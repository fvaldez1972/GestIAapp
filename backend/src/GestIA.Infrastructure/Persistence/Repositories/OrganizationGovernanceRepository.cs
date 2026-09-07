using GestIA.Application.Organizations;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class OrganizationGovernanceRepository(GestIaDbContext dbContext)
    : IOrganizationGovernanceRepository
{
    public async Task<IReadOnlyList<OrganizationGovernanceSummaryResponse>> ListAsync(
        CancellationToken cancellationToken)
    {
        var organizations = await dbContext.Organizations
            .IgnoreQueryFilters(["Active"])
            .AsNoTracking()
            .OrderBy(organization => organization.LegalName)
            .Select(organization => new
            {
                Organization = new OrganizationResponse(
                    organization.IdOrganization,
                    organization.CodeOrganization,
                    organization.LegalName,
                    organization.Rfc,
                    organization.Active),
                // Vista de plataforma: lista las organizaciones con sus clientes, así que cruza
                // organizaciones a propósito. El endpoint exige PLATFORM.ADMIN.
                Clients = dbContext.Clients
                    .IgnoreQueryFilters(QueryFilterNames.ActiveAndOrganization)
                    .Where(client => client.IdOrganization == organization.IdOrganization)
                    .OrderBy(client => client.LegalName)
                    .Select(client => new OrganizationClientSummaryResponse(
                        client.IdClient,
                        client.CodeClient,
                        client.LegalName,
                        client.TradeName,
                        client.Rfc,
                        client.Active))
                    .ToArray(),
                UsersCount = dbContext.OrganizationMemberships
                    .IgnoreQueryFilters(QueryFilterNames.ActiveOnly)
                    .Count(membership => membership.IdOrganization == organization.IdOrganization && membership.Active),
                AdminsCount = dbContext.UserRoles
                    .IgnoreQueryFilters(QueryFilterNames.ActiveOnly)
                    .Count(userRole =>
                        userRole.Active &&
                        userRole.Role.CodeRole == "ORGANIZATION_ADMIN" &&
                        userRole.OrganizationMembership != null &&
                        userRole.OrganizationMembership.IdOrganization == organization.IdOrganization)
            })
            .ToArrayAsync(cancellationToken);

        return organizations
            .Select(item => new OrganizationGovernanceSummaryResponse(
                item.Organization,
                item.Clients,
                item.UsersCount,
                item.AdminsCount))
            .ToArray();
    }
}
