using GestIA.Application.Documents;

namespace GestIA.Application.UnitTests;

public sealed class DocumentStorageReferenceTests
{
    [Theory]
    [InlineData("../business-documents/file.pdf")]
    [InlineData("operation-evidences/../business-documents/file.pdf")]
    [InlineData("operation-evidences/..\\business-documents/file.pdf")]
    [InlineData("business-documents/.. /file.pdf")]
    [InlineData("/business-documents/file.pdf")]
    [InlineData("C:/storage/file.pdf")]
    [InlineData("business-documents/file.pdf:secret")]
    [InlineData("business-documents//file.pdf")]
    [InlineData("business-documents/%2e%2e/file.pdf")]
    [InlineData("business-documents/file.pdf.")]
    public void RejectsTraversalAndAmbiguousPaths(string reference) =>
        Assert.False(DocumentStorageReference.IsSafeRelativePath(reference));

    [Fact]
    public void OrganizationPrefixIsExact()
    {
        var organizationId = Guid.NewGuid();
        Assert.True(DocumentStorageReference.BelongsToOrganization($"business-documents/{organizationId:N}/2026/09/file.pdf", organizationId));
        Assert.False(DocumentStorageReference.BelongsToOrganization($"business-documents/{Guid.NewGuid():N}/2026/09/file.pdf", organizationId));
        Assert.False(DocumentStorageReference.BelongsToOrganization($"business-documents/{organizationId:N}-other/file.pdf", organizationId));
        Assert.False(DocumentStorageReference.BelongsToOrganization("business-documents/2026/09/file.pdf", organizationId));
    }
}
