using System.Text.Json.Serialization;
using GestIA.Domain.Operations;

namespace GestIA.Application.Operations;

public sealed record AttendanceQuery(Guid IdOrganization, Guid IdClient, Guid IdService, DateOnly? Date);

/// <summary>
/// <b>El unico contrato de escritura donde el token de concurrencia es opcional</b>, y la razon es
/// que este endpoint crea o corrige con la misma peticion: en un alta no hay version previa que
/// pisar, asi que exigir el token haria imposible capturar la primera asistencia del turno.
///
/// <para>La licencia llega hasta ahi. Cuando el registro ya existe, la rama de correccion de
/// <c>UpsertAttendanceAsync</c> exige el token y responde 428 si falta. Que aqui sea anulable no
/// significa que corregir sin token este permitido; significa que la obligacion no la puede
/// expresar el tipo, porque depende de si la fila existe.</para>
/// </summary>
public sealed record UpsertAttendanceRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdScheduledShift,
    AttendanceStatus Status,
    TimeOnly? ActualStartTime,
    TimeOnly? ActualEndTime,
    int MinutesLate,
    string? Notes,
    Guid? IdApprovalRequest,
    string? CorrectionReason = null,
    byte[]? RowVersion = null);

public sealed record AttendanceRecordResponse(
    Guid IdAttendanceRecord,
    Guid IdScheduledShift,
    Guid IdEmployee,
    string EmployeeCode,
    string EmployeeName,
    DateOnly AttendanceDate,
    AttendanceStatus Status,
    TimeOnly? ActualStartTime,
    TimeOnly? ActualEndTime,
    int MinutesLate,
    string? Notes,
    bool Active,
    byte[] RowVersion);

public sealed record CreateIncidentRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid? IdScheduledShift,
    Guid? IdEmployee,
    DateOnly IncidentDate,
    string IncidentType,
    IncidentSeverity Severity,
    IncidentStatus Status,
    string Description,
    string? ResolutionNotes);

public sealed record UpdateIncidentRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid? IdScheduledShift,
    Guid? IdEmployee,
    DateOnly IncidentDate,
    string IncidentType,
    IncidentSeverity Severity,
    IncidentStatus Status,
    string Description,
    string? ResolutionNotes,
    [property: JsonRequired] byte[] RowVersion,
    string? CorrectionReason = null);

public sealed record IncidentResponse(
    Guid IdIncident,
    Guid IdService,
    Guid? IdScheduledShift,
    Guid? IdEmployee,
    string? EmployeeCode,
    string? EmployeeName,
    DateOnly IncidentDate,
    string IncidentType,
    IncidentSeverity Severity,
    IncidentStatus Status,
    string Description,
    string? ResolutionNotes,
    bool Active,
    /// <summary>
    /// Cuándo se registró la incidencia, en UTC.
    ///
    /// <para><b>Viaja porque la pantalla lo necesita para una marca que no se guarda.</b> Una
    /// incidencia es «posterior al cierre» si se creó después del <c>ClosedAt</c> del cierre
    /// vigente de su servicio y su fecha. Es reconstruible, como la vacancia de posiciones, así que
    /// no hay columna que lo diga: pero sin este instante en la respuesta no se puede reconstruir
    /// nada, y la marca quedaría en un dibujo que la aplicación no sabe pintar.</para>
    /// </summary>
    DateTime CreatedAt,
    byte[] RowVersion);

public sealed record CreateCoverageRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdScheduledShift,
    Guid IdReplacementEmployee,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    CoverageStatus Status,
    string? Notes,
    Guid? IdCoverageReason = null);

public sealed record UpdateCoverageRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdReplacementEmployee,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    CoverageStatus Status,
    string? Notes,
    [property: JsonRequired] byte[] RowVersion,
    Guid? IdCoverageReason = null,
    string? CorrectionReason = null);

public sealed record CoverageRecordResponse(
    Guid IdCoverageRecord,
    Guid IdScheduledShift,
    Guid IdOriginalEmployee,
    string OriginalEmployeeCode,
    string OriginalEmployeeName,
    Guid IdReplacementEmployee,
    string ReplacementEmployeeCode,
    string ReplacementEmployeeName,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    int DurationMinutes,
    CoverageStatus Status,
    string? Notes,
    bool Active,
    byte[] RowVersion,
    Guid? IdCoverageReason = null);

public sealed record OperationEvidenceInput(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid? IdAttendanceRecord,
    Guid? IdIncident,
    Guid? IdCoverageRecord,
    OperationEvidenceType EvidenceType,
    string Title,
    string StorageReference,
    string? Notes);

public sealed record OperationEvidenceResponse(
    Guid IdOperationEvidence,
    Guid IdService,
    Guid? IdAttendanceRecord,
    Guid? IdIncident,
    Guid? IdCoverageRecord,
    OperationEvidenceType EvidenceType,
    string Title,
    string StorageReference,
    string? Notes,
    bool Active);

public sealed record ApprovalRequestQuery(
    Guid IdOrganization,
    Guid? IdService,
    ApprovalRequestStatus? Status);

public sealed record CreateApprovalRequestRequest(
    Guid IdOrganization,
    Guid IdService,
    ApprovalRequestType ApprovalType,
    string EntityType,
    Guid EntityId,
    string Reason,
    string? RequestedChangeSummary,
    string? AssignedApproverName,
    Guid? IdOperationEvidence);

public sealed record DecideApprovalRequestRequest(
    Guid IdOrganization,
    ApprovalRequestStatus Status,
    string? DecisionNotes);

public sealed record ApprovalRequestResponse(
    Guid IdApprovalRequest,
    Guid IdOrganization,
    Guid IdService,
    ApprovalRequestType ApprovalType,
    string EntityType,
    Guid EntityId,
    string Reason,
    string? RequestedChangeSummary,
    string? AssignedApproverName,
    Guid? IdOperationEvidence,
    ApprovalRequestStatus Status,
    DateTime RequestedAt,
    string RequestedByName,
    DateTime? DecidedAt,
    string? DecidedByName,
    string? DecisionNotes,
    bool Active);

public sealed record OperationDayClosureQuery(
    Guid IdOrganization,
    Guid? IdService,
    DateOnly? FromDate,
    DateOnly? ToDate);

public sealed record CloseOperationDayRequest(
    Guid IdOrganization,
    DateOnly OperationDate,
    string? Notes);

public sealed record ReopenOperationDayRequest(
    Guid IdOrganization,
    string Reason,
    [property: JsonRequired] byte[] RowVersion);

public sealed record OperationDayClosureResponse(
    Guid IdOperationDayClosure,
    Guid IdOrganization,
    Guid IdService,
    DateOnly OperationDate,
    int ExpectedShifts,
    int AttendanceRecords,
    int PendingAttendance,
    int OpenIncidents,
    int CoverageRecords,
    string? Notes,
    OperationDayClosureStatus Status,
    DateTime ClosedAt,
    string ClosedByName,
    DateTime? ReopenedAt,
    string? ReopenedByName,
    string? ReopenReason,
    bool Active,
    byte[] RowVersion);
