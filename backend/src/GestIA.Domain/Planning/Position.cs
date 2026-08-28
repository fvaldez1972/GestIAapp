using GestIA.Domain.Common;
using GestIA.Domain.Services;

namespace GestIA.Domain.Planning;

public sealed record PositionProfile(
    string Name,
    int RequiredWorkerCount,
    string? RequiredSkillProfile,
    string? Notes);

public sealed class Position : AuditableEntity
{
    private readonly List<ShiftPattern> shiftPatterns = [];

    private Position()
    {
    }

    private Position(
        Guid idPosition,
        Guid idService,
        string codePosition,
        PositionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdPosition = idPosition;
        IdService = idService;
        CodePosition = Required(codePosition, nameof(codePosition)).ToUpperInvariant();
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdPosition { get; private set; }
    public Guid IdService { get; private set; }
    public string CodePosition { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int RequiredWorkerCount { get; private set; }
    public string? RequiredSkillProfile { get; private set; }
    public string? Notes { get; private set; }
    public Service Service { get; private set; } = null!;
    public IReadOnlyCollection<ShiftPattern> ShiftPatterns => shiftPatterns;

    public static Position Create(
        Guid idService,
        string codePosition,
        PositionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idService, codePosition, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        PositionProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(PositionProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        if (profile.RequiredWorkerCount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        Name = Required(profile.Name, nameof(profile.Name));
        RequiredWorkerCount = profile.RequiredWorkerCount;
        RequiredSkillProfile = Optional(profile.RequiredSkillProfile);
        Notes = Optional(profile.Notes);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
