namespace GestIA.Domain.Planning;

public readonly record struct ShiftInterval(DateOnly Date, TimeOnly StartTime, int DurationMinutes)
{
    public bool Overlaps(ShiftInterval other)
    {
        var start = Date.ToDateTime(StartTime);
        var otherStart = other.Date.ToDateTime(other.StartTime);
        return start < otherStart.AddMinutes(other.DurationMinutes) && otherStart < start.AddMinutes(DurationMinutes);
    }
}
