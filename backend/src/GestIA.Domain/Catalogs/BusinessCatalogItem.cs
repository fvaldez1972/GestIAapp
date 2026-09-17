using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Catalogs;

public sealed record BusinessCatalogItemProfile(
    BusinessCatalogItemType Type,
    string Name,
    string? Description,
    int Order = 1,
    Guid? IdParentCatalogItem = null);

public sealed class BusinessCatalogItem : AuditableEntity, IOrganizationScopedEntity
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
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// El nombre plegado con el que se comprueba la unicidad. No se captura, no se muestra y
    /// <b>no se escribe desde aquí</b>: es una columna calculada por la base a partir del nombre.
    ///
    /// <para>La calcula la base y no el dominio por dos razones. Una: hay una migración ya
    /// desplegada que inserta valores de catálogo con SQL crudo listando columnas, y una columna
    /// que hubiera que rellenar la habría roto al reproducirla. Dos: así no existe la posibilidad
    /// de que una fila entre por un camino que se olvidó de calcularla.</para>
    ///
    /// <para><see cref="CatalogName.Normalize"/> reproduce la misma regla en memoria, para que el
    /// alta al vuelo pueda avisar del duplicado <b>antes</b> de mandar la petición.</para>
    /// </summary>
    public string NormalizedName { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int Order { get; private set; } = 1;
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
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Name);
        if (!Enum.IsDefined(profile.Type)) throw new ArgumentException("Unknown catalog type.");
        if (profile.Order < 1) throw new ArgumentOutOfRangeException(nameof(profile), "Order must be positive.");

        Type = profile.Type;
        Name = profile.Name.Trim();
        Description = string.IsNullOrWhiteSpace(profile.Description) ? null : profile.Description.Trim();
        IdParentCatalogItem = profile.IdParentCatalogItem;
        Order = profile.Order;
    }
}
