using GestIA.Domain.Clients;
using GestIA.Domain.Common;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;

namespace GestIA.Domain.Catalogs;

public sealed record EligibilityRequirementProfile(
    EligibilityRequirementTargetType TargetType,
    Guid? IdClient,
    Guid? IdService,
    Guid? IdPosition,
    EligibilityRequirementType RequirementType,
    string RequiredCode,
    string Name,
    string? Description,
    bool IsBlocking);

public sealed class EligibilityRequirement : AuditableEntity
{
    private EligibilityRequirement()
    {
    }

    private EligibilityRequirement(
        Guid idEligibilityRequirement,
        Guid idOrganization,
        EligibilityRequirementProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEligibilityRequirement = idEligibilityRequirement;
        IdOrganization = idOrganization;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEligibilityRequirement { get; private set; }
    public Guid IdOrganization { get; private set; }
    public EligibilityRequirementTargetType TargetType { get; private set; }
    public Guid? IdClient { get; private set; }
    public Guid? IdService { get; private set; }
    public Guid? IdPosition { get; private set; }
    public EligibilityRequirementType RequirementType { get; private set; }
    public string RequiredCode { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsBlocking { get; private set; }
    public Organization Organization { get; private set; } = null!;
    public Client? Client { get; private set; }
    public Service? Service { get; private set; }
    public Position? Position { get; private set; }

    public static EligibilityRequirement Create(
        Guid idOrganization,
        EligibilityRequirementProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        EligibilityRequirementProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(EligibilityRequirementProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.RequiredCode);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.Name);

        ValidateTarget(profile);

        TargetType = profile.TargetType;
        IdClient = profile.TargetType is EligibilityRequirementTargetType.Client ? profile.IdClient : null;
        IdService = profile.TargetType is EligibilityRequirementTargetType.Service ? profile.IdService : null;
        IdPosition = profile.TargetType is EligibilityRequirementTargetType.Position ? profile.IdPosition : null;
        RequirementType = profile.RequirementType;
        RequiredCode = profile.RequiredCode.Trim().ToUpperInvariant();
        Name = profile.Name.Trim();
        Description = string.IsNullOrWhiteSpace(profile.Description) ? null : profile.Description.Trim();
        IsBlocking = profile.IsBlocking;
    }

    private static void ValidateTarget(EligibilityRequirementProfile profile)
    {
        var valid = profile.TargetType switch
        {
            EligibilityRequirementTargetType.Organization =>
                profile.IdClient is null && profile.IdService is null && profile.IdPosition is null,
            EligibilityRequirementTargetType.Client =>
                profile.IdClient.HasValue && profile.IdService is null && profile.IdPosition is null,
            EligibilityRequirementTargetType.Service =>
                profile.IdClient is null && profile.IdService.HasValue && profile.IdPosition is null,
            EligibilityRequirementTargetType.Position =>
                profile.IdClient is null && profile.IdService is null && profile.IdPosition.HasValue,
            _ => false
        };

        if (!valid)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "El alcance de la regla de elegibilidad no es válido.");
        }
    }
}
