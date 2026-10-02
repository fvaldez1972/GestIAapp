using System.Linq.Expressions;
using GestIA.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Conventions;

/// <summary>
/// Aísla las organizaciones en la capa de datos: toda entidad que declare
/// <see cref="IOrganizationScopedEntity"/> queda filtrada por la organización que el guard
/// autorizó para la petición en curso.
///
/// <para><b>El filtro falla cerrado.</b> Se compara contra
/// <see cref="GestIaDbContext.CurrentOrganizationId"/>, que es <c>Guid?</c>. Cuando no hay
/// organización fijada, la comparación con <c>NULL</c> no encuentra filas. Olvidar el guard
/// devuelve cero registros —visible en el primer recorrido— en lugar de devolver los de todas
/// las organizaciones, que no se notaría.</para>
///
/// <para><b>Por qué cuelga del <c>DbContext</c> y no del proveedor de contexto.</b> EF construye
/// el modelo una sola vez y lo cachea por tipo de <c>DbContext</c>; la expresión del filtro se
/// guarda ahí dentro. Si capturara la instancia del proveedor, quedaría congelada la del primer
/// modelo construido y todas las peticiones posteriores consultarían la organización de la
/// primera. EF resuelve ese caso sólo para referencias al propio <c>DbContext</c>, que sustituye
/// por la instancia vigente en cada consulta. Por eso el filtro lee una propiedad del contexto y
/// el contexto delega en el proveedor.</para>
/// </summary>
public static class OrganizationQueryFilter
{
    /// <summary>Nombre del filtro. Es lo que se apaga con <c>IgnoreQueryFilters(["Organization"])</c>.</summary>
    public const string FilterName = "Organization";

    public static void ApplyOrganizationQueryFilter(this ModelBuilder modelBuilder, GestIaDbContext context)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        ArgumentNullException.ThrowIfNull(context);

        var currentOrganization = typeof(GestIaDbContext)
            .GetProperty(nameof(GestIaDbContext.CurrentOrganizationId))!;

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (entityType.IsOwned() ||
                entityType.BaseType is not null ||
                !typeof(IOrganizationScopedEntity).IsAssignableFrom(entityType.ClrType))
            {
                continue;
            }

            var entity = Expression.Parameter(entityType.ClrType, "entity");

            // entity.IdOrganization == context.CurrentOrganizationId
            var body = Expression.Equal(
                Expression.Convert(
                    Expression.Property(entity, nameof(IOrganizationScopedEntity.IdOrganization)),
                    typeof(Guid?)),
                Expression.Property(Expression.Constant(context), currentOrganization));

            entityType.SetQueryFilter(FilterName, Expression.Lambda(body, entity));
        }
    }
}
