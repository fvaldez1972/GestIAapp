using System.Text.Json.Serialization;
using GestIA.Domain.Services;

namespace GestIA.Application.Services;

public sealed record CreateServiceContractRequest(
    Guid IdOrganization,
    Guid IdClient,
    string CodeServiceContract,
    ServiceContractStatus Status,
    DateOnly? SignedDate,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short PaymentTermDays,
    short TerminationNoticeDays,
    string? CurrencyCode,
    string? DocumentReference,
    string? Notes);

public sealed record UpdateServiceContractRequest(
    Guid IdOrganization,
    Guid IdClient,
    ServiceContractStatus Status,
    DateOnly? SignedDate,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short PaymentTermDays,
    short TerminationNoticeDays,
    string? CurrencyCode,
    string? DocumentReference,
    string? Notes);

public sealed record ServiceContractResponse(
    Guid IdServiceContract,
    Guid IdClient,
    string CodeServiceContract,
    ServiceContractStatus Status,
    DateOnly? SignedDate,
    DateOnly EffectiveFromDate,
    DateOnly? EffectiveToDate,
    short PaymentTermDays,
    short TerminationNoticeDays,
    string CurrencyCode,
    string? DocumentReference,
    string? Notes,
    bool Active);

/// <summary>
/// El alta de un servicio contratado.
///
/// <para><c>CodeService</c> es opcional: sin el, lo pone el servidor con la forma <c>SRV-01</c>,
/// consecutivo por cliente. Es el mismo trato que el codigo de cliente y el de organizacion, y por
/// la misma razon: es un identificador de conveniencia, no la clave del registro, y pedirselo a
/// quien da de alta un servicio le hace inventar una convencion que el sistema ya tiene.</para>
/// </summary>
public sealed record CreateServiceRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdClientSite,
    Guid? IdServiceContract,
    string? CodeService,
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate);

public sealed record UpdateServiceRequest(
    Guid IdOrganization,
    Guid IdClient,
    Guid IdClientSite,
    Guid? IdServiceContract,
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate);

public sealed record ServiceResponse(
    Guid IdService,
    Guid IdClient,
    Guid IdClientSite,
    string? ClientSiteName,
    Guid? IdServiceContract,
    string? ServiceContractCode,
    string CodeService,
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool Active);

/// <summary>
/// Consulta de servicios de una organización, sin pasar por el cliente.
///
/// <para>Existe para que la pantalla de Servicios deje de exigir la cascada
/// organización → cliente → servicio: con <c>Service.IdOrganization</c> —denormalizada en la
/// tanda A— la lista se resuelve en una sola consulta y el cliente pasa a ser un filtro
/// opcional más.</para>
/// </summary>
/// <param name="Active">
/// Omitido o <c>true</c> devuelve sólo los activos, como el resto de las listas del sistema.
/// <c>false</c> devuelve sólo los inactivos. No hay forma de pedir ambos: ver la nota del
/// repositorio.
/// </param>
public sealed record ServiceListQuery(
    Guid IdOrganization,
    DateOnly CoverageDate,
    string? Search = null,
    Guid? IdClient = null,
    Guid? IdClientSite = null,
    Guid? IdServiceContract = null,
    ServiceStatusFilter Status = ServiceStatusFilter.Active,
    int Page = 1,
    int PageSize = 20);

/// <summary>
/// Los tres modos del listado de servicios.
///
/// <para><b>Antes eran dos, y la pantalla necesita tres.</b> Omitir el estado devolvía sólo los
/// activos y pedir los inactivos devolvía sólo los inactivos; no había forma de ver los dos
/// juntos. El listado de Servicios pinta los tres estados en una sola tabla, así que
/// <c>All</c> existe para eso.</para>
///
/// <para><b>Ojo con la distinción, que es sutil.</b> «Vigencia terminada» <b>no</b> es
/// «Inactivo»: lo primero sale de comparar la fecha de término con el día operativo y lo segundo
/// del borrado lógico. Un servicio puede estar <b>activo y vencido a la vez</b>, y este filtro no
/// lo separa: separa activos de dados de baja.</para>
/// </summary>
public enum ServiceStatusFilter
{
    /// <summary>Sólo los activos. Es lo que devuelve el listado si no se pide otra cosa.</summary>
    Active,

    /// <summary>Sólo los dados de baja.</summary>
    Inactive,

    /// <summary>Los dos. Apaga el borrado lógico, y sólo ése.</summary>
    All,
}

public sealed record ServiceSearchCriteria(
    Guid IdOrganization,
    string? Search,
    Guid? IdClient,
    Guid? IdClientSite,
    Guid? IdServiceContract,
    ServiceStatusFilter Status,
    DateOnly CoverageDate,
    int Skip,
    int Take);

/// <summary>
/// Un servicio en la lista de una organización: lo mismo que <see cref="ServiceResponse"/> más
/// el nombre del cliente y cuántas posiciones tiene, que son los dos datos que la lista muestra
/// y que de otro modo obligarían a una consulta por fila.
/// </summary>
public sealed record ServiceListItemResponse(
    Guid IdService,
    Guid IdClient,
    string ClientName,
    Guid IdClientSite,
    string? ClientSiteName,
    Guid? IdServiceContract,
    string? ServiceContractCode,
    string CodeService,
    string Name,
    string Description,
    string? InvoiceDescription,
    DateOnly StartDate,
    DateOnly? EndDate,
    int PositionsCount,
    /// <summary>Cuánta gente piden entre todas las posiciones del servicio.</summary>
    int RequiredWorkerCount,
    /// <summary>Cuánta hay asignada a <see cref="CoverageDate"/>.</summary>
    int AssignedWorkerCount,
    /// <summary>El día al que se calculó la cobertura. Sin él, los dos números no dicen nada.</summary>
    DateOnly CoverageDate,
    bool Active)
{
    /// <summary>
    /// Lo que falta. <b>Negativo si sobra gente</b>, y se muestra así: un excedente revela una
    /// violación de control y esconderlo detrás de un cero lo vuelve invisible.
    /// </summary>
    public int Vacancy => RequiredWorkerCount - AssignedWorkerCount;

    /// <summary>Hay hueco. Es lo que el listado pinta en rojo, sin abrir la ficha.</summary>
    public bool HasVacancy => Vacancy > 0;
}

