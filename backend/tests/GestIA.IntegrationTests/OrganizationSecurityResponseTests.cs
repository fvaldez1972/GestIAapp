using System.Reflection;
using GestIA.Api.Endpoints;
using GestIA.Application.Audit;
using GestIA.Application.Common;
using GestIA.Application.Security;
using GestIA.Domain.Organizations;
using GestIA.Domain.Security;
using GestIA.Infrastructure.Persistence;
using GestIA.Infrastructure.Persistence.Repositories;

namespace GestIA.IntegrationTests;

/// <summary>
/// Las dos mitades del defecto «se creó el acceso pero dice que hubo un error inesperado».
///
/// <para><b>La primera.</b> Los cinco endpoints de escritura sobre usuarios de una organización
/// —crear acceso, editar usuario, asignar acceso, quitarlo y activar— guardaban bien y reventaban
/// después, al construir la respuesta: filtraban por usuario <i>sobre la proyección</i>, y un
/// predicado que habla de una propiedad de <c>SecurityUserResponse</c> no es una columna, así que
/// EF no puede traducirlo. El 500 llegaba con el cambio ya escrito en la base.</para>
///
/// <para><b>La segunda.</b> La pantalla afirma que «toda acción sensible queda registrada en
/// Auditoría», y Auditoría no conocía ninguna entidad de seguridad: el acceso recién creado no
/// aparecía por ningún lado.</para>
///
/// <para>Las dos sólo se ven contra una base de verdad. Con un doble en memoria la consulta
/// «traduce» sin quejarse y la prueba pasaría mientras la aplicación falla.</para>
/// </summary>
public sealed class OrganizationSecurityResponseTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly Guid ActorId = Guid.NewGuid();
    private const string ActorName = "Pruebas de seguridad";
    private static readonly DateTime Now = new(2026, 9, 8, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>
    /// Buscar un usuario por identificador tiene que traducirse a SQL.
    ///
    /// <para>Si alguien vuelve a poner el <c>Where</c> después del <c>Select</c>, esta prueba falla
    /// con <c>InvalidOperationException: The LINQ expression … could not be translated</c>, que es
    /// exactamente lo que veía quien pulsaba «Crear acceso».</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task FindingOneOrganizationUserTranslatesToSql()
    {
        var seed = await SeedAsync();
        await using var context = database.Context();

        var found = await FindAsync(context, seed.OrganizationId, seed.UserId);

        Assert.NotNull(found);
        Assert.Equal(seed.UserId, found!.IdUser);
        Assert.Equal("Persona con acceso", found.DisplayName);
        Assert.Single(found.Organizations);
        Assert.Single(found.Roles);
        Assert.Equal("Supervisor operativo", found.Roles[0].Name);
    }

    /// <summary>Un identificador de otra organización no devuelve nada, y tampoco revienta.</summary>
    [OperationalSqlFact]
    public async Task FindingAUserOutsideTheOrganizationReturnsNothing()
    {
        var seed = await SeedAsync();
        await using var context = database.Context();

        Assert.Null(await FindAsync(context, seed.OrganizationId, Guid.NewGuid()));
    }

    /// <summary>
    /// El alta de un usuario y la de su acceso aparecen en Auditoría.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheNewAccessShowsUpInTheAuditTrail()
    {
        var seed = await SeedAsync();
        await using var context = database.Context();
        var repository = new AuditRepository(context, new TestActor());

        var result = await repository.SearchAsync(
            new AuditQuery(seed.OrganizationId, null, null, null, null, 1, 200), Token);

        Assert.Contains("Usuarios", result.AvailableEntities);
        Assert.Contains("Accesos", result.AvailableEntities);
        Assert.Contains(result.Events.Items, row =>
            row.Entity == "Usuarios" && row.EntityName == "Persona con acceso" && row.Action == "Alta");
        Assert.Contains(result.Events.Items, row =>
            row.Entity == "Accesos" && row.EntityName == "Persona con acceso" && row.Action == "Alta");
    }

    /// <summary>
    /// Se llama por reflexión a propósito: el ayudante es privado, y lo que se quiere comprobar es
    /// el que usan de verdad los cinco endpoints, no una copia escrita para la prueba. Una copia
    /// habría seguido pasando mientras la aplicación fallaba.
    /// </summary>
    private static async Task<SecurityUserResponse?> FindAsync(
        GestIaDbContext context, Guid organizationId, Guid idUser)
    {
        var method = typeof(OrganizationSecurityEndpoints).GetMethod(
            "FindOrganizationUserResponseAsync",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var task = (Task<SecurityUserResponse?>)method!.Invoke(
            null, [context, organizationId, idUser, Token])!;
        return await task;
    }

    private async Task<(Guid OrganizationId, Guid UserId)> SeedAsync()
    {
        database.Organization.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            Guid.NewGuid().ToString("N")[..24], "Seguridad de organización", null, ActorId, ActorName, Now);
        context.Add(organization);
        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);

        var user = User.Create(
            $"acceso-{Guid.NewGuid():N}@gestia.local",
            "Persona con acceso",
            "hash",
            "salt",
            1,
            ActorId,
            ActorName,
            Now);
        var role = Role.CreateSystem(
            $"SUP{Guid.NewGuid():N}"[..12], "Supervisor operativo", ActorId, ActorName, Now);
        context.Add(user);
        context.Add(role);
        await context.SaveChangesAsync(Token);

        var membership = OrganizationMembership.Create(
            user.IdUser, organization.IdOrganization, "Acceso operativo", ActorId, ActorName, Now);
        context.Add(membership);
        await context.SaveChangesAsync(Token);

        context.Add(UserRole.Create(
            user.IdUser, role.IdRole, membership.IdOrganizationMembership, ActorId, ActorName, Now));
        await context.SaveChangesAsync(Token);

        return (organization.IdOrganization, user.IdUser);
    }

    private sealed class TestActor : IActorContext
    {
        public Guid ActorId { get; } = OrganizationSecurityResponseTests.ActorId;
        public string ActorName => "Pruebas de seguridad";
    }
}
