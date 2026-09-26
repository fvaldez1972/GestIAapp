using GestIA.Domain.Workforce;

namespace GestIA.Application.Workforce;

public interface IWorkforceRepository
{
    Task<EmployeeListResult> ListEmployeesAsync(EmployeeQuery query, CancellationToken cancellationToken);

    /// <summary>
    /// El listado con lo que la tabla necesita resuelto: puesto de catálogo, resumen documental y
    /// asignaciones. Los requisitos documentales salen de la organización, así que viajan aparte.
    /// </summary>
    Task<(IReadOnlyList<EmployeeListItemResponse> Items, int TotalCount)> SearchEmployeesAsync(
        EmployeeSearchCriteria criteria,
        IReadOnlyCollection<Guid> requiredDocuments,
        CancellationToken cancellationToken);

    /// <summary>
    /// Los cinco números del encabezado del listado, en una sola consulta.
    ///
    /// <para>Toma la organización y los requisitos, y <b>no</b> el resto del criterio: el resumen
    /// es de toda la organización a propósito. Ver <see cref="EmployeeSummaryResponse"/>.</para>
    /// </summary>
    Task<EmployeeSummaryResponse> SummarizeEmployeesAsync(
        EmployeeSearchCriteria criteria,
        IReadOnlyCollection<Guid> requiredDocuments,
        CancellationToken cancellationToken);

    /// <summary>
    /// Con qué clientes está ocupada cada persona hoy, para toda la organización y en una consulta.
    ///
    /// <para>Por organización y no por empleado: la lista de candidatos los pide todos a la vez, y
    /// preguntarlo uno por uno serían tantas consultas como candidatos.</para>
    /// </summary>
    Task<IReadOnlyList<EmployeeCurrentAssignmentsResponse>> ListCurrentAssignmentClientsAsync(
        Guid idOrganization,
        DateOnly today,
        CancellationToken cancellationToken);

    /// <summary>Los tipos de documento que esta organización exige, de EligibilityRequirement.</summary>
    Task<IReadOnlyList<Guid>> ListRequiredDocumentTypesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    /// <summary>Los puestos de catálogo que alguien tiene, para el filtro. Sólo los usados.</summary>
    Task<IReadOnlyList<(Guid Id, string Name)>> ListUsedJobPositionsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    /// <summary>Los municipios donde hay personal, para el filtro.</summary>
    Task<IReadOnlyList<string>> ListEmployeeMunicipalitiesAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    /// <summary>
    /// Las asignaciones de una persona.
    ///
    /// <para>Hoy sólo se alcanzan por cliente y servicio, así que la pestaña tendría que recorrer
    /// todos los servicios de la organización para encontrar las de alguien.</para>
    /// </summary>
    Task<IReadOnlyList<EmployeeAssignmentResponse>> ListAssignmentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly today,
        CancellationToken cancellationToken);

    Task<Employee?> GetEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    /// <summary>
    /// El expediente <b>con sus periodos laborales cargados</b>.
    ///
    /// <para>Existe aparte porque las reglas de ingreso, baja y reingreso son reglas sobre el conjunto
    /// de periodos: sin la colección cargada, el agregado no puede comprobar que hay como máximo uno
    /// abierto ni de cuándo cuenta la antigüedad. El resto de las operaciones no los necesita y no
    /// paga por traerlos.</para>
    /// </summary>
    Task<Employee?> GetEmployeeWithPeriodsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<EmploymentPeriodResponse>> ListEmploymentPeriodsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken);

    /// <summary>
    /// Las asignaciones vigentes de una persona a una fecha, para cerrarlas al darla de baja.
    ///
    /// <para>Vigente quiere decir activa y sin fin, o con fin posterior a la fecha de la baja. Una
    /// asignación que ya terminó no se toca.</para>
    /// </summary>
    Task<IReadOnlyList<ServiceAssignment>> ListOpenAssignmentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly onDate,
        CancellationToken cancellationToken);

    /// <summary>
    /// Cuántos turnos ya proyectados quedan a nombre de una persona desde una fecha.
    ///
    /// <para>No se borran: una versión publicada de la planeación es inmutable, y cancelar turnos
    /// ajenos en silencio sería peor que dejarlos. Se cuentan para <b>decirlo</b> al dar la baja, de
    /// modo que alguien los cubra.</para>
    /// </summary>
    Task<(int Count, DateOnly? FirstDate, DateOnly? LastDate)> CountFutureShiftsAsync(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly fromDate,
        CancellationToken cancellationToken);

    Task<bool> OrganizationExistsAsync(Guid idOrganization, CancellationToken cancellationToken);

    Task<bool> IsEmployeeCodeInUseAsync(
        Guid idOrganization,
        string codeEmployee,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken);

    Task<bool> IsRfcInUseAsync(
        Guid idOrganization,
        string rfc,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken);

    Task<bool> IsCurpInUseAsync(
        Guid idOrganization,
        string curp,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken);

    Task<bool> IsSocialSecurityNumberInUseAsync(
        Guid idOrganization,
        string socialSecurityNumber,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken);

    Task AddEmployeeAsync(Employee employee, CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeDocument>> ListDocumentsAsync(Guid idEmployee, CancellationToken cancellationToken);

    Task<EmployeeDocument?> GetDocumentAsync(
        Guid idEmployee,
        Guid idEmployeeDocument,
        CancellationToken cancellationToken);

    Task AddDocumentAsync(EmployeeDocument document, CancellationToken cancellationToken);

    Task<IReadOnlyList<EmployeeEvaluation>> ListEvaluationsAsync(Guid idEmployee, CancellationToken cancellationToken);

    Task<EmployeeEvaluation?> GetEvaluationAsync(
        Guid idEmployee,
        Guid idEmployeeEvaluation,
        CancellationToken cancellationToken);

    Task<bool> IsEvaluationInUseAsync(
        Guid idEmployee,
        EmployeeEvaluationType evaluationType,
        DateOnly evaluatedDate,
        Guid? excludedEmployeeEvaluationId,
        CancellationToken cancellationToken);

    Task AddEvaluationAsync(EmployeeEvaluation evaluation, CancellationToken cancellationToken);
}
