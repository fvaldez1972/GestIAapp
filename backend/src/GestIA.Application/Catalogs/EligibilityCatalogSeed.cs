using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Catalogs;

/// <summary>
/// El valor de catálogo que sustituye a cada miembro de los tres enums convertidos.
/// </summary>
/// <param name="Type">El catálogo al que pertenece.</param>
/// <param name="EnumValue">El nombre del miembro del enum, tal como está guardado en la base.</param>
/// <param name="Name">El nombre visible de la fila del catálogo.</param>
/// <param name="Order">El orden en que se enseña.</param>
/// <param name="Group">
/// El grupo del que cuelga, cuando el catálogo tiene dos niveles. Sólo lo usan las categorías de
/// documento del personal; en los demás va nulo.
/// </param>
public sealed record EligibilityCatalogSeedValue(
    BusinessCatalogItemType Type,
    string EnumValue,
    string Name,
    int Order,
    string? Group = null);

/// <summary>
/// Los grupos con los que nace el catálogo de categorías de documento del personal.
///
/// <para>Se siembran por la misma razón que las categorías: un catálogo de dos niveles con el nivel
/// de arriba vacío no se puede usar. Son un punto de partida editable, no una taxonomía impuesta:
/// la organización puede renombrarlos, desactivarlos o reagrupar sus tipos, porque es un catálogo
/// como cualquier otro.</para>
/// </summary>
public sealed record EmployeeDocumentGroupSeed(string Name, int Order);

/// <summary>
/// Los valores con los que nace una organización en los tres catálogos que dejaron de ser enums.
///
/// <para><b>Esto no contradice la regla de que el alta real no inventa configuración.</b> Los
/// puestos, las habilidades y las reglas de elegibilidad sí son decisiones de cada organización, y
/// por eso el alta no los siembra. Las categorías de documento, las de evaluación y los propósitos
/// de contacto eran otra cosa: hasta el 19 de septiembre de 2026 eran listas fijas del sistema, que
/// toda organización tenía desde el primer minuto sin configurar nada. Si al volverlas editables se
/// hubieran dejado vacías, una organización recién creada no podría registrar ni un documento.
/// Sembrarlas conserva lo que ya había; lo nuevo es que ahora se pueden cambiar.</para>
///
/// <para>La lista está aquí, y no sólo dentro de la migración, porque las dos tienen que decir lo
/// mismo: la migración siembra a las organizaciones que ya existían y esto siembra a las que vengan.
/// Si se separaran, una organización creada mañana tendría catálogos distintos de una creada ayer.
/// </para>
/// </summary>
public static class EligibilityCatalogSeed
{
    public static IReadOnlyList<EmployeeDocumentGroupSeed> DocumentGroups { get; } =
    [
        new("Identidad", 1),
        new("Fiscal", 2),
        new("Seguridad social", 3),
        new("Domicilio", 4),
        new("Formacion", 5),
        new("Licencias y permisos", 6),
        new("Antecedentes", 7),
        new("Empleo", 8),
    ];

    public static IReadOnlyList<EligibilityCatalogSeedValue> All { get; } =
    [
        Document(EmployeeDocumentType.EmploymentApplication, "Solicitud de empleo", 1, "Empleo"),
        Document(EmployeeDocumentType.BirthCertificate, "Acta de nacimiento", 2, "Identidad"),
        Document(EmployeeDocumentType.MarriageCertificate, "Acta de matrimonio", 3, "Identidad"),
        Document(EmployeeDocumentType.VoterId, "INE", 4, "Identidad"),
        Document(EmployeeDocumentType.Curp, "CURP", 5, "Identidad"),
        Document(EmployeeDocumentType.SocialSecurityNumber, "NSS", 6, "Seguridad social"),
        Document(EmployeeDocumentType.Rfc, "RFC", 7, "Fiscal"),
        Document(EmployeeDocumentType.TaxStatusCertificate, "Constancia de situación fiscal", 8, "Fiscal"),
        Document(EmployeeDocumentType.DriverLicense, "Licencia de conducir", 9, "Licencias y permisos"),
        Document(EmployeeDocumentType.ProofOfAddress, "Comprobante de domicilio", 10, "Domicilio"),
        Document(EmployeeDocumentType.ProofOfStudies, "Comprobante de estudios", 11, "Formacion"),
        Document(EmployeeDocumentType.MilitaryServiceCard, "Cartilla militar", 12, "Licencias y permisos"),
        Document(EmployeeDocumentType.CriminalRecordCertificate, "Constancia de antecedentes", 13, "Antecedentes"),
        Document(EmployeeDocumentType.Other, "Otro documento", 14, "Empleo"),

        Evaluation(EmployeeEvaluationType.Polygraph, "Polígrafo", 1),
        Evaluation(EmployeeEvaluationType.SocioeconomicStudy, "Estudio socioeconómico", 2),
        Evaluation(EmployeeEvaluationType.CriminalRecordReview, "Revisión de antecedentes", 3),
        Evaluation(EmployeeEvaluationType.DrugTest, "Examen toxicológico", 4),
        Evaluation(EmployeeEvaluationType.Other, "Otra evaluación", 5),

        Purpose(ClientContactPurpose.Administrative, "Administrativo", 1),
        Purpose(ClientContactPurpose.Operational, "Operativo", 2),
        Purpose(ClientContactPurpose.Billing, "Facturación", 3),
        Purpose(ClientContactPurpose.Legal, "Legal", 4),
        Purpose(ClientContactPurpose.Emergency, "Emergencia", 5),
        Purpose(ClientContactPurpose.Payments, "Pagos", 6),
        Purpose(ClientContactPurpose.Purchasing, "Compras", 7),
        Purpose(ClientContactPurpose.InternalSecurity, "Seguridad interna", 8),
    ];

    /// <summary>El nombre de catálogo que sustituye a un tipo de documento del enum heredado.</summary>
    public static string NameFor(EmployeeDocumentType type) =>
        All.First(value =>
            value.Type == BusinessCatalogItemType.EmployeeDocumentCategory &&
            value.EnumValue == type.ToString()).Name;

    /// <summary>El nombre de catálogo que sustituye a un tipo de evaluación del enum heredado.</summary>
    public static string NameFor(EmployeeEvaluationType type) =>
        All.First(value =>
            value.Type == BusinessCatalogItemType.EmployeeEvaluationCategory &&
            value.EnumValue == type.ToString()).Name;

    /// <summary>El nombre de catálogo que sustituye a un propósito de contacto del enum heredado.</summary>
    public static string NameFor(ClientContactPurpose purpose) =>
        All.First(value =>
            value.Type == BusinessCatalogItemType.ContactPurpose &&
            value.EnumValue == purpose.ToString()).Name;

    private static EligibilityCatalogSeedValue Document(
        EmployeeDocumentType type, string name, int order, string group) =>
        new(BusinessCatalogItemType.EmployeeDocumentCategory, type.ToString(), name, order, group);

    private static EligibilityCatalogSeedValue Evaluation(EmployeeEvaluationType type, string name, int order) =>
        new(BusinessCatalogItemType.EmployeeEvaluationCategory, type.ToString(), name, order);

    private static EligibilityCatalogSeedValue Purpose(ClientContactPurpose purpose, string name, int order) =>
        new(BusinessCatalogItemType.ContactPurpose, purpose.ToString(), name, order);
}
