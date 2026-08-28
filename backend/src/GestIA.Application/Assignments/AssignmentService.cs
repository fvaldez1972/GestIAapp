using GestIA.Application.Common;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Assignments;

public sealed class AssignmentService(
    IAssignmentRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IAssignmentService
{
    public async Task<IReadOnlyList<ServiceAssignmentResponse>> ListAssignmentsAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var assignments = await repository.ListAssignmentsAsync(idService, cancellationToken);
        return assignments.Select(Map).ToArray();
    }

    public async Task<ServiceAssignmentResponse> CreateAssignmentAsync(
        CreateServiceAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var employee = await EnsureActiveEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var position = await EnsurePositionAsync(request.IdService, request.IdPosition, cancellationToken);
        var profile = ValidateProfile(
            request.IdPosition,
            request.AssignmentType,
            request.StartDate,
            request.EndDate,
            request.IsPrimary,
            request.Notes);
        await EnsureEmployeeEligibilityAsync(employee, position, profile.StartDate, cancellationToken);
        await EnsureNoOverlapAsync(employee.IdEmployee, request.StartDate, request.EndDate, null, cancellationToken);

        var assignment = ServiceAssignment.Create(
            employee.IdEmployee,
            request.IdService,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddAssignmentAsync(assignment, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Map(await repository.GetAssignmentAsync(request.IdService, assignment.IdServiceAssignment, cancellationToken) ?? assignment);
    }

    public async Task<ServiceAssignmentResponse> UpdateAssignmentAsync(
        Guid idServiceAssignment,
        UpdateServiceAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(request.IdOrganization, request.IdClient, request.IdService, cancellationToken);
        var assignment = await EnsureAssignmentAsync(request.IdService, idServiceAssignment, cancellationToken);
        var employee = await EnsureActiveEmployeeAsync(request.IdOrganization, assignment.IdEmployee, cancellationToken);
        var position = await EnsurePositionAsync(request.IdService, request.IdPosition, cancellationToken);
        var profile = ValidateProfile(
            request.IdPosition,
            request.AssignmentType,
            request.StartDate,
            request.EndDate,
            request.IsPrimary,
            request.Notes);
        await EnsureEmployeeEligibilityAsync(employee, position, profile.StartDate, cancellationToken);
        await EnsureNoOverlapAsync(
            employee.IdEmployee,
            request.StartDate,
            request.EndDate,
            idServiceAssignment,
            cancellationToken);

        assignment.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Map(await repository.GetAssignmentAsync(request.IdService, idServiceAssignment, cancellationToken) ?? assignment);
    }

    public async Task DeactivateAssignmentAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        Guid idServiceAssignment,
        CancellationToken cancellationToken)
    {
        await EnsureServiceAsync(idOrganization, idClient, idService, cancellationToken);
        var assignment = await EnsureAssignmentAsync(idService, idServiceAssignment, cancellationToken);
        assignment.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureServiceAsync(
        Guid idOrganization,
        Guid idClient,
        Guid idService,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (idOrganization == Guid.Empty)
        {
            errors[nameof(idOrganization)] = ["La organización es obligatoria."];
        }

        if (idClient == Guid.Empty)
        {
            errors[nameof(idClient)] = ["El cliente es obligatorio."];
        }

        if (idService == Guid.Empty)
        {
            errors[nameof(idService)] = ["El servicio es obligatorio."];
        }

        InputValidation.ThrowIfInvalid(errors);

        if (await repository.GetServiceAsync(idOrganization, idClient, idService, cancellationToken) is null)
        {
            throw new ResourceNotFoundException("No se encontró el servicio solicitado.");
        }
    }

    private async Task<Employee> EnsureActiveEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        if (idEmployee == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idEmployee)] = ["El empleado es obligatorio."]
            });
        }

        var employee = await repository.GetEmployeeAsync(idOrganization, idEmployee, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el empleado solicitado.");

        if (employee.Status != EmployeeStatus.Active)
        {
            throw new ResourceConflictException("Solo se pueden asignar empleados activos.");
        }

        return employee;
    }

    private async Task<Position> EnsurePositionAsync(
        Guid idService,
        Guid idPosition,
        CancellationToken cancellationToken)
    {
        if (idPosition == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idPosition)] = ["La posición es obligatoria."]
            });
        }

        return await repository.GetPositionAsync(idService, idPosition, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la posición solicitada.");
    }

    private async Task EnsureEmployeeEligibilityAsync(
        Employee employee,
        Position position,
        DateOnly effectiveDate,
        CancellationToken cancellationToken)
    {
        var documents = await repository.ListEmployeeDocumentsAsync(employee.IdEmployee, cancellationToken);
        var invalidDocuments = documents
            .Where(document =>
                document.Status is EmployeeDocumentStatus.Rejected or EmployeeDocumentStatus.Expired ||
                (document.ExpiresDate.HasValue && document.ExpiresDate.Value < effectiveDate))
            .Select(document => document.DocumentType.ToString())
            .Distinct()
            .ToArray();

        if (invalidDocuments.Length > 0)
        {
            throw new ResourceConflictException(
                $"El empleado no es elegible para asignación: tiene documentos vencidos o rechazados ({string.Join(", ", invalidDocuments)}).");
        }

        var evaluations = await repository.ListEmployeeEvaluationsAsync(employee.IdEmployee, cancellationToken);
        var invalidEvaluations = evaluations
            .Where(evaluation =>
                evaluation.Result is EmployeeEvaluationResult.NotApproved or EmployeeEvaluationResult.Inconclusive ||
                (evaluation.ExpiresDate.HasValue && evaluation.ExpiresDate.Value < effectiveDate))
            .Select(evaluation => evaluation.EvaluationType.ToString())
            .Distinct()
            .ToArray();

        if (invalidEvaluations.Length > 0)
        {
            throw new ResourceConflictException(
                $"El empleado no es elegible para asignación: tiene evaluaciones vencidas o no aprobadas ({string.Join(", ", invalidEvaluations)}).");
        }

        if (!string.IsNullOrWhiteSpace(position.RequiredSkillProfile) &&
            !string.IsNullOrWhiteSpace(employee.JobTitle) &&
            !employee.JobTitle.Contains(position.RequiredSkillProfile, StringComparison.OrdinalIgnoreCase))
        {
            throw new ResourceConflictException(
                $"El empleado no coincide con el perfil requerido para la posición: {position.RequiredSkillProfile}.");
        }
    }

    private async Task<ServiceAssignment> EnsureAssignmentAsync(
        Guid idService,
        Guid idServiceAssignment,
        CancellationToken cancellationToken) =>
        await repository.GetAssignmentAsync(idService, idServiceAssignment, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la asignación solicitada.");

    private async Task EnsureNoOverlapAsync(
        Guid idEmployee,
        DateOnly startDate,
        DateOnly? endDate,
        Guid? excludedAssignmentId,
        CancellationToken cancellationToken)
    {
        if (await repository.HasEmployeeAssignmentOverlapAsync(idEmployee, startDate, endDate, excludedAssignmentId, cancellationToken))
        {
            throw new ResourceConflictException("El empleado ya tiene una asignación activa que se traslapa con ese rango de fechas.");
        }
    }

    private static ServiceAssignmentProfile ValidateProfile(
        Guid idPosition,
        ServiceAssignmentType assignmentType,
        DateOnly startDate,
        DateOnly? endDate,
        bool isPrimary,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        if (idPosition == Guid.Empty)
        {
            errors[nameof(idPosition)] = ["La posición es obligatoria."];
        }

        if (startDate == default)
        {
            errors[nameof(startDate)] = ["La fecha inicial es obligatoria."];
        }

        if (endDate < startDate)
        {
            errors[nameof(endDate)] = ["La fecha final no puede ser menor que la inicial."];
        }

        var normalizedNotes = InputValidation.Optional(notes, nameof(notes), 1000, errors);
        InputValidation.ThrowIfInvalid(errors);

        return new ServiceAssignmentProfile(
            idPosition,
            assignmentType,
            startDate,
            endDate,
            isPrimary,
            normalizedNotes);
    }

    private static ServiceAssignmentResponse Map(ServiceAssignment assignment) =>
        new(
            assignment.IdServiceAssignment,
            assignment.IdEmployee,
            assignment.Employee.CodeEmployee,
            assignment.Employee.FullName,
            assignment.IdService,
            assignment.IdPosition,
            assignment.Position?.CodePosition,
            assignment.Position?.Name,
            assignment.AssignmentType,
            assignment.StartDate,
            assignment.EndDate,
            assignment.IsPrimary,
            assignment.Notes,
            assignment.Active);
}
