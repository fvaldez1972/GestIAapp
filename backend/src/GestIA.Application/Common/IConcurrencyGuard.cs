namespace GestIA.Application.Common;

/// <summary>
/// Declara con qué versión del registro creía estar trabajando quien envió la petición.
///
/// <para>Es lo que convierte al token en una comprobación real: sin esta llamada, la escritura
/// usaría la versión que el servidor acaba de leer —que ya incluye el cambio de la otra persona—
/// y pisarla sin error, que es exactamente la pérdida silenciosa que el token viene a impedir.</para>
///
/// <para><b>El token no puede ser nulo, y es deliberado.</b> Antes lo era, y un token nulo se
/// trataba como «no comprobar nada». Eso convirtió al contrato en algo que se podía olvidar sin
/// consecuencia: durante meses el frontend mandó el token desde un solo lugar de seis y ninguna
/// petición falló, porque no fallar era precisamente el comportamiento del olvido. Con el
/// parámetro no anulable, olvidarlo deja de compilar en vez de dejar de comprobar.</para>
///
/// <para><b>La única excepción vive en asistencia</b>, donde el mismo endpoint crea o corrige: en
/// un alta no hay nada que pisar. Ahí el token sigue siendo opcional en el contrato de entrada,
/// pero la rama de corrección lo exige antes de llegar aquí, con
/// <see cref="ConcurrencyTokenMissingException"/>. Ninguna otra ruta tiene esa licencia.</para>
/// </summary>
public interface IConcurrencyGuard
{
    /// <param name="entity">La fila que se va a escribir, ya rastreada.</param>
    /// <param name="expectedRowVersion">
    /// El token que la pantalla leyó al abrir el registro. Un arreglo vacío se rechaza igual que
    /// un nulo: es la misma ausencia con otra forma, y dejarla pasar reabriría el hueco por el
    /// lado del deserializador, que sí puede escribir nulo en un campo no anulable.
    /// </param>
    void Expect<T>(T entity, byte[] expectedRowVersion) where T : class;
}
