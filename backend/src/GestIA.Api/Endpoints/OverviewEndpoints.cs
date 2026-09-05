using GestIA.Api.Security;
using GestIA.Application.Overview;

namespace GestIA.Api.Endpoints;

public static class OverviewEndpoints
{
    /// <summary>
    /// El estado de la organización para la pantalla de Inicio.
    ///
    /// <para><b>Deliberadamente sin <c>RequirePermission</c>.</b> Inicio es la pantalla de
    /// aterrizaje de todos: quien sólo tiene <c>OPERATIONS.READ</c> también entra aquí, y exigir
    /// un permiso de módulo le daría un 403 en su portada. Lo que protege esta ruta es el guard de
    /// organización —que además fija el filtro global— y, dentro, el propio servicio, que recorta
    /// destinos, indicadores y asuntos según lo que el actor puede hacer.</para>
    /// </summary>
    public static IEndpointRouteBuilder MapOverviewEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/overview", async (
            HttpContext context,
            Guid organizationId,
            IOverviewService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.GetOverviewAsync(new OverviewQuery(organizationId), cancellationToken);
            return Results.Ok(result);
        })
            .WithTags("Overview")
            .WithName("GetOverview");

        return endpoints;
    }
}
