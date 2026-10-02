using GestIA.Domain.Common;
using GestIA.Domain.Planning;

namespace GestIA.Domain.Operations;

public static class CoverageInterval
{
    public static ShiftInterval WithinShift(
        DateOnly shiftDate, TimeOnly shiftStartTime, int shiftDurationMinutes,
        TimeOnly coverageStartTime, int coverageDurationMinutes)
    {
        var shiftStart = shiftDate.ToDateTime(shiftStartTime);
        var coverageStart = shiftDate.ToDateTime(coverageStartTime);
        if (coverageStart < shiftStart)
        {
            coverageStart = coverageStart.AddDays(1);
        }

        if (coverageDurationMinutes <= 0 ||
            coverageStart.AddMinutes(coverageDurationMinutes) > shiftStart.AddMinutes(shiftDurationMinutes))
        {
            throw new DomainRuleException("La cobertura debe quedar dentro del horario del turno original.");
        }

        return new ShiftInterval(DateOnly.FromDateTime(coverageStart), coverageStartTime, coverageDurationMinutes);
    }
}
