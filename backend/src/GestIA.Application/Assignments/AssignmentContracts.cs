using System.Text.Json.Serialization;
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
    string? Notes,
    [property: JsonRequired] byte[] RowVersion,
    string? CorrectionReason = null);

public sealed record ServiceAssignmentResponse(
    Guid IdServiceAssignment,
    Guid IdEmployee,
    string EmployeeCode,
    string EmployeeName,
    /// <summary>
    /// El municipio del domicilio de la persona. Es lo que hoy permite decir si vive cerca.
    ///
    /// <para>Con municipio y estado no se puede medir distancia; se puede comparar contra el municipio
    /// de la sede, y eso es exactamente lo que RQ-11 pide con los datos que hay.</para>
    /// </summary>
    string? EmployeeMunicipality,
    Guid IdService,
    Guid? IdPosition,
    string? PositionCode,
    string? PositionName,
    ServiceAssignmentType AssignmentType,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsPrimary,
    string? Notes,
    bool Active,
    byte[] RowVersion);
