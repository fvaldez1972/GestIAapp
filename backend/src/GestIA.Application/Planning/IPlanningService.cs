namespace GestIA.Application.Planning;

public interface IPlanningService
{
    Task<IReadOnlyList<PositionResponse>> ListPositionsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken);

    Task<PositionResponse> CreatePositionAsync(CreatePositionRequest request, CancellationToken cancellationToken);

    Task<PositionResponse> UpdatePositionAsync(
        Guid idPosition,
        UpdatePositionRequest request,
        CancellationToken cancellationToken);

    Task DeactivatePositionAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ShiftPatternResponse>> ListShiftPatternsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken);

    Task<ShiftPatternResponse> CreateShiftPatternAsync(
        CreateShiftPatternRequest request,
        CancellationToken cancellationToken);

    Task<ShiftPatternResponse> UpdateShiftPatternAsync(
        Guid idShiftPattern,
        UpdateShiftPatternRequest request,
        CancellationToken cancellationToken);

    Task DeactivateShiftPatternAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        Guid idShiftPattern,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ShiftSegmentResponse>> ListShiftSegmentsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        Guid idShiftPattern,
        CancellationToken cancellationToken);

    Task<ShiftSegmentResponse> CreateShiftSegmentAsync(
        CreateShiftSegmentRequest request,
        CancellationToken cancellationToken);

    Task<ShiftSegmentResponse> UpdateShiftSegmentAsync(
        Guid idShiftSegment,
        UpdateShiftSegmentRequest request,
        CancellationToken cancellationToken);

    Task DeactivateShiftSegmentAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idPosition,
        Guid idShiftPattern,
        Guid idShiftSegment,
        CancellationToken cancellationToken);
}
