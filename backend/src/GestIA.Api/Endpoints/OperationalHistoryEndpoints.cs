using GestIA.Api.Security;
using GestIA.Application.History;
using GestIA.Application.Security;
using GestIA.Domain.History;

namespace GestIA.Api.Endpoints;

/// <summary>
/// El historial de correcciones de un registro operativo.
///
/// <para><b>Hay una ruta por entidad y no una sola con el tipo como parámetro</b>, a propósito:
/// cada una declara el permiso del módulo dueño del registro. El historial no puede ser una
/// puerta lateral para ver lo que el registro mismo no deja ver, y con rutas separadas ese
/// permiso se lee en el código en lugar de resolverse dentro del manejador.</para>
///
/// <para>El aislamiento entre organizaciones lo dan el guard —que fija la organización
/// autorizada— y el filtro global. Pedir el historial de un registro ajeno devuelve lista vacía.</para>
/// </summary>
public static class OperationalHistoryEndpoints
{
    public static void MapOperationalHistoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        var group = endpoints.MapGroup("/api/v1/history").WithTags("Historial");

        Map(group, "attendance", OperationalEntityType.AttendanceRecord,
            SecurityPermissions.OperationsRead, "ListAttendanceHistory");

        Map(group, "incidents", OperationalEntityType.Incident,
            SecurityPermissions.OperationsRead, "ListIncidentHistory");

        Map(group, "coverages", OperationalEntityType.CoverageRecord,
            SecurityPermissions.OperationsRead, "ListCoverageHistory");

        Map(group, "service-configurations", OperationalEntityType.ServiceConfiguration,
            SecurityPermissions.ClientsRead, "ListServiceConfigurationHistory");

        Map(group, "service-assignments", OperationalEntityType.ServiceAssignment,
            SecurityPermissions.PlanningRead, "ListServiceAssignmentHistory");
    }

    private static void Map(
        RouteGroupBuilder group,
        string segment,
        OperationalEntityType entityType,
        string permission,
        string name) =>
        group.MapGet($"/{segment}/{{recordId:guid}}", async (
            HttpContext context,
            Guid recordId,
            Guid organizationId,
            IOperationalHistoryService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            return Results.Ok(await service.ListAsync(entityType, recordId, cancellationToken));
        })
            .RequirePermission(permission)
            .WithName(name);
}
