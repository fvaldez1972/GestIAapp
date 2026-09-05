using GestIA.Application.Common;
using GestIA.Application.Security;

namespace GestIA.Application.Overview;

/// <summary>
/// El estado de la organización tal como lo ve quien entra.
///
/// <para>Dos decisiones viven aquí y no en el frontend, porque las dos son reglas de negocio:</para>
///
/// <list type="number">
/// <item><b>Si un cero es real o es «sin datos aún».</b> Un tablero que muestra cuatro ceros a una
/// organización recién creada enseña a ignorar el tablero. La regla es del dato, no del
/// calendario: si ayer no hubo planeación publicada, el indicador del día anterior dice que falta
/// el prerrequisito, aunque la organización ya opere.</item>
/// <item><b>Qué ve cada actor.</b> Los siete pasos se ven siempre —describen a la organización,
/// no a quien mira—, pero el destino de un paso sólo viaja si el actor puede entrar ahí, y los
/// indicadores y los asuntos de atención se filtran por permiso: ofrecer trabajo que no se puede
/// hacer es peor que no ofrecerlo.</item>
/// </list>
/// </summary>
public sealed class OverviewService(
    IOverviewRepository repository,
    IActorContext actor,
    IClock clock) : IOverviewService
{
    private const int TotalSteps = 7;

    public async Task<OverviewResponse> GetOverviewAsync(
        OverviewQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var today = clock.Today;
        var previousDay = today.AddDays(-1);
        var weekStart = StartOfWeek(today);
        var weekEnd = weekStart.AddDays(6);
        var nextWeekStart = weekStart.AddDays(7);

        var facts = await repository.GetFactsAsync(
            query.IdOrganization,
            today,
            previousDay,
            weekStart,
            weekEnd,
            nextWeekStart,
            nextWeekStart.AddDays(6),
            cancellationToken);

        return new OverviewResponse(
            today,
            previousDay,
            weekStart,
            weekEnd,
            BuildSetup(facts),
            BuildMetrics(facts, previousDay),
            BuildAttention(facts));
    }

    /// <summary>
    /// La semana operativa empieza en lunes.
    ///
    /// <para>No se usa la cultura del servidor: en <c>en-US</c> la semana empieza en domingo, y el
    /// mismo tablero mostraría semanas distintas según dónde corra el proceso.</para>
    /// </summary>
    private static DateOnly StartOfWeek(DateOnly date) =>
        date.AddDays(-(((int)date.DayOfWeek + 6) % 7));

    // ── El camino ────────────────────────────────────────────────────────────────────────────

    private OverviewSetupResponse BuildSetup(OverviewFacts facts)
    {
        var counts = facts.Counts;

        // Los cinco catálogos mínimos. Con cuatro el paso sigue abierto: el que falta bloquea algo
        // concreto más adelante, y darlo por bueno lo esconde hasta que alguien tropieza.
        var catalogsDone = counts.JobPositions > 0
            && counts.Skills > 0
            && counts.Zones > 0
            && counts.IncidentReasons > 0
            && counts.CoverageReasons > 0;

        var clientsDone = counts.ClientSites > 0;
        var servicesDone = counts.ServicesWithConfiguration > 0;
        var positionsDone = counts.PositionsWithPattern > 0;
        var employeesDone = counts.EmployeesWithFile > 0;
        var assignmentsDone = counts.PrimaryAssignments > 0;
        var planningDone = facts.WeekHasPublishedPlan;

        var steps = new List<OverviewSetupStepResponse>
        {
            Step(OverviewSetupStepKey.Catalogs, catalogsDone, [], "/catalogos", SecurityPermissions.CatalogsRead),
            Step(OverviewSetupStepKey.Clients, clientsDone, [], "/clientes", SecurityPermissions.ClientsRead,
                facts.ClientWithoutContactName),
            Step(OverviewSetupStepKey.Services, servicesDone, Blocking(clientsDone, OverviewSetupStepKey.Clients),
                "/servicios", SecurityPermissions.ClientsRead, facts.FirstServiceName),
            Step(OverviewSetupStepKey.Positions, positionsDone, Blocking(servicesDone, OverviewSetupStepKey.Services),
                "/servicios", SecurityPermissions.PlanningRead),
            Step(OverviewSetupStepKey.Employees, employeesDone, Blocking(catalogsDone, OverviewSetupStepKey.Catalogs),
                "/personal", SecurityPermissions.WorkforceRead),
            Step(OverviewSetupStepKey.Assignments, assignmentsDone,
                [.. Blocking(positionsDone, OverviewSetupStepKey.Positions),
                 .. Blocking(employeesDone, OverviewSetupStepKey.Employees)],
                "/servicios", SecurityPermissions.PlanningRead),
            Step(OverviewSetupStepKey.Planning, planningDone, Blocking(assignmentsDone, OverviewSetupStepKey.Assignments),
                "/planeacion", SecurityPermissions.PlanningRead),
        };

        return new OverviewSetupResponse(steps.Count(step => step.Done), TotalSteps, counts, steps);
    }

    private static OverviewSetupStepKey[] Blocking(bool prerequisiteDone, OverviewSetupStepKey key) =>
        prerequisiteDone ? [] : [key];

    private OverviewSetupStepResponse Step(
        OverviewSetupStepKey key,
        bool done,
        IReadOnlyList<OverviewSetupStepKey> blockedBy,
        string route,
        string permission,
        string? highlightName = null) =>
        new(key, (int)key, done, blockedBy, Allowed(permission) ? route : null, highlightName);

    // ── Los indicadores ──────────────────────────────────────────────────────────────────────

    private List<OverviewMetricResponse> BuildMetrics(OverviewFacts facts, DateOnly previousDay)
    {
        var counts = facts.Counts;
        var metrics = new List<OverviewMetricResponse>();

        if (Allowed(SecurityPermissions.PlanningRead))
        {
            // Sin versión publicada que cubra la semana no hay turnos que contar. Un cero aquí
            // diría «nadie trabaja esta semana», que es distinto de «nadie ha publicado nada».
            metrics.Add(new OverviewMetricResponse(
                OverviewMetricKey.PlannedShifts,
                facts.WeekHasPublishedPlan ? OverviewMetricState.Ready : OverviewMetricState.Pending,
                facts.PlannedShiftsInWeek,
                OverviewTone.Neutral,
                facts.PositionsPlannedInWeek,
                facts.ServicesPlannedInWeek,
                null,
                "/planeacion"));

            // Sin ninguna posición definida no hay cupo contra el que comparar: el hueco no es
            // cero, es incalculable.
            metrics.Add(new OverviewMetricResponse(
                OverviewMetricKey.PositionsWithoutPrimary,
                counts.Positions > 0 ? OverviewMetricState.Ready : OverviewMetricState.Pending,
                facts.PositionsWithoutPrimary,
                facts.PositionsWithoutPrimary > 0 ? OverviewTone.Danger : OverviewTone.Success,
                counts.Positions,
                facts.PositionsWithoutPrimaryServices,
                null,
                "/servicios"));
        }

        if (Allowed(SecurityPermissions.OperationsRead))
        {
            // La regla es del dato y no del calendario: si ayer no hubo planeación publicada, no
            // había turnos que cubrir, y decir «0 sin cubrir» sería felicitarse por nada.
            metrics.Add(new OverviewMetricResponse(
                OverviewMetricKey.UncoveredShiftsYesterday,
                facts.PreviousDayHasPublishedPlan ? OverviewMetricState.Ready : OverviewMetricState.Pending,
                facts.PreviousDayUncovered,
                facts.PreviousDayUncovered > 0 ? OverviewTone.Danger : OverviewTone.Success,
                facts.PreviousDayShifts,
                facts.PreviousDayUncoveredServices,
                previousDay,
                "/operacion/cobertura"));
        }

        if (Allowed(SecurityPermissions.WorkforceRead))
        {
            metrics.Add(new OverviewMetricResponse(
                OverviewMetricKey.ExpiredDocuments,
                facts.ActiveEmployees > 0 ? OverviewMetricState.Ready : OverviewMetricState.Pending,
                facts.EmployeesWithExpiredDocuments,
                facts.EmployeesWithExpiredDocuments > 0 ? OverviewTone.Warning : OverviewTone.Success,
                facts.ActiveEmployees,
                0,
                null,
                "/personal"));
        }

        return metrics;
    }

    // ── Lo que necesita atención ─────────────────────────────────────────────────────────────

    private List<OverviewAttentionResponse> BuildAttention(OverviewFacts facts)
    {
        var items = new List<OverviewAttentionResponse>();

        if (facts.PositionsWithoutPrimary > 0 && Allowed(SecurityPermissions.PlanningRead))
        {
            items.Add(new OverviewAttentionResponse(
                OverviewAttentionKey.PositionsWithoutPrimary,
                OverviewTone.Danger,
                facts.PositionsWithoutPrimary,
                facts.PositionsWithoutPrimaryServices,
                facts.OldestVacancyDate,
                "/servicios"));
        }

        if (facts.PreviousDayAbsencesWithoutIncident > 0 && Allowed(SecurityPermissions.OperationsRead))
        {
            items.Add(new OverviewAttentionResponse(
                OverviewAttentionKey.AbsencesWithoutIncident,
                OverviewTone.Danger,
                facts.PreviousDayAbsencesWithoutIncident,
                facts.PreviousDayAbsenceServices,
                null,
                "/operacion/incidencias"));
        }

        // Sólo tiene sentido pedir la semana siguiente cuando ya hay algo que planear.
        if (!facts.NextWeekIsPublished && facts.Counts.PrimaryAssignments > 0 && Allowed(SecurityPermissions.PlanningRead))
        {
            items.Add(new OverviewAttentionResponse(
                OverviewAttentionKey.NextWeekUnpublished,
                OverviewTone.Warning,
                1,
                0,
                null,
                "/planeacion"));
        }

        if (facts.PositionsWithoutPattern > 0 && Allowed(SecurityPermissions.PlanningRead))
        {
            items.Add(new OverviewAttentionResponse(
                OverviewAttentionKey.PositionsWithoutPattern,
                OverviewTone.Warning,
                facts.PositionsWithoutPattern,
                facts.PositionsWithoutPatternServices,
                null,
                "/servicios"));
        }

        if (facts.EmployeesWithExpiredDocuments > 0 && Allowed(SecurityPermissions.WorkforceRead))
        {
            items.Add(new OverviewAttentionResponse(
                OverviewAttentionKey.ExpiredDocuments,
                OverviewTone.Warning,
                facts.EmployeesWithExpiredDocuments,
                0,
                facts.OldestDocumentExpiryDate,
                "/personal"));
        }

        return items;
    }

    /// <summary>
    /// Si el actor puede entrar a un módulo.
    ///
    /// <para>El super admin pasa por encima, igual que en <c>PermissionEndpointFilter</c>. Sin
    /// esta rama el super admin vería sus propios pasos sin destino, porque su token lleva
    /// <c>PLATFORM.ADMIN</c> y no la lista completa de permisos.</para>
    /// </summary>
    private bool Allowed(string permission) =>
        actor.HasPermission(permission) || actor.HasPermission(SecurityPermissions.PlatformAdmin);
}
