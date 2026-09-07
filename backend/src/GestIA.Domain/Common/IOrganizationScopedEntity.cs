namespace GestIA.Domain.Common;

/// <summary>
/// Marks a record that belongs to exactly one organization and carries that organization in its
/// own column, instead of reaching it through a chain of relationships.
///
/// The organization is immutable: it is set when the record is created and no entity exposes a
/// public way to change it. That immutability is what makes the denormalized column safe to
/// keep, and an architecture test enforces it.
///
/// Not implemented by <see cref="GestIA.Domain.Organizations.Organization"/>, which is the root,
/// nor by the security entities, which are organization independent by design.
/// </summary>
public interface IOrganizationScopedEntity
{
    Guid IdOrganization { get; }
}
