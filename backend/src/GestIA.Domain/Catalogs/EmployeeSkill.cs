using GestIA.Domain.Common;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Catalogs;

public sealed record EmployeeSkillProfile(
    Guid IdSkillCatalogItem,
    DateOnly? AcquiredDate,
    DateOnly? ExpiresDate,
    string? Notes);

public sealed class EmployeeSkill : AuditableEntity
{
    private EmployeeSkill()
    {
    }

    private EmployeeSkill(
        Guid idEmployeeSkill,
        Guid idEmployee,
        EmployeeSkillProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEmployeeSkill = idEmployeeSkill;
        IdEmployee = idEmployee;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployeeSkill { get; private set; }
    public Guid IdEmployee { get; private set; }
    public Guid IdSkillCatalogItem { get; private set; }
    public DateOnly? AcquiredDate { get; private set; }
    public DateOnly? ExpiresDate { get; private set; }
    public string? Notes { get; private set; }
    public Employee Employee { get; private set; } = null!;
    public BusinessCatalogItem SkillCatalogItem { get; private set; } = null!;

    public static EmployeeSkill Create(
        Guid idEmployee,
        EmployeeSkillProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idEmployee, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        EmployeeSkillProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(EmployeeSkillProfile profile)
    {
        if (profile.IdSkillCatalogItem == Guid.Empty)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        if (profile.ExpiresDate < profile.AcquiredDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        IdSkillCatalogItem = profile.IdSkillCatalogItem;
        AcquiredDate = profile.AcquiredDate;
        ExpiresDate = profile.ExpiresDate;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
