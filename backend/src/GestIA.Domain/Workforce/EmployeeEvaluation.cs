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
public sealed class EmployeeEvaluation : AuditableEntity, IOrganizationScopedEntity
{
    private EmployeeEvaluation()
    {
    }

    private EmployeeEvaluation(
        Guid idEmployeeEvaluation,
        Guid idOrganization,
        Guid idEmployee,
        EmployeeEvaluationType evaluationType,
        EmployeeEvaluationResult result,
        DateOnly evaluatedDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEmployeeEvaluation = idEmployeeEvaluation;
        IdOrganization = idOrganization;
        IdEmployee = idEmployee;
        EvaluationType = evaluationType;
        Result = result;
        EvaluatedDate = evaluatedDate;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployeeEvaluation { get; private set; }
    public Guid IdOrganization { get; private set; }
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
        Guid idOrganization,
        Guid idEmployee,
        EmployeeEvaluationType evaluationType,
        EmployeeEvaluationResult result,
        DateOnly evaluatedDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(
            Guid.NewGuid(),
            idOrganization,
            idEmployee,
            evaluationType,
            result,
            evaluatedDate,
            actorId,
            actorName,
            occurredAt);

    public static EmployeeEvaluation Create(
        Guid idOrganization,
        Guid idEmployee,
        EmployeeEvaluationProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var evaluation = Create(
            idOrganization,
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
