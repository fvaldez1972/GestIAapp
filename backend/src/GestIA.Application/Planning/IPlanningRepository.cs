using GestIA.Domain.Planning;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Application.Planning;

public interface IPlanningRepository
{
    Task<ServiceEntity?> GetServiceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Position>> ListPositionsAsync(Guid idService, CancellationToken cancellationToken);

    Task<Position?> GetPositionAsync(
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken);

    Task<bool> IsPositionCodeInUseAsync(
        Guid idService,
        string codePosition,
        Guid? excludedPositionId,
        CancellationToken cancellationToken);

    Task AddPositionAsync(Position position, CancellationToken cancellationToken);

    Task<IReadOnlyList<ShiftPattern>> ListShiftPatternsAsync(Guid idPosition, CancellationToken cancellationToken);

    Task<ShiftPattern?> GetShiftPatternAsync(
        Guid idPosition,
        Guid idShiftPattern,
        CancellationToken cancellationToken);

    Task<bool> IsShiftPatternCodeInUseAsync(
        Guid idPosition,
        string codeShiftPattern,
        Guid? excludedShiftPatternId,
        CancellationToken cancellationToken);

    Task AddShiftPatternAsync(ShiftPattern shiftPattern, CancellationToken cancellationToken);

    Task<IReadOnlyList<ShiftSegment>> ListShiftSegmentsAsync(Guid idShiftPattern, CancellationToken cancellationToken);

    Task<ShiftSegment?> GetShiftSegmentAsync(
        Guid idShiftPattern,
        Guid idShiftSegment,
        CancellationToken cancellationToken);

    Task<bool> HasSegmentOverlapAsync(
        Guid idShiftPattern,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        bool crossesMidnight,
        Guid? excludedShiftSegmentId,
        CancellationToken cancellationToken);

    Task AddShiftSegmentAsync(ShiftSegment shiftSegment, CancellationToken cancellationToken);
}
