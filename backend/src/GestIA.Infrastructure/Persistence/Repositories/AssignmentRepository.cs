using GestIA.Application.Assignments;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;
using ServiceEntity = GestIA.Domain.Services.Service;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class AssignmentRepository(GestIaDbContext dbContext) : IAssignmentRepository
{
    public Task<ServiceEntity?> GetServiceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken) =>
        dbContext.Services.SingleOrDefaultAsync(
            service =>
                service.IdService == idService &&
                service.IdClient == idClient &&
                service.Client.IdOrganization == idOrganization,
            cancellationToken);

    public Task<Employee?> GetEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        dbContext.Employees.SingleOrDefaultAsync(
            employee =>
                employee.IdEmployee == idEmployee &&
                employee.IdOrganization == idOrganization,
            cancellationToken);

    public Task<Position?> GetPositionAsync(
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken) =>
        dbContext.Positions.SingleOrDefaultAsync(
            position => position.IdService == idService && position.IdPosition == idPosition,
            cancellationToken);

    public async Task<IReadOnlyList<EmployeeDocument>> ListEmployeeDocumentsAsync(
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeDocuments
            .AsNoTracking()
            .Where(document => document.IdEmployee == idEmployee)
            .OrderBy(document => document.DocumentType)
            .ThenByDescending(document => document.ReceivedDate)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<EmployeeEvaluation>> ListEmployeeEvaluationsAsync(
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        await dbContext.EmployeeEvaluations
            .AsNoTracking()
            .Where(evaluation => evaluation.IdEmployee == idEmployee)
            .OrderByDescending(evaluation => evaluation.EvaluatedDate)
            .ThenBy(evaluation => evaluation.EvaluationType)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<ServiceAssignment>> ListAssignmentsAsync(
        Guid idService,
        CancellationToken cancellationToken) =>
        await dbContext.ServiceAssignments
            .AsNoTracking()
            .Include(assignment => assignment.Employee)
            .Include(assignment => assignment.Position)
            .Where(assignment => assignment.IdService == idService)
            .OrderBy(assignment => assignment.StartDate)
            .ThenBy(assignment => assignment.Employee.FullName)
            .ToArrayAsync(cancellationToken);

    public Task<ServiceAssignment?> GetAssignmentAsync(
        Guid idService,
        Guid idServiceAssignment,
        CancellationToken cancellationToken) =>
        dbContext.ServiceAssignments
            .Include(assignment => assignment.Employee)
            .Include(assignment => assignment.Position)
            .SingleOrDefaultAsync(
                assignment =>
                    assignment.IdService == idService &&
                    assignment.IdServiceAssignment == idServiceAssignment,
                cancellationToken);

    public Task<bool> HasEmployeeAssignmentOverlapAsync(
        Guid idEmployee,
        DateOnly startDate,
        DateOnly? endDate,
        Guid? excludedAssignmentId,
        CancellationToken cancellationToken)
    {
        var finalDate = endDate ?? DateOnly.MaxValue;

        return dbContext.ServiceAssignments.AnyAsync(
            assignment =>
                assignment.IdEmployee == idEmployee &&
                (!excludedAssignmentId.HasValue || assignment.IdServiceAssignment != excludedAssignmentId.Value) &&
                assignment.StartDate <= finalDate &&
                (assignment.EndDate == null || assignment.EndDate >= startDate),
            cancellationToken);
    }

    public Task AddAssignmentAsync(ServiceAssignment assignment, CancellationToken cancellationToken) =>
        dbContext.ServiceAssignments.AddAsync(assignment, cancellationToken).AsTask();
}
