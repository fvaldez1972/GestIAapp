namespace GestIA.Application.Organizations;

public interface IOrganizationGovernanceRepository
{
    Task<IReadOnlyList<OrganizationGovernanceSummaryResponse>> ListAsync(CancellationToken cancellationToken);
}
