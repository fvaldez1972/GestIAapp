using GestIA.Domain.Common;
using GestIA.Domain.Documents;

namespace GestIA.Domain.UnitTests;

public sealed class BusinessDocumentOwnershipTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void ChangingOwnerIsRejectedBeforeMutatingProfile(bool changeType)
    {
        var profile = Profile();
        var document = BusinessDocument.Create(Guid.NewGuid(), profile, Guid.NewGuid(), "Tester", DateTime.UtcNow);
        var changed = changeType ? profile with { OwnerType = BusinessDocumentOwnerType.Employee } : profile with { OwnerId = Guid.NewGuid() };
        var before = BusinessDocumentSnapshot.Capture(document);
        Assert.Throws<DomainRuleException>(() => document.UpdateProfile(changed, Guid.NewGuid(), "Tester", DateTime.UtcNow));
        Assert.Equal(before, BusinessDocumentSnapshot.Capture(document));
    }

    [Fact]
    public void SensitiveClassificationCannotBeRemoved()
    {
        var profile = Profile() with { IsSensitive = true };
        var document = BusinessDocument.Create(Guid.NewGuid(), profile, Guid.NewGuid(), "Tester", DateTime.UtcNow);
        Assert.Throws<DomainRuleException>(() => document.UpdateProfile(profile with { IsSensitive = false }, Guid.NewGuid(), "Tester", DateTime.UtcNow));
        Assert.True(document.IsSensitive);
    }

    private static BusinessDocumentProfile Profile() => new(BusinessDocumentOwnerType.Client, Guid.NewGuid(),
        "Contract", "Contract", BusinessDocumentStatus.PendingReview, null, null, "business-documents/test.pdf", false, null);
}
