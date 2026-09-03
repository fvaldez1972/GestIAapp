using GestIA.Api.Security;
using GestIA.Application.Catalogs;
using GestIA.Application.Security;
using GestIA.Domain.Catalogs;

namespace GestIA.Api.Endpoints;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/catalogs")
            .WithTags("Catalogs");

        group.MapGet("/items", async (
            HttpContext context,
            Guid organizationId,
            BusinessCatalogItemType? type,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var items = await service.ListCatalogItemsAsync(organizationId, type, cancellationToken);
            return Results.Ok(items);
        })
            .RequirePermission(SecurityPermissions.CatalogsRead)
            .WithName("ListCatalogItems");

        group.MapPost("/items", async (
            HttpContext context,
            CatalogItemInput request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var item = await service.CreateCatalogItemAsync(request, cancellationToken);
            return Results.Created($"/api/v1/catalogs/items/{item.IdCatalogItem}", item);
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("CreateCatalogItem");

        group.MapPut("/items/{idCatalogItem:guid}", async (
            HttpContext context,
            Guid idCatalogItem,
            CatalogItemInput request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var item = await service.UpdateCatalogItemAsync(idCatalogItem, request, cancellationToken);
            return Results.Ok(item);
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("UpdateCatalogItem");

        group.MapDelete("/items/{idCatalogItem:guid}", async (
            HttpContext context,
            Guid idCatalogItem,
            Guid organizationId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateCatalogItemAsync(organizationId, idCatalogItem, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("DeactivateCatalogItem");

        group.MapGet("/eligibility-requirements", async (
            HttpContext context,
            Guid organizationId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var requirements = await service.ListEligibilityRequirementsAsync(organizationId, cancellationToken);
            return Results.Ok(requirements);
        })
            .RequirePermission(SecurityPermissions.CatalogsRead)
            .WithName("ListEligibilityRequirements");

        group.MapPost("/eligibility-requirements", async (
            HttpContext context,
            EligibilityRequirementInput request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var requirement = await service.CreateEligibilityRequirementAsync(request, cancellationToken);
            return Results.Created(
                $"/api/v1/catalogs/eligibility-requirements/{requirement.IdEligibilityRequirement}",
                requirement);
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("CreateEligibilityRequirement");

        group.MapPut("/eligibility-requirements/{idEligibilityRequirement:guid}", async (
            HttpContext context,
            Guid idEligibilityRequirement,
            EligibilityRequirementInput request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var requirement = await service.UpdateEligibilityRequirementAsync(
                idEligibilityRequirement,
                request,
                cancellationToken);
            return Results.Ok(requirement);
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("UpdateEligibilityRequirement");

        group.MapDelete("/eligibility-requirements/{idEligibilityRequirement:guid}", async (
            HttpContext context,
            Guid idEligibilityRequirement,
            Guid organizationId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateEligibilityRequirementAsync(
                organizationId,
                idEligibilityRequirement,
                cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.CatalogsWrite)
            .WithName("DeactivateEligibilityRequirement");

        group.MapGet("/employees/{idEmployee:guid}/skills", async (
            HttpContext context,
            Guid idEmployee,
            Guid organizationId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var skills = await service.ListEmployeeSkillsAsync(organizationId, idEmployee, cancellationToken);
            return Results.Ok(skills);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("ListEmployeeSkills");

        group.MapPost("/employees/{idEmployee:guid}/skills", async (
            HttpContext context,
            Guid idEmployee,
            EmployeeSkillInput request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var skill = await service.CreateEmployeeSkillAsync(
                request with { IdEmployee = idEmployee },
                cancellationToken);
            return Results.Created($"/api/v1/catalogs/employees/{idEmployee}/skills/{skill.IdEmployeeSkill}", skill);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("CreateEmployeeSkill");

        group.MapPut("/employees/{idEmployee:guid}/skills/{idEmployeeSkill:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid idEmployeeSkill,
            EmployeeSkillInput request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, request.IdOrganization) is { } forbidden)
            {
                return forbidden;
            }

            var skill = await service.UpdateEmployeeSkillAsync(
                idEmployeeSkill,
                request with { IdEmployee = idEmployee },
                cancellationToken);
            return Results.Ok(skill);
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("UpdateEmployeeSkill");

        group.MapDelete("/employees/{idEmployee:guid}/skills/{idEmployeeSkill:guid}", async (
            HttpContext context,
            Guid idEmployee,
            Guid idEmployeeSkill,
            Guid organizationId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            await service.DeactivateEmployeeSkillAsync(organizationId, idEmployee, idEmployeeSkill, cancellationToken);
            return Results.NoContent();
        })
            .RequirePermission(SecurityPermissions.WorkforceWrite)
            .WithName("DeactivateEmployeeSkill");

        group.MapGet("/eligibility/check", async (
            HttpContext context,
            Guid organizationId,
            Guid employeeId,
            Guid? clientId,
            Guid? serviceId,
            Guid? positionId,
            DateOnly referenceDate,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            if (OrganizationAccessGuard.ForbidIfUnauthorized(context, organizationId) is { } forbidden)
            {
                return forbidden;
            }

            var result = await service.CheckEligibilityAsync(
                new EligibilityCheckQuery(
                    organizationId,
                    employeeId,
                    clientId,
                    serviceId,
                    positionId,
                    referenceDate),
                cancellationToken);
            return Results.Ok(result);
        })
            .RequirePermission(SecurityPermissions.WorkforceRead)
            .WithName("CheckEmployeeEligibility");

        return endpoints;
    }
}
