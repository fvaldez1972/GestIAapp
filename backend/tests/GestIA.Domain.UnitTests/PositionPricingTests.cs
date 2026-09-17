using GestIA.Domain.Common;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;

namespace GestIA.Domain.UnitTests;

/// <summary>
/// El precio del puesto y su periodo.
///
/// <para>Lo que hay que demostrar es que <b>el importe y su periodo viajan juntos</b>. Un precio sin
/// periodo no significa nada: 42 000 al mes y 42 000 a la semana son dos contratos distintos, y la
/// columna se llamaba <c>MonthlyPrice</c> justamente porque antes sólo podía ser uno.</para>
/// </summary>
public sealed class PositionPricingTests
{
    private static readonly Guid ActorId = Guid.Parse("7d2f1a44-91b6-4e7d-9c31-5a8e2f0b64c7");
    private const string ActorName = "Pruebas";
    private static readonly DateTime OccurredAt = new(2026, 9, 16, 20, 0, 0, DateTimeKind.Utc);

    private static Position Puesto(decimal precio, PaymentFrequency periodo) =>
        Position.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "p-01",
            new PositionProfile("Caseta poniente", 1, null, null, null, precio, "MXN", false, periodo),
            ActorId,
            ActorName,
            OccurredAt);

    /// <summary>El periodo por omisión es mensual, que es lo que significaban los precios de antes.</summary>
    [Fact]
    public void ThePriceKeepsItsPeriodAndDefaultsToMonthly()
    {
        var porOmision = Position.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "p-02",
            new PositionProfile("Rondín", 1, null, null, null, 42000m),
            ActorId,
            ActorName,
            OccurredAt);

        Assert.Equal(42000m, porOmision.Price);
        Assert.Equal(PaymentFrequency.Monthly, porOmision.PriceFrequency);
    }

    /// <summary>
    /// El importe <b>no se convierte</b> al cambiar de periodo.
    ///
    /// <para>Pasarlo a su equivalente mensual metería un redondeo en un dato que nadie pidió
    /// redondear, y el número dejaría de ser el que se pactó con el cliente.</para>
    /// </summary>
    [Fact]
    public void AWeeklyPriceIsStoredAsPactedWithoutConverting()
    {
        var semanal = Puesto(3500m, PaymentFrequency.Weekly);

        Assert.Equal(3500m, semanal.Price);
        Assert.Equal(PaymentFrequency.Weekly, semanal.PriceFrequency);
    }

    [Fact]
    public void ChangingTheProfileChangesBothThePriceAndItsPeriod()
    {
        var puesto = Puesto(42000m, PaymentFrequency.Monthly);

        puesto.UpdateProfile(
            new PositionProfile("Caseta poniente", 1, null, null, null, 3500m, "MXN", false, PaymentFrequency.Weekly),
            ActorId,
            ActorName,
            OccurredAt);

        Assert.Equal(3500m, puesto.Price);
        Assert.Equal(PaymentFrequency.Weekly, puesto.PriceFrequency);
    }

    /// <summary>Un precio negativo se rechaza en el dominio, además de en la restricción de la base.</summary>
    [Fact]
    public void ANegativePriceIsRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Puesto(-1m, PaymentFrequency.Weekly));
    }

    /// <summary>
    /// La periodicidad de pago de la organización nace <b>sin declarar</b>, y eso es un estado
    /// válido: nadie decide por la organización lo que la organización no ha dicho.
    /// </summary>
    [Fact]
    public void AnOrganizationStartsWithoutADeclaredPayrollFrequency()
    {
        var organizacion = Organization.Create("ORG-01", "Empresa de prueba", null, ActorId, ActorName, OccurredAt);

        Assert.Null(organizacion.PayrollFrequency);

        organizacion.SetPayrollFrequency(PaymentFrequency.Weekly, ActorId, ActorName, OccurredAt);
        Assert.Equal(PaymentFrequency.Weekly, organizacion.PayrollFrequency);

        // Y se puede volver a dejar sin declarar: no es un camino de ida.
        organizacion.SetPayrollFrequency(null, ActorId, ActorName, OccurredAt);
        Assert.Null(organizacion.PayrollFrequency);
    }

    /// <summary>
    /// Quincenal y catorcenal son valores distintos, y el enum los distingue.
    ///
    /// <para>Se confunden todo el tiempo: catorcenal son veintiséis pagos al año y quincenal
    /// veinticuatro. Tratarlos como uno pagaría de más o de menos.</para>
    /// </summary>
    [Fact]
    public void BiweeklyAndSemiMonthlyAreNotTheSameValue()
    {
        Assert.NotEqual(PaymentFrequency.Biweekly, PaymentFrequency.SemiMonthly);
        Assert.Equal(4, Enum.GetValues<PaymentFrequency>().Length);
    }
}
