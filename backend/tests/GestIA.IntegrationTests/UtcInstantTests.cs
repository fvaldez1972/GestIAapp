using System.Text.Json;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// Que un instante leído de la base siga siendo UTC, y que se note en el JSON.
///
/// <para><b>Estas pruebas van contra una base de verdad y no contra un doble a propósito.</b> El
/// defecto no estaba en el dominio ni en el serializador: estaba en el viaje de vuelta desde SQL
/// Server, que no guarda el huso. Un doble en memoria devuelve el <c>DateTime</c> que se le puso, y
/// habría pasado en verde mientras la aplicación seguía seis horas corrida.</para>
///
/// <para><b>Y por eso ninguna comprueba la respuesta de un alta.</b> El objeto recién creado sigue
/// en memoria con el <c>Kind</c> que le puso el dominio, así que ese camino siempre salió bien y es
/// justo el que escondió el defecto durante dos semanas. Aquí se cierra el contexto y se vuelve a
/// abrir, que es lo que hace una pantalla al recargarse.</para>
/// </summary>
public sealed class UtcInstantTests(OperationalSqlDatabase database) : IClassFixture<OperationalSqlDatabase>
{
    private static readonly CancellationToken Token = CancellationToken.None;
    private static readonly TestActor Actor = new();

    [OperationalSqlFact]
    public async Task InstantReadBackFromTheDatabaseKeepsItsUtcKind()
    {
        var (organization, id) = await SeedCatalogItemAsync();

        // Contexto nuevo: sin esto se leería la instancia que el rastreador todavía tiene en
        // memoria, y la prueba no diría nada del viaje de vuelta.
        await using var context = database.Context();
        var persisted = await context.BusinessCatalogItems.AsNoTracking()
            .SingleAsync(item => item.IdBusinessCatalogItem == id, Token);

        Assert.Equal(DateTimeKind.Utc, persisted.CreatedAt.Kind);
        Assert.Equal(organization, persisted.IdOrganization);
    }

    /// <summary>
    /// El síntoma que el usuario ve, comprobado donde de verdad ocurre: en el texto que viaja.
    ///
    /// <para>Un instante sin especificar se serializa <b>sin la «Z»</b>, y el navegador interpreta
    /// una cadena sin «Z» como hora local. En México eso son seis horas de corrimiento en toda
    /// columna <c>At</c>. La prueba mira la cadena, no el objeto, porque el corrimiento nace ahí.
    /// </para>
    /// </summary>
    [OperationalSqlFact]
    public async Task InstantSerializesWithTheUtcMarkerAfterReload()
    {
        var (_, id) = await SeedCatalogItemAsync();

        await using var context = database.Context();
        var persisted = await context.BusinessCatalogItems.AsNoTracking()
            .SingleAsync(item => item.IdBusinessCatalogItem == id, Token);

        var json = JsonSerializer.Serialize(persisted.CreatedAt);

        Assert.EndsWith("Z\"", json, StringComparison.Ordinal);
    }

    /// <summary>
    /// Los instantes que pueden faltar viajan igual, y no se rompen por ser nulos.
    /// </summary>
    [OperationalSqlFact]
    public async Task NullableInstantAlsoKeepsItsUtcKind()
    {
        var (_, id) = await SeedCatalogItemAsync();

        await using (var writer = database.Context())
        {
            var item = await writer.BusinessCatalogItems.SingleAsync(entity => entity.IdBusinessCatalogItem == id, Token);
            item.UpdateProfile(
                new BusinessCatalogItemProfile(BusinessCatalogItemType.JobPosition, "Guardia corregido", null),
                Actor.ActorId,
                Actor.ActorName,
                DateTime.UtcNow);
            await writer.SaveChangesAsync(Token);
        }

        await using var context = database.Context();
        var persisted = await context.BusinessCatalogItems.AsNoTracking()
            .SingleAsync(entity => entity.IdBusinessCatalogItem == id, Token);

        Assert.NotNull(persisted.UpdatedAt);
        Assert.Equal(DateTimeKind.Utc, persisted.UpdatedAt!.Value.Kind);
        Assert.EndsWith("Z\"", JsonSerializer.Serialize(persisted.UpdatedAt), StringComparison.Ordinal);
    }

    /// <summary>
    /// Guardar no mueve el instante. Si el convertidor tradujera de más, la hora se correría en el
    /// sentido contrario y el defecto seguiría, disfrazado.
    /// </summary>
    [OperationalSqlFact]
    public async Task SavingDoesNotShiftTheInstant()
    {
        var occurredAt = new DateTime(2026, 9, 7, 16, 7, 40, DateTimeKind.Utc);
        var organization = await SeedOrganizationAsync();

        Guid id;
        await using (var writer = database.Context())
        {
            var item = BusinessCatalogItem.Create(
                organization,
                new BusinessCatalogItemProfile(BusinessCatalogItemType.JobPosition, "Guardia de acceso", null),
                Actor.ActorId,
                Actor.ActorName,
                occurredAt);
            writer.Add(item);
            await writer.SaveChangesAsync(Token);
            id = item.IdBusinessCatalogItem;
        }

        await using var context = database.Context();
        var persisted = await context.BusinessCatalogItems.AsNoTracking()
            .SingleAsync(item => item.IdBusinessCatalogItem == id, Token);

        Assert.Equal(occurredAt, persisted.CreatedAt);
    }

    private async Task<(Guid Organization, Guid Item)> SeedCatalogItemAsync()
    {
        var organization = await SeedOrganizationAsync();

        await using var context = database.Context();
        var item = BusinessCatalogItem.Create(
            organization,
            new BusinessCatalogItemProfile(BusinessCatalogItemType.JobPosition, $"Guardia {Guid.NewGuid():N}"[..24], null),
            Actor.ActorId,
            Actor.ActorName,
            DateTime.UtcNow);
        context.Add(item);
        await context.SaveChangesAsync(Token);

        return (organization, item.IdBusinessCatalogItem);
    }

    private async Task<Guid> SeedOrganizationAsync()
    {
        await using var context = database.Context();
        var organization = Organization.Create(
            Guid.NewGuid().ToString("N")[..24],
            "Utc instant test",
            null,
            Actor.ActorId,
            Actor.ActorName,
            DateTime.UtcNow);
        context.Add(organization);
        await context.SaveChangesAsync(Token);
        database.Organization.SetAuthorizedOrganization(organization.IdOrganization);

        return organization.IdOrganization;
    }

    private sealed class TestActor : IActorContext
    {
        public Guid ActorId { get; } = Guid.NewGuid();
        public string ActorName => "Utc instant tests";
    }
}
