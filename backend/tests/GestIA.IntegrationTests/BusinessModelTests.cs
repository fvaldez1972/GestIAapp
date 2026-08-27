using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

public sealed class BusinessModelTests
{
    [Fact]
    public void InitialBusinessEntitiesAreMappedWithTheApprovedPhysicalNames()
    {
        using var context = CreateContext();

        var expectedMappings = new Dictionary<Type, string>
        {
            [typeof(Organization)] = "Organizations",
            [typeof(Client)] = "Clients",
            [typeof(ClientSite)] = "ClientSites",
            [typeof(ClientContact)] = "ClientContacts",
            [typeof(ServiceContract)] = "ServiceContracts",
            [typeof(Service)] = "Services",
            [typeof(ServiceConfiguration)] = "ServiceConfigurations",
            [typeof(Employee)] = "Employees",
            [typeof(EmployeeDocument)] = "EmployeeDocuments",
            [typeof(EmployeeEvaluation)] = "EmployeeEvaluations",
            [typeof(ServiceAssignment)] = "ServiceAssignments"
        };

        foreach (var mapping in expectedMappings)
        {
            var entityType = context.Model.FindEntityType(mapping.Key)
                ?? throw new InvalidOperationException($"Mapping for {mapping.Key.Name} was not found.");

            Assert.Equal(mapping.Value, entityType.GetTableName());
            Assert.Equal("dbo", entityType.GetSchema());
            Assert.Equal($"PK_{mapping.Value}", entityType.FindPrimaryKey()?.GetName());
            Assert.NotEmpty(entityType.GetDeclaredQueryFilters());
        }
    }

    [Fact]
    public void ServiceAndEmployeeRelationsUseDeterministicForeignKeyNames()
    {
        using var context = CreateContext();

        var service = context.Model.FindEntityType(typeof(Service))
            ?? throw new InvalidOperationException("Service mapping was not found.");
        var assignment = context.Model.FindEntityType(typeof(ServiceAssignment))
            ?? throw new InvalidOperationException("ServiceAssignment mapping was not found.");

        Assert.Contains(service.GetForeignKeys(), key =>
            key.GetConstraintName() == "FK_Services_Clients_IdClient");
        Assert.Contains(service.GetForeignKeys(), key =>
            key.GetConstraintName() == "FK_Services_ClientSites_IdClientSite");
        Assert.Contains(assignment.GetForeignKeys(), key =>
            key.GetConstraintName() == "FK_ServiceAssignments_Employees_IdEmployee");
        Assert.Contains(assignment.GetForeignKeys(), key =>
            key.GetConstraintName() == "FK_ServiceAssignments_Services_IdService");
    }

    private static GestIaDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<GestIaDbContext>()
            .UseSqlServer(
                "Server=localhost,1433;Database=db-gestia-test;User Id=sa;" +
                "Password=Only_for_model_tests_2026!;Encrypt=True;TrustServerCertificate=True")
            .Options;

        return new GestIaDbContext(options);
    }
}
