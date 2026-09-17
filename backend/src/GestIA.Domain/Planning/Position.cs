using GestIA.Domain.Common;
using GestIA.Domain.Services;

namespace GestIA.Domain.Planning;

/// <summary>
/// Lo que define un puesto del servicio, incluido lo que se cobra por el.
///
/// <para>El precio vive aqui y no en el servicio porque en seguridad privada se cotiza <b>por
/// puesto</b>: un servicio con caseta, rondin y monitorista tiene tres precios, no uno. Antes
/// estaba en una configuracion del servicio, que obligaba a un solo numero para todos los puestos
/// y ademas repetia en texto libre el horario que el patron de turnos ya declara.</para>
/// </summary>
public sealed record PositionProfile(
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    string? Notes,
    Guid? IdJobPositionCatalogItem = null,
    decimal Price = 0m,
    string CurrencyCode = "MXN",
    bool IsTaxIncluded = false,
    PaymentFrequency PriceFrequency = PaymentFrequency.Monthly);

public sealed class Position : AuditableEntity, IOrganizationScopedEntity
{
    private readonly List<ShiftPattern> shiftPatterns = [];

    private Position()
    {
    }

    private Position(
        Guid idPosition,
        Guid idOrganization,
        Guid idService,
        string codePosition,
        PositionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdPosition = idPosition;
        IdOrganization = idOrganization;
        IdService = idService;
        CodePosition = Required(codePosition, nameof(codePosition)).ToUpperInvariant();
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdPosition { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdService { get; private set; }
    public string CodePosition { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int RequiredWorkerCount { get; private set; }
    /// <summary>
    /// El puesto, por identificador contra el catálogo <c>JobPosition</c>.
    ///
    /// <para><b>Es nulable, y eso significa algo distinto de "no cumple".</b> Un valor nulo dice
    /// "no sabemos cuál es su puesto", normalmente porque el texto libre heredado no correspondía
    /// a ninguna entrada del catálogo. La elegibilidad <b>no bloquea</b> por un nulo: no es lo
    /// mismo no cumplir el perfil que no saber cuál es, y tratarlos igual impediría asignar a
    /// gente que sí puede.</para>
    ///
    /// <para>Convive con el texto libre, que se conserva sin tocar hasta que no queden nulos. La
    /// comparación de elegibilidad usa este identificador; el texto ya no decide nada.</para>
    /// </summary>
    public Guid? IdJobPositionCatalogItem { get; private set; }

    /// <summary>
    /// Lo que se cobra por este puesto, en el periodo que declara <see cref="PriceFrequency"/>.
    /// Cero mientras no se pacte.
    ///
    /// <para><b>La columna se llamaba <c>MonthlyPrice</c> y dejó de ser cierto.</b> Desde que el
    /// precio se puede pactar por semana, un nombre que afirma el mes describiría mal la mitad de
    /// los casos. El importe <b>no se convierte</b>: se guarda tal como se pactó, con su periodo al
    /// lado. Pasarlo todo a mensual para conservar el nombre habría metido un redondeo en un dato
    /// que nadie pidió redondear.</para>
    /// </summary>
    public decimal Price { get; private set; }

    /// <summary>
    /// Cada cuándo se cobra ese precio.
    ///
    /// <para>Es lo que se le factura al cliente, y no tiene por qué coincidir con cada cuándo se le
    /// paga al personal, que es de la organización.</para>
    /// </summary>
    public PaymentFrequency PriceFrequency { get; private set; }

    public string CurrencyCode { get; private set; } = "MXN";
    public bool IsTaxIncluded { get; private set; }

    public string? RequiredSkillProfile { get; private set; }
    public string? Notes { get; private set; }
    public Service Service { get; private set; } = null!;
    public IReadOnlyCollection<ShiftPattern> ShiftPatterns => shiftPatterns;

    public static Position Create(
        Guid idOrganization,
        Guid idService,
        string codePosition,
        PositionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idService, codePosition, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        PositionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(PositionProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        if (profile.RequiredWorkerCount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        if (profile.Price < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        Name = Required(profile.Name, nameof(profile.Name));
        RequiredWorkerCount = profile.RequiredWorkerCount;
        Price = profile.Price;
        PriceFrequency = profile.PriceFrequency;
        CurrencyCode = Required(profile.CurrencyCode, nameof(profile.CurrencyCode)).ToUpperInvariant();
        IsTaxIncluded = profile.IsTaxIncluded;
        IdJobPositionCatalogItem = profile.IdJobPositionCatalogItem;
        RequiredSkillProfile = Optional(profile.RequiredSkillProfile);
        Notes = Optional(profile.Notes);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
