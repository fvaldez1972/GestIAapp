using System.Text.RegularExpressions;
using GestIA.Application.Common;
using GestIA.Domain.Clients;

namespace GestIA.Application.Clients;

public sealed partial class ClientContactService(
    IClientRepository clientRepository,
    IClientSiteRepository siteRepository,
    IClientContactRepository contactRepository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IClientContactService
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
        await EnsureSiteAsync(request.IdClient, request.IdClientSite, cancellationToken);
        var details = Validate(request);

        var contact = ClientContact.Create(
            request.IdClient,
            request.IdClientSite,
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
        await EnsureSiteAsync(request.IdClient, request.IdClientSite, cancellationToken);
        var details = Validate(request);
        var contact = await contactRepository.GetAsync(request.IdClient, idClientContact, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el contacto solicitado.");

        contact.UpdateDetails(
            request.IdClientSite,
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

    private async Task EnsureSiteAsync(
        Guid idClient,
        Guid? idClientSite,
        CancellationToken cancellationToken)
    {
        if (!idClientSite.HasValue)
        {
            return;
        }

        if (!await siteRepository.ExistsAsync(idClient, idClientSite.Value, cancellationToken))
        {
            throw new ResourceNotFoundException("La sede seleccionada no pertenece al cliente.");
        }
    }

    private static ClientContactDetails Validate(CreateClientContactRequest request) =>
        Validate(
            request.Purpose,
            request.FullName,
            request.JobTitle,
            request.Email,
            request.Phone,
            request.MobilePhone,
            request.IsPrimary);

    private static ClientContactDetails Validate(UpdateClientContactRequest request) =>
        Validate(
            request.Purpose,
            request.FullName,
            request.JobTitle,
            request.Email,
            request.Phone,
            request.MobilePhone,
            request.IsPrimary);

    private static ClientContactDetails Validate(
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
            isPrimary);
        InputValidation.ThrowIfInvalid(errors);
        return details;
    }

    private static ClientContactResponse Map(ClientContact contact) => new(
        contact.IdClientContact,
        contact.IdClient,
        contact.IdClientSite,
        contact.ClientSite?.Name,
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
