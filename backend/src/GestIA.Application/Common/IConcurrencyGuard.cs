namespace GestIA.Application.Common;

/// <summary>
/// Declara con qué versión del registro creía estar trabajando quien envió la petición.
///
/// <para>Es lo que convierte al token en una comprobación real: sin esta llamada, la escritura
/// usaría la versión que el servidor acaba de leer —que ya incluye el cambio de la otra persona—
/// y pisarla sin error, que es exactamente la pérdida silenciosa que el token viene a impedir.</para>
///
/// <para>Un token nulo no comprueba nada. Es deliberado: en un alta no hay nada que pisar, y en
/// asistencia el mismo endpoint crea o corrige.</para>
/// </summary>
public interface IConcurrencyGuard
{
    void Expect<T>(T entity, byte[]? expectedRowVersion) where T : class;
}
