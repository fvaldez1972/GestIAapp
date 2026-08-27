using GestIA.Domain.Common;

namespace GestIA.Domain.Organizations;

public sealed class Organization : AuditableEntity
{
    private Organization()
    {
    }

    private Organization(
        Guid idOrganization,
        string codeOrganization,
        string legalName,
        string? rfc,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdOrganization = idOrganization;
        CodeOrganization = Required(codeOrganization, nameof(codeOrganization));
        LegalName = Required(legalName, nameof(legalName));
        Rfc = Optional(rfc);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdOrganization { get; private set; }
    public string CodeOrganization { get; private set; } = string.Empty;
    public string LegalName { get; private set; } = string.Empty;
    public string? Rfc { get; private set; }

    public static Organization Create(
        string codeOrganization,
        string legalName,
        string? rfc,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), codeOrganization, legalName, rfc, actorId, actorName, occurredAt);

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
