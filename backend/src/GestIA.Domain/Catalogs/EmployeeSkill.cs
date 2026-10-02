using GestIA.Domain.Common;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Catalogs;

public sealed record EmployeeSkillProfile(
    Guid IdSkillCatalogItem,
    DateOnly? AcquiredDate,
    DateOnly? ExpiresDate,
    string? Notes);

/// <summary>
/// Lleva su propia <c>IdOrganization</c> aunque la alcanzaría por su padre.
///
/// <para>Está denormalizada a propósito, y la decisión se tomó al revés de lo que dijo la tanda A.
/// Entonces la alternativa era "una columna redundante contra ningún costo". Con el filtro global
/// de la tanda B la alternativa pasó a ser un filtro por navegación, y eso hace que <b>el filtro
/// del hijo dependa del filtro del padre</b>: apagar uno sin el otro da resultados que hay que
/// razonar caso por caso, que es justo lo que el filtro global vino a evitar.</para>
///
/// <para>Es seguro porque la organización del padre es <b>inmutable</b>, y eso no es una
/// suposición: <c>OrganizationScopeTests</c> falla si alguien expone una vía de cambiarla.</para>
/// </summary>
public sealed class EmployeeSkill : AuditableEntity, IOrganizationScopedEntity
{
    private EmployeeSkill()
    {
    }

    private EmployeeSkill(
        Guid idEmployeeSkill,
        Guid idOrganization,
        Guid idEmployee,
        EmployeeSkillProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEmployeeSkill = idEmployeeSkill;
        IdOrganization = idOrganization;
        IdEmployee = idEmployee;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployeeSkill { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdEmployee { get; private set; }
    public Guid IdSkillCatalogItem { get; private set; }
    public DateOnly? AcquiredDate { get; private set; }
    public DateOnly? ExpiresDate { get; private set; }
    public string? Notes { get; private set; }
    public Employee Employee { get; private set; } = null!;
    public BusinessCatalogItem SkillCatalogItem { get; private set; } = null!;

    public static EmployeeSkill Create(
        Guid idOrganization,
        Guid idEmployee,
        EmployeeSkillProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idEmployee, profile, actorId, actorName, occurredAt);

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
