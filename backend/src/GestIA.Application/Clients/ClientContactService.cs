using System.Text.RegularExpressions;
using GestIA.Application.Common;
using GestIA.Application.Catalogs;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public sealed partial class ClientContactService(
    IClientRepository clientRepository,
    IClientSiteRepository siteRepository,
    IClientContactRepository contactRepository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock,
    FormCatalogValidator catalogValidator) : IClientContactService
{
    public async Task<IReadOnlyList<ClientContactResponse>> ListAsync(
        Guid idOrganization,
        Guid idClient,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        var contacts = await contactRepository.ListAsync(idClient, cancellationToken);
        return contacts.Select(Map).ToArray();
    }

    public async Task<ClientContactResponse> CreateAsync(
        CreateClientContactRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(request.IdOrganization, request.IdClient, cancellationToken);
        await EnsureZoneAsync(request.IdClient, request.IdClientZone, cancellationToken);
        var details = Validate(request);

        await EnsureSinglePrimaryAsync(request.IdClient, null, details.IsPrimary, cancellationToken);

        await catalogValidator.ValueAsync(request.IdOrganization, BusinessCatalogItemType.JobPosition, details.JobTitle, null, cancellationToken);
        var contact = ClientContact.Create(
            request.IdOrganization,
            request.IdClient,
            request.IdClientZone,
            details,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await contactRepository.AddAsync(contact, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(contact);
    }

    public async Task<ClientContactResponse> UpdateAsync(
        Guid idClientContact,
        UpdateClientContactRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(request.IdOrganization, request.IdClient, cancellationToken);
        await EnsureZoneAsync(request.IdClient, request.IdClientZone, cancellationToken);
        var details = Validate(request);
        var contact = await contactRepository.GetAsync(request.IdClient, idClientContact, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el contacto solicitado.");

        await EnsureSinglePrimaryAsync(request.IdClient, idClientContact, details.IsPrimary, cancellationToken);

        await catalogValidator.ValueAsync(request.IdOrganization, BusinessCatalogItemType.JobPosition, details.JobTitle, contact.JobTitle, cancellationToken);
        contact.UpdateDetails(
            request.IdClientZone,
            details,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(contact);
    }

    public async Task DeactivateAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idClientContact,
        CancellationToken cancellationToken)
    {
        await EnsureClientAsync(idOrganization, idClient, cancellationToken);
        var contact = await contactRepository.GetAsync(idClient, idClientContact, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el contacto solicitado.");

        contact.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
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

    /// <summary>
    /// Un solo contacto principal por cliente.
    ///
    /// <para>La marca no se mueve sola: marcar a otro <b>no</b> desmarca al que la tiene, porque
    /// eso cambiaría un dato del expediente sin que nadie lo pidiera y sin dejar claro qué pasó.
    /// Hay que quitársela primero al actual, y el aviso dice a quién.</para>
    ///
    /// <para>Se comprueba aquí <b>y</b> en la base, con un índice único filtrado. Aquí para poder
    /// decir el nombre; allá para que la regla siga siendo cierta si mañana otro camino guarda un
    /// contacto sin pasar por este servicio.</para>
    /// </summary>
    private async Task EnsureSinglePrimaryAsync(
        Guid idClient,
        Guid? idClientContact,
        bool isPrimary,
        CancellationToken cancellationToken)
    {
        if (!isPrimary)
        {
            return;
        }

        var actual = await contactRepository.GetPrimaryAsync(idClient, idClientContact, cancellationToken);
        if (actual is not null)
        {
            throw new ResourceConflictException(
                $"Este cliente ya tiene un contacto principal: {actual.FullName}. "
                + "Quítale la marca antes de dársela a otro.");
        }
    }

    private async Task EnsureZoneAsync(
        Guid idClient,
        Guid? idClientZone,
        CancellationToken cancellationToken)
    {
        if (!idClientZone.HasValue)
        {
            return;
        }

        if (!await siteRepository.ExistsAsync(idClient, idClientZone.Value, cancellationToken))
        {
            throw new ResourceNotFoundException("La zona seleccionada no pertenece al cliente.");
        }
    }

    private static ClientContactDetails Validate(CreateClientContactRequest request) =>
        Validate(
            request.IdPurposeCatalogItem,
            request.IdContactJobPositionCatalogItem,
            request.IdClientZone,
            request.Purpose,
            request.FullName,
            request.JobTitle,
            request.Email,
            request.Phone,
            request.MobilePhone,
            request.IsPrimary);

    private static ClientContactDetails Validate(UpdateClientContactRequest request) =>
        Validate(
            request.IdPurposeCatalogItem,
            request.IdContactJobPositionCatalogItem,
            request.IdClientZone,
            request.Purpose,
            request.FullName,
            request.JobTitle,
            request.Email,
            request.Phone,
            request.MobilePhone,
            request.IsPrimary);

    private static ClientContactDetails Validate(
        Guid? idPurposeCatalogItem,
        Guid? idContactJobPositionCatalogItem,
        Guid? idClientZone,
        ClientContactPurpose purpose,
        string fullName,
        string? jobTitle,
        string? email,
        string? phone,
        string? mobilePhone,
        bool isPrimary)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        if (!Enum.IsDefined(purpose))
        {
            errors[nameof(purpose)] = ["El propósito del contacto no es válido."];
        }

        // La zona es opcional: vacia significa que el contacto vale para todo el cliente. Que la
        // zona, cuando viene, sea de ese cliente lo comprueba EnsureZoneAsync antes de llegar aqui.

        var normalizedEmail = InputValidation.Optional(email, nameof(email), 254, errors);
        if (normalizedEmail is not null && !EmailRegex().IsMatch(normalizedEmail))
        {
            errors[nameof(email)] = ["El correo electrónico no tiene un formato válido."];
        }

        var normalizedPhone = InputValidation.Optional(phone, nameof(phone), 30, errors);
        var normalizedMobile = InputValidation.Optional(mobilePhone, nameof(mobilePhone), 30, errors);

        if (normalizedPhone is null && normalizedMobile is null && normalizedEmail is null)
        {
            errors[nameof(phone)] = ["Captura al menos un medio de contacto."];
        }

        var details = new ClientContactDetails(
            purpose,
            InputValidation.Required(fullName, nameof(fullName), 200, errors),
            InputValidation.Optional(jobTitle, nameof(jobTitle), 120, errors),
            normalizedEmail,
            normalizedPhone,
            normalizedMobile,
            isPrimary,
            idPurposeCatalogItem,
            idContactJobPositionCatalogItem);
        InputValidation.ThrowIfInvalid(errors);
        return details;
    }

    private static ClientContactResponse Map(ClientContact contact) => new(
        contact.IdClientContact,
        contact.IdClient,
        contact.IdClientSite,
        contact.IdPurposeCatalogItem,
        contact.IdContactJobPositionCatalogItem,
        contact.ClientSite?.Name,
        contact.PurposeCatalogItem?.Name,
        contact.ContactJobPositionCatalogItem?.Name,
        contact.Purpose,
        contact.FullName,
        contact.JobTitle,
        contact.Email,
        contact.Phone,
        contact.MobilePhone,
        contact.IsPrimary,
        contact.Active);

    [GeneratedRegex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", RegexOptions.CultureInvariant)]
    private static partial Regex EmailRegex();
}
