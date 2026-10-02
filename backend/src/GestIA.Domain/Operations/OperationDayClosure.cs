using GestIA.Domain.Common;
using GestIA.Domain.Services;

namespace GestIA.Domain.Operations;

public sealed record OperationDayClosureProfile(
    Guid IdOrganization,
    Guid IdService,
    DateOnly OperationDate,
    int ExpectedShifts,
    int AttendanceRecords,
    int PendingAttendance,
    int OpenIncidents,
    int CoverageRecords,
    string? Notes);

public sealed class OperationDayClosure : AuditableEntity, IOrganizationScopedEntity
{
    private OperationDayClosure()
    {
    }

    private OperationDayClosure(
        Guid idOperationDayClosure,
        OperationDayClosureProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdOperationDayClosure = idOperationDayClosure;
        ApplyProfile(profile);
        ClosedAt = occurredAt.Kind == DateTimeKind.Utc ? occurredAt : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
        ClosedBy = actorId;
        ClosedByName = actorName.Trim();
        Status = OperationDayClosureStatus.Closed;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdOperationDayClosure { get; private set; }
    public Guid IdOrganization { get; private set; }

    /// <summary>
    /// Token de concurrencia. Lo genera y lo mantiene SQL Server; nadie lo asigna.
    ///
    /// <para><b>Para qué sirve, si las escrituras operativas ya corren en transacciones
    /// serializables.</b> La transacción protege contra escrituras que se cruzan <i>dentro</i> de
    /// la base. La pérdida que este token detecta vive <i>fuera</i>: el supervisor B abrió la
    /// pantalla a las 10:01, A guardó a las 10:05, y B guarda a las 10:06 con lo que tenía en
    /// pantalla desde antes. La transacción de B lee el registro ya actualizado por A y lo pisa
    /// con datos viejos, correctamente y sin error. El desfase está en el navegador, y por eso el
    /// token tiene que viajar en la respuesta y volver en la petición.</para>
    ///
    /// <para>Y aquí importa más que en otras tablas: esta entidad lleva bitácora, así que una
    /// pérdida silenciosa dejaría un historial que registra un cambio que otro pisó.</para>
    /// </summary>
    public byte[] RowVersion { get; private set; } = [];
    public Guid IdService { get; private set; }
    public DateOnly OperationDate { get; private set; }
    public int ExpectedShifts { get; private set; }
    public int AttendanceRecords { get; private set; }
    public int PendingAttendance { get; private set; }
    public int OpenIncidents { get; private set; }
    public int CoverageRecords { get; private set; }
    public string? Notes { get; private set; }
    public OperationDayClosureStatus Status { get; private set; }
    public DateTime ClosedAt { get; private set; }
    public Guid ClosedBy { get; private set; }
    public string ClosedByName { get; private set; } = string.Empty;
    public DateTime? ReopenedAt { get; private set; }
    public Guid? ReopenedBy { get; private set; }
    public string? ReopenedByName { get; private set; }
    public string? ReopenReason { get; private set; }
    public Service Service { get; private set; } = null!;

    public static OperationDayClosure Create(
        OperationDayClosureProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        if (profile.IdOrganization == Guid.Empty)
        {
            throw new ArgumentException("La organización es obligatoria.", nameof(profile));
        }

        if (profile.IdService == Guid.Empty)
        {
            throw new ArgumentException("El servicio es obligatorio.", nameof(profile));
        }

        if (profile.OperationDate == default)
        {
            throw new ArgumentException("La fecha operativa es obligatoria.", nameof(profile));
        }

        return new OperationDayClosure(Guid.NewGuid(), profile, actorId, actorName, occurredAt);
    }

    public void Reopen(string reason, Guid actorId, string actorName, DateTime occurredAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(reason);

        if (Status == OperationDayClosureStatus.Reopened)
        {
            return;
        }

        Status = OperationDayClosureStatus.Reopened;
        ReopenReason = reason.Trim();
        ReopenedAt = occurredAt.Kind == DateTimeKind.Utc ? occurredAt : DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
        ReopenedBy = actorId;
        ReopenedByName = actorName.Trim();
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(OperationDayClosureProfile profile)
    {
        if (profile.ExpectedShifts < 0 || profile.AttendanceRecords < 0 || profile.PendingAttendance < 0 || profile.OpenIncidents < 0 || profile.CoverageRecords < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "Los conteos del cierre no pueden ser negativos.");
        }

        IdOrganization = profile.IdOrganization;
        IdService = profile.IdService;
        OperationDate = profile.OperationDate;
        ExpectedShifts = profile.ExpectedShifts;
        AttendanceRecords = profile.AttendanceRecords;
        PendingAttendance = profile.PendingAttendance;
        OpenIncidents = profile.OpenIncidents;
        CoverageRecords = profile.CoverageRecords;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
