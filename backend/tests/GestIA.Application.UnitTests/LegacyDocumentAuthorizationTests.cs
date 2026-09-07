using GestIA.Application.Common;
using GestIA.Application.Documents;
using GestIA.Application.Workforce;
using GestIA.Domain.Workforce;

namespace GestIA.Application.UnitTests;

public sealed class LegacyDocumentAuthorizationTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task EmployeeDetailAndListsHideLegacyCollectionsWithoutSensitiveRead(bool permitted)
    {
        var repository = new Repository();
        var service = new WorkforceService(repository, new Unit(), new Actor(permitted), new Clock(), null!, null!);
        var detail = await service.GetEmployeeAsync(repository.Employee.IdOrganization, repository.Employee.IdEmployee, default);
        var documents = await service.ListDocumentsAsync(repository.Employee.IdOrganization, repository.Employee.IdEmployee, default);
        var evaluations = await service.ListEvaluationsAsync(repository.Employee.IdOrganization, repository.Employee.IdEmployee, default);
        Assert.Equal(permitted ? 1 : 0, detail.Documents.Count);
        Assert.Equal(permitted ? 1 : 0, documents.Count);
        Assert.Empty(evaluations);
        Assert.Equal(permitted ? 4 : 0, repository.CollectionReads);
    }

    [Fact]
    public async Task SensitivePermissionDoesNotBypassEmployeeOrganization()
    {
        var repository = new Repository();
        var service = new WorkforceService(repository, new Unit(), new Actor(true), new Clock(), null!, null!);
        await Assert.ThrowsAsync<ResourceNotFoundException>(() =>
            service.GetEmployeeAsync(Guid.NewGuid(), repository.Employee.IdEmployee, default));
        Assert.Equal(0, repository.CollectionReads);
    }

    [Fact]
    public async Task SensitiveReadAloneCannotArchiveLegacyDocumentsOrEvaluations()
    {
        var repository = new Repository();
        var service = new WorkforceService(repository, new Unit(), new Actor(true), new Clock(), null!, null!);
        await Assert.ThrowsAsync<ResourceForbiddenException>(() =>
            service.DeactivateDocumentAsync(repository.Employee.IdOrganization, repository.Employee.IdEmployee, Guid.NewGuid(), default));
        await Assert.ThrowsAsync<ResourceForbiddenException>(() =>
            service.DeactivateEvaluationAsync(repository.Employee.IdOrganization, repository.Employee.IdEmployee, Guid.NewGuid(), default));
    }

    private sealed class Actor(bool read) : IActorContext
    {
        public Guid ActorId => Guid.Empty;
        public string ActorName => "Tester";
        public bool HasPermission(string permission) => read && permission == BusinessDocumentPermissions.SensitiveRead;
    }

    private sealed class Clock : IClock
    {
        public DateTime UtcNow => DateTime.UtcNow;

        // Doble de prueba: la fecha sale del instante simulado, sin huso.
        public DateOnly Today => DateOnly.FromDateTime(UtcNow);

        // Doble de prueba: sin huso, la hora local es la UTC.
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }

    private sealed class Unit : IUnitOfWork
    {
        public Task SaveChangesAsync(CancellationToken cancellationToken = default) => throw new InvalidOperationException("Unexpected write");
    }

    private sealed class Repository : IWorkforceRepository
    {
        // El listado de la pantalla no interviene en esta prueba, que es de autorización de
        // documentos heredados. Los miembros nuevos del contrato se cumplen en vacío.
        public Task<(IReadOnlyList<EmployeeListItemResponse> Items, int TotalCount)> SearchEmployeesAsync(
            EmployeeSearchCriteria criteria,
            IReadOnlyCollection<EmployeeDocumentType> requiredDocuments,
            CancellationToken cancellationToken) =>
            Task.FromResult(((IReadOnlyList<EmployeeListItemResponse>)[], 0));

        public Task<IReadOnlyList<EmployeeDocumentType>> ListRequiredDocumentTypesAsync(
            Guid idOrganization,
            CancellationToken cancellationToken) =>
            Task.FromResult((IReadOnlyList<EmployeeDocumentType>)[]);

        public Task<IReadOnlyList<(Guid Id, string Name)>> ListUsedJobPositionsAsync(
            Guid idOrganization,
            CancellationToken cancellationToken) =>
            Task.FromResult((IReadOnlyList<(Guid, string)>)[]);

        public Task<IReadOnlyList<string>> ListEmployeeMunicipalitiesAsync(
            Guid idOrganization,
            CancellationToken cancellationToken) =>
            Task.FromResult((IReadOnlyList<string>)[]);

        public Task<IReadOnlyList<EmployeeAssignmentResponse>> ListAssignmentsAsync(
            Guid idOrganization,
            Guid idEmployee,
            DateOnly today,
            CancellationToken cancellationToken) =>
            Task.FromResult((IReadOnlyList<EmployeeAssignmentResponse>)[]);
        public Employee Employee { get; } = Employee.Create(Guid.NewGuid(), "EMP-1", "Test Employee", null,
            new DateOnly(2026, 9, 3), Guid.NewGuid(), "Tester", DateTime.UtcNow);
        public int CollectionReads { get; private set; }
        public Task<Employee?> GetEmployeeAsync(Guid idOrganization, Guid idEmployee, CancellationToken cancellationToken) =>
            Task.FromResult<Employee?>(Employee.IdOrganization == idOrganization && Employee.IdEmployee == idEmployee ? Employee : null);
        public Task<IReadOnlyList<EmployeeDocument>> ListDocumentsAsync(Guid idEmployee, CancellationToken cancellationToken)
        {
            CollectionReads++;
            return Task.FromResult<IReadOnlyList<EmployeeDocument>>([EmployeeDocument.Create(Employee.IdOrganization, idEmployee,
                new EmployeeDocumentProfile(EmployeeDocumentType.EmploymentApplication, EmployeeDocumentStatus.Pending,
                    "secret-number", null, null, null, "business-documents/private.pdf", "private-notes"),
                Guid.NewGuid(), "Tester", DateTime.UtcNow)]);
        }
        public Task<IReadOnlyList<EmployeeEvaluation>> ListEvaluationsAsync(Guid idEmployee, CancellationToken cancellationToken)
        {
            CollectionReads++;
            return Task.FromResult<IReadOnlyList<EmployeeEvaluation>>([]);
        }
        public Task<EmployeeListResult> ListEmployeesAsync(EmployeeQuery query, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> OrganizationExistsAsync(Guid idOrganization, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> IsEmployeeCodeInUseAsync(Guid idOrganization, string codeEmployee, Guid? excludedEmployeeId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> IsRfcInUseAsync(Guid idOrganization, string rfc, Guid? excludedEmployeeId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> IsCurpInUseAsync(Guid idOrganization, string curp, Guid? excludedEmployeeId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> IsSocialSecurityNumberInUseAsync(Guid idOrganization, string socialSecurityNumber, Guid? excludedEmployeeId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task AddEmployeeAsync(Employee employee, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeDocument?> GetDocumentAsync(Guid idEmployee, Guid idEmployeeDocument, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task AddDocumentAsync(EmployeeDocument document, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeEvaluation?> GetEvaluationAsync(Guid idEmployee, Guid idEmployeeEvaluation, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> IsEvaluationInUseAsync(Guid idEmployee, EmployeeEvaluationType evaluationType, DateOnly evaluatedDate, Guid? excludedEmployeeEvaluationId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task AddEvaluationAsync(EmployeeEvaluation evaluation, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
