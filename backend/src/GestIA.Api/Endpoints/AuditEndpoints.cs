using GestIA.Api.Security;
using GestIA.Application.Audit;
using GestIA.Application.Security;
using System.Text;

namespace GestIA.Api.Endpoints;

public static class AuditEndpoints
{
    public static IEndpointRouteBuilder MapAuditEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/audit")
            .WithTags("Audit");

        group.MapGet("/events", async (
            Guid organizationId,
            string? entity,
            string? search,
            DateOnly? fromDate,
            DateOnly? toDate,
            int page,
            int pageSize,
            IAuditService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.SearchAsync(
                new AuditQuery(
                    organizationId,
                    entity,
                    search,
                    fromDate,
                    toDate,
                    page <= 0 ? 1 : page,
                    pageSize <= 0 ? 20 : pageSize),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.AuditRead)
            .WithName("ListAuditEvents");

        group.MapGet("/events/export", async (
            Guid organizationId,
            string? entity,
            string? search,
            DateOnly? fromDate,
            DateOnly? toDate,
            IAuditService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.SearchAsync(
                new AuditQuery(
                    organizationId,
                    entity,
                    search,
                    fromDate,
                    toDate,
                    1,
                    100),
                cancellationToken);

            var rows = new List<IReadOnlyList<object?>>
            {
                new object?[] { "Fecha", "Entidad", "Registro", "IdRegistro", "Accion", "Usuario", "Detalle", "Estado" }
            };

            rows.AddRange(result.Events.Items.Select(item => new object?[]
            {
                item.OccurredAt,
                item.Entity,
                item.EntityName,
                item.RecordId,
                item.Action,
                item.ActorName,
                item.Details,
                item.Active ? "Activo" : "Inactivo"
            }));

            var csv = ToCsv(rows);
            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();
            var fileName = $"gestia-auditoria-{entity ?? "todas"}-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
            return Results.File(bytes, "text/csv; charset=utf-8", fileName);
        })
            .RequirePermission(SecurityPermissions.AuditRead)
            .WithName("ExportAuditEvents");

        return endpoints;
    }

    private static string ToCsv(IEnumerable<IReadOnlyList<object?>> rows) =>
        string.Join(Environment.NewLine, rows.Select(row => string.Join(",", row.Select(EscapeCsv))));

    private static string EscapeCsv(object? value)
    {
        var text = Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty;
        return $"\"{text.Replace("\"", "\"\"")}\"";
    }
}
