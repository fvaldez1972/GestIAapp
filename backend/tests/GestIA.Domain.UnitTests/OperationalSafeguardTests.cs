using GestIA.Domain.Common;
using GestIA.Domain.Operations;
using GestIA.Domain.Requests;

namespace GestIA.Domain.UnitTests;

public sealed class OperationalSafeguardTests
{
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 9, 3, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(CoverageStatus.Completed)]
    [InlineData(CoverageStatus.Cancelled)]
    public void ClosedCoverageOnlyAcceptsAnIdenticalReplay(CoverageStatus status)
    {
        var profile = Profile();
        var coverage = CoverageRecord.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), profile, Actor, "Test", Now);
        coverage.UpdateProfile(profile with { Status = CoverageStatus.Confirmed }, Actor, "Test", Now);
        profile = profile with { Status = status };
        coverage.UpdateProfile(profile, Actor, "Test", Now);
        coverage.UpdateProfile(profile, Actor, "Test", Now.AddMinutes(1));

        Assert.Equal(Now, coverage.UpdatedAt);
        Assert.Throws<DomainRuleException>(() => coverage.UpdateProfile(
            profile with { IdReplacementEmployee = Guid.NewGuid() }, Actor, "Test", Now));
        Assert.Throws<DomainRuleException>(() => coverage.UpdateProfile(
            profile with { Notes = "Rewritten" }, Actor, "Test", Now));
        Assert.Throws<DomainRuleException>(() => coverage.UpdateProfile(
            profile with { Status = CoverageStatus.Requested }, Actor, "Test", Now));
    }

    [Fact]
    public void ConfirmedCoverageCannotChangeAllocationWhileCompleting()
    {
        var profile = Profile();
        var coverage = CoverageRecord.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), profile, Actor, "Test", Now);
        coverage.UpdateProfile(profile with { Status = CoverageStatus.Confirmed }, Actor, "Test", Now);
        Assert.Throws<DomainRuleException>(() => coverage.UpdateProfile(
            profile with { Status = CoverageStatus.Completed, CoverageEndTime = new TimeOnly(16, 0) },
            Actor, "Test", Now));
    }

    [Fact]
    public void CancellationCannotReassignCoverage()
    {
        var profile = Profile();
        var coverage = CoverageRecord.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), profile, Actor, "Test", Now);
        Assert.Throws<DomainRuleException>(() => coverage.UpdateProfile(
            profile with { Status = CoverageStatus.Cancelled, IdReplacementEmployee = Guid.NewGuid() },
            Actor, "Test", Now));
    }

    [Fact]
    public void OvernightCoverageUsesTheActualNextDayAndMustFitTheShift()
    {
        var day = new DateOnly(2026, 9, 3);
        var interval = CoverageInterval.WithinShift(day, new TimeOnly(22, 0), 480, new TimeOnly(1, 0), 180);
        Assert.Equal(day.AddDays(1), interval.Date);
        Assert.Throws<DomainRuleException>(() =>
            CoverageInterval.WithinShift(day, new TimeOnly(22, 0), 480, new TimeOnly(5, 0), 120));
        Assert.Throws<DomainRuleException>(() =>
            CoverageInterval.WithinShift(day, new TimeOnly(8, 0), 480, new TimeOnly(7, 0), 60));
    }

    [Fact]
    public void CompletedRequestCannotBeEditedOrReopened()
    {
        var request = OperationalRequest.Create(Guid.NewGuid(), null, null, "REQ", OperationalRequestType.Other,
            OperationalRequestPriority.Medium, "Test", "Description", "User", null, Actor, "Test", Now);
        foreach (var status in new[] { OperationalRequestStatus.Submitted, OperationalRequestStatus.InReview,
            OperationalRequestStatus.Approved, OperationalRequestStatus.Completed })
        {
            request.ChangeStatus(status, "Done", Actor, "Test", Now);
        }

        Assert.Throws<DomainRuleException>(() => request.UpdateDetails(null, null, OperationalRequestType.NewClient,
            OperationalRequestPriority.Medium, "Changed", "Description", "User", null, Actor, "Test", Now));
        Assert.Throws<DomainRuleException>(() => request.ChangeStatus(
            OperationalRequestStatus.Draft, null, Actor, "Test", Now));
    }

    private static CoverageRecordProfile Profile() =>
        new(Guid.NewGuid(), new TimeOnly(8, 0), new TimeOnly(17, 0), false, CoverageStatus.Requested, null);
}
