using GestIA.Application.Planning;
using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class PlanningRepository(GestIaDbContext dbContext) : IPlanningRepository
{
    public Task<ServiceEntity?> GetServiceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken) =>
        dbContext.Services.SingleOrDefaultAsync(
            service =>
                service.IdService == idService &&
                service.IdClient == idClient &&
                service.Client.IdOrganization == idOrganization,
            cancellationToken);

    public async Task<IReadOnlyList<Position>> ListPositionsAsync(
        Guid idService,
        CancellationToken cancellationToken) =>
        await dbContext.Positions
            .AsNoTracking()
            .Where(position => position.IdService == idService)
            .OrderBy(position => position.CodePosition)
            .ToArrayAsync(cancellationToken);

    public Task<Position?> GetPositionAsync(
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken) =>
        dbContext.Positions.SingleOrDefaultAsync(
            position => position.IdService == idService && position.IdPosition == idPosition,
            cancellationToken);

    public Task<bool> IsPositionCodeInUseAsync(
        Guid idService,
        string codePosition,
        Guid? excludedPositionId,
        CancellationToken cancellationToken) =>
        dbContext.Positions
            .IgnoreQueryFilters()
            .AnyAsync(
                position =>
                    position.IdService == idService &&
                    position.CodePosition == codePosition &&
                    (!excludedPositionId.HasValue || position.IdPosition != excludedPositionId.Value),
                cancellationToken);

    public Task AddPositionAsync(Position position, CancellationToken cancellationToken) =>
        dbContext.Positions.AddAsync(position, cancellationToken).AsTask();

    public async Task<IReadOnlyList<ShiftPattern>> ListShiftPatternsAsync(
        Guid idPosition,
        CancellationToken cancellationToken) =>
        await dbContext.ShiftPatterns
            .AsNoTracking()
            .Where(pattern => pattern.IdPosition == idPosition)
            .OrderByDescending(pattern => pattern.EffectiveFromDate)
            .ThenBy(pattern => pattern.CodeShiftPattern)
            .ToArrayAsync(cancellationToken);

    public Task<ShiftPattern?> GetShiftPatternAsync(
        Guid idPosition,
        Guid idShiftPattern,
        CancellationToken cancellationToken) =>
        dbContext.ShiftPatterns.SingleOrDefaultAsync(
            pattern => pattern.IdPosition == idPosition && pattern.IdShiftPattern == idShiftPattern,
            cancellationToken);

    public Task<bool> IsShiftPatternCodeInUseAsync(
        Guid idPosition,
        string codeShiftPattern,
        Guid? excludedShiftPatternId,
        CancellationToken cancellationToken) =>
        dbContext.ShiftPatterns
            .IgnoreQueryFilters()
            .AnyAsync(
                pattern =>
                    pattern.IdPosition == idPosition &&
                    pattern.CodeShiftPattern == codeShiftPattern &&
                    (!excludedShiftPatternId.HasValue || pattern.IdShiftPattern != excludedShiftPatternId.Value),
                cancellationToken);

    public Task AddShiftPatternAsync(ShiftPattern shiftPattern, CancellationToken cancellationToken) =>
        dbContext.ShiftPatterns.AddAsync(shiftPattern, cancellationToken).AsTask();

    public async Task<IReadOnlyList<ShiftSegment>> ListShiftSegmentsAsync(
        Guid idShiftPattern,
        CancellationToken cancellationToken) =>
        await dbContext.ShiftSegments
            .AsNoTracking()
            .Where(segment => segment.IdShiftPattern == idShiftPattern)
            .OrderBy(segment => segment.DayOfWeek)
            .ThenBy(segment => segment.StartTime)
            .ToArrayAsync(cancellationToken);

    public Task<ShiftSegment?> GetShiftSegmentAsync(
        Guid idShiftPattern,
        Guid idShiftSegment,
        CancellationToken cancellationToken) =>
        dbContext.ShiftSegments.SingleOrDefaultAsync(
            segment => segment.IdShiftPattern == idShiftPattern && segment.IdShiftSegment == idShiftSegment,
            cancellationToken);

    public async Task<bool> HasSegmentOverlapAsync(
        Guid idShiftPattern,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        bool crossesMidnight,
        Guid? excludedShiftSegmentId,
        CancellationToken cancellationToken)
    {
        var newStart = Minutes(startTime);
        var newEnd = newStart + DurationMinutes(startTime, endTime, crossesMidnight);
        var existingSegments = await dbContext.ShiftSegments
            .AsNoTracking()
            .Where(segment =>
                segment.IdShiftPattern == idShiftPattern &&
                segment.DayOfWeek == dayOfWeek &&
                (!excludedShiftSegmentId.HasValue || segment.IdShiftSegment != excludedShiftSegmentId.Value))
            .Select(segment => new
            {
                segment.StartTime,
                segment.DurationMinutes
            })
            .ToArrayAsync(cancellationToken);

        return existingSegments.Any(segment =>
        {
            var existingStart = Minutes(segment.StartTime);
            var existingEnd = existingStart + segment.DurationMinutes;
            return newStart < existingEnd && existingStart < newEnd;
        });
    }

    public Task AddShiftSegmentAsync(ShiftSegment shiftSegment, CancellationToken cancellationToken) =>
        dbContext.ShiftSegments.AddAsync(shiftSegment, cancellationToken).AsTask();

    private static int Minutes(TimeOnly time) => time.Hour * 60 + time.Minute;

    private static int DurationMinutes(TimeOnly startTime, TimeOnly endTime, bool crossesMidnight)
    {
        var start = Minutes(startTime);
        var end = Minutes(endTime);
        return crossesMidnight ? (1440 - start) + end : end - start;
    }
}
