using System.Text.Json;
using GestIA.Application.Common;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.Catalogs;

public sealed class OrganizationCatalogDefaults(ICatalogRepository repository, IActorContext actor, IClock clock)
{
    public static string GeographyJson { get; } = ReadGeography();
    public static MexicoGeography Geography { get; } = JsonSerializer.Deserialize<MexicoGeography>(GeographyJson)!;

    // Stage defaults in the same unit of work as the organization and its initial admin.
    public async Task StageAsync(Guid organization, CancellationToken token)
    {
        var country = await Add(BusinessCatalogItemType.Country, "México", null);
        await Add(BusinessCatalogItemType.Nationality, "Mexicana", null);
        foreach (var state in Geography.States)
        {
            var parent = await Add(BusinessCatalogItemType.State, state.Name, country);
            foreach (var city in state.Cities)
                await Add(BusinessCatalogItemType.City, city.Name, parent);
        }
        // Los motivos ya no se siembran: se crean al vuelo desde Incidencias y desde Cobertura, que
        // es donde se necesitan. Sembrar once motivos que casi nadie usa obligaba a revisarlos y
        // desactivar los que sobraban antes de poder confiar en el catalogo.
        //
        // Puestos, habilidades y zonas tampoco: los dos primeros se crean al vuelo desde Personal, y
        // el catalogo de zonas se retiro por completo.
        //
        // Lo unico que sigue viniendo cargado es la geografia, porque no se captura: se elige. Sale
        // de esta clase en su propia tanda, a una tabla compartida entre organizaciones.

        async Task<Guid> Add(BusinessCatalogItemType type, string name, Guid? parent)
        {
            var item = BusinessCatalogItem.Create(organization,
                new(type, name, null, IdParentCatalogItem: parent), actor.ActorId, actor.ActorName, clock.UtcNow);
            await repository.AddCatalogItemAsync(item, token);
            return item.IdBusinessCatalogItem;
        }
    }

    private static string ReadGeography()
    {
        using var stream = typeof(OrganizationCatalogDefaults).Assembly.GetManifestResourceStream("GestIA.MexicoGeography.20260903")
            ?? throw new InvalidOperationException("Missing bundled geography catalog.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}

public sealed record MexicoGeography(string Source, string RetrievedAt, MexicoState[] States);
public sealed record MexicoState(string Code, string Name, MexicoCity[] Cities);
public sealed record MexicoCity(string Code, string Name);
