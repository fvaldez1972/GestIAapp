using GestIA.Application.Common;

namespace GestIA.Api.Security;

/// <summary>
/// Los contextos ambientales que toda composición con endpoints necesita: la organización
/// autorizada y el motivo de la corrección en curso.
///
/// Está aparte para que la aplicación real y cualquier host de prueba declaren explícitamente
/// que los tienen. Si falta el de organización, el guard falla en voz alta al resolver el
/// servicio en lugar de dejar pasar consultas sin organización; si falta el del motivo, el
/// registro de historial falla al guardar en lugar de escribir eventos sin justificación.
/// </summary>
public static class RequestContextRegistration
{
    public static IServiceCollection AddGestIaRequestContext(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddHttpContextAccessor();
        services.AddScoped<IOrganizationContext, HttpOrganizationContext>();
        services.AddScoped<IOperationReasonContext, HttpOperationReasonContext>();
        return services;
    }
}
