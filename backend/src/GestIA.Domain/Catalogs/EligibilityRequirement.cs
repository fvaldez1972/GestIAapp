using GestIA.Domain.Clients;
using GestIA.Domain.Common;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Catalogs;

public sealed record EligibilityRequirementProfile(
    EligibilityRequirementTargetType TargetType,
    Guid? IdClient,
    Guid? IdService,
    Guid? IdPosition,
    EligibilityRequirementType RequirementType,
    Guid? IdRequiredCatalogItem,
    EmployeeDocumentType? RequiredDocumentType,
    EmployeeEvaluationType? RequiredEvaluationType,
    string Name,
    string? Description);

/// <summary>
/// Una regla que decide si alguien puede cubrir un turno.
///
/// <para><b>Qué exige la regla vive en tres campos y no en uno, porque son tres cosas distintas.</b>
/// Hasta el 7 de septiembre de 2026 había una sola columna de texto, <c>RequiredCode</c>, cuyo
/// significado cambiaba con <see cref="RequirementType"/>: para una regla de habilidad era el
/// código de una fila del catálogo, y para las de documento y evaluación era el <b>nombre de un
/// enum de C#</b>. Nada impedía guardar el valor de un enum en una regla del otro, y leer el campo
/// exigía saber de antemano qué tipo de regla se estaba mirando.</para>
///
/// <para>Al retirarse el código del catálogo, la de habilidad se quedó sin a qué apuntar y las
/// otras dos nunca habían apuntado a un catálogo. Separarlas fue la única salida honesta: cada tipo
/// de regla apunta ahora a lo que de verdad exige, y con el tipo correcto.</para>
///
/// <para>Una regla de tipo <c>Restriction</c> no exige nada concreto: prohíbe. Los tres campos van
/// vacíos.</para>
///
/// <para><b>Desde el 19 de septiembre de 2026 los tres tipos apuntan al catálogo.</b> Aquel día las
/// categorías de documento y de evaluación dejaron de ser enums fijos y pasaron a ser filas del
/// catálogo, editables por organización, así que <see cref="IdRequiredCatalogItem"/> vale para los
/// tres y <see cref="RequirementType"/> dice de qué catálogo sale la fila. Las dos columnas de enum
/// se conservan como rastro de lo que había, no deciden nada, y se retiran cuando no queden
/// identificadores sin rellenar.</para>
///
/// <para><b>Qué tan grave es que falte ya no vive sólo aquí.</b> <see cref="IsBlocking"/> pasó a ser
/// nulable: un nulo hereda la marca de la entrada del catálogo, y un valor la afina para este
/// alcance. La razón está en los datos: de las 29 reglas vivas el día de la decisión, trece eran por
/// posición, y una marca de catálogo —que vale para toda la organización— no puede expresar lo que
/// exige un puesto concreto.</para>
/// </summary>
public sealed class EligibilityRequirement : AuditableEntity, IOrganizationScopedEntity
{
    private EligibilityRequirement()
    {
    }

    private EligibilityRequirement(
        Guid idEligibilityRequirement,
        Guid idOrganization,
        EligibilityRequirementProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEligibilityRequirement = idEligibilityRequirement;
        IdOrganization = idOrganization;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEligibilityRequirement { get; private set; }
    public Guid IdOrganization { get; private set; }
    public EligibilityRequirementTargetType TargetType { get; private set; }
    public Guid? IdClient { get; private set; }
    public Guid? IdService { get; private set; }
    public Guid? IdPosition { get; private set; }
    public EligibilityRequirementType RequirementType { get; private set; }

    /// <summary>
    /// La entrada del catálogo que la regla exige: una experiencia, una categoría de documento o una
    /// de evaluación, según el tipo. Vacía sólo en las restricciones, que no exigen nada.
    /// </summary>
    public Guid? IdRequiredCatalogItem { get; private set; }

    /// <summary>El documento exigido, como enum. <b>Rastro heredado: ya no decide nada.</b></summary>
    public EmployeeDocumentType? RequiredDocumentType { get; private set; }

    /// <summary>La evaluación exigida, como enum. <b>Rastro heredado: ya no decide nada.</b></summary>
    public EmployeeEvaluationType? RequiredEvaluationType { get; private set; }

    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    /// <summary>
    /// Si incumplir esta regla impide asignar y publicar. <b>Nulo hereda la marca del catálogo.</b>
    /// </summary>
    public bool? IsBlocking { get; private set; }
    public Organization Organization { get; private set; } = null!;
    public Client? Client { get; private set; }
    public Service? Service { get; private set; }
    public Position? Position { get; private set; }

    /// <summary>La habilidad exigida, para poder nombrarla en el mensaje que bloquea.</summary>
    public BusinessCatalogItem? RequiredCatalogItem { get; private set; }

    public static EligibilityRequirement Create(
        Guid idOrganization,
        EligibilityRequirementProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        EligibilityRequirementProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(EligibilityRequirementProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Name);

        ValidateTarget(profile);
        ValidateRequirement(profile);

        TargetType = profile.TargetType;
        IdClient = profile.TargetType is EligibilityRequirementTargetType.Client ? profile.IdClient : null;
        IdService = profile.TargetType is EligibilityRequirementTargetType.Service ? profile.IdService : null;
        IdPosition = profile.TargetType is EligibilityRequirementTargetType.Position ? profile.IdPosition : null;
        RequirementType = profile.RequirementType;

        // Los tres tipos que exigen algo lo exigen por identificador del catálogo; la restricción no
        // exige nada. Los enums sólo sobreviven donde ya venían, para no borrar el rastro de lo que
        // la regla decía antes de la conversión.
        IdRequiredCatalogItem = profile.RequirementType is EligibilityRequirementType.Restriction
            ? null
            : profile.IdRequiredCatalogItem;
        RequiredDocumentType = profile.RequirementType is EligibilityRequirementType.Document
            ? profile.RequiredDocumentType
            : null;
        RequiredEvaluationType = profile.RequirementType is EligibilityRequirementType.Evaluation
            ? profile.RequiredEvaluationType
            : null;

        Name = profile.Name.Trim();
        Description = string.IsNullOrWhiteSpace(profile.Description) ? null : profile.Description.Trim();
    }

    /// <summary>
    /// Lo que exige la regla sale del catálogo, salvo en la restricción, que no exige nada.
    ///
    /// <para>Se comprueba aquí además de en la restricción de la base porque el mensaje que sale de
    /// aquí dice qué falta; el de la base diría que se violó una restricción con nombre.</para>
    ///
    /// <para><b>Ya no se comprueba que los enums estén vacíos.</b> Desde que documentos y
    /// evaluaciones son catálogo, una regla convertida lleva su identificador <b>y</b> el enum que
    /// tenía antes, y exigir que sólo hubiera uno habría dejado sin poder guardarse a las once
    /// reglas que ya existían.</para>
    /// </summary>
    private static void ValidateRequirement(EligibilityRequirementProfile profile)
    {
        var valido = profile.RequirementType switch
        {
            EligibilityRequirementType.Skill or
            EligibilityRequirementType.Document or
            EligibilityRequirementType.Evaluation => profile.IdRequiredCatalogItem.HasValue,
            EligibilityRequirementType.Restriction => profile.IdRequiredCatalogItem is null,
            _ => false
        };

        if (!valido)
        {
            throw new ArgumentOutOfRangeException(
                nameof(profile),
                "Una regla de elegibilidad exige una entrada del catálogo que corresponda a su " +
                "tipo —experiencia, categoría de documento o categoría de evaluación—, o nada si es " +
                "una restricción.");
        }
    }

    private static void ValidateTarget(EligibilityRequirementProfile profile)
    {
        var valid = profile.TargetType switch
        {
            EligibilityRequirementTargetType.Organization =>
                profile.IdClient is null && profile.IdService is null && profile.IdPosition is null,
            EligibilityRequirementTargetType.Client =>
                profile.IdClient.HasValue && profile.IdService is null && profile.IdPosition is null,
            EligibilityRequirementTargetType.Service =>
                profile.IdClient is null && profile.IdService.HasValue && profile.IdPosition is null,
            EligibilityRequirementTargetType.Position =>
                profile.IdClient is null && profile.IdService is null && profile.IdPosition.HasValue,
            _ => false
        };

        if (!valid)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "El alcance de la regla de elegibilidad no es válido.");
        }
    }
}
