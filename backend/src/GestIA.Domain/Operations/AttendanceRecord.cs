using GestIA.Domain.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.Operations;

public sealed record AttendanceRecordProfile(
    AttendanceStatus Status,
    TimeOnly? ActualStartTime,
    TimeOnly? ActualEndTime,
    int MinutesLate,
    string? Notes);

public sealed class AttendanceRecord : AuditableEntity, IOrganizationScopedEntity
{
    private AttendanceRecord()
    {
    }

    private AttendanceRecord(
        Guid idAttendanceRecord,
        Guid idOrganization,
        Guid idScheduledShift,
        Guid idEmployee,
        DateOnly attendanceDate,
        AttendanceRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdAttendanceRecord = idAttendanceRecord;
        IdOrganization = idOrganization;
        IdScheduledShift = idScheduledShift;
        IdEmployee = idEmployee;
        AttendanceDate = attendanceDate;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdAttendanceRecord { get; private set; }
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
    public Guid IdScheduledShift { get; private set; }
    public Guid IdEmployee { get; private set; }
    public DateOnly AttendanceDate { get; private set; }
    public AttendanceStatus Status { get; private set; }
    public TimeOnly? ActualStartTime { get; private set; }
    public TimeOnly? ActualEndTime { get; private set; }
    public int MinutesLate { get; private set; }
    public string? Notes { get; private set; }
    public ScheduledShift ScheduledShift { get; private set; } = null!;
    public Employee Employee { get; private set; } = null!;

    public static AttendanceRecord Create(
        Guid idOrganization,
        Guid idScheduledShift,
        Guid idEmployee,
        DateOnly attendanceDate,
        AttendanceRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idScheduledShift, idEmployee, attendanceDate, profile, actorId, actorName, occurredAt);

    public void UpdateProfile(
        AttendanceRecordProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(AttendanceRecordProfile profile)
    {
        if (profile.MinutesLate < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "Los minutos de retardo no pueden ser negativos.");
        }

        Status = profile.Status;
        ActualStartTime = profile.ActualStartTime;
        ActualEndTime = profile.ActualEndTime;
        MinutesLate = profile.MinutesLate;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
