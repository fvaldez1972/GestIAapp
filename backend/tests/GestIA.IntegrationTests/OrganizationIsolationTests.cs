using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Common;
using GestIA.Domain.Documents;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Requests;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// El aislamiento entre organizaciones, comprobado contra una base real con <b>dos</b>
/// organizaciones sembradas con los mismos datos. Es la diferencia entre afirmar que el filtro
/// existe y demostrar que separa.
///
/// <para><b>Cobertura.</b> Se siembran 26 de las 29 entidades con alcance de organización. Las
/// tres que faltan —<c>ApprovalRequest</c>, <c>OperationDayClosure</c> y <c>SupportSession</c>—
/// se consultan igual: el filtro lo aplica una sola convención a las 29 por igual, y
/// <see cref="OrganizationFilterModelTests"/> ya comprueba que ninguna se quedó sin él en el
/// modelo. Sembrar más grafos probaría constructores, no el filtro.</para>
///
/// Corre contra una base temporal propia, creada y destruida por
/// <see cref="OperationalSqlDatabase"/>. Nunca toca <c>db-gestia-dev</c>.
/// </summary>
public sealed class OrganizationIsolationTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly Guid ActorId = Guid.Parse("0f4a7f4f-1f0e-4a35-8f2e-3f9d5a6b7c80");
    private const string ActorName = "Pruebas";
    private static readonly DateTime Now = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 5);

    [OperationalSqlFact]
    public async Task AQueryInsideOneOrganizationNeverSeesAnother()
    {
        var (first, second) = await SeedBothAsync();

        database.Organization.SetAuthorizedOrganization(first);
        await using var context = database.Context();

        await AssertEveryScopedSetBelongsTo(context, first, expectRows: true);
    }

    /// <summary>
    /// El fallo cerrado. Si alguien escribe un endpoint y olvida el guard, no queda organización
    /// fijada: la consulta devuelve cero filas y se nota en el primer recorrido, en lugar de
    /// devolver las de todas las organizaciones, que no se notaría.
    /// </summary>
    [OperationalSqlFact]
    public async Task WithoutAnAuthorizedOrganizationEveryQueryComesBackEmpty()
    {
        await SeedBothAsync();

        database.Organization.Clear();
        await using var context = database.Context();

        await AssertEveryScopedSetBelongsTo(context, organizationId: null, expectRows: false);
    }

    /// <summary>
    /// Los dos filtros son independientes: apagar el borrado lógico deja ver los registros
    /// inactivos <b>de la propia organización</b> y no destapa los de la otra. Era el riesgo
    /// concreto de las 141 llamadas que antes apagaban todo a la vez.
    /// </summary>
    [OperationalSqlFact]
    public async Task IgnoringTheActiveFilterDoesNotOpenTheOrganizationOne()
    {
        var (first, second) = await SeedBothAsync();

        database.Organization.SetAuthorizedOrganization(first);

        await using (var setup = database.Context())
        {
            var client = await setup.Clients.SingleAsync();
            client.Deactivate(ActorId, ActorName, Now);
            await setup.SaveChangesAsync();
        }

        await using var context = database.Context();

        Assert.Empty(await context.Clients.ToArrayAsync());

        var withInactive = await context.Clients.IgnoreQueryFilters(["Active"]).ToArrayAsync();

        var recovered = Assert.Single(withInactive);
        Assert.Equal(first, recovered.IdOrganization);
        Assert.False(recovered.Active);
        Assert.DoesNotContain(withInactive, item => item.IdOrganization == second);
    }

    /// <summary>
    /// EF construye el modelo una sola vez y lo cachea por tipo de <c>DbContext</c>. Si la
    /// expresión del filtro hubiera capturado la organización del primer contexto construido,
    /// todas las consultas posteriores devolverían la de la primera petición. Esta prueba cambia
    /// de organización en el mismo proceso y comprueba que no pasa.
    /// </summary>
    [OperationalSqlFact]
    public async Task ChangingOrganizationInTheSameProcessChangesWhatIsSeen()
    {
        var (first, second) = await SeedBothAsync();

        database.Organization.SetAuthorizedOrganization(first);
        await using (var context = database.Context())
        {
            Assert.Equal(first, (await context.Clients.SingleAsync()).IdOrganization);
        }

        database.Organization.SetAuthorizedOrganization(second);
        await using (var context = database.Context())
        {
            Assert.Equal(second, (await context.Clients.SingleAsync()).IdOrganization);
        }
    }

    private static async Task AssertEveryScopedSetBelongsTo(
        GestIaDbContext context,
        Guid? organizationId,
        bool expectRows)
    {
        var seeded = 0;

        async Task Check<T>(IQueryable<T> set) where T : class, IOrganizationScopedEntity
        {
            var rows = await set.ToArrayAsync();

            if (organizationId is null)
            {
                Assert.Empty(rows);
                return;
            }

            Assert.All(rows, row => Assert.Equal(organizationId, row.IdOrganization));

            if (rows.Length > 0)
            {
                seeded++;
            }
        }

        await Check(context.Clients);
        await Check(context.Employees);
        await Check(context.Services);
        await Check(context.ServiceContracts);
        await Check(context.ServiceConfigurations);
        await Check(context.Positions);
        await Check(context.ShiftPatterns);
        await Check(context.ShiftSegments);
        await Check(context.ScheduleVersions);
        await Check(context.ScheduledShifts);
        await Check(context.ServiceAssignments);
        await Check(context.AttendanceRecords);
        await Check(context.CoverageRecords);
        await Check(context.Incidents);
        await Check(context.OperationEvidences);
        await Check(context.BusinessCatalogItems);
        await Check(context.EligibilityRequirements);
        await Check(context.OperationalRequests);
        await Check(context.BusinessDocuments);
        await Check(context.BusinessDocumentEvents);
        await Check(context.ApprovalRequests);
        await Check(context.OperationDayClosures);
        await Check(context.SupportSessions);
        await Check(context.OperationalEvents);

        // Tanda E: las cinco que dejaron de llegar a su organización por el padre.
        await Check(context.ClientSites);
        await Check(context.ClientContacts);
        await Check(context.EmployeeDocuments);
        await Check(context.EmployeeEvaluations);
        await Check(context.EmployeeSkills);

        if (expectRows)
        {
            // Sin esto la prueba pasaría igual con la base vacía, que es la forma más fácil de
            // que una prueba de aislamiento deje de comprobar nada.
            Assert.Equal(26, seeded);
        }
    }

    /// <summary>Dos organizaciones con exactamente los mismos datos, para que la única
    /// diferencia entre lo que se ve y lo que no sea el filtro.</summary>
    private async Task<(Guid First, Guid Second)> SeedBothAsync()
    {
        database.Organization.Clear();

        var first = await SeedOrganizationAsync("UNO");
        var second = await SeedOrganizationAsync("DOS");

        return (first, second);
    }

    private async Task<Guid> SeedOrganizationAsync(string prefix)
    {
        // Sembrar es escribir, y las escrituras no pasan por el filtro de consulta; las lecturas
        // de esta base recién creada tampoco encuentran nada que ocultar.
        database.Organization.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Organización {prefix}", null, ActorId, ActorName, Now);
        var organizationId = organization.IdOrganization;

        var client = Client.Create(
            organizationId, $"{prefix}-CLI", "Cliente", "EXA010101AA1", ActorId, ActorName, Now);
        var site = ClientSite.Create(
            client.IdOrganization, client.IdClient, $"{prefix}-SED", "Sede", "Calle", "Ciudad", "Estado", "01000", ActorId, ActorName, Now);
        var service = Service.Create(
            organizationId, client.IdClient, site.IdClientSite, null,
            $"{prefix}-SER", "Servicio", "Servicio", Day, ActorId, ActorName, Now);
        var contract = ServiceContract.Create(
            organizationId, client.IdClient, $"{prefix}-CON",
            new(ServiceContractStatus.Effective, null, Day, null, 30, 30, "MXN", null, null),
            ActorId, ActorName, Now);
        var configuration = ServiceConfiguration.Create(
            organizationId, service.IdService,
            new(Day, null, 1, 8m, 5, 176m, 5, "Turno diurno", null, 10000m, "MXN", true),
            ActorId, ActorName, Now);
        var position = Position.Create(
            organizationId, service.IdService, $"{prefix}-PUE", new("Puesto", 1, null, null),
            ActorId, ActorName, Now);
        var pattern = ShiftPattern.Create(
            organizationId, position.IdPosition, $"{prefix}-PAT",
            new("Patrón", null, Day, null), ActorId, ActorName, Now);
        var segment = ShiftSegment.Create(
            organizationId, pattern.IdShiftPattern,
            new(Day.DayOfWeek, new TimeOnly(8, 0), new TimeOnly(16, 0), false, 1, null),
            ActorId, ActorName, Now);
        var employee = Employee.Create(
            organizationId, $"{prefix}-EMP", "Empleado", null, Day, ActorId, ActorName, Now);
        var replacement = Employee.Create(
            organizationId, $"{prefix}-REL", "Relevo", null, Day, ActorId, ActorName, Now);
        var version = ScheduleVersion.Create(
            organizationId, service.IdService, new("Versión", Day, Day.AddDays(1), null),
            ActorId, ActorName, Now);
        version.Publish(ActorId, ActorName, Now);
        var shift = ScheduledShift.Create(
            organizationId, version.IdScheduleVersion,
            new(position.IdPosition, employee.IdEmployee, Day, new TimeOnly(8, 0), new TimeOnly(16, 0), false, null),
            ActorId, ActorName, Now);
        var assignment = ServiceAssignment.Create(
            organizationId, employee.IdEmployee, service.IdService,
            new(position.IdPosition, ServiceAssignmentType.Primary, Day, null, true, null),
            ActorId, ActorName, Now);
        var attendance = AttendanceRecord.Create(
            organizationId, shift.IdScheduledShift, employee.IdEmployee, Day,
            new(AttendanceStatus.Present, new TimeOnly(8, 0), new TimeOnly(16, 0), 0, null),
            ActorId, ActorName, Now);
        var coverage = CoverageRecord.Create(
            organizationId, shift.IdScheduledShift, employee.IdEmployee,
            new(replacement.IdEmployee, new TimeOnly(8, 0), new TimeOnly(16, 0), false, CoverageStatus.Requested, null),
            ActorId, ActorName, Now);
        var incident = Incident.Create(
            organizationId, service.IdService,
            new(shift.IdScheduledShift, employee.IdEmployee, Day, "Retardo",
                IncidentSeverity.Low, IncidentStatus.Open, "Descripción", null),
            ActorId, ActorName, Now);
        var evidence = OperationEvidence.Create(
            organizationId, service.IdService,
            new(attendance.IdAttendanceRecord, null, null, OperationEvidenceType.Photo,
                "Evidencia", $"operation-evidences/{prefix}.jpg", null),
            ActorId, ActorName, Now);
        var catalogItem = BusinessCatalogItem.Create(
            organizationId, new(BusinessCatalogItemType.CoverageReason, $"{prefix}-FAL", "Falta", null),
            ActorId, ActorName, Now);
        var requirement = EligibilityRequirement.Create(
            organizationId,
            new(EligibilityRequirementTargetType.Organization, null, null, null,
                EligibilityRequirementType.Document, $"{prefix}-DOC", "Documento", null, true),
            ActorId, ActorName, Now);
        var request = OperationalRequest.Create(
            organizationId, null, null, $"{prefix}-SOL", OperationalRequestType.NewClient,
            OperationalRequestPriority.Medium, "Alta", "Descripción", "Usuario", null,
            ActorId, ActorName, Now);
        var document = BusinessDocument.Create(
            organizationId,
            new(BusinessDocumentOwnerType.Client, client.IdClient, "Contrato", "Documento",
                BusinessDocumentStatus.PendingReview, null, null, $"business-documents/{prefix}.pdf", false, null),
            ActorId, ActorName, Now);
        var documentEvent = BusinessDocumentEvent.Record(
            document, "Created", null, ActorId, ActorName, Now);

        // Las cinco de la tanda E, para que la comprobación de aislamiento sobre ellas no sea
        // vacía: una prueba que recorre un conjunto sin filas no comprueba nada.
        var contact = ClientContact.Create(
            organizationId, client.IdClient, site.IdClientSite,
            new(ClientContactPurpose.Operational, $"Contacto {prefix}", null, null, null, null, true),
            ActorId, ActorName, Now);
        var employeeDocument = EmployeeDocument.Create(
            organizationId, employee.IdEmployee,
            new(EmployeeDocumentType.VoterId, EmployeeDocumentStatus.Validated,
                null, null, null, null, $"employee-documents/{prefix}.pdf", null),
            ActorId, ActorName, Now);
        var employeeEvaluation = EmployeeEvaluation.Create(
            organizationId, employee.IdEmployee,
            new(EmployeeEvaluationType.Polygraph, EmployeeEvaluationResult.Approved, Day, null, null, null, null),
            ActorId, ActorName, Now);
        var skillCatalogItem = BusinessCatalogItem.Create(
            organizationId, new(BusinessCatalogItemType.Skill, $"{prefix}-HAB", "Habilidad", null),
            ActorId, ActorName, Now);
        var employeeSkill = EmployeeSkill.Create(
            organizationId, employee.IdEmployee,
            new(skillCatalogItem.IdBusinessCatalogItem, Day, null, null),
            ActorId, ActorName, Now);

        context.AddRange(
            organization, client, site, service, contract, configuration, position, pattern, segment,
            employee, replacement, version, shift, assignment, attendance, coverage, incident, evidence,
            catalogItem, requirement, request, document, documentEvent,
            contact, employeeDocument, employeeEvaluation, skillCatalogItem, employeeSkill);

        await context.SaveChangesAsync();

        // Una corrección deliberada tras el alta, para que la bitácora tenga datos: las altas no
        // generan evento, así que sin esto OperationalEvents quedaría vacía y la comprobación de
        // aislamiento sobre ella no comprobaría nada.
        database.Organization.SetAuthorizedOrganization(organizationId);
        database.Reason.SetReason("Se corrigió la asistencia tras el cierre del día", true);
        attendance.UpdateProfile(
            new(AttendanceStatus.Late, new TimeOnly(8, 30), new TimeOnly(16, 0), 30, null),
            ActorId, ActorName, Now);
        await context.SaveChangesAsync();
        database.Organization.Clear();

        return organizationId;
    }
}
