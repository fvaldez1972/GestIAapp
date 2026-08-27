using GestIA.Domain.Clients;
using GestIA.Domain.Common;

namespace GestIA.Domain.Services;

public sealed class ServiceContract : AuditableEntity
{
    private ServiceContract()
    {
    }

    private ServiceContract(
        Guid idServiceContract,
        Guid idClient,
        string codeServiceContract,
        ServiceContractTerms terms,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdServiceContract = idServiceContract;
        IdClient = idClient;
        CodeServiceContract = Required(codeServiceContract, nameof(codeServiceContract)).ToUpperInvariant();
        Status = ServiceContractStatus.Draft;
        ApplyTerms(terms);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdServiceContract { get; private set; }
    public Guid IdClient { get; private set; }
    public string CodeServiceContract { get; private set; } = string.Empty;
    public ServiceContractStatus Status { get; private set; }
    public DateOnly? SignedDate { get; private set; }
    public DateOnly EffectiveFromDate { get; private set; }
    public DateOnly? EffectiveToDate { get; private set; }
    public short PaymentTermDays { get; private set; }
    public short TerminationNoticeDays { get; private set; }
    public string CurrencyCode { get; private set; } = "MXN";
    public string? DocumentReference { get; private set; }
    public string? Notes { get; private set; }
    public Client Client { get; private set; } = null!;

    public static ServiceContract Create(
        Guid idClient,
        string codeServiceContract,
        DateOnly effectiveFromDate,
        DateOnly? effectiveToDate,
        short paymentTermDays,
        short terminationNoticeDays,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        Create(
            idClient,
            codeServiceContract,
            new ServiceContractTerms(
                ServiceContractStatus.Draft,
                null,
                effectiveFromDate,
                effectiveToDate,
                paymentTermDays,
                terminationNoticeDays,
                "MXN",
                null,
                null),
            actorId,
            actorName,
            occurredAt);

    public static ServiceContract Create(
        Guid idClient,
        string codeServiceContract,
        ServiceContractTerms terms,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idClient, codeServiceContract, terms, actorId, actorName, occurredAt);

    public void UpdateTerms(
        ServiceContractTerms terms,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyTerms(terms);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyTerms(ServiceContractTerms terms)
    {
        ArgumentNullException.ThrowIfNull(terms);

        if (terms.EffectiveToDate < terms.EffectiveFromDate)
        {
            throw new ArgumentOutOfRangeException(nameof(terms));
        }

        ArgumentOutOfRangeException.ThrowIfNegative(terms.PaymentTermDays);
        ArgumentOutOfRangeException.ThrowIfNegative(terms.TerminationNoticeDays);

        Status = terms.Status;
        SignedDate = terms.SignedDate;
        EffectiveFromDate = terms.EffectiveFromDate;
        EffectiveToDate = terms.EffectiveToDate;
        PaymentTermDays = terms.PaymentTermDays;
        TerminationNoticeDays = terms.TerminationNoticeDays;
        CurrencyCode = Required(terms.CurrencyCode, nameof(terms.CurrencyCode)).ToUpperInvariant();
        DocumentReference = Optional(terms.DocumentReference);
        Notes = Optional(terms.Notes);
    }

    private static string Required(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record ServiceContractTerms(
    ServiceContractStatus Status,
    DateOnly? SignedDate,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short PaymentTermDays,
    short TerminationNoticeDays,
    string CurrencyCode,
    string? DocumentReference,
    string? Notes);
