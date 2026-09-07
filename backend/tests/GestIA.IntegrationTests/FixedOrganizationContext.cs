using GestIA.Application.Common;

namespace GestIA.IntegrationTests;

/// <summary>
/// Organización autorizada para una prueba. En producción la fija
/// <c>OrganizationAccessGuard</c> al autorizar la petición; aquí la fija la prueba, que es lo
/// que le permite decir "estoy dentro de la organización A" y comprobar que no ve la B.
///
/// <see cref="None"/> representa el caso sin organización: el filtro global no encuentra filas,
/// que es el fallo cerrado. Las pruebas que sólo leen el modelo de EF, sin consultar, lo usan.
/// </summary>
public sealed class FixedOrganizationContext : IOrganizationContext
{
    private FixedOrganizationContext(Guid? organizationId) => CurrentOrganizationId = organizationId;

    public static FixedOrganizationContext None() => new(null);

    public static FixedOrganizationContext For(Guid organizationId) => new(organizationId);

    public Guid? CurrentOrganizationId { get; private set; }

    public void SetAuthorizedOrganization(Guid organizationId) => CurrentOrganizationId = organizationId;

    /// <summary>Vuelve al caso sin organización, para comprobar que el filtro falla cerrado.</summary>
    public void Clear() => CurrentOrganizationId = null;
}
