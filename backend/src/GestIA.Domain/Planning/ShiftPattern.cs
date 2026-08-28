using GestIA.Domain.Common;

namespace GestIA.Domain.Planning;

public sealed record ShiftPatternProfile(
    string Name,
    string? Description,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate);

public sealed class ShiftPattern : AuditableEntity
{
    private readonly List<ShiftSegment> segments = [];

    private ShiftPattern()
    {
    }

    private ShiftPattern(
        Guid idShiftPattern,
        Guid idPosition,
        string codeShiftPattern,
        ShiftPatternProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdShiftPattern = idShiftPattern;
        IdPosition = idPosition;
        CodeShiftPattern = Required(codeShiftPattern, nameof(codeShiftPattern)).ToUpperInvariant();
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdShiftPattern { get; private set; }
    public Guid IdPosition { get; private set; }
    public string CodeShiftPattern { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public DateOnly EffectiveFromDate { get; private set; }
    public DateOnly? EffectiveToDate { get; private set; }
    public Position Position { get; private set; } = null!;
    public IReadOnlyCollection<ShiftSegment> Segments => segments;

    public static ShiftPattern Create(
        Guid idPosition,
        string codeShiftPattern,
        ShiftPatternProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idPosition, codeShiftPattern, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        ShiftPatternProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ShiftPatternProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        if (profile.EffectiveToDate < profile.EffectiveFromDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        Name = Required(profile.Name, nameof(profile.Name));
        Description = Optional(profile.Description);
        EffectiveFromDate = profile.EffectiveFromDate;
        EffectiveToDate = profile.EffectiveToDate;
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
