using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Services;

namespace GestIA.Infrastructure.Persistence.DemoData;

/// <summary>
/// Datos base del sembrado demo. Todo es sintético y determinista: nombres inventados,
/// RFC con estructura válida pero sin correspondencia real, y ninguna persona identificable.
/// </summary>
internal static class DemoCatalog
{
    public static readonly (string Code, string Name)[] JobPositions =
    [
        ("GUARDIA", "Guardia de seguridad"),
        ("SUPERVISOR", "Supervisor de sitio"),
        ("JEFE_TURNO", "Jefe de turno"),
        ("MONITORISTA", "Monitorista de CCTV"),
        ("INTENDENCIA", "Auxiliar de intendencia"),
        ("RECEPCION", "Recepcionista"),
        ("CHOFER", "Chofer operativo"),
        ("COORDINADOR", "Coordinador operativo")
    ];

    public static readonly (string Code, string Name)[] Skills =
    [
        ("MANEJO_ARMA", "Manejo de arma"),
        ("PRIMEROS_AUX", "Primeros auxilios"),
        ("CCTV", "Operación de CCTV"),
        ("CONTROL_ACCESO", "Control de acceso"),
        ("MANEJO_CRISIS", "Manejo de crisis"),
        ("LICENCIA_A", "Licencia de conducir tipo A")
    ];

    public static readonly (string Code, string Name)[] Zones =
    [
        ("ZONA_NORTE", "Zona Norte"),
        ("ZONA_CENTRO", "Zona Centro"),
        ("ZONA_SUR", "Zona Sur"),
        ("ZONA_BAJIO", "Zona Bajío")
    ];

    public sealed record EligibilityRule(
        EligibilityRequirementType RequirementType,
        string RequiredCode,
        string Name,
        string? Description,
        bool IsBlocking);

    public static readonly EligibilityRule[] EligibilityRules =
    [
        new(EligibilityRequirementType.Document, "Curp", "CURP vigente",
            "Toda asignación exige CURP capturada y validada.", true),
        new(EligibilityRequirementType.Document, "ProofOfAddress", "Comprobante de domicilio",
            "Comprobante con antigüedad máxima de tres meses.", true),
        new(EligibilityRequirementType.Document, "CriminalRecordCertificate", "Carta de no antecedentes",
            "Vigencia de un año desde la expedición.", true),
        new(EligibilityRequirementType.Document, "ProofOfStudies", "Comprobante de estudios",
            "Requisito informativo, no bloquea la asignación.", false),
        new(EligibilityRequirementType.Evaluation, "Polygraph", "Examen poligráfico",
            "Obligatorio para posiciones con manejo de valores.", true),
        new(EligibilityRequirementType.Evaluation, "SocioeconomicStudy", "Estudio socioeconómico",
            "Se revisa cada dos años.", false),
        new(EligibilityRequirementType.Skill, "PRIMEROS_AUX", "Primeros auxilios",
            "Deseable en todas las posiciones de sitio.", false)
    ];

    public sealed record DemoClient(
        string Code,
        string LegalName,
        string TradeName,
        string Rfc,
        string TaxActivity,
        int ServiceCount,
        int SiteCount,
        int ContactCount,
        ServiceContractStatus[] ContractStatuses);

    /// <summary>
    /// Nueve clientes con 20 servicios repartidos de forma deliberadamente desigual:
    /// dos clientes concentran casi la mitad y cuatro tienen un solo servicio.
    /// </summary>
    public static readonly DemoClient[] Clients =
    [
        new("CLI-01", "Comercializadora del Norte, S.A. de C.V.", "Comercial Norte", "CDN180312QW4",
            "Comercio al por menor en tiendas de autoservicio", 5, 3, 3,
            [ServiceContractStatus.Effective, ServiceContractStatus.Expired]),
        new("CLI-02", "Refaccionaria Península, S.A. de C.V.", "Refa Península", "RPE150822HJ7",
            "Venta de refacciones automotrices", 4, 2, 3,
            [ServiceContractStatus.Effective]),
        new("CLI-03", "Panificadora Altiplano, S.A. de C.V.", "Pan Altiplano", "PAL120705KL2",
            "Elaboración y distribución de pan", 3, 3, 2,
            [ServiceContractStatus.Effective, ServiceContractStatus.UnderReview]),
        new("CLI-04", "Farmacias del Valle, S.A. de C.V.", "Farmavalle", "FDV200114RT9",
            "Comercio al por menor de productos farmacéuticos", 2, 2, 2,
            [ServiceContractStatus.Executed]),
        new("CLI-05", "Entretenimiento Meridiano, S.A. de C.V.", "Meridiano Cines", "EME170930BN5",
            "Exhibición de películas", 2, 1, 2,
            [ServiceContractStatus.Effective]),
        new("CLI-06", "Almacenes Reforma, S.A. de C.V.", "Almacenes Reforma", "ARE110228ZX1",
            "Tiendas departamentales", 1, 2, 1,
            [ServiceContractStatus.Draft]),
        new("CLI-07", "Mueblería Costa Grande, S.A. de C.V.", "Costa Grande", "MCG190617VB8",
            "Venta de muebles y línea blanca", 1, 1, 1,
            [ServiceContractStatus.Terminated]),
        new("CLI-08", "Autoservicio La Alameda, S.A. de C.V.", "La Alameda", "AAL160405MN3",
            "Supermercados", 1, 1, 2,
            [ServiceContractStatus.Effective]),
        new("CLI-09", "Distribuidora Golfo Azul, S.A. de C.V.", "Golfo Azul", "DGA210919PL6",
            "Distribución de abarrotes", 1, 1, 1,
            [ServiceContractStatus.UnderReview])
    ];

    public static readonly ClientContactPurpose[] ContactPurposes =
    [
        ClientContactPurpose.Operational,
        ClientContactPurpose.Administrative,
        ClientContactPurpose.Billing,
        ClientContactPurpose.Emergency,
        ClientContactPurpose.Legal
    ];

    public static readonly string[] ContactFirstNames =
    [
        "María", "José", "Guadalupe", "Juan", "Verónica", "Ricardo", "Alejandra", "Fernando",
        "Patricia", "Sergio", "Lucía", "Ángel", "Rocío", "Ismael", "Xóchitl", "Ñery"
    ];

    public static readonly string[] ContactLastNames =
    [
        "Hernández", "García", "Martínez", "López", "González", "Pérez", "Sánchez", "Ramírez",
        "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Ibáñez", "Muñoz"
    ];

    public static readonly string[] SiteNames =
    [
        "Matriz", "Sucursal Centro", "Centro de Distribución", "Planta Industrial",
        "Corporativo", "Bodega Norte", "Patio de Maniobras"
    ];

    public static readonly string[] Streets =
    [
        "Avenida Insurgentes Sur", "Calle Morelos", "Boulevard Díaz Ordaz", "Calzada de Tlalpan",
        "Avenida Universidad", "Calle 5 de Mayo", "Prolongación Reforma"
    ];

    public sealed record DemoMunicipality(string Municipality, string State, string PostalCode);

    public static readonly DemoMunicipality[] Municipalities =
    [
        new("Benito Juárez", "Ciudad de México", "03100"),
        new("Monterrey", "Nuevo León", "64000"),
        new("Zapopan", "Jalisco", "45010"),
        new("Puebla", "Puebla", "72000"),
        new("Mérida", "Yucatán", "97000"),
        new("Querétaro", "Querétaro", "76000"),
        new("Tijuana", "Baja California", "22000"),
        new("León", "Guanajuato", "37000")
    ];

    public static readonly string[] ServiceNames =
    [
        "Vigilancia perimetral 24x7",
        "Control de acceso vehicular",
        "Monitoreo de CCTV",
        "Custodia de traslado de valores",
        "Guardia de recepción corporativa",
        "Rondines nocturnos",
        "Seguridad en piso de venta",
        "Resguardo de andén de carga"
    ];

    public static readonly string[] EmployeeFirstNames =
    [
        "Adrián", "Beatriz", "Carlos", "Daniela", "Eduardo", "Fabiola", "Gerardo", "Hilda",
        "Ignacio", "Jimena", "Karla", "Leonardo", "Mónica", "Néstor", "Olivia", "Pablo",
        "Quetzal", "Raquel", "Salvador", "Teresa", "Ulises", "Valeria", "Wenceslao", "Ximena",
        "Yolanda", "Zacarías", "Ángela", "Íñigo"
    ];

    public static readonly string[] EmployeeLastNames =
    [
        "Aguilar", "Bautista", "Carrillo", "Delgado", "Escobar", "Fuentes", "Guerrero", "Herrera",
        "Iglesias", "Juárez", "Lara", "Medina", "Navarro", "Ochoa", "Peña", "Quiroz",
        "Rojas", "Salazar", "Trejo", "Urbina", "Vázquez", "Zamora", "Ávalos", "Núñez"
    ];

    public static readonly string[] IncidentTypes =
    [
        "Retardo", "Ausencia", "Incumplimiento de uniforme", "Incidente operativo",
        "Falla de equipo", "Conflicto con personal del cliente"
    ];
}
