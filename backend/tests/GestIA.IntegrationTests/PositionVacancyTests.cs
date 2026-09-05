using GestIA.Application.Planning;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// La vacancia de una posición: elementos requeridos menos asignaciones vigentes a una fecha.
///
/// Es una proyección, no una columna: se calcula en cada consulta. Lo que estas pruebas fijan es
/// qué cuenta como "vigente" y qué pasa cuando sobra gente, que es el caso que el control de
/// capacidad necesita ver.
///
/// Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.
/// </summary>
public sealed class PositionVacancyTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly Guid ActorId = Guid.Parse("0f4a7f4f-1f0e-4a35-8f2e-3f9d5a6b7c80");
    private const string ActorName = "Pruebas";
    private static readonly DateTime Now = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2026, 9, 5);
    private static readonly CancellationToken Token = CancellationToken.None;

    [OperationalSqlFact]
    public async Task APositionWithNoAssignmentsIsFullyVacant()
    {
        var seed = await SeedAsync("VAC", requiredWorkers: 3);

        var position = Assert.Single(await VacancyAsync(seed.ServiceId, Today));

        Assert.Equal(3, position.RequiredWorkerCount);
        Assert.Equal(0, position.AssignedWorkerCount);
        Assert.Equal(3, position.Vacancy);
        Assert.True(position.HasVacancy);
        Assert.False(position.IsOverstaffed);
    }

    [OperationalSqlFact]
    public async Task APositionFullyStaffedHasNoVacancy()
    {
        var seed = await SeedAsync("LLE", requiredWorkers: 2);
        await AssignAsync(seed, count: 2, start: Today.AddDays(-10), end: null);

        var position = Assert.Single(await VacancyAsync(seed.ServiceId, Today));

        Assert.Equal(2, position.AssignedWorkerCount);
        Assert.Equal(0, position.Vacancy);
        Assert.False(position.HasVacancy);
        Assert.False(position.IsOverstaffed);
    }

    /// <summary>
    /// El caso que decidiste no esconder: si hay más gente asignada que elementos requeridos, la
    /// vacancia sale <b>negativa</b>.
    ///
    /// Recortarla a cero daría un número que se ve correcto y ocultaría un sobrecubrimiento que
    /// nadie autorizó, que es justo lo que el control de capacidad tiene que detectar.
    /// </summary>
    [OperationalSqlFact]
    public async Task ExtraPeopleShowAsNegativeVacancyInsteadOfBeingHidden()
    {
        var seed = await SeedAsync("EXC", requiredWorkers: 2);
        await AssignAsync(seed, count: 3, start: Today.AddDays(-10), end: null);

        var position = Assert.Single(await VacancyAsync(seed.ServiceId, Today));

        Assert.Equal(3, position.AssignedWorkerCount);
        Assert.Equal(-1, position.Vacancy);
        Assert.True(position.IsOverstaffed);
        Assert.False(position.HasVacancy);
    }

    [OperationalSqlFact]
    public async Task AnAssignmentThatEndedBeforeTheDateDoesNotCount()
    {
        var seed = await SeedAsync("TER", requiredWorkers: 1);
        await AssignAsync(seed, count: 1, start: Today.AddDays(-30), end: Today.AddDays(-1));

        Assert.Equal(1, Assert.Single(await VacancyAsync(seed.ServiceId, Today)).Vacancy);
    }

    /// <summary>
    /// El día en que la asignación termina todavía cuenta: quien la tiene hasta el 5 sigue
    /// cubriendo el 5. La frontera importa porque el tablero se consulta justo ese día.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheLastDayOfAnAssignmentStillCounts()
    {
        var seed = await SeedAsync("FRO", requiredWorkers: 1);
        await AssignAsync(seed, count: 1, start: Today.AddDays(-30), end: Today);

        Assert.Equal(0, Assert.Single(await VacancyAsync(seed.ServiceId, Today)).Vacancy);
        Assert.Equal(1, Assert.Single(await VacancyAsync(seed.ServiceId, Today.AddDays(1))).Vacancy);
    }

    [OperationalSqlFact]
    public async Task AnAssignmentThatStartsLaterDoesNotCountYet()
    {
        var seed = await SeedAsync("FUT", requiredWorkers: 1);
        await AssignAsync(seed, count: 1, start: Today.AddDays(5), end: null);

        Assert.Equal(1, Assert.Single(await VacancyAsync(seed.ServiceId, Today)).Vacancy);
        Assert.Equal(0, Assert.Single(await VacancyAsync(seed.ServiceId, Today.AddDays(5))).Vacancy);
    }

    /// <summary>
    /// Una asignación dada de baja no cubre nada. No lo hace esta expresión: lo hace el filtro
    /// global de borrado lógico, y por eso la regla no tiene que repetirlo.
    /// </summary>
    [OperationalSqlFact]
    public async Task AnInactiveAssignmentDoesNotCount()
    {
        var seed = await SeedAsync("BAJ", requiredWorkers: 1);
        await AssignAsync(seed, count: 1, start: Today.AddDays(-10), end: null);

        Assert.Equal(0, Assert.Single(await VacancyAsync(seed.ServiceId, Today)).Vacancy);

        await using (var context = database.Context())
        {
            var assignment = await context.ServiceAssignments.FirstAsync(item => item.IdPosition == seed.PositionId);
            assignment.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        Assert.Equal(1, Assert.Single(await VacancyAsync(seed.ServiceId, Today)).Vacancy);
    }

    /// <summary>
    /// La vacancia de un servicio de otra organización no se ve, y no porque la consulta lo
    /// filtre a mano: lo hace el filtro global con la organización que fijó el guard.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheVacancyOfAnotherOrganizationIsNotVisible()
    {
        var mine = await SeedAsync("MIA", requiredWorkers: 1);
        var other = await SeedAsync("OTR", requiredWorkers: 1);

        database.Organization.SetAuthorizedOrganization(other.OrganizationId);
        Assert.Empty(await VacancyAsync(mine.ServiceId, Today));

        database.Organization.SetAuthorizedOrganization(mine.OrganizationId);
        Assert.Single(await VacancyAsync(mine.ServiceId, Today));
    }

    private async Task<IReadOnlyList<PositionVacancyResponse>> VacancyAsync(Guid idService, DateOnly date)
    {
        await using var context = database.Context();
        return await new PlanningRepository(context).ListPositionVacancyAsync(idService, date, Token);
    }

    private async Task AssignAsync(Seed seed, int count, DateOnly start, DateOnly? end)
    {
        await using var context = database.Context();

        for (var index = 0; index < count; index++)
        {
            var employee = Employee.Create(
                seed.OrganizationId, $"{seed.Prefix}-E{index}", $"Empleado {index}", null,
                Today.AddYears(-1), ActorId, ActorName, Now);

            context.Add(employee);
            context.Add(ServiceAssignment.Create(
                seed.OrganizationId, employee.IdEmployee, seed.ServiceId,
                new(seed.PositionId, ServiceAssignmentType.Primary, start, end, index == 0, null),
                ActorId, ActorName, Now));
        }

        await context.SaveChangesAsync();
    }

    private async Task<Seed> SeedAsync(string prefix, int requiredWorkers)
    {
        database.Organization.Clear();
        database.Reason.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Organización {prefix}", null, ActorId, ActorName, Now);
        var client = Client.Create(
            organization.IdOrganization, $"{prefix}-CLI", "Cliente", "EXA010101AA1", ActorId, ActorName, Now);
        var site = ClientSite.Create(
            client.IdClient, $"{prefix}-SED", "Sede", "Calle", "Ciudad", "Estado", "01000", ActorId, ActorName, Now);
        var service = Service.Create(
            organization.IdOrganization, client.IdClient, site.IdClientSite, null,
            $"{prefix}-SER", "Servicio", "Servicio", Today.AddYears(-1), ActorId, ActorName, Now);
        var position = Position.Create(
            organization.IdOrganization, service.IdService, $"{prefix}-PUE",
            new("Puesto", requiredWorkers, null, null), ActorId, ActorName, Now);

        context.AddRange(organization, client, site, service, position);
        await context.SaveChangesAsync();

        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);

        return new(prefix, organization.IdOrganization, service.IdService, position.IdPosition);
    }

    private sealed record Seed(string Prefix, Guid OrganizationId, Guid ServiceId, Guid PositionId);
}
