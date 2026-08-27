using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GestIaDbContext).Assembly);
        modelBuilder.ApplyGestIaDatabaseStandards();
    }
}
