using GestIA.Api.Security;
using GestIA.Application.Planning;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

/// <summary>
/// El catálogo de patrones de turno.
///
/// <para><b>Vive bajo catálogos y no bajo una posición</b> porque eso es lo que cambió: el patrón
/// dejó de capturarse dentro de cada posición para capturarse una vez y elegirse de un
/// desplegable.</para>
///
/// <para><b>El desplegable se sirve con permiso de planeación, no de catálogos.</b> Quien crea una
/// posición necesita ver los patrones disponibles aunque no pueda administrar el catálogo; exigirle
/// <c>CATALOGS.READ</c> lo dejaría con un combo vacío y sin explicación.</para>
/// </summary>
public static class ShiftPatternTemplateEndpoints
{
    public static IEndpointRouteBuilder MapShiftPatternTemplateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/catalogs/shift-pattern-templates")
            .WithTags("Catalogs");

        group.MapGet("", async (
            HttpContext context,
            Guid organizationId,
            bool? includeInactive,
            IShiftPatternTemplateService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ListAsync(
                organizationId, includeInactive ?? false, cancellationToken);

            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.CatalogsRead)
            .WithName("ListShiftPatternTemplates");

        group.MapGet("/options", async (
            HttpContext context,
            Guid organizationId,
            IShiftPatternTemplateService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.ListOptionsAsync(organizationId, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.PlanningRead)
            .WithName("ListShiftPatternTemplateOptions");

        group.MapPost("", async (
            HttpContext context,
            CreateShiftPatternTemplateRequest request,
            IShiftPatternTemplateService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CreateAsync(request, cancellationToken);
            return Results.Created(
                $"/api/v1/catalogs/shift-pattern-templates/{result.IdShiftPatternTemplate}",
                result);
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("CreateShiftPatternTemplate");

        group.MapPut("/{idShiftPatternTemplate:guid}", async (
            HttpContext context,
            Guid idShiftPatternTemplate,
            UpdateShiftPatternTemplateRequest request,
            IShiftPatternTemplateService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateAsync(idShiftPatternTemplate, request, cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("UpdateShiftPatternTemplate");

        group.MapDelete("/{idShiftPatternTemplate:guid}", async (
            HttpContext context,
            Guid idShiftPatternTemplate,
            Guid organizationId,
            IShiftPatternTemplateService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateAsync(organizationId, idShiftPatternTemplate, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("DeactivateShiftPatternTemplate");

        return endpoints;
    }
}
