using System.Text.Json;
using System.Text.Json.Serialization;
using GestIA.Domain.Operations;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.History;

/// <summary>
/// Fotos de los cinco registros con historial, con <b>lista blanca explícita</b>, igual que
/// <c>BusinessDocumentSnapshot</c>.
///
/// <para><b>El texto libre no entra; entra si estaba lleno o vacío.</b> En su lugar viaja un
/// booleano <c>Has…</c>. El motivo no es el tamaño: una copia del texto en la bitácora se
/// consulta con el permiso de la bitácora y no con el del registro, así que duplicarlo abre una
/// puerta lateral a datos personales de terceros. La bitácora dice qué cambió y cuándo; no
/// reemplaza al dato. Si hay que reconstruir el contenido, se lee del registro, con su
/// permiso.</para>
///
/// <para>Eso vale incluso cuando el texto es la sustancia del registro, como
/// <c>Incident.Description</c>: el criterio no es qué tan importante es el campo, sino quién
/// puede verlo.</para>
///
/// <para><b>Viajan identificadores, nunca nombres visibles</b> (principio 4 del README). Si un
/// nombre se corrige después, no queda una copia vieja regada en el historial.</para>
///
/// <para>La prueba <c>OperationalSnapshotTests</c> comprueba la regla y no la lista: recorre
/// estos tipos por reflexión y falla si aparece un campo de texto fuera de la lista blanca corta
/// de códigos permitidos. Agregar mañana un campo de texto libre rompe el build.</para>
/// </summary>
public static class OperationalSnapshot
{
    /// <summary>
    /// Los enums viajan por <b>nombre</b> y no por número, por la misma razón que la columna
    /// <c>EntityType</c>: un valor insertado a media enumeración cambiaría el significado de las
    /// fotos ya escritas, y una bitácora que se reinterpreta sola no sirve de nada.
    /// </summary>
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter() }
    };

    /// <summary>Los tipos con historial, para que Infrastructure no repita la lista.</summary>
    public static bool IsTracked(object entity) =>
        entity is AttendanceRecord or ServiceConfiguration or Incident or CoverageRecord or ServiceAssignment;

    /// <summary>
    /// Identidad y foto de un registro. La identidad sale del propio registro —no del contexto
    /// ambiental— para que el evento quede en la organización a la que pertenece el dato.
    /// </summary>
    public static OperationalSnapshotCapture Capture(object entity)
    {
        ArgumentNullException.ThrowIfNull(entity);

        return entity switch
        {
            AttendanceRecord item => new(
                OperationalEntityType.AttendanceRecord,
                item.IdAttendanceRecord,
                item.IdOrganization,
                Serialize(AttendanceRecordSnapshot.From(item))),

            ServiceConfiguration item => new(
                OperationalEntityType.ServiceConfiguration,
                item.IdServiceConfiguration,
                item.IdOrganization,
                Serialize(ServiceConfigurationSnapshot.From(item))),

            Incident item => new(
                OperationalEntityType.Incident,
                item.IdIncident,
                item.IdOrganization,
                Serialize(IncidentSnapshot.From(item))),

            CoverageRecord item => new(
                OperationalEntityType.CoverageRecord,
                item.IdCoverageRecord,
                item.IdOrganization,
                Serialize(CoverageRecordSnapshot.From(item))),

            ServiceAssignment item => new(
                OperationalEntityType.ServiceAssignment,
                item.IdServiceAssignment,
                item.IdOrganization,
                Serialize(ServiceAssignmentSnapshot.From(item))),

            _ => throw new ArgumentException(
                $"{entity.GetType().Name} no lleva historial funcional.", nameof(entity))
        };
    }

    private static string Serialize<T>(T snapshot) => JsonSerializer.Serialize(snapshot, Options);
}

/// <summary>Lo que hace falta para escribir un evento: a quién pertenece, qué registro es y su foto.</summary>
public sealed record OperationalSnapshotCapture(
    OperationalEntityType EntityType,
    Guid RecordId,
    Guid IdOrganization,
    string Json);

public sealed record AttendanceRecordSnapshot(
    Guid IdAttendanceRecord,
    Guid IdOrganization,
    Guid IdScheduledShift,
    Guid IdEmployee,
    DateOnly AttendanceDate,
    AttendanceStatus Status,
    TimeOnly? ActualStartTime,
    TimeOnly? ActualEndTime,
    int MinutesLate,
    bool HasNotes,
    bool Active)
{
    public static AttendanceRecordSnapshot From(AttendanceRecord item)
    {
        ArgumentNullException.ThrowIfNull(item);

        return new(
            item.IdAttendanceRecord, item.IdOrganization, item.IdScheduledShift, item.IdEmployee,
            item.AttendanceDate, item.Status, item.ActualStartTime, item.ActualEndTime,
            item.MinutesLate, !string.IsNullOrWhiteSpace(item.Notes), item.Active);
    }
}

public sealed record ServiceConfigurationSnapshot(
    Guid IdServiceConfiguration,
    Guid IdOrganization,
    Guid IdService,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short RequiredWorkerCount,
    decimal HoursPerDay,
    byte DaysPerWeek,
    decimal AverageWeeklyHours,
    decimal AverageMonthlyHours,
    short PreparationLeadDays,
    decimal MonthlyPrice,
    string CurrencyCode,
    bool IsTaxIncluded,
    bool HasWorkScheduleDescription,
    bool HasSpecificInstructions,
    bool Active)
{
    public static ServiceConfigurationSnapshot From(ServiceConfiguration item)
    {
        ArgumentNullException.ThrowIfNull(item);

        // El precio, la moneda y el impuesto SÍ entran: son el dato que se factura al cliente y
        // la razón principal de tener historial en esta entidad.
        return new(
            item.IdServiceConfiguration, item.IdOrganization, item.IdService,
            item.EffectiveFromDate, item.EffectiveToDate, item.RequiredWorkerCount,
            item.HoursPerDay, item.DaysPerWeek, item.AverageWeeklyHours, item.AverageMonthlyHours,
            item.PreparationLeadDays, item.MonthlyPrice, item.CurrencyCode, item.IsTaxIncluded,
            !string.IsNullOrWhiteSpace(item.WorkScheduleDescription),
            !string.IsNullOrWhiteSpace(item.SpecificInstructions), item.Active);
    }
}

public sealed record IncidentSnapshot(
    Guid IdIncident,
    Guid IdOrganization,
    Guid IdService,
    Guid? IdScheduledShift,
    Guid? IdEmployee,
    DateOnly IncidentDate,
    string IncidentType,
    IncidentSeverity Severity,
    IncidentStatus Status,
    bool HasDescription,
    bool HasResolutionNotes,
    bool Active)
{
    public static IncidentSnapshot From(Incident item)
    {
        ArgumentNullException.ThrowIfNull(item);

        // Description queda fuera aunque sea obligatoria y sea el relato del hecho: puede llevar
        // nombres de terceros, y copiarla aquí la sacaría del control de permisos de la
        // incidencia. IncidentType sí entra: es un código, no un relato.
        return new(
            item.IdIncident, item.IdOrganization, item.IdService, item.IdScheduledShift,
            item.IdEmployee, item.IncidentDate, item.IncidentType, item.Severity, item.Status,
            !string.IsNullOrWhiteSpace(item.Description),
            !string.IsNullOrWhiteSpace(item.ResolutionNotes), item.Active);
    }
}

public sealed record CoverageRecordSnapshot(
    Guid IdCoverageRecord,
    Guid IdOrganization,
    Guid IdScheduledShift,
    Guid IdOriginalEmployee,
    Guid IdReplacementEmployee,
    Guid? IdCoverageReason,
    TimeOnly CoverageStartTime,
    TimeOnly CoverageEndTime,
    bool IsOvernight,
    int DurationMinutes,
    CoverageStatus Status,
    bool HasNotes,
    bool Active)
{
    public static CoverageRecordSnapshot From(CoverageRecord item)
    {
        ArgumentNullException.ThrowIfNull(item);

        return new(
            item.IdCoverageRecord, item.IdOrganization, item.IdScheduledShift,
            item.IdOriginalEmployee, item.IdReplacementEmployee, item.IdCoverageReason,
            item.CoverageStartTime, item.CoverageEndTime, item.IsOvernight, item.DurationMinutes,
            item.Status, !string.IsNullOrWhiteSpace(item.Notes), item.Active);
    }
}

public sealed record ServiceAssignmentSnapshot(
    Guid IdServiceAssignment,
    Guid IdOrganization,
    Guid IdEmployee,
    Guid IdService,
    Guid? IdPosition,
    ServiceAssignmentType AssignmentType,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsPrimary,
    bool HasNotes,
    bool Active)
{
    public static ServiceAssignmentSnapshot From(ServiceAssignment item)
    {
        ArgumentNullException.ThrowIfNull(item);

        return new(
            item.IdServiceAssignment, item.IdOrganization, item.IdEmployee, item.IdService,
            item.IdPosition, item.AssignmentType, item.StartDate, item.EndDate, item.IsPrimary,
            !string.IsNullOrWhiteSpace(item.Notes), item.Active);
    }
}
