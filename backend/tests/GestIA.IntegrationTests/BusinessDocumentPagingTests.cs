using GestIA.Application.Common;
using GestIA.Application.Documents;
using GestIA.Domain.Documents;
using GestIA.Domain.Organizations;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence.Repositories;

namespace GestIA.IntegrationTests;

/// <summary>
/// Que el listado de documentos pagine de verdad.
///
/// <para>Se reportó que «el navegador de páginas no funciona, los documentos se van acumulando».
/// La lectura del código decía que la cadena estaba bien de punta a punta, pero eso es una opinión
/// hasta que una prueba la comprueba contra una base: si el repositorio ignorara el
/// <c>Skip</c>/<c>Take</c>, la pantalla mostraría todo en una página y un «1 / 1» al lado, que es
/// exactamente lo que se veía.</para>
///
/// <para>Con esto, la respuesta a esa pregunta deja de depender de que alguien vuelva a leer el
/// código.</para>
/// </summary>
public sealed class BusinessDocumentPagingTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly Guid ActorId = Guid.NewGuid();
    private const string ActorName = "Pruebas de paginado";
    private static readonly DateTime Now = new(2026, 9, 8, 12, 0, 0, DateTimeKind.Utc);

    [OperationalSqlFact]
    public async Task TheDocumentListPagesInsteadOfReturningEverything()
    {
        var (organizationId, ownerId) = await SeedAsync(12);

        await using var context = database.Context();
        var repositorio = new BusinessDocumentRepository(context, new Reloj());

        var primera = await repositorio.SearchAsync(Criterios(organizationId, ownerId, skip: 0, take: 5), Token);
        var segunda = await repositorio.SearchAsync(Criterios(organizationId, ownerId, skip: 5, take: 5), Token);
        var tercera = await repositorio.SearchAsync(Criterios(organizationId, ownerId, skip: 10, take: 5), Token);

        // El total es de la consulta entera; lo que viene son sólo los de la página.
        Assert.Equal(12, primera.TotalCount);
        Assert.Equal(5, primera.Items.Count);
        Assert.Equal(5, segunda.Items.Count);
        Assert.Equal(2, tercera.Items.Count);

        // Y son distintos: si el Skip se ignorara, las tres traerían lo mismo.
        var primeros = primera.Items.Select(item => item.IdBusinessDocument).ToArray();
        var segundos = segunda.Items.Select(item => item.IdBusinessDocument).ToArray();
        Assert.Empty(primeros.Intersect(segundos));

        // Las tres páginas juntas son el total, sin repetir ni perder ninguno.
        var todos = primeros.Concat(segundos).Concat(tercera.Items.Select(item => item.IdBusinessDocument)).ToArray();
        Assert.Equal(12, todos.Distinct().Count());
    }

    private sealed class Reloj : IClock
    {
        public DateTime UtcNow => Now;
        public DateOnly Today => DateOnly.FromDateTime(Now);
        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }

    private static BusinessDocumentSearchCriteria Criterios(Guid organizationId, Guid ownerId, int skip, int take) =>
        new(organizationId, BusinessDocumentOwnerType.Employee, ownerId, null, null, skip, take, true);

    private async Task<(Guid OrganizationId, Guid OwnerId)> SeedAsync(int cuantos)
    {
        database.Organization.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            Guid.NewGuid().ToString("N")[..24], "Paginado de documentos", null, ActorId, ActorName, Now);
        context.Add(organization);
        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);

        // El documento cuelga de un empleado de verdad: hay clave foranea, y sembrar un
        // identificador inventado hace fallar el guardado antes de llegar a lo que se prueba.
        var empleado = Employee.Create(
            organization.IdOrganization,
            $"PAG-{Guid.NewGuid():N}"[..12],
            "Persona con expediente",
            "Guardia",
            DateOnly.FromDateTime(Now).AddDays(-90),
            ActorId,
            ActorName,
            Now);
        context.Add(empleado);
        await context.SaveChangesAsync(Token);

        var ownerId = empleado.IdEmployee;

        for (var indice = 0; indice < cuantos; indice++)
        {
            context.Add(BusinessDocument.Create(
                organization.IdOrganization,
                new BusinessDocumentProfile(
                    BusinessDocumentOwnerType.Employee,
                    ownerId,
                    "Identificacion",
                    $"Documento {indice:00}",
                    BusinessDocumentStatus.PendingReview,
                    null,
                    null,
                    $"doc-{indice:00}.pdf",
                    false,
                    null),
                ActorId,
                ActorName,
                Now));
        }

        await context.SaveChangesAsync(Token);

        return (organization.IdOrganization, ownerId);
    }
}
