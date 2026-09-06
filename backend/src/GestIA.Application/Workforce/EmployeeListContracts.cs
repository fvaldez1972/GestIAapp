using GestIA.Application.Common;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Workforce;

/// <summary>
/// Cómo está el expediente documental de una persona.
///
/// <para><b>«Sin cargar» no es «al día»</b>, y ésa es la distinción que da sentido a la píldora del
/// listado. Un requisito que la organización exige y del que no hay documento no es un expediente
/// en orden: es un hueco que nadie ve hasta que alguien intenta asignar.</para>
///
/// <para>El peor manda: si hay un vencido, la fila dice vencido aunque también falte otro.</para>
/// </summary>
public enum EmployeeDocumentHealth
{
    /// <summary>Todos los requisitos cubiertos, y ninguno próximo a caducar.</summary>
    UpToDate,

    /// <summary>Falta el documento de algún requisito de la organización.</summary>
    Missing,

    /// <summary>Alguno caduca dentro del umbral.</summary>
    Expiring,

    /// <summary>Alguno ya caducó.</summary>
    Expired
}

/// <summary>El filtro de vigencia documental del listado.</summary>
public enum EmployeeDocumentFilter
{
    Any,
    Expired,
    Expiring,
    Missing,
    UpToDate
}

/// <summary>
/// Un empleado en el listado.
///
/// <para>Trae resuelto lo que la tabla muestra: el puesto por nombre de catálogo, el resumen
/// documental y cuántas asignaciones tiene. Sin esto, saber si a alguien le falta un documento
/// costaría una consulta por fila.</para>
/// </summary>
public sealed record EmployeeListItemResponse(
    Guid IdEmployee,
    Guid IdOrganization,
    string CodeEmployee,
    string FullName,
    EmployeeStatus Status,
    DateOnly HireDate,
    string? Curp,
    Guid? IdJobPositionCatalogItem,
    /// <summary>El nombre del catálogo. Nulo cuando la persona no tiene puesto catalogado.</summary>
    string? JobPositionName,
    /// <summary>El texto libre heredado. Se muestra sólo cuando no hay puesto de catálogo.</summary>
    string? JobTitle,
    string? State,
    string? Municipality,
    int RequiredDocuments,
    int ExpiredDocuments,
    int ExpiringDocuments,
    int MissingDocuments,
    int AssignmentCount,
    EmployeeDocumentHealth DocumentHealth);

/// <summary>
/// Una asignación vista desde la persona.
///
/// <para><c>InProgress</c> no es un estado del modelo: se <b>deriva</b> de que haya entrada
/// registrada y no haya salida. Existe para que un turno nocturno que empezó ayer no se lea como
/// ausencia ni como turno terminado.</para>
/// </summary>
public sealed record EmployeeAssignmentResponse(
    Guid IdServiceAssignment,
    Guid IdService,
    string ServiceName,
    string ClientName,
    Guid? IdPosition,
    string? PositionName,
    ServiceAssignmentType AssignmentType,
    bool IsPrimary,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool InForce,
    /// <summary>Turno de hoy o de ayer con entrada y sin salida.</summary>
    bool HasShiftInProgress,
    DateOnly? ShiftInProgressDate);

public sealed record EmployeeSearchCriteria(
    Guid IdOrganization,
    string? Search,
    EmployeeStatus? Status,
    Guid? IdJobPositionCatalogItem,
    EmployeeDocumentFilter DocumentFilter,
    string? Municipality,
    DateOnly Today,
    /// <summary>
    /// Cuántos días antes de caducar cuenta como «por vencer».
    ///
    /// <para>Hoy son treinta, fijos y decididos en el servidor. El bosquejo lo dibujaba como un
    /// ajuste por organización, y <b>ese ajuste no existe en el modelo</b>; hacerlo configurable es
    /// una decisión de negocio con su migración.</para>
    /// </summary>
    int ExpiringWithinDays,
    int Skip,
    int Take);

public sealed record EmployeeSearchQuery(
    Guid IdOrganization,
    string? Search = null,
    EmployeeStatus? Status = null,
    Guid? IdJobPositionCatalogItem = null,
    EmployeeDocumentFilter DocumentFilter = EmployeeDocumentFilter.Any,
    string? Municipality = null,
    int Page = 1,
    int PageSize = 25);

/// <summary>
/// El listado y el contexto que lo explica.
///
/// <para><c>ExpiringWithinDays</c> y <c>RequiredDocuments</c> viajan con la página porque la
/// pantalla tiene que <b>escribirlos</b>: «por vencer: 30 días o menos» y «4 requisitos de esta
/// organización». Sin ellos, la píldora sería un número sin regla a la vista.</para>
/// </summary>
public sealed record EmployeeSearchResponse(
    PagedResult<EmployeeListItemResponse> Page,
    int ExpiringWithinDays,
    int RequiredDocuments);

public sealed record EmployeeJobPositionOption(Guid IdCatalogItem, string Name);

public sealed record EmployeeFilterOptionsResponse(
    IReadOnlyList<EmployeeJobPositionOption> JobPositions,
    IReadOnlyList<string> Municipalities);
