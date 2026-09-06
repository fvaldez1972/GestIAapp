using GestIA.Application.Assignments;
using GestIA.Application.Workforce;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// El listado de personal con su resumen documental.
///
/// Lo que hay que demostrar es la distinción que da sentido a la píldora: <b>«sin cargar» no es «al
/// día»</b>. Un requisito que la organización exige y del que no hay documento no es un expediente
/// en orden, y confundirlos esconde el hueco hasta que alguien intenta asignar.
///
/// Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.
/// </summary>
public sealed class EmployeeSearchTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly Guid ActorId = Guid.Parse("5a1e7c62-9f04-4b18-8d3a-6c2e91f47b05");
    private const string ActorName = "Pruebas";
    private static readonly DateTime Now = new(2026, 9, 6, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 6);
    private const int Umbral = 30;
    private static readonly CancellationToken Token = CancellationToken.None;

    /// <summary>Los dos requisitos que la organización de prueba exige.</summary>
    private static readonly EmployeeDocumentType[] Requeridos =
        [EmployeeDocumentType.Curp, EmployeeDocumentType.ProofOfAddress];

    // ── El resumen documental ────────────────────────────────────────────────────────────────

    [OperationalSqlFact]
    public async Task TheListResolvesJobPositionDocumentsAndAssignmentsInOneQuery()
    {
        var seed = await SeedAsync("RES");

        var (items, total) = await SearchAsync(Criterios(seed.OrganizationId));

        Assert.Equal(4, total);

        var alDia = Assert.Single(items, item => item.CodeEmployee == "RES-EMP-OK");
        Assert.Equal("Guardia de acceso", alDia.JobPositionName);
        Assert.Equal(2, alDia.RequiredDocuments);
        Assert.Equal(0, alDia.MissingDocuments);
        Assert.Equal(0, alDia.ExpiredDocuments);
        Assert.Equal(EmployeeDocumentHealth.UpToDate, alDia.DocumentHealth);
        Assert.Equal(1, alDia.AssignmentCount);
    }

    /// <summary>
    /// El caso que sostiene la pantalla. Sin ningún documento, los dos requisitos están <b>sin
    /// cargar</b>, y eso no es un expediente al día: es un hueco que nadie ve.
    /// </summary>
    [OperationalSqlFact]
    public async Task AnEmployeeWithNoDocumentsReportsEveryRequirementAsMissingNotUpToDate()
    {
        var seed = await SeedAsync("HUE");

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));

        var sinNada = Assert.Single(items, item => item.CodeEmployee == "HUE-EMP-SIN");
        Assert.Equal(2, sinNada.MissingDocuments);
        Assert.Equal(0, sinNada.ExpiredDocuments);
        Assert.Equal(EmployeeDocumentHealth.Missing, sinNada.DocumentHealth);
        Assert.NotEqual(EmployeeDocumentHealth.UpToDate, sinNada.DocumentHealth);
    }

    /// <summary>
    /// Un documento cuya fecha ya pasó cuenta como vencido aunque nadie lo haya marcado. Esperar a
    /// que alguien revise el expediente es esperar a que el bloqueo aparezca al asignar.
    /// </summary>
    [OperationalSqlFact]
    public async Task ADocumentWhoseDateHasPassedCountsAsExpiredEvenIfNobodyMarkedIt()
    {
        var seed = await SeedAsync("VEN");

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));

        var vencido = Assert.Single(items, item => item.CodeEmployee == "VEN-EMP-VEN");
        Assert.Equal(1, vencido.ExpiredDocuments);
        Assert.Equal(EmployeeDocumentHealth.Expired, vencido.DocumentHealth);
    }

    /// <summary>
    /// El umbral separa «por vencer» de «al día», y los bordes importan: justo en el día treinta
    /// todavía avisa, y al día siguiente ya no.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheThresholdSeparatesExpiringFromUpToDateAtItsExactEdge()
    {
        var seed = await SeedAsync("UMB");

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));

        var enElBorde = Assert.Single(items, item => item.CodeEmployee == "UMB-EMP-BOR");
        Assert.Equal(1, enElBorde.ExpiringDocuments);
        Assert.Equal(EmployeeDocumentHealth.Expiring, enElBorde.DocumentHealth);

        // El de al lado caduca un día después del umbral: está al día.
        var fuera = Assert.Single(items, item => item.CodeEmployee == "UMB-EMP-OK");
        Assert.Equal(0, fuera.ExpiringDocuments);
        Assert.Equal(EmployeeDocumentHealth.UpToDate, fuera.DocumentHealth);
    }

    /// <summary>El peor manda: con un vencido y un hueco, la fila dice vencido.</summary>
    [OperationalSqlFact]
    public async Task TheWorstStateWins()
    {
        var seed = await SeedAsync("PEO");

        await using (var context = database.Context())
        {
            var empleado = await context.Employees.SingleAsync(item => item.CodeEmployee == "PEO-EMP-VEN");
            // Se da de baja el comprobante de domicilio, que estaba vigente: queda el hueco de ese
            // requisito además de la CURP vencida.
            var comprobante = await context.EmployeeDocuments.SingleAsync(document =>
                document.IdEmployee == empleado.IdEmployee &&
                document.DocumentType == EmployeeDocumentType.ProofOfAddress);
            comprobante.Deactivate(ActorId, ActorName, Now);
            await context.SaveChangesAsync(Token);
        }

        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));
        var peor = Assert.Single(items, item => item.CodeEmployee == "PEO-EMP-VEN");

        Assert.True(peor.MissingDocuments > 0);
        Assert.Equal(EmployeeDocumentHealth.Expired, peor.DocumentHealth);
    }

    // ── Los filtros ──────────────────────────────────────────────────────────────────────────

    [OperationalSqlFact]
    public async Task TheFiveStatusesFilterIndependently()
    {
        var seed = await SeedAsync("EST");

        foreach (var estado in new[] { EmployeeStatus.Candidate, EmployeeStatus.Active })
        {
            var (items, _) = await SearchAsync(Criterios(seed.OrganizationId) with { Status = estado });
            Assert.All(items, item => Assert.Equal(estado, item.Status));
        }
    }

    [OperationalSqlFact]
    public async Task TheValidityFilterBringsExactlyItsOwn()
    {
        var seed = await SeedAsync("FIL");

        var (sinCargar, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { DocumentFilter = EmployeeDocumentFilter.Missing });
        Assert.Contains(sinCargar, item => item.CodeEmployee == "FIL-EMP-SIN");
        Assert.DoesNotContain(sinCargar, item => item.CodeEmployee == "FIL-EMP-OK");

        var (vencidos, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { DocumentFilter = EmployeeDocumentFilter.Expired });
        Assert.Equal("VEN", Assert.Single(vencidos).CodeEmployee[^3..]);

        var (alDia, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { DocumentFilter = EmployeeDocumentFilter.UpToDate });
        Assert.All(alDia, item => Assert.Equal(EmployeeDocumentHealth.UpToDate, item.DocumentHealth));
    }

    [OperationalSqlFact]
    public async Task TheJobPositionFilterUsesTheCatalogAndOffersOnlyWhatIsInUse()
    {
        var seed = await SeedAsync("PUE");

        var (items, _) = await SearchAsync(
            Criterios(seed.OrganizationId) with { IdJobPositionCatalogItem = seed.JobPositionId });
        Assert.All(items, item => Assert.Equal(seed.JobPositionId, item.IdJobPositionCatalogItem));

        await using var context = database.Context();
        var puestos = await new WorkforceRepository(context)
            .ListUsedJobPositionsAsync(seed.OrganizationId, Token);

        // El segundo puesto del catálogo no lo tiene nadie, así que no se ofrece: un filtro con una
        // opción que no puede traer nada es un control que estorba.
        Assert.Equal("Guardia de acceso", Assert.Single(puestos).Name);
    }

    // ── Los requisitos de la organización ────────────────────────────────────────────────────

    /// <summary>
    /// La organización elige qué exigir, <b>pero sobre el vocabulario que el sistema reconoce</b>.
    /// Un código escrito a mano que no corresponde a ningún tipo no puede convertirse en un
    /// requisito que nadie podrá cumplir nunca.
    /// </summary>
    [OperationalSqlFact]
    public async Task ARequirementNamingAnUnknownTypeIsDiscardedInsteadOfBlockingEveryone()
    {
        var seed = await SeedAsync("VOC");

        await using (var context = database.Context())
        {
            context.Add(EligibilityRequirement.Create(
                seed.OrganizationId,
                new EligibilityRequirementProfile(
                    EligibilityRequirementTargetType.Organization, null, null, null,
                    EligibilityRequirementType.Document, "CARTA_ASTRAL", "Carta astral", null, true),
                ActorId, ActorName, Now));
            await context.SaveChangesAsync(Token);
        }

        await using var lectura = database.Context();
        var repository = new WorkforceRepository(lectura);
        var codigos = await repository.ListRequiredDocumentCodesAsync(seed.OrganizationId, Token);
        Assert.Contains("CARTA_ASTRAL", codigos);

        // El servicio lo descarta, así que el empleado completo sigue al día.
        var (items, _) = await SearchAsync(Criterios(seed.OrganizationId));
        var alDia = Assert.Single(items, item => item.CodeEmployee == "VOC-EMP-OK");
        Assert.Equal(2, alDia.RequiredDocuments);
        Assert.Equal(EmployeeDocumentHealth.UpToDate, alDia.DocumentHealth);
    }

    // ── Las asignaciones por persona ─────────────────────────────────────────────────────────

    [OperationalSqlFact]
    public async Task TheAssignmentsOfAPersonBringOnlyTheirOwn()
    {
        var seed = await SeedAsync("ASI");

        await using var context = database.Context();
        var asignaciones = await new WorkforceRepository(context)
            .ListAssignmentsAsync(seed.OrganizationId, seed.EmployeeWithAssignmentId, Day, Token);

        var asignacion = Assert.Single(asignaciones);
        Assert.True(asignacion.InForce);
        Assert.True(asignacion.IsPrimary);
        Assert.Equal("Puesto de acceso", asignacion.PositionName);
        Assert.False(asignacion.HasShiftInProgress);
    }

    /// <summary>
    /// El turno nocturno con entrada y sin salida se lee <b>en curso</b>, no como ausencia ni como
    /// turno terminado. Se mira también el día anterior, porque el turno empieza un día y termina
    /// al siguiente.
    /// </summary>
    [OperationalSqlFact]
    public async Task ANightShiftWithEntryAndNoExitReadsAsInProgress()
    {
        var seed = await SeedAsync("NOC");

        await using (var context = database.Context())
        {
            var servicio = await context.Services.SingleAsync(item => item.IdService == seed.ServiceId);
            var posicion = await context.Positions.SingleAsync(item => item.IdService == seed.ServiceId);

            var version = ScheduleVersion.Create(
                seed.OrganizationId, servicio.IdService,
                new ScheduleVersionProfile("Semana", Day.AddDays(-3), Day.AddDays(3), null),
                ActorId, ActorName, Now);
            version.Publish(ActorId, ActorName, Now);

            var turno = ScheduledShift.Create(
                seed.OrganizationId, version.IdScheduleVersion,
                new ScheduledShiftProfile(
                    posicion.IdPosition, seed.EmployeeWithAssignmentId, Day.AddDays(-1),
                    new(19, 0), new(7, 0), true, null),
                ActorId, ActorName, Now);

            // Entrada registrada, salida pendiente: el turno sigue corriendo.
            context.AddRange(version, turno, AttendanceRecord.Create(
                seed.OrganizationId, turno.IdScheduledShift, seed.EmployeeWithAssignmentId, Day.AddDays(-1),
                new AttendanceRecordProfile(AttendanceStatus.Present, new(18, 56), null, 0, null),
                ActorId, ActorName, Now));

            await context.SaveChangesAsync(Token);
        }

        await using var lectura = database.Context();
        var asignaciones = await new WorkforceRepository(lectura)
            .ListAssignmentsAsync(seed.OrganizationId, seed.EmployeeWithAssignmentId, Day, Token);

        var asignacion = Assert.Single(asignaciones);
        Assert.True(asignacion.HasShiftInProgress);
        Assert.Equal(Day.AddDays(-1), asignacion.ShiftInProgressDate);
    }

    // ── La elegibilidad ──────────────────────────────────────────────────────────────────────

    /// <summary>
    /// <b>Un nulo no bloquea.</b> El empleado sin puesto de catálogo tiene el expediente incompleto,
    /// y aun así puede asignarse: no es lo mismo «no sabemos su puesto» que «no cumple el perfil».
    /// Es la condición que la franja de la ficha tiene que hacer visible.
    /// </summary>
    [OperationalSqlFact]
    public void AnEmployeeWithoutACatalogJobPositionIsNotBlocked()
    {
        var puestoDeLaPosicion = Guid.NewGuid();

        Assert.False(JobPositionEligibility.IsBlocked(puestoDeLaPosicion, null));
        Assert.False(JobPositionEligibility.IsBlocked(null, Guid.NewGuid()));
        Assert.True(JobPositionEligibility.IsBlocked(puestoDeLaPosicion, Guid.NewGuid()));
        Assert.False(JobPositionEligibility.IsBlocked(puestoDeLaPosicion, puestoDeLaPosicion));
    }

    [OperationalSqlFact]
    public async Task TheEmployeesOfOneOrganizationDoNotLeakIntoAnother()
    {
        var mine = await SeedAsync("MIA");
        var other = await SeedAsync("OTR");

        var (items, _) = await SearchAsync(Criterios(other.OrganizationId));

        Assert.All(items, item => Assert.StartsWith("OTR-", item.CodeEmployee, StringComparison.Ordinal));
        Assert.NotEqual(mine.OrganizationId, other.OrganizationId);
    }

    // ── Ayudas ───────────────────────────────────────────────────────────────────────────────

    private static EmployeeSearchCriteria Criterios(Guid organizationId) =>
        new(organizationId, null, null, null, EmployeeDocumentFilter.Any, null, Day, Umbral, 0, 50);

    private async Task<(IReadOnlyList<EmployeeListItemResponse> Items, int TotalCount)> SearchAsync(
        EmployeeSearchCriteria criteria)
    {
        database.Organization.SetAuthorizedOrganization(criteria.IdOrganization);
        await using var context = database.Context();
        return await new WorkforceRepository(context).SearchEmployeesAsync(criteria, Requeridos, Token);
    }

    /// <summary>
    /// Cuatro personas, cada una con un expediente distinto: al día, sin ningún documento, con uno
    /// vencido, y con uno que caduca justo en el borde del umbral.
    /// </summary>
    private async Task<Seed> SeedAsync(string prefix)
    {
        database.Organization.Clear();
        database.Reason.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Organización {prefix}", null, ActorId, ActorName, Now);
        var organizationId = organization.IdOrganization;

        var puesto = BusinessCatalogItem.Create(
            organizationId,
            new BusinessCatalogItemProfile(
                BusinessCatalogItemType.JobPosition, $"{prefix}-PUE", "Guardia de acceso", null),
            ActorId, ActorName, Now);

        // Un segundo puesto que nadie tiene: el filtro no debe ofrecerlo.
        var puestoSinUso = BusinessCatalogItem.Create(
            organizationId,
            new BusinessCatalogItemProfile(
                BusinessCatalogItemType.JobPosition, $"{prefix}-PU2", "Supervisor", null),
            ActorId, ActorName, Now);

        context.AddRange(organization, puesto, puestoSinUso);

        foreach (var tipo in Requeridos)
        {
            context.Add(EligibilityRequirement.Create(
                organizationId,
                new EligibilityRequirementProfile(
                    EligibilityRequirementTargetType.Organization, null, null, null,
                    EligibilityRequirementType.Document, tipo.ToString().ToUpperInvariant(),
                    $"Requisito {tipo}", null, true),
                ActorId, ActorName, Now));
        }

        var cliente = Client.Create(
            organizationId, $"{prefix}-CLI", $"Cliente {prefix}", "AAA010101AA1", ActorId, ActorName, Now);
        var sede = ClientSite.Create(
            organizationId, cliente.IdClient, $"{prefix}-SED", "Sede", "Calle", "Zapopan", "Jalisco",
            "45110", ActorId, ActorName, Now);
        var servicio = Service.Create(
            organizationId, cliente.IdClient, sede.IdClientSite, null,
            $"{prefix}-SER", "Servicio", "Vigilancia", Day.AddDays(-60), ActorId, ActorName, Now);
        var posicion = Position.Create(
            organizationId, servicio.IdService, $"{prefix}-POS",
            new PositionProfile("Puesto de acceso", 1, null, null, puesto.IdBusinessCatalogItem),
            ActorId, ActorName, Now);

        context.AddRange(cliente, sede, servicio, posicion);

        var alDia = Empleado(organizationId, $"{prefix}-EMP-OK", "Persona al dia", puesto.IdBusinessCatalogItem);
        var sinNada = Empleado(organizationId, $"{prefix}-EMP-SIN", "Persona sin papeles", puesto.IdBusinessCatalogItem);
        var conVencido = Empleado(organizationId, $"{prefix}-EMP-VEN", "Persona con vencido", puesto.IdBusinessCatalogItem);
        var enElBorde = Empleado(organizationId, $"{prefix}-EMP-BOR", "Persona en el borde", puesto.IdBusinessCatalogItem);

        sinNada.ChangeStatus(EmployeeStatus.Candidate, ActorId, ActorName, Now);

        context.AddRange(alDia, sinNada, conVencido, enElBorde);

        // Al día: los dos requisitos, caducando mucho después del umbral.
        context.AddRange(
            Documento(organizationId, alDia.IdEmployee, EmployeeDocumentType.Curp, Day.AddDays(200)),
            Documento(organizationId, alDia.IdEmployee, EmployeeDocumentType.ProofOfAddress, Day.AddDays(200)));

        // Con vencido: la CURP caducó ayer, y el comprobante está bien.
        context.AddRange(
            Documento(organizationId, conVencido.IdEmployee, EmployeeDocumentType.Curp, Day.AddDays(-1)),
            Documento(organizationId, conVencido.IdEmployee, EmployeeDocumentType.ProofOfAddress, Day.AddDays(200)));

        // En el borde: caduca justo el día treinta, que todavía avisa.
        context.AddRange(
            Documento(organizationId, enElBorde.IdEmployee, EmployeeDocumentType.Curp, Day.AddDays(Umbral)),
            Documento(organizationId, enElBorde.IdEmployee, EmployeeDocumentType.ProofOfAddress, Day.AddDays(Umbral + 1)));

        context.Add(ServiceAssignment.Create(
            organizationId, alDia.IdEmployee, servicio.IdService,
            new ServiceAssignmentProfile(
                posicion.IdPosition, ServiceAssignmentType.Primary, Day.AddDays(-30), null, true, null),
            ActorId, ActorName, Now));

        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organizationId);

        return new(organizationId, puesto.IdBusinessCatalogItem, servicio.IdService, alDia.IdEmployee);
    }

    private static Employee Empleado(Guid organizationId, string code, string nombre, Guid idPuesto)
    {
        var empleado = Employee.Create(
            organizationId, code, nombre, "Guardia", Day.AddDays(-90), ActorId, ActorName, Now);

        empleado.ChangeStatus(EmployeeStatus.Active, ActorId, ActorName, Now);
        empleado.UpdateProfile(
            new EmployeeProfile(
                nombre, "Guardia", Day.AddDays(-90),
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, "Zapopan", "Jalisco", null, null, null,
                null, idPuesto),
            ActorId, ActorName, Now);

        return empleado;
    }

    private static EmployeeDocument Documento(
        Guid organizationId,
        Guid idEmployee,
        EmployeeDocumentType tipo,
        DateOnly caduca) =>
        EmployeeDocument.Create(
            organizationId,
            idEmployee,
            new EmployeeDocumentProfile(tipo, EmployeeDocumentStatus.Validated, null, null, null, caduca, null, null),
            ActorId, ActorName, Now);

    private sealed record Seed(
        Guid OrganizationId,
        Guid JobPositionId,
        Guid ServiceId,
        Guid EmployeeWithAssignmentId);
}
