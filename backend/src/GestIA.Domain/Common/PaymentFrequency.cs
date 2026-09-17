namespace GestIA.Domain.Common;

/// <summary>
/// Cada cuándo se paga o se cobra algo.
///
/// <para>Sirve para dos hechos distintos que conviene no confundir: <b>cada cuándo se le cobra al
/// cliente</b> el precio de un puesto, y <b>cada cuándo se le paga al personal</b>. En seguridad
/// privada casi nunca coinciden: al guardia se le paga a la semana y al cliente se le factura al
/// mes.</para>
/// </summary>
public enum PaymentFrequency
{
    /// <summary>Cada semana.</summary>
    Weekly,

    /// <summary>
    /// Cada catorce días: veintiséis pagos al año.
    ///
    /// <para><b>No es lo mismo que quincenal</b>, y se confunden todo el tiempo. Catorcenal cae
    /// siempre en el mismo día de la semana y desfasa respecto al mes; quincenal cae en fechas
    /// fijas y sus periodos tienen distinta duración. Entran las dos porque en México conviven, y
    /// tratarlas como una sola pagaría de más o de menos.</para>
    /// </summary>
    Biweekly,

    /// <summary>Quincenal: el día quince y el último del mes, veinticuatro pagos al año.</summary>
    SemiMonthly,

    /// <summary>Cada mes.</summary>
    Monthly
}
