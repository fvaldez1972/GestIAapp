using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Documents;
using GestIA.Domain.History;
using GestIA.Domain.Organizations;
using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Requests;
using GestIA.Domain.Security;
using GestIA.Domain.Services;
using GestIA.Domain.Support;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using GestIA.Infrastructure.Persistence.Conventions;
using GestIA.Infrastructure.Persistence.History;

namespace GestIA.Infrastructure.Persistence;

public sealed class GestIaDbContext(
    DbContextOptions<GestIaDbContext> options,
    IOrganizationContext organization,
    IOperationalHistoryRecorder history)
    : DbContext(options)
{
    /// <summary>
    /// La organización autorizada para la petición en curso, o <c>null</c> fuera de una petición.
    ///
    /// El filtro global de organización lee esta propiedad en lugar del proveedor directamente,
    /// porque EF sustituye las referencias al <c>DbContext</c> dentro de un filtro por la
    /// instancia vigente de cada consulta. Ver <see cref="Conventions.OrganizationQueryFilter"/>.
    /// </summary>
    public Guid? CurrentOrganizationId => organization.CurrentOrganizationId;

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientSite> ClientSites => Set<ClientSite>();
    public DbSet<ClientContact> ClientContacts => Set<ClientContact>();
    public DbSet<ServiceContract> ServiceContracts => Set<ServiceContract>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<ServiceConfiguration> ServiceConfigurations => Set<ServiceConfiguration>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EmployeeDocument> EmployeeDocuments => Set<EmployeeDocument>();
    public DbSet<EmployeeEvaluation> EmployeeEvaluations => Set<EmployeeEvaluation>();
    public DbSet<ServiceAssignment> ServiceAssignments => Set<ServiceAssignment>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<ShiftPattern> ShiftPatterns => Set<ShiftPattern>();
    public DbSet<ShiftSegment> ShiftSegments => Set<ShiftSegment>();
    public DbSet<ScheduleVersion> ScheduleVersions => Set<ScheduleVersion>();
    public DbSet<ScheduledShift> ScheduledShifts => Set<ScheduledShift>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<CoverageRecord> CoverageRecords => Set<CoverageRecord>();
    public DbSet<OperationEvidence> OperationEvidences => Set<OperationEvidence>();
    public DbSet<ApprovalRequest> ApprovalRequests => Set<ApprovalRequest>();
    public DbSet<OperationDayClosure> OperationDayClosures => Set<OperationDayClosure>();
    public DbSet<OperationalRequest> OperationalRequests => Set<OperationalRequest>();
    public DbSet<BusinessDocument> BusinessDocuments => Set<BusinessDocument>();
    public DbSet<BusinessDocumentEvent> BusinessDocumentEvents => Set<BusinessDocumentEvent>();
    public DbSet<BusinessCatalogItem> BusinessCatalogItems => Set<BusinessCatalogItem>();
    public DbSet<EligibilityRequirement> EligibilityRequirements => Set<EligibilityRequirement>();
    public DbSet<EmployeeSkill> EmployeeSkills => Set<EmployeeSkill>();
    public DbSet<User> Users => Set<User>();
    public DbSet<OrganizationMembership> OrganizationMemberships => Set<OrganizationMembership>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<SupportSession> SupportSessions => Set<SupportSession>();
    public DbSet<OperationalEvent> OperationalEvents => Set<OperationalEvent>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        EnsureHistoryIsAppendOnly();
        RecordOperationalHistory();
        var saved = base.SaveChanges(acceptAllChangesOnSuccess);
        history.Complete();
        return saved;
    }

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        EnsureHistoryIsAppendOnly();
        RecordOperationalHistory();
        var saved = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        history.Complete();
        return saved;
    }

    /// <summary>
    /// Las bitácoras son de sólo agregar. Una vez escrito, un evento no se corrige ni se
    /// elimina: si pudiera, dejaría de servir para lo único que sirve.
    ///
    /// La lista está escrita a mano y una prueba de arquitectura comprueba que no falte ninguna
    /// entidad de bitácora, porque una tabla nueva que nadie agregue aquí quedaría editable sin
    /// que nada lo advierta.
    /// </summary>
    private void EnsureHistoryIsAppendOnly()
    {
        if (ChangeTracker.Entries<BusinessDocumentEvent>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted))
        {
            throw new InvalidOperationException("El historial documental no puede modificarse ni eliminarse.");
        }

        if (ChangeTracker.Entries<OperationalEvent>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted))
        {
            throw new InvalidOperationException("La bitácora operativa no puede modificarse ni eliminarse.");
        }
    }

    /// <summary>
    /// Emite los eventos de historial de las correcciones pendientes, <b>dentro</b> del mismo
    /// guardado que las escribe.
    ///
    /// Ésta es la razón de que la bitácora no pueda mentir: los eventos entran al mismo lote y a
    /// la misma transacción que el cambio que documentan, así que no existe el estado "cambio
    /// guardado, evento perdido". Y como los emite el guardado y no cada servicio, tampoco existe
    /// el de "alguien olvidó registrarlo".
    /// </summary>
    private void RecordOperationalHistory()
    {
        var events = history.Capture(ChangeTracker);

        if (events.Count > 0)
        {
            OperationalEvents.AddRange(events);
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GestIaDbContext).Assembly);
        modelBuilder.ApplyGestIaDatabaseStandards();
        modelBuilder.ApplyOrganizationQueryFilter(this);
    }
}
