using GestIA.Domain.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;

namespace GestIA.Domain.Workforce;

public sealed record ServiceAssignmentProfile(
    Guid IdPosition,
    ServiceAssignmentType AssignmentType,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsPrimary,
    string? Notes);

public sealed class ServiceAssignment : AuditableEntity, IOrganizationScopedEntity
{
    private ServiceAssignment()
    {
    }

    private ServiceAssignment(
        Guid idServiceAssignment,
        Guid idOrganization,
        Guid idEmployee,
        Guid idService,
        ServiceAssignmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdServiceAssignment = idServiceAssignment;
        IdOrganization = idOrganization;
        IdEmployee = idEmployee;
        IdService = idService;
        ApplyProfile(profile);
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdServiceAssignment { get; private set; }
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
    public Guid IdEmployee { get; private set; }
    public Guid IdService { get; private set; }
    public Guid? IdPosition { get; private set; }
    public ServiceAssignmentType AssignmentType { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public bool IsPrimary { get; private set; }
    public string? Notes { get; private set; }
    public Employee Employee { get; private set; } = null!;
    public Service Service { get; private set; } = null!;
    public Position? Position { get; private set; }

    public static ServiceAssignment Create(
        Guid idOrganization,
        Guid idEmployee,
        Guid idService,
        ServiceAssignmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(
            Guid.NewGuid(),
            idOrganization,
            idEmployee,
            idService,
            profile,
            actorId,
            actorName,
            occurredAt);

    public void UpdateProfile(
        ServiceAssignmentProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    /// <summary>
    /// Cierra la asignación en una fecha.
    ///
    /// <para><b>Existe para la baja del empleado</b>, que desde RQ-07 cierra en la misma transacción
    /// las asignaciones que seguían vigentes: dejarlas abiertas describiría a alguien que ya no trabaja
    /// y sigue cubriendo un servicio.</para>
    ///
    /// <para>Es distinto de <see cref="UpdateProfile"/> a propósito. Aquél reemplaza el perfil entero y
    /// se usa cuando alguien edita la asignación; éste toca una sola fecha y no puede mover la posición
    /// ni el tipo por accidente. Una asignación que ya terminaba antes de esa fecha se queda como
    /// estaba: adelantar un fin que ya ocurrió no es cerrar, es reescribir.</para>
    /// </summary>
    public void Close(DateOnly endDate, Guid actorId, string actorName, DateTime occurredAt)
    {
        if (EndDate is not null && EndDate <= endDate)
        {
            return;
        }

        EndDate = endDate < StartDate ? StartDate : endDate;
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    private void ApplyProfile(ServiceAssignmentProfile profile)
    {
        if (profile.IdPosition == Guid.Empty)
        {
            throw new ArgumentException("La posición es obligatoria.", nameof(profile));
        }

        if (profile.EndDate < profile.StartDate)
        {
            throw new ArgumentOutOfRangeException(nameof(profile), "La fecha final no puede ser menor que la inicial.");
        }

        IdPosition = profile.IdPosition;
        AssignmentType = profile.AssignmentType;
        StartDate = profile.StartDate;
        EndDate = profile.EndDate;
        IsPrimary = profile.IsPrimary;
        Notes = string.IsNullOrWhiteSpace(profile.Notes) ? null : profile.Notes.Trim();
    }
}
