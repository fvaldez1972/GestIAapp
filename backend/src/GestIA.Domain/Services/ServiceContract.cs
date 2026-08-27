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
        DateOnly effectiveFromDate,
        DateOnly? effectiveToDate,
        short paymentTermDays,
        short terminationNoticeDays,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codeServiceContract);
        if (effectiveToDate < effectiveFromDate)
        {
            throw new ArgumentOutOfRangeException(nameof(effectiveToDate));
        }

        ArgumentOutOfRangeException.ThrowIfNegative(paymentTermDays);
        ArgumentOutOfRangeException.ThrowIfNegative(terminationNoticeDays);

        IdServiceContract = idServiceContract;
        IdClient = idClient;
        CodeServiceContract = codeServiceContract.Trim();
        Status = ServiceContractStatus.Draft;
        EffectiveFromDate = effectiveFromDate;
        EffectiveToDate = effectiveToDate;
        PaymentTermDays = paymentTermDays;
        TerminationNoticeDays = terminationNoticeDays;
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
        new(
            Guid.NewGuid(),
            idClient,
            codeServiceContract,
            effectiveFromDate,
            effectiveToDate,
            paymentTermDays,
            terminationNoticeDays,
            actorId,
            actorName,
            occurredAt);
}
