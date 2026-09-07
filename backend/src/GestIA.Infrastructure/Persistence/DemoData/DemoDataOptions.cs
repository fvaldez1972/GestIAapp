using System.Globalization;
using Microsoft.Extensions.Configuration;

namespace GestIA.Infrastructure.Persistence.DemoData;

/// <summary>
/// Configuración del sembrador de datos demo.
///
/// El sembrador NUNCA corre por omisión: <see cref="Enabled"/> es <c>false</c> salvo que
/// se active explícitamente con <c>DemoData__Enabled=true</c>. Es una pieza separada del
/// alta real de organizaciones: no modifica <c>OrganizationProvisioningService</c> ni la
/// ruta de bootstrap, que por decisión registrada en
/// <c>docs/CATALOGOS-CIERRE-2026-09-03.md</c> no inventan puestos ni reglas de elegibilidad.
/// </summary>
public sealed class DemoDataOptions
{
    public const string SectionName = "DemoData";

    /// <summary>
    /// Interruptor explícito. Sin esto en <c>true</c> el sembrador no hace absolutamente nada.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Código de la organización demo. Es la llave de idempotencia de todo el sembrado.
    /// </summary>
    public string CodeOrganization { get; set; } = "DEMO";

    public string LegalName { get; set; } = "Servicios Integrales Demo, S.A. de C.V.";

    public string Rfc { get; set; } = "SID260101AB1";

    /// <summary>
    /// Fecha de referencia de la que cuelgan vigencias, vencimientos y el mes de operación.
    /// Se fija para que el resultado sea reproducible entre corridas y entre máquinas.
    /// Si se deja vacía se usa la fecha UTC de hoy, y entonces el sembrado deja de ser
    /// bit a bit reproducible aunque sigue siendo idempotente.
    /// </summary>
    public DateOnly? ReferenceDate { get; set; } = new(2026, 9, 4);

    /// <summary>
    /// Semilla del generador determinista. Misma semilla, mismos datos.
    /// </summary>
    public int RandomSeed { get; set; } = 20260904;

    /// <summary>
    /// Enlace manual desde configuración. Se hace a mano en lugar de usar el enlazador
    /// automático para no agregar <c>Microsoft.Extensions.Configuration.Binder</c> como
    /// dependencia nueva de Infrastructure sólo por el sembrador demo.
    /// </summary>
    public static void Bind(IConfiguration section, DemoDataOptions options)
    {
        ArgumentNullException.ThrowIfNull(section);
        ArgumentNullException.ThrowIfNull(options);

        if (bool.TryParse(section["Enabled"], out var enabled))
        {
            options.Enabled = enabled;
        }

        if (section["CodeOrganization"] is { Length: > 0 } code)
        {
            options.CodeOrganization = code;
        }

        if (section["LegalName"] is { Length: > 0 } legalName)
        {
            options.LegalName = legalName;
        }

        if (section["Rfc"] is { Length: > 0 } rfc)
        {
            options.Rfc = rfc;
        }

        if (DateOnly.TryParse(
                section["ReferenceDate"],
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var referenceDate))
        {
            options.ReferenceDate = referenceDate;
        }

        if (int.TryParse(section["RandomSeed"], CultureInfo.InvariantCulture, out var seed))
        {
            options.RandomSeed = seed;
        }
    }
}
