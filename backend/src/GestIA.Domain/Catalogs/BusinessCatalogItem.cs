using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Catalogs;

public sealed record BusinessCatalogItemProfile(
    BusinessCatalogItemType Type,
    string Code,
    string Name,
    string? Description,
    string Group = "General",
    int Order = 1,
    string[]? Synonyms = null,
    Guid? IdParentCatalogItem = null);

public sealed class BusinessCatalogItem : AuditableEntity
{
    private BusinessCatalogItem()
    {
    }

    private BusinessCatalogItem(
        Guid idBusinessCatalogItem,
        Guid idOrganization,
        BusinessCatalogItemProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdBusinessCatalogItem = idBusinessCatalogItem;
        IdOrganization = idOrganization;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdBusinessCatalogItem { get; private set; }
    public Guid IdOrganization { get; private set; }
    public BusinessCatalogItemType Type { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Group { get; private set; } = "General";
    public int Order { get; private set; } = 1;
    public string[] Synonyms { get; private set; } = [];
    public Guid? IdParentCatalogItem { get; private set; }
    public Organization Organization { get; private set; } = null!;

    public static BusinessCatalogItem Create(
        Guid idOrganization,
        BusinessCatalogItemProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        BusinessCatalogItemProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(BusinessCatalogItemProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Code);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Name);
        if (!Enum.IsDefined(profile.Type)) throw new ArgumentException("Unknown catalog type.");
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Group);
        if (profile.Order < 1) throw new ArgumentOutOfRangeException(nameof(profile), "Order must be positive.");

        Type = profile.Type;
        Code = profile.Code.Trim().ToUpperInvariant();
        Name = profile.Name.Trim();
        Description = string.IsNullOrWhiteSpace(profile.Description) ? null : profile.Description.Trim();
        Group = profile.Group.Trim();
        IdParentCatalogItem = profile.IdParentCatalogItem;
        Order = profile.Order;
        Synonyms = (profile.Synonyms ?? []).Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }
}
