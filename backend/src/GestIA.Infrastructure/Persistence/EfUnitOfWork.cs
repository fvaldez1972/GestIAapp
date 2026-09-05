using GestIA.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence;

/// <summary>
/// El guardado de siempre, con una sola cosa añadida: traduce el conflicto de concurrencia.
///
/// <para><b>Sin esto, el token de concurrencia sólo servía a medias.</b> De las seis entidades con
/// <c>rowversion</c>, cuatro guardan dentro de la transacción operativa, que ya lo traducía; las
/// otras dos —la configuración de servicio y la asignación de personal— guardan por aquí, y su
/// conflicto salía como un error interno sin explicación. Es decir: justo las dos que edita la
/// pantalla de Servicios.</para>
///
/// <para>El mensaje lo construye el mismo código que el de la transacción operativa, así que las
/// seis dicen lo mismo: quién corrigió el registro y cuándo.</para>
/// </summary>
public sealed class EfUnitOfWork(GestIaDbContext dbContext, IClock clock) : IUnitOfWork
{
    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            throw new ConcurrencyConflictException(
                await ConcurrencyConflictDescription.BuildAsync(
                    dbContext, clock.OperationalTimeZone, exception, cancellationToken));
        }
    }
}
