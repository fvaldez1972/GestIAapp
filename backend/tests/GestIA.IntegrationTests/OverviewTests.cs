using GestIA.Application.Common;
using GestIA.Application.Overview;
using GestIA.Application.Security;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence.Repositories;

namespace GestIA.IntegrationTests;

/// <summary>
/// El estado de la organización que sostiene la pantalla de Inicio.
///
/// Lo que hay que demostrar es la distinción que hace útil el tablero: <b>un cero real y un «sin
/// datos aún» no son lo mismo</b>, y quién decide cuál es cuál. Lo decide el servidor, aquí.
///
/// Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.
/// </summary>
public sealed class OverviewTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly Guid ActorId = Guid.Parse("2b6c1a90-77f3-4b31-9a4c-51d0e2f8a913");
    private const string ActorName = "Pruebas";
    private static readonly DateTime Now = new(2026, 9, 9, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>Miércoles. La semana operativa va del lunes 07 al domingo 13.</summary>
    private static readonly DateOnly Day = new(2026, 9, 9);
    private static readonly DateOnly Yesterday = new(2026, 9, 8);
    private static readonly DateOnly WeekStart = new(2026, 9, 7);
    private static readonly DateOnly WeekEnd = new(2026, 9, 13);
    private static readonly CancellationToken Token = CancellationToken.None;

    /// <summary>Todo lo que un administrador de organización puede leer.</summary>
    private static readonly string[] AdminPermissions =
    [
        SecurityPermissions.CatalogsRead,
        SecurityPermissions.ClientsRead,
        SecurityPermissions.WorkforceRead,
        SecurityPermissions.PlanningRead,
        SecurityPermissions.OperationsRead,
    ];

    // ── La organización recién creada ────────────────────────────────────────────────────────

    /// <summary>
    /// El caso que da nombre al problema. Inicio es el tablero del administrador de la
    /// organización y se ve igual desde el primer día: <b>los cuatro indicadores existen siempre</b>.
    /// Lo que no puede pasar es que digan cero, porque un cero aquí no es un dato sino la ausencia
    /// de configuración.
    /// </summary>
    [OperationalSqlFact]
    public async Task ANewOrganizationGetsTheFourMetricsAndNoneOfThemHasAValue()
    {
        var organizationId = await SeedAsync("NUE", Level.Nothing);

        var overview = await OverviewAsync(organizationId);

        // Los cuatro existen y los cuatro dicen que falta el prerrequisito. Ninguno dice cero.
        Assert.Equal(4, overview.Metrics.Count);
        Assert.All(overview.Metrics, metric => Assert.Equal(OverviewMetricState.Pending, metric.State));

        // Y nada que atender, que es lo que obliga a la pantalla a distinguir «no hay pendientes»
        // de «todavía no hay con qué saberlo»: aquí lo segundo.
        Assert.Empty(overview.Attention);
    }

    // ── Cero real contra sin datos aún ───────────────────────────────────────────────────────

    /// <summary>
    /// <b>La regla es del dato, no del calendario.</b> La organización opera —tiene servicios,
    /// posiciones, gente y una semana publicada— pero ayer no estaba cubierto por ninguna versión
    /// publicada. Decir «0 turnos sin cubrir» sería felicitarse por un día que nadie planeó.
    /// </summary>
    [OperationalSqlFact]
    public async Task YesterdayWithoutAPublishedPlanSaysTheDataIsMissingEvenWhenTheOrganizationOperates()
    {
        var organizationId = await SeedAsync("AYE", Level.Assignments);

        // Una semana publicada que empieza hoy: cubre la semana operativa, pero no cubre ayer.
        await PublishAsync(organizationId, Day, WeekEnd, withShiftOn: Day);

        var overview = await OverviewAsync(organizationId);

        Assert.Equal(OverviewMetricState.Ready, Metric(overview, OverviewMetricKey.PlannedShifts).State);

        var yesterday = Metric(overview, OverviewMetricKey.UncoveredShiftsYesterday);
        Assert.Equal(OverviewMetricState.Pending, yesterday.State);
        Assert.Equal(Yesterday, yesterday.AsOfDate);
    }

    /// <summary>
    /// Una semana cuya planeación publicada sólo cubre un día no es una semana planeada, y el
    /// indicador tiene que poder decirlo. Salió al mirar la pantalla con los datos de la demo,
    /// donde la planeación termina a fin de mes.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheWeekReportsHowManyOfItsDaysActuallyHaveShifts()
    {
        var organizationId = await SeedAsync("DIA", Level.Assignments);

        await PublishAsync(organizationId, WeekStart, WeekEnd, withShiftOn: WeekStart);

        var overview = await OverviewAsync(organizationId);
        var planned = Metric(overview, OverviewMetricKey.PlannedShifts);

        Assert.Equal(OverviewMetricState.Ready, planned.State);
        Assert.Equal(1, planned.Value);
        Assert.Equal(1, planned.CoveredDays);
    }

    /// <summary>
    /// El mismo indicador, con ayer sí planeado y sin faltas: <b>cero real</b>, y se muestra con
    /// la fecha que lo respalda porque es un logro operativo, no una ausencia.
    /// </summary>
    [OperationalSqlFact]
    public async Task YesterdayWithAPublishedPlanAndNoAbsencesIsARealZero()
    {
        var organizationId = await SeedAsync("CER", Level.Assignments);

        await PublishAsync(organizationId, WeekStart, WeekEnd, withShiftOn: Yesterday);

        var overview = await OverviewAsync(organizationId);

        var yesterday = Metric(overview, OverviewMetricKey.UncoveredShiftsYesterday);
        Assert.Equal(OverviewMetricState.Ready, yesterday.State);
        Assert.Equal(0, yesterday.Value);
        Assert.Equal(OverviewTone.Success, yesterday.Tone);
        Assert.Equal(Yesterday, yesterday.AsOfDate);
    }

    /// <summary>
    /// Una falta sin cobertura que la resuelva deja el turno al descubierto, y además abre su
    /// propio asunto de atención si nadie levantó la incidencia.
    /// </summary>
    [OperationalSqlFact]
    public async Task AnAbsenceWithoutCoverageLeavesTheShiftUncoveredAndAsksForItsIncident()
    {
        var organizationId = await SeedAsync("FAL", Level.Assignments);

        await PublishAsync(organizationId, WeekStart, WeekEnd, withShiftOn: Yesterday, absent: true);

        var overview = await OverviewAsync(organizationId);

        var yesterday = Metric(overview, OverviewMetricKey.UncoveredShiftsYesterday);
        Assert.Equal(OverviewMetricState.Ready, yesterday.State);
        Assert.Equal(1, yesterday.Value);
        Assert.Equal(OverviewTone.Danger, yesterday.Tone);

        Assert.Contains(
            overview.Attention,
            item => item.Key == OverviewAttentionKey.AbsencesWithoutIncident && item.Count == 1);
    }

    /// <summary>
    /// Sin ninguna posición definida el hueco no es cero: es incalculable, porque no hay cupo
    /// contra el que comparar. Con posiciones y todas cubiertas, sí es cero.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheVacancyIsUncalculableWithoutPositionsAndZeroWhenTheyAreAllCovered()
    {
        var withoutPositions = await SeedAsync("SIN", Level.Services);
        var withPositions = await SeedAsync("CON", Level.Assignments);

        var empty = Metric(await OverviewAsync(withoutPositions), OverviewMetricKey.PositionsWithoutPrimary);
        Assert.Equal(OverviewMetricState.Pending, empty.State);

        var covered = Metric(await OverviewAsync(withPositions), OverviewMetricKey.PositionsWithoutPrimary);
        Assert.Equal(OverviewMetricState.Ready, covered.State);
        Assert.Equal(0, covered.Value);
        Assert.Equal(OverviewTone.Success, covered.Tone);
        Assert.Equal(1, covered.Total);
    }

    /// <summary>
    /// Una posición sin titular vigente sale con su tono y abre su asunto, que es el que deja
    /// turnos al descubierto y por eso encabeza la lista.
    /// </summary>
    [OperationalSqlFact]
    public async Task APositionWithoutATitularIsCountedAndLeadsTheAttentionList()
    {
        var organizationId = await SeedAsync("VAC", Level.Positions);

        var overview = await OverviewAsync(organizationId);

        var vacancy = Metric(overview, OverviewMetricKey.PositionsWithoutPrimary);
        Assert.Equal(1, vacancy.Value);
        Assert.Equal(OverviewTone.Danger, vacancy.Tone);

        Assert.Equal(OverviewAttentionKey.PositionsWithoutPrimary, overview.Attention[0].Key);
        Assert.Equal(OverviewTone.Danger, overview.Attention[0].Severity);
    }

    /// <summary>
    /// Un documento cuya fecha ya pasó cuenta como vencido aunque nadie lo haya marcado. Esperar a
    /// que alguien revise el expediente es esperar a que el bloqueo aparezca al asignar.
    /// </summary>
    [OperationalSqlFact]
    public async Task ADocumentWhoseDateHasPassedCountsAsExpiredEvenIfNobodyMarkedIt()
    {
        var organizationId = await SeedAsync("DOC", Level.Employees);

        await using (var context = database.Context())
        {
            var employee = context.Employees.First(item => item.IdOrganization == organizationId);
            context.Add(EmployeeDocument.Create(
                organizationId,
                employee.IdEmployee,
                new EmployeeDocumentProfile(
                    EmployeeDocumentType.VoterId,
                    EmployeeDocumentStatus.Validated,
                    null, null, null, Day.AddDays(-11), null, null),
                ActorId, ActorName, Now));
            await context.SaveChangesAsync(Token);
        }

        var overview = await OverviewAsync(organizationId);

        var documents = Metric(overview, OverviewMetricKey.ExpiredDocuments);
        Assert.Equal(OverviewMetricState.Ready, documents.State);
        Assert.Equal(1, documents.Value);
        Assert.Equal(OverviewTone.Warning, documents.Tone);

        var item = Assert.Single(overview.Attention, entry => entry.Key == OverviewAttentionKey.ExpiredDocuments);
        Assert.Equal(Day.AddDays(-11), item.SinceDate);
    }

    // ── Lo que ve cada actor ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Los indicadores y los asuntos sí se filtran, porque son trabajo. Sin
    /// <c>WORKFORCE.READ</c> no aparece la fila de documentos ni su indicador.
    /// </summary>
    [OperationalSqlFact]
    public async Task WithoutWorkforceReadTheDocumentRowAndItsMetricAreNotOffered()
    {
        var organizationId = await SeedAsync("FIL", Level.Employees);

        var overview = await OverviewAsync(organizationId, SecurityPermissions.PlanningRead);

        Assert.DoesNotContain(overview.Metrics, metric => metric.Key == OverviewMetricKey.ExpiredDocuments);
        Assert.DoesNotContain(overview.Attention, item => item.Key == OverviewAttentionKey.ExpiredDocuments);
        Assert.Contains(overview.Metrics, metric => metric.Key == OverviewMetricKey.PositionsWithoutPrimary);
    }

    /// <summary>
    /// El super admin no lleva la lista completa de permisos, sólo <c>PLATFORM.ADMIN</c>. Sin la
    /// rama que lo reconoce, no vería ningún indicador.
    /// </summary>
    [OperationalSqlFact]
    public async Task ThePlatformAdminSeesEveryMetric()
    {
        var organizationId = await SeedAsync("SUP", Level.Catalogs);

        var overview = await OverviewAsync(organizationId, SecurityPermissions.PlatformAdmin);

        Assert.Equal(4, overview.Metrics.Count);
    }

    /// <summary>
    /// El aislamiento sigue mandando: los hechos de una organización no se cuelan en la otra,
    /// aunque las dos vivan en la misma base.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheFactsOfOneOrganizationDoNotLeakIntoAnother()
    {
        var configured = await SeedAsync("MIA", Level.Assignments);
        var empty = await SeedAsync("OTR", Level.Nothing);

        var overview = await OverviewAsync(empty);

        // La organización vacía no ve nada de la configurada: los cuatro indicadores sin calcular
        // y ningún asunto. Si los hechos se colaran, el de posiciones sin titular estaría listo.
        Assert.All(overview.Metrics, metric => Assert.Equal(OverviewMetricState.Pending, metric.State));
        Assert.Empty(overview.Attention);

        var other = await OverviewAsync(configured);
        Assert.Equal(
            OverviewMetricState.Ready,
            Metric(other, OverviewMetricKey.PositionsWithoutPrimary).State);
    }

    // ── Sembrado ─────────────────────────────────────────────────────────────────────────────

    /// <summary>Hasta dónde llega la configuración de la organización sembrada.</summary>
    private enum Level
    {
        Nothing = 0,
        Catalogs = 1,
        Clients = 2,
        Services = 3,
        Positions = 4,
        Employees = 5,
        Assignments = 6,
    }

    private async Task<Guid> SeedAsync(string prefix, Level level)
    {
        database.Organization.Clear();
        database.Reason.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Organización {prefix}", null, ActorId, ActorName, Now);
        var organizationId = organization.IdOrganization;
        context.Add(organization);

        Guid? jobPositionId = null;

        if (level >= Level.Catalogs)
        {
            var jobPosition = Catalog(organizationId, BusinessCatalogItemType.JobPosition, $"{prefix}-PUE");
            jobPositionId = jobPosition.IdBusinessCatalogItem;
            context.AddRange(
                jobPosition,
                Catalog(organizationId, BusinessCatalogItemType.Skill, $"{prefix}-HAB"),
                Catalog(organizationId, BusinessCatalogItemType.IncidentReason, $"{prefix}-INC"),
                Catalog(organizationId, BusinessCatalogItemType.CoverageReason, $"{prefix}-COB"));
        }

        Guid serviceId = Guid.Empty;
        Guid positionId = Guid.Empty;

        if (level >= Level.Clients)
        {
            var client = Client.Create(
                organizationId, $"{prefix}-CLI", $"Razón Social {prefix}", "EXA010101AA1", ActorId, ActorName, Now);
            var site = ClientSite.Create(
                organizationId, client.IdClient, $"{prefix}-SED", $"Sede {prefix}",
                "Calle", "Ciudad", "Estado", "01000", ActorId, ActorName, Now);
            context.AddRange(client, site);

            if (level >= Level.Services)
            {
                var service = Service.Create(
                    organizationId, client.IdClient, site.IdClientSite, null,
                    $"{prefix}-SER", $"Servicio {prefix}", "Servicio", Day.AddDays(-60), ActorId, ActorName, Now);
                serviceId = service.IdService;

                var configuration = ServiceConfiguration.Create(
                    organizationId, service.IdService,
                    new ServiceConfigurationProfile(
                        Day.AddDays(-60), null, 1, 8m, 5, 176m, 0, "Turno diurno", null, 10000m, "MXN", true),
                    ActorId, ActorName, Now);
                context.AddRange(service, configuration);
            }

            if (level >= Level.Positions)
            {
                var position = Position.Create(
                    organizationId, serviceId, $"{prefix}-POS", new PositionProfile("Puesto", 1, null, null),
                    ActorId, ActorName, Now);
                positionId = position.IdPosition;

                var pattern = ShiftPattern.Create(
                    organizationId, position.IdPosition, $"{prefix}-PAT",
                    new ShiftPatternProfile("Semanal", null, Day.AddDays(-60), null),
                    ActorId, ActorName, Now);

                var segment = ShiftSegment.Create(
                    organizationId, pattern.IdShiftPattern,
                    new ShiftSegmentProfile(DayOfWeek.Monday, new(8, 0), new(16, 0), false, 1, null),
                    ActorId, ActorName, Now);

                context.AddRange(position, pattern, segment);
            }
        }

        if (level >= Level.Employees)
        {
            var employee = Employee.Create(
                organizationId, $"{prefix}-EMP", $"Persona {prefix}", "Guardia", Day.AddDays(-90),
                ActorId, ActorName, Now);
            employee.ChangeStatus(EmployeeStatus.Active, ActorId, ActorName, Now);

            if (jobPositionId is not null)
            {
                employee.UpdateProfile(
                    ProfileFor($"Persona {prefix}", jobPositionId.Value), ActorId, ActorName, Now);
            }

            context.Add(employee);

            if (level >= Level.Assignments)
            {
                context.Add(ServiceAssignment.Create(
                    organizationId, employee.IdEmployee, serviceId,
                    new ServiceAssignmentProfile(
                        positionId, ServiceAssignmentType.Primary, Day.AddDays(-30), null, true, null),
                    ActorId, ActorName, Now));
            }
        }

        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organizationId);
        return organizationId;
    }

    /// <summary>
    /// El perfil de empleado tiene veintitantos campos opcionales y aquí sólo importan dos. Se
    /// aísla en un método para que las pruebas no se lean como una lista de nulos.
    /// </summary>
    private static EmployeeProfile ProfileFor(string fullName, Guid jobPositionId) =>
        new(fullName, "Guardia", Day.AddDays(-90),
            null, null, null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, null, null, null,
            null, jobPositionId);

    private static BusinessCatalogItem Catalog(Guid organizationId, BusinessCatalogItemType type, string code) =>
        BusinessCatalogItem.Create(
            organizationId,
            new BusinessCatalogItemProfile(type, $"Valor {code}", null),
            ActorId, ActorName, Now);

    private async Task AddAsync(Guid organizationId, params object[] entities)
    {
        await using var context = database.Context();
        database.Organization.SetAuthorizedOrganization(organizationId);
        context.AddRange(entities);
        await context.SaveChangesAsync(Token);
    }

    /// <summary>
    /// Publica una versión de planeación, opcionalmente con un turno en un día y con la asistencia
    /// de ese turno marcada como falta.
    /// </summary>
    private async Task PublishAsync(
        Guid organizationId,
        DateOnly from,
        DateOnly to,
        DateOnly? withShiftOn = null,
        bool absent = false)
    {
        await using var context = database.Context();
        database.Organization.SetAuthorizedOrganization(organizationId);

        var service = context.Services.First(item => item.IdOrganization == organizationId);
        var position = context.Positions.First(item => item.IdOrganization == organizationId);
        var employee = context.Employees.First(item => item.IdOrganization == organizationId);

        var version = ScheduleVersion.Create(
            organizationId, service.IdService,
            new ScheduleVersionProfile("Semana", from, to, null), ActorId, ActorName, Now);
        version.Publish(ActorId, ActorName, Now);
        context.Add(version);

        if (withShiftOn is { } shiftDate)
        {
            var shift = ScheduledShift.Create(
                organizationId, version.IdScheduleVersion,
                new ScheduledShiftProfile(position.IdPosition, employee.IdEmployee, shiftDate,
                    new(8, 0), new(16, 0), false, null),
                ActorId, ActorName, Now);
            context.Add(shift);

            if (absent)
            {
                context.Add(AttendanceRecord.Create(
                    organizationId, shift.IdScheduledShift, employee.IdEmployee, shiftDate,
                    new AttendanceRecordProfile(AttendanceStatus.Absent, null, null, 0, null),
                    ActorId, ActorName, Now));
            }
        }

        await context.SaveChangesAsync(Token);
    }

    // ── Ayudas ───────────────────────────────────────────────────────────────────────────────

    private async Task<OverviewResponse> OverviewAsync(Guid organizationId, params string[] permissions)
    {
        database.Organization.SetAuthorizedOrganization(organizationId);
        await using var context = database.Context();

        var service = new OverviewService(
            new OverviewRepository(context),
            new PermisosDePrueba(permissions.Length == 0 ? AdminPermissions : permissions),
            new RelojFijo());

        return await service.GetOverviewAsync(new OverviewQuery(organizationId), Token);
    }

    private static OverviewMetricResponse Metric(OverviewResponse overview, OverviewMetricKey key) =>
        overview.Metrics.Single(metric => metric.Key == key);

    private sealed class PermisosDePrueba(IReadOnlyCollection<string> permissions) : IActorContext
    {
        public Guid ActorId => OverviewTests.ActorId;
        public string ActorName => "Pruebas";
        public bool HasPermission(string permission) => permissions.Contains(permission);
    }

    /// <summary>Miércoles 09 de septiembre de 2026, para que la semana y el «ayer» no se muevan.</summary>
    private sealed class RelojFijo : IClock
    {
        public DateTime UtcNow => Now;
        public DateOnly Today => Day;
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
