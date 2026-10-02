namespace GestIA.Application.Reports;

public sealed record OperationsSummaryQuery(
    Guid IdOrganization,
    Guid? IdClient,
    Guid? IdService,
    DateOnly? FromDate,
    DateOnly? ToDate);

public sealed record OperationsSummaryResponse(
    int AttendanceRecords,
    int PresentAttendance,
    int LateAttendance,
    int AbsentAttendance,
    int ExcusedAttendance,
    int Incidents,
    int OpenIncidents,
    int CriticalIncidents,
    int CoverageRecords,
    int ConfirmedCoverages,
    int CompletedCoverages,
    int CoveredMinutes,
    int PendingApprovals,
    int ClosedOperationDays);

public sealed record OperationsServiceSummaryResponse(
    Guid IdClient,
    string ClientName,
    Guid IdService,
    string CodeService,
    string ServiceName,
    int AttendanceRecords,
    int PresentAttendance,
    int LateAttendance,
    int AbsentAttendance,
    int ExcusedAttendance,
    int Incidents,
    int OpenIncidents,
    int CriticalIncidents,
    int CoverageRecords,
    int ConfirmedCoverages,
    int CompletedCoverages,
    int CoveredMinutes,
    int PendingApprovals,
    int ClosedOperationDays);

public sealed record WorkforceEligibilityQuery(
    Guid IdOrganization,
    DateOnly ReferenceDate,
    string? Search);

public sealed record WorkforceEligibilityResponse(
    Guid IdEmployee,
    string CodeEmployee,
    string FullName,
    string? JobTitle,
    bool IsEligible,
    /// <summary>
    /// Si no había <b>ninguna regla activa</b> que aplicara a esta persona.
    ///
    /// <para>Es un tercer estado, y hace falta. «Elegible» afirma que se comprobó y se cumplió;
    /// esto admite que no se comprobó nada, porque no hay nada configurado. Tratarlos igual
    /// convierte la ausencia de configuración en un visto bueno, y el caso donde más duele es el
    /// que más se repite: una organización recién dada de alta enseñaría una lista vacía que
    /// parece tranquilizadora y no lo es.</para>
    ///
    /// <para>Existía en el validador manual de Catálogos, que decía «sin reglas suficientes para
    /// concluir». Se retiró con esa pantalla el 19 de septiembre de 2026 y el matiz se perdió;
    /// vuelve aquí, que es donde heredó el trabajo.</para>
    /// </summary>
    bool HasNoApplicableRules,
    IReadOnlyList<string> Reasons,
    int ExpiredDocuments,
    int RejectedDocuments,
    int InvalidEvaluations);
