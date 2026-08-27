using GestIA.Application.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Application.Organizations;

public sealed class OrganizationService(
    IOrganizationRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IOrganizationService
{
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
