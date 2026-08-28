using GestIA.Application.Clients;
using GestIA.Application.Assignments;
using GestIA.Application.Operations;
using GestIA.Application.Organizations;
using GestIA.Application.Planning;
using GestIA.Application.Reports;
using GestIA.Application.Scheduling;
using GestIA.Application.Security;
using GestIA.Application.Services;
using GestIA.Application.Workforce;
using Microsoft.Extensions.DependencyInjection;

namespace GestIA.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<IClientService, ClientService>();
        services.AddScoped<IClientSiteService, ClientSiteService>();
        services.AddScoped<IClientContactService, ClientContactService>();
        services.AddScoped<IServiceManagementService, ServiceManagementService>();
        services.AddScoped<IWorkforceService, WorkforceService>();
        services.AddScoped<IPlanningService, PlanningService>();
        services.AddScoped<IAssignmentService, AssignmentService>();
        services.AddScoped<ISchedulingService, SchedulingService>();
        services.AddScoped<IOperationsService, OperationsService>();
        services.AddScoped<IReportsService, ReportsService>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();

        return services;
    }
}
