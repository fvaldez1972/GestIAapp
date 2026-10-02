namespace GestIA.Application.Common;

/// <summary>
/// La organización sobre la que la petición en curso está autorizada a operar.
///
/// El valor lo fija <c>OrganizationAccessGuard</c> en el momento en que autoriza la petición,
/// de modo que el filtro de consulta y la autorización miran el mismo identificador: no hay
/// forma de que una consulta apunte a una organización distinta de la que se validó.
///
/// <para><b>Ausencia significa ninguna, no todas.</b> Cuando
/// <see cref="CurrentOrganizationId"/> es <c>null</c> —porque el guard no corrió, o porque el
/// código está fuera de una petición— el filtro de organización no encuentra filas. Olvidar el
/// guard devuelve cero registros, que se nota en el primer recorrido, en lugar de devolver los
/// de todas las organizaciones, que no se nota nunca.</para>
///
/// <para>Los caminos que legítimamente no tienen organización —el inicio de sesión, la vista de
/// plataforma del super admin y los sembradores— lo dicen en voz alta con
/// <c>IgnoreQueryFilters(["Organization"])</c>, que se puede buscar y está limitado a una lista
/// blanca por una prueba de arquitectura.</para>
/// </summary>
public interface IOrganizationContext
{
    Guid? CurrentOrganizationId { get; }

    /// <summary>
    /// Fija la organización autorizada de la petición. Volver a fijar el mismo valor no hace
    /// nada; intentar cambiarlo a otro es un error, porque significaría que una misma petición
    /// consultó dos organizaciones y la segunda habría quedado con los datos de la primera.
    /// </summary>
    void SetAuthorizedOrganization(Guid organizationId);
}
