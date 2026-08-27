using GestIA.Domain.Common;

namespace GestIA.Domain.Workforce;

public sealed class EmployeeEvaluation : AuditableEntity
{
    private EmployeeEvaluation()
    {
    }

    private EmployeeEvaluation(
        Guid idEmployeeEvaluation,
        Guid idEmployee,
        EmployeeEvaluationType evaluationType,
        EmployeeEvaluationResult result,
        DateOnly evaluatedDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEmployeeEvaluation = idEmployeeEvaluation;
        IdEmployee = idEmployee;
        EvaluationType = evaluationType;
        Result = result;
        EvaluatedDate = evaluatedDate;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployeeEvaluation { get; private set; }
    public Guid IdEmployee { get; private set; }
    public EmployeeEvaluationType EvaluationType { get; private set; }
    public EmployeeEvaluationResult Result { get; private set; }
    public DateOnly EvaluatedDate { get; private set; }
    public DateOnly? ExpiresDate { get; private set; }
    public string? CertificateNumber { get; private set; }
    public string? StorageReference { get; private set; }
    public string? Notes { get; private set; }
    public Employee Employee { get; private set; } = null!;

    public static EmployeeEvaluation Create(
        Guid idEmployee,
        EmployeeEvaluationType evaluationType,
        EmployeeEvaluationResult result,
        DateOnly evaluatedDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(
            Guid.NewGuid(),
            idEmployee,
            evaluationType,
            result,
            evaluatedDate,
            actorId,
            actorName,
            occurredAt);
}
