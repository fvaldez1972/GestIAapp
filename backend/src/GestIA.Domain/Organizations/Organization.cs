using GestIA.Domain.Common;

namespace GestIA.Domain.Organizations;

public sealed class Organization : AuditableEntity
{
    private Organization()
    {
    }

    private Organization(
        Guid idOrganization,
        string codeOrganization,
        string legalName,
        string? rfc,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdOrganization = idOrganization;
        CodeOrganization = Required(codeOrganization, nameof(codeOrganization));
        LegalName = Required(legalName, nameof(legalName));
        Rfc = Optional(rfc);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdOrganization { get; private set; }
    public string CodeOrganization { get; private set; } = string.Empty;
    public string LegalName { get; private set; } = string.Empty;
    public string? Rfc { get; private set; }

    /// <summary>
    /// Cada cuándo se le paga al personal de esta organización.
    ///
    /// <para><b>Es de la organización, y no de la persona, del cliente ni de la sede.</b> Fue una
    /// decisión explícita: una empresa de seguridad paga semanal y una de limpieza puede pagar
    /// quincenal, pero dentro de una misma empresa no cambia de una persona a otra.</para>
    ///
    /// <para><b>Nulo significa que nadie lo ha declarado</b>, y no se rellena con una suposición.
    /// Poner «semanal» por omisión a las organizaciones que ya existen habría afirmado en su nombre
    /// algo que nadie capturó; la pantalla dice «sin declarar» hasta que alguien lo decida.</para>
    /// </summary>
    public PaymentFrequency? PayrollFrequency { get; private set; }

    /// <summary>Fija la periodicidad de pago. Nulo la deja sin declarar, que es un estado válido.</summary>
    public void SetPayrollFrequency(
        PaymentFrequency? payrollFrequency,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        PayrollFrequency = payrollFrequency;
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    public static Organization Create(
        string codeOrganization,
        string legalName,
        string? rfc,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), codeOrganization, legalName, rfc, actorId, actorName, occurredAt);

    public void UpdateProfile(
        string codeOrganization,
        string legalName,
        string? rfc,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        CodeOrganization = Required(codeOrganization, nameof(codeOrganization));
        LegalName = Required(legalName, nameof(legalName));
        Rfc = Optional(rfc);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
