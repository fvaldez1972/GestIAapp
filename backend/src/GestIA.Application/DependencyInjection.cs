using GestIA.Application.Clients;
using GestIA.Application.Organizations;
using GestIA.Application.Security;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<IClientService, ClientService>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();

        return services;
    }
}
