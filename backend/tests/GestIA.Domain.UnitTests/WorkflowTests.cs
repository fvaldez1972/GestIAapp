using GestIA.Domain.Common;
using GestIA.Domain.Documents;
using GestIA.Domain.Operations;
using GestIA.Domain.Requests;

namespace GestIA.Domain.UnitTests;

public sealed class WorkflowTests
{
    private static readonly Guid ActorId = Guid.Parse("93b9d6c4-8f34-4c0a-8dc7-44328993b6df");
    private static readonly DateTime Now = new(2026, 9, 3, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void NewDocumentCannotBypassReview()
    {
        var document = CreateDocument();
        Assert.Equal(BusinessDocumentStatus.PendingReview, document.Status);
        Assert.Null(document.ReviewedAt);
    }

    [Fact]
    public void DocumentReviewRecordsDecisionAndEditingRequiresReviewAgain()
    {
        var document = CreateDocument();
        document.Review(BusinessDocumentStatus.Validated, "Verified", ActorId, "Reviewer", Now);
        Assert.Equal(BusinessDocumentStatus.Validated, document.Status);
        Assert.Equal(Now, document.ReviewedAt);
        Assert.Equal("Reviewer", document.ReviewedByName);
        document.UpdateProfile(DocumentProfile() with { OwnerId = document.OwnerId }, ActorId, "Editor", Now.AddMinutes(1));
        Assert.Equal(BusinessDocumentStatus.PendingReview, document.Status);
        Assert.Null(document.ReviewedAt);
    }

    [Fact]
    public void RejectingDocumentRequiresReason()
    {
        var document = CreateDocument();
        Assert.Throws<ArgumentException>(() => document.Review(BusinessDocumentStatus.Rejected, null, ActorId, "Reviewer", Now));
    }

    [Fact]
    public void RequestRequiresReviewBeforeApproval()
    {
        var request = OperationalRequest.Create(Guid.NewGuid(), null, null, "REQ-1", OperationalRequestType.NewService,
            OperationalRequestPriority.Medium, "New service", "Description", "Requester", null, ActorId, "Admin", Now);
        Assert.Equal(OperationalRequestStatus.Draft, request.Status);
        Assert.Throws<DomainRuleException>(() => request.ChangeStatus(OperationalRequestStatus.Approved, null, ActorId, "Admin", Now));
        request.ChangeStatus(OperationalRequestStatus.Submitted, null, ActorId, "Admin", Now);
        request.ChangeStatus(OperationalRequestStatus.InReview, null, ActorId, "Admin", Now);
        request.ChangeStatus(OperationalRequestStatus.Approved, null, ActorId, "Admin", Now);
        Assert.Equal(OperationalRequestStatus.Approved, request.Status);
    }

    [Fact]
    public void IncidentRequiresResolutionToClose()
    {
        var profile = new IncidentProfile(null, null, DateOnly.FromDateTime(Now), "Absence", IncidentSeverity.Low,
            IncidentStatus.Open, "Description", null);
        var incident = Incident.Create(Guid.NewGuid(), Guid.NewGuid(), profile, ActorId, "Admin", Now);
        Assert.Throws<DomainRuleException>(() => incident.UpdateProfile(profile with { Status = IncidentStatus.Resolved }, ActorId, "Admin", Now));
        incident.UpdateProfile(profile with { Status = IncidentStatus.Resolved, ResolutionNotes = "Replacement assigned" }, ActorId, "Admin", Now);
        Assert.Equal(IncidentStatus.Resolved, incident.Status);
    }

    [Fact]
    public void CoverageRequiresSeparateConfirmation()
    {
        var profile = new CoverageRecordProfile(Guid.NewGuid(), new TimeOnly(7, 0), new TimeOnly(19, 0), false, CoverageStatus.Completed, null);
        var coverage = CoverageRecord.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), profile, ActorId, "Admin", Now);
        Assert.Equal(CoverageStatus.Requested, coverage.Status);
        Assert.Throws<DomainRuleException>(() => coverage.UpdateProfile(profile, ActorId, "Admin", Now));
        coverage.UpdateProfile(profile with { Status = CoverageStatus.Confirmed }, ActorId, "Admin", Now);
        coverage.UpdateProfile(profile, ActorId, "Admin", Now);
        Assert.Equal(CoverageStatus.Completed, coverage.Status);
    }

    private static BusinessDocument CreateDocument() => BusinessDocument.Create(Guid.NewGuid(), DocumentProfile(), ActorId, "Admin", Now);

    private static BusinessDocumentProfile DocumentProfile() => new(BusinessDocumentOwnerType.Client, Guid.NewGuid(), "Contract", "Contract",
        BusinessDocumentStatus.Validated, null, null, "business-documents/test.pdf", false, null);
}
