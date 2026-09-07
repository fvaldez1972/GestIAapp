namespace GestIA.Application.Documents;

public static class DocumentStorageReference
{
    public static bool IsSafeRelativePath(string reference)
    {
        if (string.IsNullOrWhiteSpace(reference) || reference != reference.Trim() ||
            reference.Any(character => char.IsControl(character) || ":%?*\"<>|".Contains(character)))
        {
            return false;
        }

        return reference.Replace('\\', '/').Split('/').All(segment =>
            segment.Length > 0 && segment is not "." and not ".." &&
            !segment.EndsWith('.') && !segment.EndsWith(' '));
    }

    public static bool BelongsToOrganization(string reference, Guid organizationId) =>
        IsSafeRelativePath(reference) && reference.Replace('\\', '/').StartsWith(
            $"business-documents/{organizationId:N}/", StringComparison.OrdinalIgnoreCase);
}
