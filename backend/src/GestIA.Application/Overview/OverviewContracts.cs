namespace GestIA.Application.Overview;

/// <summary>Los cuatro indicadores del tablero.</summary>
public enum OverviewMetricKey
{
    /// <summary>Turnos de la semana operativa que salen de una versión publicada.</summary>
    PlannedShifts,

    /// <summary>Posiciones sin una asignación titular vigente hoy.</summary>
    PositionsWithoutPrimary,

    /// <summary>Turnos del día anterior con falta y sin cobertura que la resuelva.</summary>
    UncoveredShiftsYesterday,

    /// <summary>Empleados activos con al menos un documento vencido.</summary>
    ExpiredDocuments
}

/// <summary>
/// La distinción que sostiene toda la pantalla.
///
/// <para><b><c>Ready</c> con valor 0 y <c>Pending</c> dicen cosas opuestas.</b> Cero significa que
/// se calculó y no hay nada: un logro operativo. <c>Pending</c> significa que el prerrequisito no
/// existe y el número no se pudo calcular. Mostrar el segundo como un cero le dice «todo bien» a
/// quien en realidad no ha configurado nada, y es la confusión que vuelve inútil un tablero.</para>
///
/// <para>Es una regla de negocio y por eso la decide el servidor. El frontend no la deduce.</para>
/// </summary>
public enum OverviewMetricState
{
    Ready,
    Pending
}

/// <summary>Cómo se lee un número. Nunca es lo único que lo dice: siempre va con su palabra.</summary>
public enum OverviewTone
{
    Neutral,
    Success,
    Warning,
    Danger
}

/// <summary>Los cinco tipos de asunto que pueden necesitar atención hoy.</summary>
public enum OverviewAttentionKey
{
    /// <summary>Posiciones sin titular vigente: dejan la cobertura del turno al descubierto.</summary>
    PositionsWithoutPrimary,

    /// <summary>Faltas del último día con asistencia que no abrieron su incidencia.</summary>
    AbsencesWithoutIncident,

    /// <summary>
    /// La semana siguiente sigue en borrador.
    ///
    /// <para>Ocupa el lugar donde el bosquejo dibujaba «conflictos de planeación». Esos no pueden
    /// existir: el traslape se rechaza al guardar, así que un borrador con traslape nunca llega a
    /// la base. Lo que sí impide que la semana arranque es que nadie la haya publicado.</para>
    /// </summary>
    NextWeekUnpublished,

    /// <summary>
    /// Posiciones sin un patrón que pueda proyectar turnos: sin patrón, o con un patrón vacío.
    ///
    /// <para>El bosquejo pedía «días del ciclo sin declarar», y eso <b>no se puede afirmar con
    /// este modelo</b>. Un <c>ShiftSegment</c> es un turno en un día de la semana, y un día de
    /// descanso es la <i>ausencia</i> de segmento: no hay forma de distinguir «descansa el jueves»
    /// de «nadie ha declarado el jueves». Lo que sí se puede afirmar, y bloquea igual, es que la
    /// posición no tiene con qué proyectar ni un turno.</para>
    /// </summary>
    PositionsWithoutPattern,

    /// <summary>Empleados activos con documentos vencidos: no pueden asignarse.</summary>
    ExpiredDocuments
}

/// <summary>
/// Un indicador.
///
/// <para><c>Total</c> es el universo contra el que se compara —posiciones, empleados, turnos del
/// día— y <c>ServiceCount</c> en cuántos servicios ocurre. Los dos existen porque un número solo
/// no dice de qué: «3» no es lo mismo que «3 de 38, en 2 servicios».</para>
///
/// <para><c>CoveredDays</c> sólo lo usa «turnos planeados de la semana», y existe por un caso que
/// apareció con datos reales: una versión publicada que cubre <b>un</b> día de la semana hace que
/// el indicador diga «27 turnos» como si la semana estuviera planeada, cuando seis de sus siete
/// días no tienen nada. Un número que parece calculado apoyado en un prerrequisito a medias es la
/// misma trampa que «sin datos aún», sólo que peor disimulada.</para>
/// </summary>
public sealed record OverviewMetricResponse(
    OverviewMetricKey Key,
    OverviewMetricState State,
    int Value,
    OverviewTone Tone,
    int Total,
    int ServiceCount,
    DateOnly? AsOfDate,
    string? Route,
    int CoveredDays = 0);

public sealed record OverviewAttentionResponse(
    OverviewAttentionKey Key,
    OverviewTone Severity,
    int Count,
    int ServiceCount,
    DateOnly? SinceDate,
    string? Route);

public sealed record OverviewResponse(
    DateOnly OperationDate,
    DateOnly PreviousOperationDate,
    DateOnly WeekStartDate,
    DateOnly WeekEndDate,
    IReadOnlyList<OverviewMetricResponse> Metrics,
    IReadOnlyList<OverviewAttentionResponse> Attention);

/// <summary>
/// Los hechos crudos que el repositorio calcula. El servicio los interpreta.
///
/// <para><c>Positions</c> y <c>PrimaryAssignmentsInForce</c> son los dos únicos conteos de
/// configuración que sobreviven al retiro del camino, y cada uno está por una razón concreta: sin
/// posiciones no hay universo contra el que medir la vacante, y sin ningún titular vigente no
/// tiene sentido reclamar que la semana siguiente siga en borrador.</para>
/// </summary>
public sealed record OverviewFacts(
    int Positions,
    int PrimaryAssignmentsInForce,
    int PlannedShiftsInWeek,
    int PlannedDaysInWeek,
    int ServicesPlannedInWeek,
    int PositionsPlannedInWeek,
    bool WeekHasPublishedPlan,
    bool PreviousDayHasPublishedPlan,
    int PreviousDayShifts,
    int PreviousDayUncovered,
    int PreviousDayUncoveredServices,
    int PreviousDayAbsencesWithoutIncident,
    int PreviousDayAbsenceServices,
    int PositionsWithoutPrimary,
    int PositionsWithoutPrimaryServices,
    DateOnly? OldestVacancyDate,
    int PositionsWithoutPattern,
    int PositionsWithoutPatternServices,
    int ActiveEmployees,
    int EmployeesWithExpiredDocuments,
    DateOnly? OldestDocumentExpiryDate,
    bool NextWeekIsPublished);

public sealed record OverviewQuery(Guid IdOrganization);
