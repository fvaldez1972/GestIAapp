using GestIA.Domain.Common;

namespace GestIA.Domain.Workforce;

public sealed record EmployeeEvaluationProfile(
    EmployeeEvaluationType EvaluationType,
    EmployeeEvaluationResult Result,
    DateOnly EvaluatedDate,
    DateOnly? ExpiresDate,
    string? CertificateNumber,
    string? StorageReference,
    string? Notes);

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

    public static EmployeeEvaluation Create(
        Guid idEmployee,
        EmployeeEvaluationProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var evaluation = Create(
            idEmployee,
            profile.EvaluationType,
            profile.Result,
            profile.EvaluatedDate,
            actorId,
            actorName,
            occurredAt);
        evaluation.ApplyProfile(profile);
        return evaluation;
    }

    public void UpdateProfile(
        EmployeeEvaluationProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(EmployeeEvaluationProfile profile)
    {
        if (profile.ExpiresDate < profile.EvaluatedDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile));
        }

        EvaluationType = profile.EvaluationType;
        Result = profile.Result;
        EvaluatedDate = profile.EvaluatedDate;
        ExpiresDate = profile.ExpiresDate;
        CertificateNumber = Normalize(profile.CertificateNumber);
        StorageReference = Normalize(profile.StorageReference);
        Notes = Normalize(profile.Notes);
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
