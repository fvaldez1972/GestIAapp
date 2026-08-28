namespace GestIA.Application.Operations;

public interface IOperationsService
{
    Task<IReadOnlyList<AttendanceRecordResponse>> ListAttendanceAsync(AttendanceQuery query, CancellationToken cancellationToken);

    Task<AttendanceRecordResponse> UpsertAttendanceAsync(UpsertAttendanceRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<IncidentResponse>> ListIncidentsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken);

    Task<IncidentResponse> CreateIncidentAsync(CreateIncidentRequest request, CancellationToken cancellationToken);

    Task<IncidentResponse> UpdateIncidentAsync(Guid idIncident, UpdateIncidentRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<CoverageRecordResponse>> ListCoveragesAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken);

    Task<CoverageRecordResponse> CreateCoverageAsync(CreateCoverageRequest request, CancellationToken cancellationToken);

    Task<CoverageRecordResponse> UpdateCoverageAsync(Guid idCoverageRecord, UpdateCoverageRequest request, CancellationToken cancellationToken);

    Task<IReadOnlyList<OperationEvidenceResponse>> ListEvidencesAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid? relatedRecordId,
        CancellationToken cancellationToken);

    Task<OperationEvidenceResponse> CreateEvidenceAsync(OperationEvidenceInput request, CancellationToken cancellationToken);

    Task<OperationEvidenceResponse> UpdateEvidenceAsync(
        Guid idOperationEvidence,
        OperationEvidenceInput request,
        CancellationToken cancellationToken);

    Task DeactivateEvidenceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idOperationEvidence,
        CancellationToken cancellationToken);
}
