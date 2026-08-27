using GestIA.Api.Security;
using GestIA.Application.Security;
using GestIA.Application.Services;

namespace GestIA.Api.Endpoints;

public static class ServiceManagementEndpoints
{
    public static IEndpointRouteBuilder MapServiceManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var serviceGroup = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/services")
            .WithTags("Services");

        serviceGroup.MapGet("", async (
            Guid idClient,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var services = await service.ListServicesAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(services);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListServices");

        serviceGroup.MapPost("", async (
            Guid idClient,
            CreateServiceRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateServiceAsync(request with { IdClient = idClient }, cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/services/{result.IdService}", result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateService");

        serviceGroup.MapPut("/{idService:guid}", async (
            Guid idClient,
            Guid idService,
            UpdateServiceRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateServiceAsync(
                idService,
                request with { IdClient = idClient },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateService");

        serviceGroup.MapDelete("/{idService:guid}", async (
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateServiceAsync(organizationId, idClient, idService, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateService");

        serviceGroup.MapGet("/{idService:guid}/configurations", async (
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var configurations = await service.ListConfigurationsAsync(
                organizationId,
                idClient,
                idService,
                cancellationToken);
            return Results.Ok(configurations);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListServiceConfigurations");

        serviceGroup.MapPost("/{idService:guid}/configurations", async (
            Guid idClient,
            Guid idService,
            CreateServiceConfigurationRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateConfigurationAsync(
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Created(
                $"/api/v1/clients/{idClient}/services/{idService}/configurations/{result.IdServiceConfiguration}",
                result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateServiceConfiguration");

        serviceGroup.MapPut("/{idService:guid}/configurations/{idServiceConfiguration:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idServiceConfiguration,
            UpdateServiceConfigurationRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateConfigurationAsync(
                idServiceConfiguration,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateServiceConfiguration");

        serviceGroup.MapDelete("/{idService:guid}/configurations/{idServiceConfiguration:guid}", async (
            Guid idClient,
            Guid idService,
            Guid idServiceConfiguration,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateConfigurationAsync(
                organizationId,
                idClient,
                idService,
                idServiceConfiguration,
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateServiceConfiguration");

        var contractGroup = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/contracts")
            .WithTags("Service Contracts");

        contractGroup.MapGet("", async (
            Guid idClient,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var contracts = await service.ListContractsAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(contracts);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListServiceContracts");

        contractGroup.MapPost("", async (
            Guid idClient,
            CreateServiceContractRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateContractAsync(request with { IdClient = idClient }, cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/contracts/{result.IdServiceContract}", result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateServiceContract");

        contractGroup.MapPut("/{idServiceContract:guid}", async (
            Guid idClient,
            Guid idServiceContract,
            UpdateServiceContractRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateContractAsync(
                idServiceContract,
                request with { IdClient = idClient },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateServiceContract");

        contractGroup.MapDelete("/{idServiceContract:guid}", async (
            Guid idClient,
            Guid idServiceContract,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            await service.DeactivateContractAsync(organizationId, idClient, idServiceContract, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateServiceContract");

        return endpoints;
    }
}
