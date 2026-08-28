using GestIA.Api.Security;
using GestIA.Application.Reports;
using GestIA.Application.Security;

namespace GestIA.Api.Endpoints;

public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/reports")
            .WithTags("Reports");

        group.MapGet("/operations-summary", async (
            Guid organizationId,
            Guid? clientId,
            Guid? serviceId,
            DateOnly? fromDate,
            DateOnly? toDate,
            IReportsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.GetOperationsSummaryAsync(
                new OperationsSummaryQuery(organizationId, clientId, serviceId, fromDate, toDate),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ReportsRead)
            .WithName("GetOperationsSummary");

        group.MapGet("/operations-by-service", async (
            Guid organizationId,
            Guid? clientId,
            Guid? serviceId,
            DateOnly? fromDate,
            DateOnly? toDate,
            IReportsService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.GetOperationsByServiceAsync(
                new OperationsSummaryQuery(organizationId, clientId, serviceId, fromDate, toDate),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ReportsRead)
            .WithName("GetOperationsByService");

        return endpoints;
    }
}
