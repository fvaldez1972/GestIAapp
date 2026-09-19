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
    DateOnly StartDate,
    DateOnly? EndDate = null,
    Guid? IdJobPositionCatalogItem = null,
    decimal Price = 0m,
    string CurrencyCode = "MXN",
    bool IsTaxIncluded = false,
    PaymentFrequency PriceFrequency = PaymentFrequency.Monthly,
    Guid? IdShiftPatternTemplate = null,
    Guid? IdSexCatalogItem = null,
    Guid? IdAgeRangeCatalogItem = null,
    Guid? IdEducationLevelCatalogItem = null);

public sealed class Position : AuditableEntity, IOrganizationScopedEntity
{
    private readonly List<ShiftPattern> shiftPatterns = [];
    private readonly List<PositionRequiredEquipment> requiredEquipment = [];

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

    /// <summary>
    /// El patrón de turno del catálogo que sigue esta posición.
    ///
    /// <para><b>Es nulable mientras conviven los dos modelos.</b> Hasta ahora cada posición
    /// construía su patrón desde cero, con sus días declarados por día de la semana; esos patrones
    /// siguen vivos y el generador de turnos sigue leyéndolos. Un nulo aquí significa «esta posición
    /// todavía usa su patrón propio», no «no tiene patrón».</para>
    ///
    /// <para>Cuando el generador pase a leer la plantilla, los patrones por posición se retiran y
    /// esto deja de ser nulable. Ese paso espera las respuestas de negocio sobre festivos y corte de
    /// semana, que son las que deciden cómo se recorre el ciclo.</para>
    /// </summary>
    public Guid? IdShiftPatternTemplate { get; private set; }

    public string CurrencyCode { get; private set; } = "MXN";
    public bool IsTaxIncluded { get; private set; }

    /// <summary>
    /// El sexo que el cliente pide para esta posición, contra el catálogo <c>Sex</c>.
    ///
    /// <para><b>Es del puesto, no de la persona.</b> Describe lo que el cliente contrató, y por eso
    /// el catálogo admite valores como «Indistinto» que no describirían a nadie. No se compara
    /// contra el expediente de quien se asigne: eso sería una regla de elegibilidad, y las reglas
    /// viven en <c>EligibilityRequirement</c>.</para>
    ///
    /// <para><b>Nulable en la base aunque la matriz lo pida obligatorio.</b> Había 69 posiciones
    /// capturadas antes de que el campo existiera, y un nulo dice «no se sabe», que es distinto de
    /// «no cumple». Lo obligatorio se exige en el servidor para lo que se cree o edite desde hoy.
    /// Es el mismo criterio que ya rige en <see cref="IdJobPositionCatalogItem"/>.</para>
    /// </summary>
    public Guid? IdSexCatalogItem { get; private set; }

    /// <summary>El rango de edad que admite, contra el catálogo <c>AgeRange</c>. Nulable por lo mismo.</summary>
    public Guid? IdAgeRangeCatalogItem { get; private set; }

    /// <summary>La escolaridad mínima, contra el catálogo <c>EducationLevel</c>. Nulable por lo mismo.</summary>
    public Guid? IdEducationLevelCatalogItem { get; private set; }

    /// <summary>
    /// Desde cuándo hace falta este puesto.
    ///
    /// <para><b>Es del puesto, no del servicio, y por eso no basta con la del contrato.</b> Un
    /// servicio vigente todo el año puede tener una posición de refuerzo que sólo va de octubre a
    /// diciembre; con una sola vigencia, la del servicio, eso no se podía expresar y el refuerzo
    /// quedaba como un puesto permanente que alguien tenía que acordarse de retirar.</para>
    ///
    /// <para>Las 69 posiciones que existían antes del 19 de septiembre de 2026 heredaron la del
    /// servicio en la migración, que es lo que implícitamente tenían.</para>
    /// </summary>
    public DateOnly StartDate { get; private set; }

    /// <summary>
    /// Hasta cuándo. Nulo significa <b>sin fecha de término</b>, no «no se sabe»: es el puesto
    /// permanente, que es el caso normal.
    /// </summary>
    public DateOnly? EndDate { get; private set; }

    public string? RequiredSkillProfile { get; private set; }
    public string? Notes { get; private set; }
    public Service Service { get; private set; } = null!;
    public IReadOnlyCollection<ShiftPattern> ShiftPatterns => shiftPatterns;

    /// <summary>
    /// El equipo que el cliente pide para esta posición, que casi nunca es uno.
    ///
    /// <para>Se administra desde el servicio de caso de uso y no desde aquí: agregar o retirar una
    /// pieza es una escritura con su propio rastro de auditoría, y esconderla detrás de un método
    /// de la entidad la dejaría sin actor ni fecha.</para>
    /// </summary>
    public IReadOnlyCollection<PositionRequiredEquipment> RequiredEquipment => requiredEquipment;

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

        // Una vigencia que termina antes de empezar no es un dato raro: es un dato imposible, y
        // dejarla entrar haría que la posición no estuviera vigente ningún día sin que nadie lo
        // dijera. Que caiga dentro de la del servicio se comprueba en el caso de uso, que es quien
        // puede leer el servicio.
        if (profile.EndDate is { } fin && fin < profile.StartDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        StartDate = profile.StartDate;
        EndDate = profile.EndDate;
        Name = Required(profile.Name, nameof(profile.Name));
        RequiredWorkerCount = profile.RequiredWorkerCount;
        Price = profile.Price;
        PriceFrequency = profile.PriceFrequency;
        IdShiftPatternTemplate = profile.IdShiftPatternTemplate;
        CurrencyCode = Required(profile.CurrencyCode, nameof(profile.CurrencyCode)).ToUpperInvariant();
        IsTaxIncluded = profile.IsTaxIncluded;
        IdJobPositionCatalogItem = profile.IdJobPositionCatalogItem;
        IdSexCatalogItem = profile.IdSexCatalogItem;
        IdAgeRangeCatalogItem = profile.IdAgeRangeCatalogItem;
        IdEducationLevelCatalogItem = profile.IdEducationLevelCatalogItem;
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
