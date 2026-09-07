using GestIA.Api.Security;
using GestIA.Application.Common;
using GestIA.Application.Security;
using GestIA.Application.Services;

namespace GestIA.Api.Endpoints;

public static class ServiceManagementEndpoints
{
    public static IEndpointRouteBuilder MapServiceManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // Lista de servicios de la organización, sin pasar por el cliente. Es lo que permite que
        // la pantalla de Servicios deje de exigir la cascada organización -> cliente -> servicio;
        // el grupo anidado de abajo se queda para el detalle, el alta y las configuraciones.
        var organizationServiceGroup = endpoints.MapGroup("/api/v1/services").WithTags("Services");

        organizationServiceGroup.MapGet("", async (
            HttpContext context,
            Guid organizationId,
            string? search,
            Guid? idClient,
            Guid? idClientSite,
            Guid? idServiceContract,
            ServiceStatusFilter? status,
            DateOnly? coverageDate,
            int? page,
            int? pageSize,
            IServiceManagementService service,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.SearchServicesAsync(
                new ServiceListQuery(
                    organizationId,
                    // La cobertura se calcula a un día, y el que vale por omisión es el operativo
                    // del servidor: el del navegador se adelanta seis horas cada tarde.
                    coverageDate ?? clock.Today,
                    search,
                    idClient,
                    idClientSite,
                    idServiceContract,
                    status ?? ServiceStatusFilter.Active,
                    page ?? 1,
                    pageSize ?? 20),
                cancellationToken);

            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("SearchServicesByOrganization");

        var serviceGroup = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/services")
            .WithTags("Services");

        serviceGroup.MapGet("", async (
            HttpContext context,
            Guid idClient,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var services = await service.ListServicesAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(services);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListServices");

        serviceGroup.MapPost("", async (
            HttpContext context,
            Guid idClient,
            CreateServiceRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CreateServiceAsync(request with { IdClient = idClient }, cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/services/{result.IdService}", result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateService");

        serviceGroup.MapPut("/{idService:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idService,
            UpdateServiceRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateServiceAsync(
                idService,
                request with { IdClient = idClient },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateService");

        serviceGroup.MapDelete("/{idService:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateServiceAsync(organizationId, idClient, idService, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateService");

        serviceGroup.MapGet("/{idService:guid}/configurations", async (
            HttpContext context,
            Guid idClient,
            Guid idService,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

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
            HttpContext context,
            Guid idClient,
            Guid idService,
            CreateServiceConfigurationRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

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
            HttpContext context,
            Guid idClient,
            Guid idService,
            Guid idServiceConfiguration,
            UpdateServiceConfigurationRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateConfigurationAsync(
                idServiceConfiguration,
                request with { IdClient = idClient, IdService = idService },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateServiceConfiguration");

        serviceGroup.MapDelete("/{idService:guid}/configurations/{idServiceConfiguration:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idService,
            Guid idServiceConfiguration,
            Guid organizationId,
            string rowVersion,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateConfigurationAsync(
                organizationId,
                idClient,
                idService,
                idServiceConfiguration,
                ConcurrencyToken.Require(rowVersion),
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateServiceConfiguration");

        var contractGroup = endpoints.MapGroup("/api/v1/clients/{idClient:guid}/contracts")
            .WithTags("Service Contracts");

        contractGroup.MapGet("", async (
            HttpContext context,
            Guid idClient,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var contracts = await service.ListContractsAsync(organizationId, idClient, cancellationToken);
            return Results.Ok(contracts);
        })
            .RequirePermission(SecurityPermissions.ClientsRead)
            .WithName("ListServiceContracts");

        contractGroup.MapPost("", async (
            HttpContext context,
            Guid idClient,
            CreateServiceContractRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CreateContractAsync(request with { IdClient = idClient }, cancellationToken);
            return Results.Created($"/api/v1/clients/{idClient}/contracts/{result.IdServiceContract}", result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("CreateServiceContract");

        contractGroup.MapPut("/{idServiceContract:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idServiceContract,
            UpdateServiceContractRequest request,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.UpdateContractAsync(
                idServiceContract,
                request with { IdClient = idClient },
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("UpdateServiceContract");

        contractGroup.MapDelete("/{idServiceContract:guid}", async (
            HttpContext context,
            Guid idClient,
            Guid idServiceContract,
            Guid organizationId,
            IServiceManagementService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateContractAsync(organizationId, idClient, idServiceContract, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.ClientsWrite)
            .WithName("DeactivateServiceContract");

        return endpoints;
    }
}
