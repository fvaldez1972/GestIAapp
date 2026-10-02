using GestIA.Application.Common;
using GestIA.Domain.Catalogs;

namespace GestIA.Application.Catalogs;

public sealed class OrganizationCatalogDefaults(ICatalogRepository repository, IActorContext actor, IClock clock)
{
    /// <summary>
    /// El catálogo del INEGI empaquetado con la aplicación.
    ///
    /// <para><b>Ya no se usa para sembrar nada, y aun así se queda.</b> La migración
    /// <c>20260903214645_CoverageCatalogReference</c> lo lee, y una migración ya desplegada no se
    /// reescribe. Los mismos datos viven hoy en las tablas compartidas, sembrados por
    /// <c>20260922131723_SharedGeographyTables</c>.</para>
    /// </summary>
    public static string GeographyJson { get; } = ReadGeography();

    // Stage defaults in the same unit of work as the organization and its initial admin.
    public async Task StageAsync(Guid organization, CancellationToken token)
    {
        await Add(BusinessCatalogItemType.Nationality, "Mexicana", null);
        // Los motivos ya no se siembran: se crean al vuelo desde Incidencias y desde Cobertura, que
        // es donde se necesitan. Sembrar once motivos que casi nadie usa obligaba a revisarlos y
        // desactivar los que sobraban antes de poder confiar en el catalogo.
        //
        // Puestos, experiencia y zonas tampoco: los dos primeros se crean al vuelo desde Personal, y
        // el catalogo de zonas se retiro por completo.
        //
        // La geografia salio de aqui el 22 de septiembre de 2026. Eran 2 511 filas por organizacion
        // -un pais, 32 estados y 2 478 municipios- de unos datos que son los mismos para todas, asi
        // que el alta de una organizacion escribia dos mil quinientas filas antes de que nadie
        // capturara nada. Ahora vive en las tablas compartidas y no se siembra por empresa.
        //
        // Y desde el 19 de septiembre de 2026, tambien las categorias de documento, las de
        // evaluacion y los propositos de contacto. Esas tres eran listas fijas del sistema que toda
        // organizacion tenia desde el primer minuto; al volverse editables habria que sembrarlas o
        // una organizacion nueva no podria registrar ni un documento. Se conserva lo que ya habia;
        // lo nuevo es que se pueden cambiar.
        // Los grupos primero, porque las categorias de documento cuelgan de ellos. Sin este orden
        // la categoria no tendria a que apuntar y naceria suelta, que es valido pero deja a una
        // organizacion nueva con un catalogo distinto del de las que ya existian.
        var grupos = new Dictionary<string, Guid>(StringComparer.Ordinal);

        foreach (var grupo in EligibilityCatalogSeed.DocumentGroups)
        {
            var item = BusinessCatalogItem.Create(organization,
                new(BusinessCatalogItemType.EmployeeDocumentGroup, grupo.Name, null, grupo.Order),
                actor.ActorId, actor.ActorName, clock.UtcNow);
            grupos[grupo.Name] = item.IdBusinessCatalogItem;
            await repository.AddCatalogItemAsync(item, token);
        }

        foreach (var value in EligibilityCatalogSeed.All)
        {
            var padre = value.Group is not null && grupos.TryGetValue(value.Group, out var idGrupo)
                ? idGrupo
                : (Guid?)null;

            var item = BusinessCatalogItem.Create(organization,
                new(value.Type, value.Name, null, value.Order, padre),
                actor.ActorId, actor.ActorName, clock.UtcNow);
            await repository.AddCatalogItemAsync(item, token);
        }

        // Y los cinco catalogos de perfil, por la misma razon y con un motivo mas concreto: sexo,
        // rango de edad, escolaridad, equipo requerido y motivos de incidencia se construyeron
        // vacios, y un selector vacio no deja capturar el perfil que despues hay que comparar.
        foreach (var value in ProfileCatalogSeed.All)
        {
            var item = BusinessCatalogItem.Create(organization,
                new(value.Type, value.Name, null, value.Order, null, value.IsRequired),
                actor.ActorId, actor.ActorName, clock.UtcNow);
            await repository.AddCatalogItemAsync(item, token);
        }

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
