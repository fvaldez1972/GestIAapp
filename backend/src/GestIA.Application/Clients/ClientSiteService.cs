using GestIA.Application.Common;
using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public sealed class ClientSiteService(
    IClientRepository clientRepository,
    IClientSiteRepository siteRepository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IClientSiteService
{
    public async Task<IReadOnlyList<ClientSiteResponse>> ListAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        var sites = await siteRepository.ListAsync(idClient, cancellationToken);
        return sites.Select(Map).ToArray();
    }

    public async Task<ClientSiteResponse> CreateAsync(
        CreateClientSiteRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(request.IdOrganization, request.IdClient, cancellationToken);
        var (code, address) = Validate(request);

        if (await siteRepository.IsCodeInUseAsync(request.IdClient, code, null, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una sede con el código '{code}'.");
        }

        var site = ClientSite.Create(
            request.IdClient,
            code,
            address,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await siteRepository.AddAsync(site, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(site);
    }

    public async Task<ClientSiteResponse> UpdateAsync(
        Guid idClientSite,
        UpdateClientSiteRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(request.IdOrganization, request.IdClient, cancellationToken);
        var address = Validate(request);
        var site = await siteRepository.GetAsync(request.IdClient, idClientSite, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la sede solicitada.");

        site.UpdateAddress(address, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(site);
    }

    public async Task DeactivateAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idClientSite,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        var site = await siteRepository.GetAsync(idClient, idClientSite, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la sede solicitada.");

        site.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureClientAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken)
    {
        if (idOrganization == Guid.Empty || idClient == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idOrganization)] = ["La organización es obligatoria."],
                [nameof(idClient)] = ["El cliente es obligatorio."]
            });
        }

        if (await clientRepository.GetAsync(idOrganization, idClient, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el cliente solicitado.");
        }
    }

    private static (string Code, ClientSiteAddress Address) Validate(CreateClientSiteRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var code = InputValidation.Required(
            request.CodeClientSite,
            nameof(request.CodeClientSite),
            30,
            errors).ToUpperInvariant();
        var address = ValidateAddress(
            request.Name,
            request.Street,
            request.ExteriorNumber,
            request.InteriorNumber,
            request.Neighborhood,
            request.Municipality,
            request.State,
            request.PostalCode,
            request.CountryCode,
            request.AccessInstructions,
            request.TimeZoneId,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return (code, address);
    }

    private static ClientSiteAddress Validate(UpdateClientSiteRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var address = ValidateAddress(
            request.Name,
            request.Street,
            request.ExteriorNumber,
            request.InteriorNumber,
            request.Neighborhood,
            request.Municipality,
            request.State,
            request.PostalCode,
            request.CountryCode,
            request.AccessInstructions,
            request.TimeZoneId,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return address;
    }

    private static ClientSiteAddress ValidateAddress(
        string name,
        string street,
        string? exteriorNumber,
        string? interiorNumber,
        string? neighborhood,
        string municipality,
        string state,
        string postalCode,
        string? countryCode,
        string? accessInstructions,
        string? timeZoneId,
        IDictionary<string, string[]> errors)
    {
        var country = string.IsNullOrWhiteSpace(countryCode)
            ? "MX"
            : InputValidation.Optional(countryCode, nameof(countryCode), 2, errors) ?? "MX";

        return new ClientSiteAddress(
            InputValidation.Required(name, nameof(name), 150, errors),
            InputValidation.Required(street, nameof(street), 200, errors),
            InputValidation.Optional(exteriorNumber, nameof(exteriorNumber), 30, errors),
            InputValidation.Optional(interiorNumber, nameof(interiorNumber), 30, errors),
            InputValidation.Optional(neighborhood, nameof(neighborhood), 120, errors),
            InputValidation.Required(municipality, nameof(municipality), 120, errors),
            InputValidation.Required(state, nameof(state), 120, errors),
            InputValidation.Required(postalCode, nameof(postalCode), 10, errors),
            country.ToUpperInvariant(),
            InputValidation.Optional(accessInstructions, nameof(accessInstructions), 1000, errors),
            InputValidation.Optional(timeZoneId, nameof(timeZoneId), 100, errors));
    }

    private static ClientSiteResponse Map(ClientSite site) => new(
        site.IdClientSite,
        site.IdClient,
        site.CodeClientSite,
        site.Name,
        site.Street,
        site.ExteriorNumber,
        site.InteriorNumber,
        site.Neighborhood,
        site.Municipality,
        site.State,
        site.PostalCode,
        site.CountryCode,
        site.AccessInstructions,
        site.TimeZoneId,
        site.Active);
}
