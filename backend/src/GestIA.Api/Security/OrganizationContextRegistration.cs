using GestIA.Application.Common;

namespace GestIA.Api.Security;

/// <summary>
/// Registro del contexto de organización. Está aparte para que cualquier composición que monte
/// endpoints —la aplicación real o un host de prueba— declare explícitamente que el guard tiene
/// dónde dejar la organización autorizada.
///
/// Si falta, <c>OrganizationAccessGuard.ForbidIfUnauthorized</c> falla en voz alta al resolver el
/// servicio, en lugar de dejar pasar consultas sin organización.
/// </summary>
public static class OrganizationContextRegistration
{
    public static IServiceCollection AddOrganizationContext(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddHttpContextAccessor();
        services.AddScoped<IOrganizationContext, HttpOrganizationContext>();
        return services;
    }
}
