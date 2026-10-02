using GestIA.Application.Common;

namespace GestIA.Infrastructure.Persistence;

/// <inheritdoc cref="IConcurrencyGuard"/>
public sealed class EfConcurrencyGuard(GestIaDbContext dbContext) : IConcurrencyGuard
{
    public void Expect<T>(T entity, byte[] expectedRowVersion)
        where T : class
    {
        ArgumentNullException.ThrowIfNull(entity);

        // El parámetro no es anulable, así que este caso no debería existir. Se comprueba igual
        // porque el deserializador de JSON sí puede escribir nulo en un campo no anulable cuando
        // la propiedad falta en el cuerpo, y ahí el sistema de tipos ya no protege nada. Sin esta
        // guarda, un cuerpo sin token volvería a escribir sin comprobar, que es justo el
        // comportamiento que se vino a cerrar.
        if (expectedRowVersion is null || expectedRowVersion.Length == 0)
        {
            throw new ConcurrencyTokenMissingException(
                "La corrección no trae el token de concurrencia del registro. Vuelve a abrirlo y " +
                "reintenta: sin el token no se puede saber si alguien más lo cambió mientras tanto.");
        }

        // El valor ORIGINAL es el que EF pone en el WHERE del UPDATE. Sustituirlo por el que
        // trajo la petición es lo que hace que la escritura falle si alguien más ya guardó.
        dbContext.Entry(entity).Property("RowVersion").OriginalValue = expectedRowVersion;
    }
}
