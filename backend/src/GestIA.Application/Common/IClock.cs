namespace GestIA.Application.Common;

/// <summary>
/// El reloj del sistema.
/// </summary>
public interface IClock
{
    /// <summary>El instante actual, en UTC. Todo lo que se guarda usa esto.</summary>
    DateTime UtcNow { get; }

    /// <summary>
    /// El día operativo de hoy.
    ///
    /// <para><b>No es <c>DateOnly.FromDateTime(UtcNow)</c>, y ésa es toda la razón de que exista.</b>
    /// En UTC el día empieza entre seis y siete horas antes que en México, así que calcular "hoy"
    /// desde UTC adelanta el cambio de día: una vigencia que termina el 4 de septiembre pasaba a
    /// vencida a las 18:00 del día 3, hora de Ciudad de México, y una regla que sólo aplica a lo
    /// vencido empezaba a exigirse un día antes de tiempo.</para>
    ///
    /// <para><b>Aquí es donde entra el huso por organización cuando se decida.</b> Hoy el huso es
    /// fijo y viene de configuración porque el huso por sede depende de tres decisiones de negocio
    /// que aún no se toman: qué es el día operativo cuando un turno cruza la medianoche, en qué
    /// huso se captura la asistencia, y qué muestra un tablero que ve sedes de dos husos.
    /// Construirlo adivinando obligaría a rehacerlo sobre datos ya sembrados. Cuando esas tres
    /// decisiones existan, el cambio entra en la implementación de esta propiedad, y sólo ahí.</para>
    ///
    /// <para>Deliberadamente <b>no tiene implementación por omisión</b>. Una que cayera a UTC
    /// dejaría a cualquier implementación nueva —incluidos los dobles de prueba— con el mismo
    /// defecto que esta propiedad viene a cerrar, y en silencio.</para>
    /// </summary>
    DateOnly Today { get; }
}
