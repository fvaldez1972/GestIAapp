namespace GestIA.Api.Security;

public static class EndpointPermissionExtensions
{
    public static RouteHandlerBuilder RequirePermission(
        this RouteHandlerBuilder builder,
        string permission)
    {
        builder.AddEndpointFilter(new PermissionEndpointFilter(permission));
        return builder;
    }
}
