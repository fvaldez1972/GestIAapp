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
}
