using GestIA.Domain.Planning;

namespace GestIA.Domain.UnitTests;

public sealed class ShiftIntervalTests
{
    [Theory]
    [InlineData(0, 22, 8, 1, 5, 8, true)]
    [InlineData(1, 5, 8, 0, 22, 8, true)]
    [InlineData(0, 22, 8, 1, 6, 8, false)]
    [InlineData(0, 7, 12, 0, 19, 12, false)]
    [InlineData(0, 7, 12, 0, 18, 4, true)]
    public void ComparesFullIntervalsAcrossMidnight(int day, int hour, int hours, int otherDay, int otherHour, int otherHours, bool expected)
    {
        var date = new DateOnly(2026, 9, 3);
        var interval = new ShiftInterval(date.AddDays(day), new TimeOnly(hour, 0), hours * 60);
        var other = new ShiftInterval(date.AddDays(otherDay), new TimeOnly(otherHour, 0), otherHours * 60);
        Assert.Equal(expected, interval.Overlaps(other));
    }
}
