using GestIA.Domain.Workforce;

namespace GestIA.Application.Assignments;

public sealed record CreateServiceAssignmentRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdEmployee,
    Guid IdPosition,
    ServiceAssignmentType AssignmentType,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsPrimary,
    string? Notes);

public sealed record UpdateServiceAssignmentRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdService,
    Guid IdPosition,
    ServiceAssignmentType AssignmentType,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsPrimary,
    string? Notes);

public sealed record ServiceAssignmentResponse(
    Guid IdServiceAssignment,
    Guid IdEmployee,
    string EmployeeCode,
    string EmployeeName,
    Guid IdService,
    Guid? IdPosition,
    string? PositionCode,
    string? PositionName,
    ServiceAssignmentType AssignmentType,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsPrimary,
    string? Notes,
    bool Active);
