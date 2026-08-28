using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Requests;
using GestIA.Domain.Security;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using GestIA.Infrastructure.Persistence.Conventions;

namespace GestIA.Infrastructure.Persistence;

public sealed class GestIaDbContext(DbContextOptions<GestIaDbContext> options)
    : DbContext(options)
{
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
    public DbSet<OperationalRequest> OperationalRequests => Set<OperationalRequest>();
    public DbSet<User> Users => Set<User>();
    public DbSet<OrganizationMembership> OrganizationMemberships => Set<OrganizationMembership>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GestIaDbContext).Assembly);
        modelBuilder.ApplyGestIaDatabaseStandards();
    }
}
