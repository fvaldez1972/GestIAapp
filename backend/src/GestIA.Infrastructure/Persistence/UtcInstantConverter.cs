using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace GestIA.Infrastructure.Persistence;

/// <summary>
/// Devuelve todo instante leído de la base marcado como UTC.
///
/// <para><b>El defecto que cierra.</b> El estándar dice que las columnas <c>At</c> son UTC por
/// contrato, y el dominio se encarga de que así se guarden. Pero al leer, EF materializaba cada
/// <c>DateTime</c> con <see cref="DateTimeKind.Unspecified"/>, porque SQL Server no guarda el huso
/// y nadie lo volvía a poner. <c>System.Text.Json</c> serializa un instante sin especificar
/// <b>sin la «Z» final</b>, y el navegador interpreta una cadena sin «Z» como hora local: seis
/// horas de corrimiento en México, en toda columna <c>At</c> de toda pantalla.</para>
///
/// <para><b>Por qué nadie lo vio en dos semanas.</b> La respuesta a un alta devuelve la entidad
/// que sigue en memoria, con el <c>Kind</c> que le puso el dominio, y ésa sí llevaba la «Z». La
/// hora sólo se corría al recargar la pantalla y leerla de la base. El camino que uno prueba al
/// hacer el cambio es justo el que salía bien.</para>
///
/// <para>Se aplica por convenio a <b>todas</b> las propiedades <c>DateTime</c> del modelo, y eso es
/// correcto aquí porque las 76 columnas de ese tipo terminan en <c>At</c>: son instantes. Las
/// fechas de negocio son <c>DateOnly</c> y no pasan por aquí, que es justo la distinción que el
/// estándar hace entre columnas <c>At</c> y columnas <c>Date</c>.</para>
/// </summary>
public sealed class UtcInstantConverter : ValueConverter<DateTime, DateTime>
{
    public UtcInstantConverter()
        : base(
            // Al escribir: lo local se traduce; lo que ya viene sin especificar se toma como UTC,
            // que es el contrato. Traducirlo otra vez lo movería dos veces.
            value => value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value,
            // Al leer: la base no guarda el huso, así que se vuelve a poner el que el contrato dice.
            value => DateTime.SpecifyKind(value, DateTimeKind.Utc))
    {
    }
}
