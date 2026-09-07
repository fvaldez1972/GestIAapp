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

        return new EmployeeSearchResponse(
            new PagedResult<EmployeeListItemResponse>(items, totalCount, query.Page, query.PageSize),
            ExpiringWithinDays,
            required.Count);
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
    /// Los requisitos documentales de la organización, traducidos a tipos del enum.
    ///
    /// <para><b>El código que no corresponde a ningún tipo se descarta.</b> La organización elige
    /// qué exigir, pero sobre el vocabulario que el sistema reconoce; un código escrito a mano que
    /// no existe no puede convertirse en un requisito que nadie podrá cumplir nunca.</para>
    /// </summary>
    private async Task<IReadOnlyList<EmployeeDocumentType>> RequiredDocumentsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var codes = await repository.ListRequiredDocumentCodesAsync(idOrganization, cancellationToken);

        return codes
            .Select(code => Enum.TryParse<EmployeeDocumentType>(code, ignoreCase: true, out var type)
                ? type
                : (EmployeeDocumentType?)null)
            .Where(type => type is not null)
            .Select(type => type!.Value)
            .Distinct()
            .ToArray();
    }
}
