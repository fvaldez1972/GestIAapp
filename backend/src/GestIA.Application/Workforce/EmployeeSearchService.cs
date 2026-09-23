using GestIA.Application.Common;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Workforce;

/// <summary>
/// El listado de personal y sus filtros, con los requisitos documentales de la organización.
///
/// <para>Aquí vive la única regla de negocio que la pantalla no puede deducir: <b>qué documentos
/// exige esta organización</b>. Salen de <c>EligibilityRequirement</c>, y por eso la píldora de un
/// empleado dice cosas distintas en dos organizaciones con los mismos papeles cargados.</para>
/// </summary>
public sealed class EmployeeSearchService(
    IWorkforceRepository repository,
    IClock clock) : IEmployeeSearchService
{
    /// <summary>
    /// Cuántos días antes de caducar cuenta como «por vencer».
    ///
    /// <para>Treinta, fijos y decididos aquí. El bosquejo lo dibujaba como un ajuste por
    /// organización y <b>ese ajuste no existe en el modelo</b>; volverlo configurable es una
    /// decisión de negocio con su migración. Mientras tanto la pantalla escribe el número, en vez
    /// de insinuar que se puede cambiar.</para>
    /// </summary>
    public const int ExpiringWithinDays = 30;

    public async Task<EmployeeSearchResponse> SearchAsync(
        EmployeeSearchQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        InputValidation.Page(query.Page, query.PageSize, errors);
        var search = InputValidation.Optional(query.Search, nameof(query.Search), 200, errors);
        var municipality = InputValidation.Optional(query.Municipality, nameof(query.Municipality), 120, errors);
        InputValidation.ThrowIfInvalid(errors);

        var required = await RequiredDocumentsAsync(query.IdOrganization, cancellationToken);

        var criteria = new EmployeeSearchCriteria(
            query.IdOrganization,
            search,
            query.Status,
            query.IdJobPositionCatalogItem,
            query.DocumentFilter,
            municipality,
            clock.Today,
            ExpiringWithinDays,
            (query.Page - 1) * query.PageSize,
            query.PageSize);

        var (items, totalCount) = await repository.SearchEmployeesAsync(criteria, required, cancellationToken);
        var resumen = await repository.SummarizeEmployeesAsync(criteria, required, cancellationToken);

        return new EmployeeSearchResponse(
            new PagedResult<EmployeeListItemResponse>(items, totalCount, query.Page, query.PageSize),
            ExpiringWithinDays,
            required.Count,
            resumen);
    }

    public async Task<EmployeeFilterOptionsResponse> GetFilterOptionsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var puestos = await repository.ListUsedJobPositionsAsync(idOrganization, cancellationToken);
        var municipios = await repository.ListEmployeeMunicipalitiesAsync(idOrganization, cancellationToken);

        return new EmployeeFilterOptionsResponse(
            puestos.Select(puesto => new EmployeeJobPositionOption(puesto.Id, puesto.Name)).ToArray(),
            municipios);
    }

    public Task<IReadOnlyList<EmployeeAssignmentResponse>> ListAssignmentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken) =>
        repository.ListAssignmentsAsync(idOrganization, idEmployee, clock.Today, cancellationToken);

    /// <summary>
    /// Los requisitos documentales de la organización, por identificador del catálogo.
    ///
    /// <para>Desde el 19 de septiembre de 2026 la categoría de un documento es una fila del catálogo
    /// que la organización edita, así que el requisito y el documento se comparan por identificador.
    /// Antes se comparaban por enum, y el vocabulario lo fijaba el sistema.</para>
    /// </summary>
    private async Task<IReadOnlyList<Guid>> RequiredDocumentsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        return await repository.ListRequiredDocumentTypesAsync(idOrganization, cancellationToken);
    }
}
