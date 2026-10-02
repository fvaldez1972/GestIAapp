using GestIA.Domain.Common;

namespace GestIA.Domain.Workforce;

/// <summary>
/// La prueba psicométrica de una persona: realizada y aprobada en una fecha, sin vencimiento propio.
///
/// <para>Se puede registrar desde la candidatura, porque se hace antes de ingresar. Sólo deja de
/// contar cuando una baja la vence, y entonces queda en el historial: nunca se borra.</para>
/// </summary>
public sealed class EmployeePsychometricTest : AuditableEntity, IOrganizationScopedEntity
{
    private EmployeePsychometricTest()
    {
    }

    private EmployeePsychometricTest(
        Guid idEmployeePsychometricTest,
        Guid idOrganization,
        Guid idEmployee,
        DateOnly approvedDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEmployeePsychometricTest = idEmployeePsychometricTest;
        IdOrganization = idOrganization;
        IdEmployee = idEmployee;
        ApprovedDate = approvedDate;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployeePsychometricTest { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdEmployee { get; private set; }

    /// <summary>Cuándo se realizó y aprobó.</summary>
    public DateOnly ApprovedDate { get; private set; }

    /// <summary>La fecha de la baja que la venció. Nula mientras siga vigente.</summary>
    public DateOnly? ExpiredOnDate { get; private set; }

    public byte[] RowVersion { get; private set; } = [];

    public Employee Employee { get; private set; } = null!;

    public bool IsValid => ExpiredOnDate is null;

    public static EmployeePsychometricTest Register(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly approvedDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idEmployee, approvedDate, actorId, actorName, occurredAt);

    public void ExpireOnTermination(DateOnly endDate, Guid actorId, string actorName, DateTime occurredAt)
    {
        if (!IsValid)
        {
            throw new DomainRuleException("Esta prueba psicométrica ya está vencida por una baja anterior.");
        }

        ExpiredOnDate = endDate;
        RegisterUpdate(actorId, actorName, occurredAt);
    }
}
