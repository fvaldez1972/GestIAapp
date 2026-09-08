using GestIA.Domain.Common;

namespace GestIA.Domain.Clients;

/// <summary>
/// Lleva su propia <c>IdOrganization</c> aunque la alcanzaría por su padre.
///
/// <para>Está denormalizada a propósito, y la decisión se tomó al revés de lo que dijo la tanda A.
/// Entonces la alternativa era "una columna redundante contra ningún costo". Con el filtro global
/// de la tanda B la alternativa pasó a ser un filtro por navegación, y eso hace que <b>el filtro
/// del hijo dependa del filtro del padre</b>: apagar uno sin el otro da resultados que hay que
/// razonar caso por caso, que es justo lo que el filtro global vino a evitar.</para>
///
/// <para>Es seguro porque la organización del padre es <b>inmutable</b>, y eso no es una
/// suposición: <c>OrganizationScopeTests</c> falla si alguien expone una vía de cambiarla.</para>
/// </summary>
public sealed class ClientSite : AuditableEntity, IOrganizationScopedEntity
{
    private ClientSite()
    {
    }

    private ClientSite(
        Guid idClientSite,
        Guid idOrganization,
        Guid idClient,
        string codeClientSite,
        ClientSiteAddress address,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdClientSite = idClientSite;
        IdOrganization = idOrganization;
        IdClient = idClient;
        CodeClientSite = Required(codeClientSite, nameof(codeClientSite)).ToUpperInvariant();
        ApplyAddress(address);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdClientSite { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdClient { get; private set; }
    public string CodeClientSite { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// El nombre plegado, que lo calcula SQL Server y sostiene la unicidad por cliente.
    ///
    /// <para>Existe por un defecto que se vio en vivo: el formulario de alta no se limpiaba al
    /// guardar, y pulsar otra vez creaba una sede idéntica. En la base viva quedaron cuatro
    /// «Vicente Eguia» del mismo cliente, creadas en dieciséis segundos.</para>
    ///
    /// <para>Es el mismo mecanismo que usa el catálogo, y por las mismas razones: columna calculada
    /// para no rellenar nada, e intercalación que ignora acentos y mayúsculas.</para>
    /// </summary>
    public string NormalizedName { get; private set; } = string.Empty;
    public string Street { get; private set; } = string.Empty;
    public string? ExteriorNumber { get; private set; }
    public string? InteriorNumber { get; private set; }
    public string? Neighborhood { get; private set; }
    public string Municipality { get; private set; } = string.Empty;
    public string State { get; private set; } = string.Empty;
    public string PostalCode { get; private set; } = string.Empty;
    public string CountryCode { get; private set; } = "MX";
    public string? AccessInstructions { get; private set; }
    public string? TimeZoneId { get; private set; }
    public Client Client { get; private set; } = null!;

    public static ClientSite Create(
        Guid idOrganization,
        Guid idClient,
        string codeClientSite,
        string name,
        string street,
        string municipality,
        string state,
        string postalCode,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        Create(
            idOrganization,
            idClient,
            codeClientSite,
            new ClientSiteAddress(
                name,
                street,
                null,
                null,
                null,
                municipality,
                state,
                postalCode,
                "MX",
                null,
                null),
            actorId,
            actorName,
            occurredAt);

    public static ClientSite Create(
        Guid idOrganization,
        Guid idClient,
        string codeClientSite,
        ClientSiteAddress address,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idClient, codeClientSite, address, actorId, actorName, occurredAt);

    public void UpdateAddress(
        ClientSiteAddress address,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyAddress(address);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyAddress(ClientSiteAddress address)
    {
        ArgumentNullException.ThrowIfNull(address);
        Name = Required(address.Name, nameof(address.Name));
        Street = Required(address.Street, nameof(address.Street));
        ExteriorNumber = Optional(address.ExteriorNumber);
        InteriorNumber = Optional(address.InteriorNumber);
        Neighborhood = Optional(address.Neighborhood);
        Municipality = Required(address.Municipality, nameof(address.Municipality));
        State = Required(address.State, nameof(address.State));
        PostalCode = Required(address.PostalCode, nameof(address.PostalCode));
        CountryCode = Required(address.CountryCode, nameof(address.CountryCode)).ToUpperInvariant();
        AccessInstructions = Optional(address.AccessInstructions);
        TimeZoneId = Optional(address.TimeZoneId);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record ClientSiteAddress(
    string Name,
    string Street,
    string? ExteriorNumber,
    string? InteriorNumber,
    string? Neighborhood,
    string Municipality,
    string State,
    string PostalCode,
    string CountryCode,
    string? AccessInstructions,
    string? TimeZoneId);
