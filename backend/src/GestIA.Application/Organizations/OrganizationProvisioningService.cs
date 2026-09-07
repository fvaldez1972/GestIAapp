using GestIA.Application.Common;
using GestIA.Application.Catalogs;
using GestIA.Application.Security;
using GestIA.Domain.Organizations;
using GestIA.Domain.Security;

namespace GestIA.Application.Organizations;

public sealed class OrganizationProvisioningService(
    IOrganizationRepository organizationRepository,
    IOrganizationAdminProvisioningRepository provisioningRepository,
    IPasswordHashService passwordHashService,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock,
    OrganizationCatalogDefaults catalogDefaults) : IOrganizationProvisioningService
{
    public async Task<OrganizationProvisioningResponse> CreateWithAdminAsync(
        CreateOrganizationWithAdminRequest request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        var code = InputValidation.Required(request.CodeOrganization, nameof(request.CodeOrganization), 30, errors).ToUpperInvariant();
        var legalName = InputValidation.Required(request.LegalName, nameof(request.LegalName), 200, errors);
        var rfc = string.IsNullOrWhiteSpace(request.Rfc)
            ? null
            : InputValidation.Rfc(request.Rfc, nameof(request.Rfc), false, errors);
        var displayName = InputValidation.Required(request.Admin.DisplayName, "Admin.DisplayName", 150, errors);
        var email = InputValidation.Required(request.Admin.Email, "Admin.Email", 254, errors);
        var password = InputValidation.Required(request.Admin.Password, "Admin.Password", 200, errors);

        if (!email.Contains('@', StringComparison.Ordinal) || !email.Contains('.', StringComparison.Ordinal))
        {
            errors["Admin.Email"] = ["Captura un correo válido."];
        }

        if (password.Length < 12)
        {
            errors["Admin.Password"] = ["La contraseña temporal debe tener al menos 12 caracteres."];
        }

        InputValidation.ThrowIfInvalid(errors);

        if (await organizationRepository.IsCodeInUseAsync(code, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una organización con el código '{code}'.");
        }

        if (rfc is not null && await organizationRepository.IsRfcInUseAsync(rfc, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe una organización con el RFC '{rfc}'.");
        }

        var normalizedEmail = User.NormalizeEmail(email);
        if (await provisioningRepository.EmailExistsAsync(normalizedEmail, cancellationToken))
        {
            throw new ResourceConflictException("Ya existe un usuario con ese correo.");
        }

        var adminRole = await provisioningRepository.GetOrganizationAdminRoleAsync(cancellationToken)
            ?? throw new ResourceConflictException("El rol ORGANIZATION_ADMIN no está configurado.");
        var now = clock.UtcNow;
        var organization = Organization.Create(code, legalName, rfc, actorContext.ActorId, actorContext.ActorName, now);
        var passwordHash = passwordHashService.Hash(password);
        var user = User.Create(
            email,
            displayName,
            passwordHash.Hash,
            passwordHash.Salt,
            passwordHash.Iterations,
            actorContext.ActorId,
            actorContext.ActorName,
            now);
        var membership = OrganizationMembership.Create(
            user.IdUser,
            organization.IdOrganization,
            "Admin de organización",
            actorContext.ActorId,
            actorContext.ActorName,
            now);
        var userRole = UserRole.Create(
            user.IdUser,
            adminRole.IdRole,
            membership.IdOrganizationMembership,
            actorContext.ActorId,
            actorContext.ActorName,
            now);

        await organizationRepository.AddAsync(organization, cancellationToken);
        await provisioningRepository.AddAsync(user, membership, userRole, cancellationToken);
        await catalogDefaults.StageAsync(organization.IdOrganization, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new OrganizationProvisioningResponse(
            new OrganizationResponse(
                organization.IdOrganization,
                organization.CodeOrganization,
                organization.LegalName,
                organization.Rfc,
                organization.Active),
            user.IdUser,
            user.Email,
            user.DisplayName);
    }
}
