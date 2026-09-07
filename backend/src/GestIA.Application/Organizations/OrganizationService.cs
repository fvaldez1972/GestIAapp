using GestIA.Application.Common;
using GestIA.Application.Catalogs;
using GestIA.Domain.Organizations;

namespace GestIA.Application.Organizations;

public sealed class OrganizationService(
    IOrganizationRepository repository,
    IOrganizationGovernanceRepository governanceRepository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock,
    OrganizationCatalogDefaults catalogDefaults) : IOrganizationService
{
    public Task<IReadOnlyList<OrganizationGovernanceSummaryResponse>> ListGovernanceAsync(
        CancellationToken cancellationToken) =>
        governanceRepository.ListAsync(cancellationToken);

    public async Task<IReadOnlyList<OrganizationResponse>> ListAsync(
        CancellationToken cancellationToken)
    {
        var organizations = await repository.ListAsync(cancellationToken);
        return organizations.Select(Map).ToArray();
    }

    public async Task<OrganizationResponse> GetAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var organization = await repository.GetAsync(idOrganization, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la organización solicitada.");
        return Map(organization);
    }

    public async Task<OrganizationResponse> CreateAsync(
        CreateOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var code = InputValidation.Required(
            request.CodeOrganization,
            nameof(request.CodeOrganization),
            30,
            errors).ToUpperInvariant();
        var legalName = InputValidation.Required(
            request.LegalName,
            nameof(request.LegalName),
            200,
            errors);
        var rfc = string.IsNullOrWhiteSpace(request.Rfc)
            ? null
            : InputValidation.Rfc(request.Rfc, nameof(request.Rfc), false, errors);
        InputValidation.ThrowIfInvalid(errors);

        if (await repository.IsCodeInUseAsync(code, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una organización con el código '{code}'.");
        }

        if (rfc is not null && await repository.IsRfcInUseAsync(rfc, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una organización con el RFC '{rfc}'.");
        }

        var organization = Organization.Create(
            code,
            legalName,
            rfc,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddAsync(organization, cancellationToken);
        await catalogDefaults.StageAsync(organization.IdOrganization, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(organization);
    }

    public async Task<OrganizationResponse> UpdateAsync(
        Guid idOrganization,
        UpdateOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        var organization = await repository.GetTrackedAsync(idOrganization, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la organización solicitada.");
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var code = InputValidation.Required(
            request.CodeOrganization,
            nameof(request.CodeOrganization),
            30,
            errors).ToUpperInvariant();
        var legalName = InputValidation.Required(
            request.LegalName,
            nameof(request.LegalName),
            200,
            errors);
        var rfc = string.IsNullOrWhiteSpace(request.Rfc)
            ? null
            : InputValidation.Rfc(request.Rfc, nameof(request.Rfc), false, errors);
        InputValidation.ThrowIfInvalid(errors);

        if (!string.Equals(organization.CodeOrganization, code, StringComparison.OrdinalIgnoreCase) &&
            await repository.IsCodeInUseAsync(code, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una organización con el código '{code}'.");
        }

        if (!string.Equals(organization.Rfc, rfc, StringComparison.OrdinalIgnoreCase) &&
            rfc is not null &&
            await repository.IsRfcInUseAsync(rfc, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una organización con el RFC '{rfc}'.");
        }

        organization.UpdateProfile(
            code,
            legalName,
            rfc,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(organization);
    }

    public async Task DeactivateAsync(Guid idOrganization, CancellationToken cancellationToken)
    {
        var organization = await repository.GetTrackedAsync(idOrganization, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la organización solicitada.");
        organization.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<OrganizationResponse> ActivateAsync(Guid idOrganization, CancellationToken cancellationToken)
    {
        var organization = await repository.GetTrackedAsync(idOrganization, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la organización solicitada.");
        organization.Activate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(organization);
    }

    private static OrganizationResponse Map(Organization organization) => new(
        organization.IdOrganization,
        organization.CodeOrganization,
        organization.LegalName,
        organization.Rfc,
        organization.Active);
}
