using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

internal static class CoverageConflicts
{
    public static async Task<bool> HasOverlapAsync(
        GestIaDbContext dbContext,
        Guid idOrganization,
        Guid idEmployee,
        ShiftInterval interval,
        Guid? idScheduledShift,
        Guid? excludedCoverageId,
        CancellationToken cancellationToken)
    {
        // A coverage after midnight belongs to the preceding shift's date.
        var firstDate = interval.Date.AddDays(-2);
        var lastDate = interval.Date.AddDays(1);
        var coverages = await dbContext.CoverageRecords.AsNoTracking()
            .Where(record =>
                record.IdOrganization == idOrganization &&
                record.Status != CoverageStatus.Cancelled &&
                (record.IdReplacementEmployee == idEmployee || record.IdScheduledShift == idScheduledShift) &&
                record.IdCoverageRecord != excludedCoverageId &&
                record.ScheduledShift.ShiftDate >= firstDate &&
                record.ScheduledShift.ShiftDate <= lastDate)
            .Select(record => new
            {
                record.ScheduledShift.ShiftDate,
                ShiftStart = record.ScheduledShift.StartTime,
                record.CoverageStartTime,
                record.DurationMinutes
            })
            .ToArrayAsync(cancellationToken);

        return coverages.Any(record =>
        {
            var date = record.CoverageStartTime < record.ShiftStart
                ? record.ShiftDate.AddDays(1)
                : record.ShiftDate;
            return interval.Overlaps(new ShiftInterval(date, record.CoverageStartTime, record.DurationMinutes));
        });
    }
}
