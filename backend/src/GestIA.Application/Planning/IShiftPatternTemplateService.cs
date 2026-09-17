using GestIA.Domain.Planning;

namespace GestIA.Application.Planning;

public interface IShiftPatternTemplateService
{
    Task<IReadOnlyList<ShiftPatternTemplateResponse>> ListAsync(
        Guid idOrganization,
        bool includeInactive,
        CancellationToken cancellationToken);

    /// <summary>Lo mínimo para el desplegable de una posición: sólo las plantillas completas.</summary>
    Task<IReadOnlyList<ShiftPatternTemplateOptionResponse>> ListOptionsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken);

    Task<ShiftPatternTemplateResponse> CreateAsync(
        CreateShiftPatternTemplateRequest request,
        CancellationToken cancellationToken);

    Task<ShiftPatternTemplateResponse> UpdateAsync(
        Guid idShiftPatternTemplate,
        UpdateShiftPatternTemplateRequest request,
        CancellationToken cancellationToken);

    Task DeactivateAsync(
        Guid idOrganization,
        Guid idShiftPatternTemplate,
        CancellationToken cancellationToken);
}

public interface IShiftPatternTemplateRepository
{
    Task<IReadOnlyList<ShiftPatternTemplate>> ListAsync(
        Guid idOrganization,
        bool includeInactive,
        CancellationToken cancellationToken);

    /// <summary>
    /// La plantilla con <b>todos</b> sus días, incluidos los retirados por un ciclo más corto.
    ///
    /// <para>Tienen que venir: si el ciclo vuelve a crecer, el día retirado se reactiva en lugar de
    /// crearse otra vez, y crear otro chocaría con la clave única del día dentro del patrón.</para>
    /// </summary>
    Task<ShiftPatternTemplate?> GetTrackedAsync(
        Guid idShiftPatternTemplate,
        CancellationToken cancellationToken);

    Task<bool> IsNameInUseAsync(
        Guid idOrganization,
        string normalizedName,
        Guid? excluding,
        CancellationToken cancellationToken);

    /// <summary>
    /// Cuántas posiciones siguen este patrón.
    ///
    /// <para>Una plantilla en uso no se retira en silencio: las posiciones que la siguen quedarían
    /// apuntando a un patrón que la pantalla ya no ofrece, y nadie sabría por qué.</para>
    /// </summary>
    Task<int> CountPositionsUsingAsync(
        Guid idShiftPatternTemplate,
        CancellationToken cancellationToken);

    /// <summary>
    /// Si el patrón se puede asignar a una posición: existe en la organización, está activo y
    /// tiene todos los días del ciclo declarados.
    ///
    /// <para>La pantalla ya sólo ofrece los completos, pero eso es cromo: la regla se comprueba en
    /// el servidor porque una petición armada a mano no pasa por el desplegable.</para>
    /// </summary>
    Task<bool> IsAssignableAsync(
        Guid idOrganization,
        Guid idShiftPatternTemplate,
        CancellationToken cancellationToken);

    Task AddAsync(ShiftPatternTemplate pattern, CancellationToken cancellationToken);

    /// <summary>
    /// Da de alta los días que acaban de nacer, uno por uno y de forma explícita.
    ///
    /// <para>No es ceremonia. Un día nuevo colgado de la colección de una plantilla que ya se
    /// rastrea se guarda como la <i>modificación</i> de una fila que no existe, el UPDATE no afecta
    /// ninguna fila, y EF lo reporta como un conflicto de concurrencia que nadie provocó. Es el
    /// mismo motivo por el que un segmento de turno se agrega con su propio método.</para>
    /// </summary>
    Task AddDaysAsync(
        IReadOnlyCollection<ShiftPatternTemplateDay> days,
        CancellationToken cancellationToken);
}
