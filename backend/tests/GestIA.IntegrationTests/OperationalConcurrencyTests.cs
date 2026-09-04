using System.Data;
using System.Data.Common;
using GestIA.Application;
using GestIA.Application.Common;
using GestIA.Application.Operations;
using GestIA.Application.Requests;
using GestIA.Application.Scheduling;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Requests;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure;
using GestIA.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.IntegrationTests;

public sealed class OperationalConcurrencyTests : IClassFixture<OperationalSqlDatabase>
{
    private readonly OperationalSqlDatabase database;
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly DateOnly Day = new(2026, 9, 3);
    private static readonly TestActor Actor = new();
    private static readonly DateTime Now = new TestClock().UtcNow;

    public OperationalConcurrencyTests(OperationalSqlDatabase database) => this.database = database;

    [OperationalSqlFact]
    public async Task ConcurrentRequestExecutionsCreateOneBusinessResult()
    {
        var seed = await SeedAsync();
        var request = await SeedRequestAsync(seed.OrganizationId);
        using var provider = Provider(new ReadBarrier("FROM [dbo].[OperationalRequests]"));
        var input = ClientExecution(seed.OrganizationId);

        async Task<Exception?> Execute()
        {
            await using var scope = provider.CreateAsyncScope();
            return await Record.ExceptionAsync(() => scope.ServiceProvider.GetRequiredService<IOperationalRequestService>()
                .ExecuteAsync(request, input, Token));
        }

        var outcomes = await Task.WhenAll(Execute(), Execute());
        Assert.Single(outcomes, error => error is null);
        Assert.Single(outcomes, error => error is ResourceConflictException);
        await using var context = database.Context();
        Assert.Equal(1, await context.Clients.CountAsync(item =>
            item.IdOrganization == seed.OrganizationId && item.CodeClient == "NEW"));
        Assert.Equal(OperationalRequestStatus.Completed,
            (await context.OperationalRequests.SingleAsync(item => item.IdOperationalRequest == request)).Status);
    }

    [OperationalSqlFact]
    public async Task FailureAfterClientSaveRollsBackAndSameScopeCanRetry()
    {
        var seed = await SeedAsync();
        var request = await SeedRequestAsync(seed.OrganizationId);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IOperationalRequestService>();
        var input = ClientExecution(seed.OrganizationId) with
        {
            ClientSite = new("SITE", "Site", "Street", null, null, null, "City", "State",
                "01000", "INVALID", null, null)
        };
        await Assert.ThrowsAsync<RequestValidationException>(() => service.ExecuteAsync(request, input, Token));
        await using (var context = database.Context())
        {
            Assert.False(await context.Clients.AnyAsync(item =>
                item.IdOrganization == seed.OrganizationId && item.CodeClient == "NEW"));
            Assert.Equal(OperationalRequestStatus.Approved,
                (await context.OperationalRequests.SingleAsync(item => item.IdOperationalRequest == request)).Status);
        }

        var result = await service.ExecuteAsync(request, input with { ClientSite = input.ClientSite! with { CountryCode = "MX" } }, Token);
        Assert.Equal(OperationalRequestStatus.Completed, result.Request.Status);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.ExecuteAsync(request, input, Token));
    }

    [OperationalSqlFact]
    public async Task ConcurrentCoverageCreationReservesShiftOnce()
    {
        var seed = await SeedAsync();
        using var provider = Provider(new ReadBarrier("FROM [dbo].[CoverageRecords]"));
        async Task<Exception?> Create()
        {
            await using var scope = provider.CreateAsyncScope();
            return await Record.ExceptionAsync(() => scope.ServiceProvider.GetRequiredService<IOperationsService>()
                .CreateCoverageAsync(CoverageInput(seed), Token));
        }

        var outcomes = await Task.WhenAll(Create(), Create());
        Assert.Single(outcomes, error => error is null);
        Assert.Single(outcomes, error => error is ResourceConflictException);
        await using var context = database.Context();
        Assert.Equal(1, await context.CoverageRecords.CountAsync(item => item.IdScheduledShift == seed.ShiftId));
    }

    [OperationalSqlFact]
    public async Task ConfirmationRechecksEligibilityButCancellationRemainsPossible()
    {
        var seed = await SeedAsync();
        using var provider = Provider();
        Guid coverageId;
        await using (var scope = provider.CreateAsyncScope())
        {
            coverageId = (await scope.ServiceProvider.GetRequiredService<IOperationsService>()
                .CreateCoverageAsync(CoverageInput(seed), Token)).IdCoverageRecord;
        }

        await using (var context = database.Context())
        {
            context.EligibilityRequirements.Add(EligibilityRequirement.Create(seed.OrganizationId,
                new(EligibilityRequirementTargetType.Position, null, null, seed.PositionId,
                    EligibilityRequirementType.Restriction, "BLOCK", "Restricted", null, true),
                Actor.ActorId, Actor.ActorName, Now));
            await context.SaveChangesAsync();
        }

        await using var updateScope = provider.CreateAsyncScope();
        var service = updateScope.ServiceProvider.GetRequiredService<IOperationsService>();
        var update = new UpdateCoverageRequest(seed.OrganizationId, seed.ClientId, seed.ServiceId,
            seed.ReplacementId, new TimeOnly(8, 0), new TimeOnly(16, 0), false, CoverageStatus.Confirmed, null);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.UpdateCoverageAsync(coverageId, update, Token));
        var cancelled = await service.UpdateCoverageAsync(coverageId, update with { Status = CoverageStatus.Cancelled }, Token);
        Assert.Equal(CoverageStatus.Cancelled, cancelled.Status);
    }

    [OperationalSqlFact]
    public async Task CoverageRejectsCrossTenantAndAlreadyScheduledReplacement()
    {
        var seed = await SeedAsync();
        var other = await SeedAsync();
        using var provider = Provider();
        await using (var scope = provider.CreateAsyncScope())
        {
            await Assert.ThrowsAsync<ResourceNotFoundException>(() =>
                scope.ServiceProvider.GetRequiredService<IOperationsService>().CreateCoverageAsync(
                    CoverageInput(seed) with { IdReplacementEmployee = other.ReplacementId }, Token));
        }
        await using (var context = database.Context())
        {
            context.ScheduledShifts.Add(Shift(seed.VersionId, seed.PositionId, seed.ReplacementId));
            await context.SaveChangesAsync();
        }
        await using var second = provider.CreateAsyncScope();
        await Assert.ThrowsAsync<ResourceConflictException>(() =>
            second.ServiceProvider.GetRequiredService<IOperationsService>().CreateCoverageAsync(CoverageInput(seed), Token));
    }

    [OperationalSqlFact]
    public async Task AlternateDraftCanRepeatPublishedShiftAndReplaceItAtomically()
    {
        var seed = await SeedAsync();
        var draftId = await DraftAsync(seed);
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ISchedulingService>();
        await service.CreateScheduledShiftAsync(ShiftInput(seed, draftId), Token);
        await service.PublishScheduleVersionAsync(seed.OrganizationId, seed.ClientId, seed.ServiceId, draftId, Token);
        await using var context = database.Context();
        Assert.Equal(ScheduleVersionStatus.Superseded,
            (await context.ScheduleVersions.SingleAsync(item => item.IdScheduleVersion == seed.VersionId)).Status);
        Assert.Equal(1, await context.ScheduleVersions.CountAsync(item =>
            item.IdService == seed.ServiceId && item.Status == ScheduleVersionStatus.Published));
    }

    [OperationalSqlFact]
    public async Task ConcurrentShiftCreationInOneDraftCannotDuplicateEmployeeInterval()
    {
        var seed = await SeedAsync();
        var draft = await DraftAsync(seed);
        using var provider = Provider(new ReadBarrier("FROM [dbo].[ScheduleVersions]"));
        async Task<Exception?> Create()
        {
            await using var scope = provider.CreateAsyncScope();
            return await Record.ExceptionAsync(() => scope.ServiceProvider.GetRequiredService<ISchedulingService>()
                .CreateScheduledShiftAsync(ShiftInput(seed, draft), Token));
        }

        var outcomes = await Task.WhenAll(Create(), Create());
        Assert.Single(outcomes, error => error is null);
        Assert.Single(outcomes, error => error is ResourceConflictException);
        await using var context = database.Context();
        Assert.Equal(1, await context.ScheduledShifts.CountAsync(item => item.IdScheduleVersion == draft));
    }

    [OperationalSqlFact]
    public async Task ConcurrentPublicationsLeaveOnlyOnePublishedVersion()
    {
        var seed = await SeedAsync();
        var first = await DraftAsync(seed, withShift: true);
        var second = await DraftAsync(seed, withShift: true);
        using var provider = Provider(new ReadBarrier("FROM [dbo].[ScheduleVersions]"));
        async Task Publish(Guid id)
        {
            await using var scope = provider.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<ISchedulingService>()
                .PublishScheduleVersionAsync(seed.OrganizationId, seed.ClientId, seed.ServiceId, id, Token);
        }

        await Task.WhenAll(Publish(first), Publish(second));
        await using var context = database.Context();
        Assert.Equal(1, await context.ScheduleVersions.CountAsync(item =>
            item.IdService == seed.ServiceId && item.Status == ScheduleVersionStatus.Published));
    }

    [OperationalSqlFact]
    public async Task PublicationRechecksConflictsWithOtherServices()
    {
        var seed = await SeedAsync();
        var draft = await DraftAsync(seed, withShift: true);
        await using (var context = database.Context())
        {
            var originalService = await context.Services.SingleAsync(item => item.IdService == seed.ServiceId);
            var otherService = Service.Create(seed.ClientId, originalService.IdClientSite, null, "OTHER",
                "Other", "Other service", Day, Actor.ActorId, Actor.ActorName, Now);
            var position = Position.Create(otherService.IdService, "P", new("Position", 1, null, null),
                Actor.ActorId, Actor.ActorName, Now);
            var version = Version(otherService.IdService);
            version.Publish(Actor.ActorId, Actor.ActorName, Now);
            context.AddRange(otherService, position, version, Shift(version.IdScheduleVersion, position.IdPosition, seed.EmployeeId));
            await context.SaveChangesAsync();
        }

        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        await Assert.ThrowsAsync<ResourceConflictException>(() => scope.ServiceProvider.GetRequiredService<ISchedulingService>()
            .PublishScheduleVersionAsync(seed.OrganizationId, seed.ClientId, seed.ServiceId, draft, Token));
    }

    [OperationalSqlFact]
    public async Task PublicationCannotDiscardPartialPeriodOrOperationalCoverage()
    {
        var seed = await SeedAsync();
        var draft = await DraftAsync(seed, withShift: true);
        await using (var context = database.Context())
        {
            var version = await context.ScheduleVersions.SingleAsync(item => item.IdScheduleVersion == draft);
            version.UpdateProfile(new("Partial", Day, Day, null), Actor.ActorId, Actor.ActorName, Now);
            await context.SaveChangesAsync();
        }
        using var provider = Provider();
        await using (var scope = provider.CreateAsyncScope())
        {
            await Assert.ThrowsAsync<ResourceConflictException>(() => scope.ServiceProvider.GetRequiredService<ISchedulingService>()
                .PublishScheduleVersionAsync(seed.OrganizationId, seed.ClientId, seed.ServiceId, draft, Token));
        }

        var fullDraft = await DraftAsync(seed, withShift: true);
        await using (var scope = provider.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<IOperationsService>().CreateCoverageAsync(CoverageInput(seed), Token);
            await Assert.ThrowsAsync<ResourceConflictException>(() => scope.ServiceProvider.GetRequiredService<ISchedulingService>()
                .PublishScheduleVersionAsync(seed.OrganizationId, seed.ClientId, seed.ServiceId, fullDraft, Token));
        }
    }

    [OperationalSqlFact]
    public async Task GenerationCountsExistingShiftsAndDetectsUnsavedOverlaps()
    {
        var seed = await SeedAsync();
        var draft = await DraftAsync(seed);
        await using (var context = database.Context())
        {
            var pattern = ShiftPattern.Create(seed.PositionId, "PATTERN",
                new("Pattern", null, Day, Day), Actor.ActorId, Actor.ActorName, Now);
            context.AddRange(pattern,
                ShiftSegment.Create(pattern.IdShiftPattern, new(Day.DayOfWeek,
                    new TimeOnly(8, 0), new TimeOnly(16, 0), false, 1, null), Actor.ActorId, Actor.ActorName, Now),
                ShiftSegment.Create(pattern.IdShiftPattern, new(Day.DayOfWeek,
                    new TimeOnly(9, 0), new TimeOnly(17, 0), false, 1, null), Actor.ActorId, Actor.ActorName, Now),
                ServiceAssignment.Create(seed.EmployeeId, seed.ServiceId,
                    new(seed.PositionId, ServiceAssignmentType.Primary, Day, null, true, null),
                    Actor.ActorId, Actor.ActorName, Now));
            await context.SaveChangesAsync();
        }
        using var provider = Provider();
        var request = new GenerateScheduledShiftsRequest(seed.OrganizationId, seed.ClientId, seed.ServiceId, draft, true);
        await using (var scope = provider.CreateAsyncScope())
        {
            var first = await scope.ServiceProvider.GetRequiredService<ISchedulingService>().GenerateScheduledShiftsAsync(request, Token);
            Assert.Equal(1, first.CreatedShifts);
            Assert.Equal(1, first.MissingAssignments);
        }
        await using var second = provider.CreateAsyncScope();
        var repeated = await second.ServiceProvider.GetRequiredService<ISchedulingService>().GenerateScheduledShiftsAsync(request, Token);
        Assert.Equal(0, repeated.CreatedShifts);
        Assert.Equal(1, repeated.MissingAssignments);
        await using var contextAfter = database.Context();
        Assert.Equal(1, await contextAfter.ScheduledShifts.CountAsync(item => item.IdScheduleVersion == draft));
    }

    [OperationalSqlFact]
    public async Task ExecutionReloadsRequestPreviouslyTrackedByPreview()
    {
        var seed = await SeedAsync();
        var request = await SeedRequestAsync(seed.OrganizationId);
        using var provider = Provider();
        await using var staleScope = provider.CreateAsyncScope();
        var staleService = staleScope.ServiceProvider.GetRequiredService<IOperationalRequestService>();
        var input = ClientExecution(seed.OrganizationId);
        Assert.True((await staleService.PreviewExecutionAsync(request, input, Token)).CanExecute);
        await using (var executingScope = provider.CreateAsyncScope())
        {
            await executingScope.ServiceProvider.GetRequiredService<IOperationalRequestService>().ExecuteAsync(request, input, Token);
        }

        await Assert.ThrowsAsync<ResourceConflictException>(() =>
            staleService.ExecuteAsync(request, input with { Client = input.Client! with { CodeClient = "DUP", Rfc = "DUP010101AA1" } }, Token));
        await using var context = database.Context();
        Assert.False(await context.Clients.AnyAsync(item => item.IdOrganization == seed.OrganizationId && item.CodeClient == "DUP"));
    }

    [OperationalSqlFact]
    public async Task ConcurrentCoverageDecisionsCannotOverwriteTerminalState()
    {
        var seed = await SeedAsync();
        using var setup = Provider();
        Guid id;
        var update = new UpdateCoverageRequest(seed.OrganizationId, seed.ClientId, seed.ServiceId,
            seed.ReplacementId, new TimeOnly(8, 0), new TimeOnly(16, 0), false, CoverageStatus.Confirmed, null);
        await using (var scope = setup.CreateAsyncScope())
        {
            var operations = scope.ServiceProvider.GetRequiredService<IOperationsService>();
            id = (await operations.CreateCoverageAsync(CoverageInput(seed), Token)).IdCoverageRecord;
            await operations.UpdateCoverageAsync(id, update, Token);
        }
        using var provider = Provider(new ReadBarrier("FROM [dbo].[CoverageRecords]"));
        async Task<Exception?> Decide(CoverageStatus status)
        {
            await using var scope = provider.CreateAsyncScope();
            return await Record.ExceptionAsync(() => scope.ServiceProvider.GetRequiredService<IOperationsService>()
                .UpdateCoverageAsync(id, update with { Status = status }, Token));
        }
        var outcomes = await Task.WhenAll(Decide(CoverageStatus.Completed), Decide(CoverageStatus.Cancelled));
        Assert.Single(outcomes, error => error is null);
        Assert.Single(outcomes, error => error is GestIA.Domain.Common.DomainRuleException);
    }

    [OperationalSqlFact]
    public async Task CoverageRequestJoinsOuterTransactionAndCannotExecuteTwice()
    {
        var seed = await SeedAsync();
        var id = await SeedRequestAsync(seed.OrganizationId);
        await using (var context = database.Context())
        {
            var request = await context.OperationalRequests.SingleAsync(item => item.IdOperationalRequest == id);
            request.UpdateDetails(seed.ClientId, seed.ServiceId, OperationalRequestType.CoverageSupport,
                request.Priority, request.Title, request.Description, request.RequestedByName, null,
                Actor.ActorId, Actor.ActorName, Now);
            await context.SaveChangesAsync();
        }
        var input = new ExecuteOperationalRequestRequest(seed.OrganizationId, null, null, null, null, null, null, null,
            new(seed.ShiftId, seed.ReplacementId, new TimeOnly(8, 0), new TimeOnly(16, 0), false, CoverageStatus.Requested, null, seed.ReasonId));
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IOperationalRequestService>();
        var result = await service.ExecuteAsync(id, input, Token);
        Assert.Equal(OperationalRequestStatus.Completed, result.Request.Status);
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.ExecuteAsync(id, input, Token));
        await using var after = database.Context();
        var coverage = await after.CoverageRecords.SingleAsync(item => item.IdScheduledShift == seed.ShiftId);
        Assert.Equal(coverage.IdCoverageRecord, result.ExecutedEntityId);
        Assert.Equal(CoverageStatus.Requested, coverage.Status);
    }

    [OperationalSqlFact]
    public async Task PublicationRacingAttendanceCannotRetireAUsedVersion()
    {
        var seed = await SeedAsync();
        var draft = await DraftAsync(seed, withShift: true);
        using var provider = Provider(new ReadBarrier("[dbo].[ScheduleVersions]"));
        async Task<Exception?> Publish()
        {
            await using var scope = provider.CreateAsyncScope();
            return await Record.ExceptionAsync(() => scope.ServiceProvider.GetRequiredService<ISchedulingService>()
                .PublishScheduleVersionAsync(seed.OrganizationId, seed.ClientId, seed.ServiceId, draft, Token));
        }
        async Task<Exception?> Attend()
        {
            await using var scope = provider.CreateAsyncScope();
            return await Record.ExceptionAsync(() => scope.ServiceProvider.GetRequiredService<IOperationsService>()
                .UpsertAttendanceAsync(new(seed.OrganizationId, seed.ClientId, seed.ServiceId, seed.ShiftId,
                    AttendanceStatus.Present, new TimeOnly(8, 0), new TimeOnly(16, 0), 0, null, null, null), Token));
        }

        var outcomes = await Task.WhenAll(Publish(), Attend());
        Assert.Single(outcomes, error => error is null);
        Assert.Single(outcomes, error => error is ResourceConflictException);
        await using var context = database.Context();
        var original = await context.ScheduleVersions.SingleAsync(item => item.IdScheduleVersion == seed.VersionId);
        var hasAttendance = await context.AttendanceRecords.AnyAsync(item => item.IdScheduledShift == seed.ShiftId);
        Assert.Equal(original.Status == ScheduleVersionStatus.Published, hasAttendance);
    }

    [OperationalSqlFact]
    public async Task CoverageReasonIsRequiredScopedActiveAndPreservedOnCancellation()
    {
        var seed = await SeedAsync();
        var other = await SeedAsync();
        using var provider = Provider();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IOperationsService>();
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCoverageAsync(CoverageInput(seed) with { IdCoverageReason = null }, Token));
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCoverageAsync(CoverageInput(seed) with { IdCoverageReason = other.ReasonId }, Token));
        var coverage = await service.CreateCoverageAsync(CoverageInput(seed), Token);
        Assert.Equal(seed.ReasonId, coverage.IdCoverageReason);
        await using (var context = database.Context())
        {
            var reason = await context.BusinessCatalogItems.SingleAsync(item => item.IdBusinessCatalogItem == seed.ReasonId);
            reason.Deactivate(Actor.ActorId, Actor.ActorName, Now);
            await context.SaveChangesAsync();
        }
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.CreateCoverageAsync(CoverageInput(seed), Token));
        var cancelled = await service.UpdateCoverageAsync(coverage.IdCoverageRecord,
            new(seed.OrganizationId, seed.ClientId, seed.ServiceId, seed.ReplacementId,
                new(8,0), new(16,0), false, CoverageStatus.Cancelled, null), Token);
        Assert.Equal(seed.ReasonId, cancelled.IdCoverageReason);
    }

    [OperationalSqlFact]
    public async Task LegacyCoverageBackfillPreservesNotesAndLinksOnlyItsOrganizationReason()
    {
        var seed = await SeedAsync();
        await using var context = database.Context();
        const string notes = "Motivo: Falta\nObservaciones: Historic note";
        var coverage = CoverageRecord.Create(seed.ShiftId, seed.EmployeeId,
            new(seed.ReplacementId, new(8,0), new(16,0), false, CoverageStatus.Requested, notes), Actor.ActorId, Actor.ActorName, Now);
        context.Add(coverage);
        await context.SaveChangesAsync();
        var sql = new GestIA.Infrastructure.Persistence.Migrations.CoverageCatalogReference()
            .UpOperations.OfType<Microsoft.EntityFrameworkCore.Migrations.Operations.SqlOperation>().First().Sql;
        await context.Database.ExecuteSqlRawAsync(sql, Token);
        await context.Entry(coverage).ReloadAsync(Token);
        Assert.Equal(seed.ReasonId, coverage.IdCoverageReason);
        Assert.Equal(notes, coverage.Notes);
    }

    private ServiceProvider Provider(DbCommandInterceptor? interceptor = null)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:GestIa"] = database.ConnectionString
        }).Build();
        var services = new ServiceCollection().AddLogging().AddApplication().AddInfrastructure(configuration);
        services.AddSingleton<IActorContext>(Actor);
        services.AddSingleton<IClock>(new TestClock());
        if (interceptor is not null)
        {
            services.AddDbContext<GestIaDbContext>(options => options.AddInterceptors(interceptor));
        }
        return services.BuildServiceProvider();
    }

    private async Task<Seed> SeedAsync()
    {
        await using var context = database.Context();
        var organization = Organization.Create(Guid.NewGuid().ToString("N")[..24], "Test", null, Actor.ActorId, Actor.ActorName, Now);
        var client = Client.Create(organization.IdOrganization, "CLIENT", "Client", "EXA010101AA1", Actor.ActorId, Actor.ActorName, Now);
        var site = ClientSite.Create(client.IdClient, "SITE", "Site", "Street", "City", "State", "01000", Actor.ActorId, Actor.ActorName, Now);
        var service = Service.Create(client.IdClient, site.IdClientSite, null, "SERVICE", "Service", "Service", Day, Actor.ActorId, Actor.ActorName, Now);
        var position = Position.Create(service.IdService, "POSITION", new("Position", 1, null, null), Actor.ActorId, Actor.ActorName, Now);
        var employee = Employee.Create(organization.IdOrganization, "EMPLOYEE", "Employee", null, Day, Actor.ActorId, Actor.ActorName, Now);
        var replacement = Employee.Create(organization.IdOrganization, "REPLACEMENT", "Replacement", null, Day, Actor.ActorId, Actor.ActorName, Now);
        var version = Version(service.IdService);
        version.Publish(Actor.ActorId, Actor.ActorName, Now);
        var shift = Shift(version.IdScheduleVersion, position.IdPosition, employee.IdEmployee);
        context.AddRange(organization, client, site, service, position, employee, replacement, version, shift);
        var country = BusinessCatalogItem.Create(organization.IdOrganization, new(BusinessCatalogItemType.Country, "MX", "Mexico", null), Actor.ActorId, Actor.ActorName, Now);
        var state = BusinessCatalogItem.Create(organization.IdOrganization, new(BusinessCatalogItemType.State, "STATE", "State", null, IdParentCatalogItem: country.IdBusinessCatalogItem), Actor.ActorId, Actor.ActorName, Now);
        var city = BusinessCatalogItem.Create(organization.IdOrganization, new(BusinessCatalogItemType.City, "CITY", "City", null, IdParentCatalogItem: state.IdBusinessCatalogItem), Actor.ActorId, Actor.ActorName, Now);
        context.AddRange(country, state, city);
        var reason = BusinessCatalogItem.Create(organization.IdOrganization, new(BusinessCatalogItemType.CoverageReason, "FALTA", "Falta", null), Actor.ActorId, Actor.ActorName, Now);
        context.Add(reason);
        await context.SaveChangesAsync();
        return new(organization.IdOrganization, client.IdClient, service.IdService, position.IdPosition,
            employee.IdEmployee, replacement.IdEmployee, version.IdScheduleVersion, shift.IdScheduledShift, reason.IdBusinessCatalogItem);
    }

    private async Task<Guid> SeedRequestAsync(Guid organizationId)
    {
        await using var context = database.Context();
        var request = OperationalRequest.Create(organizationId, null, null, "REQ", OperationalRequestType.NewClient,
            OperationalRequestPriority.Medium, "New client", "Description", "User", null, Actor.ActorId, Actor.ActorName, Now);
        foreach (var status in new[] { OperationalRequestStatus.Submitted, OperationalRequestStatus.InReview, OperationalRequestStatus.Approved })
        {
            request.ChangeStatus(status, null, Actor.ActorId, Actor.ActorName, Now);
        }
        context.Add(request);
        await context.SaveChangesAsync();
        return request.IdOperationalRequest;
    }

    private async Task<Guid> DraftAsync(Seed seed, bool withShift = false)
    {
        await using var context = database.Context();
        var version = Version(seed.ServiceId);
        context.Add(version);
        if (withShift)
        {
            context.Add(Shift(version.IdScheduleVersion, seed.PositionId, seed.EmployeeId));
        }
        await context.SaveChangesAsync();
        return version.IdScheduleVersion;
    }

    private static ExecuteOperationalRequestRequest ClientExecution(Guid organizationId) =>
        new(organizationId, "Execute", new("NEW", "New client", null, "NEW010101AA1", null, null, null,
            null, null, null, null, null, null), null, null, null, null, null, null);

    private static CreateCoverageRequest CoverageInput(Seed seed) =>
        new(seed.OrganizationId, seed.ClientId, seed.ServiceId, seed.ShiftId, seed.ReplacementId,
            new TimeOnly(8, 0), new TimeOnly(16, 0), false, CoverageStatus.Requested, null, seed.ReasonId);

    private static CreateScheduledShiftRequest ShiftInput(Seed seed, Guid versionId) =>
        new(seed.OrganizationId, seed.ClientId, seed.ServiceId, versionId, seed.PositionId, seed.EmployeeId,
            Day, new TimeOnly(8, 0), new TimeOnly(16, 0), false, null);

    private static ScheduleVersion Version(Guid serviceId) =>
        ScheduleVersion.Create(serviceId, new("Version", Day, Day.AddDays(1), null), Actor.ActorId, Actor.ActorName, Now);

    private static ScheduledShift Shift(Guid versionId, Guid positionId, Guid employeeId) =>
        ScheduledShift.Create(versionId, new(positionId, employeeId, Day, new TimeOnly(8, 0),
            new TimeOnly(16, 0), false, null), Actor.ActorId, Actor.ActorName, Now);

    private sealed record Seed(Guid OrganizationId, Guid ClientId, Guid ServiceId, Guid PositionId,
        Guid EmployeeId, Guid ReplacementId, Guid VersionId, Guid ShiftId, Guid ReasonId);

    private sealed class TestActor : IActorContext
    {
        public Guid ActorId { get; } = Guid.NewGuid();
        public string ActorName => "Operational tests";
    }

    private sealed class TestClock : IClock
    {
        public DateTime UtcNow => new(2026, 9, 3, 12, 0, 0, DateTimeKind.Utc);
    }

    private sealed class ReadBarrier(string table) : DbCommandInterceptor
    {
        private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int readers;

        public override async ValueTask<DbDataReader> ReaderExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, DbDataReader result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase) &&
                command.CommandText.Contains(table, StringComparison.Ordinal) &&
                Interlocked.Increment(ref readers) <= 2)
            {
                Assert.Equal(IsolationLevel.Serializable,
                    eventData.Context!.Database.CurrentTransaction!.GetDbTransaction().IsolationLevel);
                if (Volatile.Read(ref readers) == 2)
                {
                    ready.TrySetResult();
                }
                await ready.Task.WaitAsync(TimeSpan.FromSeconds(20), cancellationToken);
            }
            return result;
        }
    }
}

public sealed class OperationalSqlFactAttribute : FactAttribute
{
    public OperationalSqlFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GESTIA_OPERATIONAL_TEST_SQLSERVER")))
        {
            Skip = "Set GESTIA_OPERATIONAL_TEST_SQLSERVER to a SQL Server connection with CREATE DATABASE permission.";
        }
    }
}

public sealed class OperationalSqlDatabase : IAsyncLifetime
{
    private readonly string databaseName = $"GestIA_OperationalTests_{Guid.NewGuid():N}";
    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable("GESTIA_OPERATIONAL_TEST_SQLSERVER");
        if (string.IsNullOrWhiteSpace(configured))
        {
            return;
        }
        // Always create a unique database; never run schema creation against the configured catalog.
        var connection = new SqlConnectionStringBuilder(configured) { InitialCatalog = databaseName };
        ConnectionString = connection.ConnectionString;
        await using var context = Context();
        await context.Database.EnsureCreatedAsync();
    }

    public GestIaDbContext Context() => new(new DbContextOptionsBuilder<GestIaDbContext>()
        .UseSqlServer(ConnectionString, options => options.EnableRetryOnFailure()).Options);

    public async Task DisposeAsync()
    {
        if (string.IsNullOrEmpty(ConnectionString))
        {
            return;
        }
        if (new SqlConnectionStringBuilder(ConnectionString).InitialCatalog != databaseName)
        {
            throw new InvalidOperationException("Refusing to delete a database not created by this fixture.");
        }
        await using var context = Context();
        await context.Database.EnsureDeletedAsync();
    }
}
