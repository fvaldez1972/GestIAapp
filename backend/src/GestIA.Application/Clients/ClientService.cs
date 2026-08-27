using GestIA.Application.Common;
using GestIA.Application.Organizations;
using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public sealed class ClientService(
    IClientRepository repository,
    IOrganizationRepository organizationRepository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IClientService
{
    public async Task<PagedResult<ClientResponse>> ListAsync(
        ClientListQuery query,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(query.IdOrganization, errors);
        InputValidation.Page(query.Page, query.PageSize, errors);
        var search = InputValidation.Optional(query.Search, nameof(query.Search), 200, errors);
        InputValidation.ThrowIfInvalid(errors);

        var criteria = new ClientSearchCriteria(
            query.IdOrganization,
            search,
            (query.Page - 1) * query.PageSize,
            query.PageSize);
        var result = await repository.SearchAsync(criteria, cancellationToken);

        return new PagedResult<ClientResponse>(
            result.Items.Select(Map).ToArray(),
            result.TotalCount,
            query.Page,
            query.PageSize);
    }

    public async Task<ClientResponse> GetAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken)
    {
        var client = await repository.GetAsync(idOrganization, idClient, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el cliente solicitado.");
        return Map(client);
    }

    public async Task<ClientResponse> CreateAsync(
        CreateClientRequest request,
        CancellationToken cancellationToken)
    {
        var input = Validate(request);

        if (!await organizationRepository.ExistsAsync(request.IdOrganization, cancellationToken))
        {
            throw new ResourceNotFoundException("La organización seleccionada no existe o está inactiva.");
        }

        await EnsureUniqueAsync(
            request.IdOrganization,
            input.CodeClient,
            input.Profile.Rfc,
            null,
            cancellationToken);

        var client = Client.Create(
            request.IdOrganization,
            input.CodeClient,
            input.Profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddAsync(client, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(client);
    }

    public async Task<ClientResponse> UpdateAsync(
        Guid idClient,
        UpdateClientRequest request,
        CancellationToken cancellationToken)
    {
        var input = Validate(request);
        var client = await repository.GetAsync(request.IdOrganization, idClient, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el cliente solicitado.");

        await EnsureUniqueAsync(
            request.IdOrganization,
            client.CodeClient,
            input.Rfc,
            idClient,
            cancellationToken);

        client.UpdateProfile(
            input,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(client);
    }

    public async Task DeactivateAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken)
    {
        var client = await repository.GetAsync(idOrganization, idClient, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el cliente solicitado.");

        client.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureUniqueAsync(
        Guid idOrganization,
        string codeClient,
        string rfc,
        Guid? excludedClientId,
        CancellationToken cancellationToken)
    {
        if (await repository.IsCodeInUseAsync(
                idOrganization,
                codeClient,
                excludedClientId,
                cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un cliente con el código '{codeClient}'.");
        }

        if (await repository.IsRfcInUseAsync(
                idOrganization,
                rfc,
                excludedClientId,
                cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un cliente con el RFC '{rfc}'.");
        }
    }

    private static (string CodeClient, ClientProfile Profile) Validate(CreateClientRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(request.IdOrganization, errors);
        var code = InputValidation.Required(
            request.CodeClient,
            nameof(request.CodeClient),
            30,
            errors).ToUpperInvariant();
        var profile = ValidateProfile(
            request.LegalName,
            request.TradeName,
            request.Rfc,
            request.Nationality,
            request.TaxActivity,
            request.TaxAddress,
            request.PublicRegistryDate,
            request.CommercialRegistryFolio,
            request.EmployerRegistrationNumber,
            request.IncorporationDate,
            request.IncorporationDeedNumber,
            request.LegalRepresentativeInstrumentNumber,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return (code, profile);
    }

    private static ClientProfile Validate(UpdateClientRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(request.IdOrganization, errors);
        var profile = ValidateProfile(
            request.LegalName,
            request.TradeName,
            request.Rfc,
            request.Nationality,
            request.TaxActivity,
            request.TaxAddress,
            request.PublicRegistryDate,
            request.CommercialRegistryFolio,
            request.EmployerRegistrationNumber,
            request.IncorporationDate,
            request.IncorporationDeedNumber,
            request.LegalRepresentativeInstrumentNumber,
            errors);
        InputValidation.ThrowIfInvalid(errors);
        return profile;
    }

    private static ClientProfile ValidateProfile(
        string legalName,
        string? tradeName,
        string rfc,
        string? nationality,
        string? taxActivity,
        string? taxAddress,
        DateOnly? publicRegistryDate,
        string? commercialRegistryFolio,
        string? employerRegistrationNumber,
        DateOnly? incorporationDate,
        string? incorporationDeedNumber,
        string? legalRepresentativeInstrumentNumber,
        IDictionary<string, string[]> errors) => new(
            InputValidation.Required(legalName, nameof(legalName), 200, errors),
            InputValidation.Optional(tradeName, nameof(tradeName), 200, errors),
            InputValidation.Rfc(rfc, nameof(rfc), true, errors),
            InputValidation.Optional(nationality, nameof(nationality), 80, errors),
            InputValidation.Optional(taxActivity, nameof(taxActivity), 300, errors),
            InputValidation.Optional(taxAddress, nameof(taxAddress), 500, errors),
            publicRegistryDate,
            InputValidation.Optional(commercialRegistryFolio, nameof(commercialRegistryFolio), 80, errors),
            InputValidation.Optional(employerRegistrationNumber, nameof(employerRegistrationNumber), 30, errors),
            incorporationDate,
            InputValidation.Optional(incorporationDeedNumber, nameof(incorporationDeedNumber), 50, errors),
            InputValidation.Optional(
                legalRepresentativeInstrumentNumber,
                nameof(legalRepresentativeInstrumentNumber),
                80,
                errors));

    private static void ValidateOrganization(
        Guid idOrganization,
        Dictionary<string, string[]> errors)
    {
        if (idOrganization == Guid.Empty)
        {
            errors[nameof(idOrganization)] = ["La organización es obligatoria."];
        }
    }

    private static ClientResponse Map(Client client) => new(
        client.IdClient,
        client.IdOrganization,
        client.Organization?.LegalName ?? string.Empty,
        client.CodeClient,
        client.LegalName,
        client.TradeName,
        client.Rfc,
        client.Nationality,
        client.TaxActivity,
        client.TaxAddress,
        client.PublicRegistryDate,
        client.CommercialRegistryFolio,
        client.EmployerRegistrationNumber,
        client.IncorporationDate,
        client.IncorporationDeedNumber,
        client.LegalRepresentativeInstrumentNumber,
        client.Active,
        client.CreatedAt,
        client.UpdatedAt);
}
