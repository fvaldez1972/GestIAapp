using GestIA.Application.Common;
using GestIA.Application.Catalogs;
using GestIA.Domain.Catalogs;
using GestIA.Application.Organizations;
using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public sealed class ClientService(
    IClientRepository repository,
    IOrganizationRepository organizationRepository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock, FormCatalogValidator catalogs) : IClientService
{
    public async Task<PagedResult<ClientListItemResponse>> ListAsync(
        ClientListQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(query.IdOrganization, errors);
        InputValidation.Page(query.Page, query.PageSize, errors);
        var search = InputValidation.Optional(query.Search, nameof(query.Search), 200, errors);
        var municipality = InputValidation.Optional(query.Municipality, nameof(query.Municipality), 120, errors);
        InputValidation.ThrowIfInvalid(errors);

        var criteria = new ClientSearchCriteria(
            query.IdOrganization,
            search,
            query.Status,
            query.SitePresence,
            municipality,
            (query.Page - 1) * query.PageSize,
            query.PageSize);
        var result = await repository.SearchAsync(criteria, cancellationToken);

        return new PagedResult<ClientListItemResponse>(
            result.Items,
            result.TotalCount,
            query.Page,
            query.PageSize);
    }

    public async Task<IReadOnlyList<string>> ListMunicipalitiesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(idOrganization, errors);
        InputValidation.ThrowIfInvalid(errors);

        return await repository.ListMunicipalitiesAsync(idOrganization, cancellationToken);
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
        await catalogs.ValueAsync(request.IdOrganization, BusinessCatalogItemType.Nationality, input.Profile.Nationality, null, cancellationToken);

        if (!await organizationRepository.ExistsAsync(request.IdOrganization, cancellationToken))
        {
            throw new ResourceNotFoundException("La organización seleccionada no existe o está inactiva.");
        }

        var codeClient = input.CodeClient ?? await NextClientCodeAsync(request.IdOrganization, cancellationToken);

        await EnsureUniqueAsync(
            request.IdOrganization,
            codeClient,
            input.Profile.Rfc,
            null,
            cancellationToken);

        var client = Client.Create(
            request.IdOrganization,
            codeClient,
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
        await catalogs.ValueAsync(request.IdOrganization, BusinessCatalogItemType.Nationality, input.Nationality, client.Nationality, cancellationToken);

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

    /// <summary>
    /// Reactiva un cliente desactivado.
    ///
    /// <para>Se busca con <c>GetIncludingInactiveAsync</c> a propósito: el <c>GetAsync</c> normal
    /// respeta el filtro global de actividad, y con él un cliente desactivado no existe. Usarlo
    /// aquí haría que reactivar devolviera siempre «no se encontró el cliente».</para>
    ///
    /// <para>Reactivar un cliente que ya está activo no es un error ni escribe nada: devuelve el
    /// cliente tal cual. Dos personas pulsando el mismo botón no deben ver una la mitad de un
    /// fallo, y una reactivación repetida no tiene por qué ensuciar la auditoría con un cambio que
    /// no cambia nada.</para>
    ///
    /// <para>No se reviven las sedes, los contactos ni los servicios que se hubieran desactivado
    /// por su cuenta: cada uno se desactivó por su motivo, y devolverlos en bloque decidiría por el
    /// usuario cosas que él no pidió.</para>
    /// </summary>
    public async Task<ClientResponse> ActivateAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken)
    {
        var client = await repository.GetIncludingInactiveAsync(idOrganization, idClient, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el cliente solicitado.");

        if (client.Active)
        {
            return Map(client);
        }

        client.Activate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(client);
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

    /// <summary>
    /// El siguiente código libre con la forma <c>CLI-01</c>.
    ///
    /// <para>Se cuenta desde el más alto ya usado, incluidos los inactivos, porque el código sigue
    /// ocupado aunque el cliente esté dado de baja. No es un consecutivo garantizado: si dos altas
    /// coinciden, la segunda choca con la unicidad y el usuario reintenta, que es preferible a
    /// tomar un candado sobre la tabla para un identificador de conveniencia.</para>
    /// </summary>
    private async Task<string> NextClientCodeAsync(Guid idOrganization, CancellationToken cancellationToken)
    {
        var highest = await repository.HighestClientCodeNumberAsync(idOrganization, cancellationToken);
        return $"CLI-{highest + 1:00}";
    }

    private static (string? CodeClient, ClientProfile Profile) Validate(CreateClientRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        ValidateOrganization(request.IdOrganization, errors);

        // Opcional a propósito: cuando no viene, lo pone el servidor. Cuando viene, se respeta y
        // se valida como siempre.
        var code = string.IsNullOrWhiteSpace(request.CodeClient)
            ? null
            : InputValidation.Required(
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
