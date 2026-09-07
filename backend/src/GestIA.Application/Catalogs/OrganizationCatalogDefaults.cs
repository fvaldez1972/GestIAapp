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
        var country = await Add(BusinessCatalogItemType.Country, "MX", "México", null);
        await Add(BusinessCatalogItemType.Nationality, "NAT-MX", "Mexicana", null);
        foreach (var state in Geography.States)
        {
            var parent = await Add(BusinessCatalogItemType.State, $"MX-{state.Code}", state.Name, country);
            foreach (var city in state.Cities)
                await Add(BusinessCatalogItemType.City, $"MX-{city.Code}", city.Name, parent);
        }
        foreach (var (code, name) in IncidentReasons)
            await Add(BusinessCatalogItemType.IncidentReason, code, name, null);
        foreach (var (code, name) in CoverageReasons)
            await Add(BusinessCatalogItemType.CoverageReason, code, name, null);

        async Task<Guid> Add(BusinessCatalogItemType type, string code, string name, Guid? parent)
        {
            var item = BusinessCatalogItem.Create(organization,
                new(type, code, name, null, IdParentCatalogItem: parent), actor.ActorId, actor.ActorName, clock.UtcNow);
            await repository.AddCatalogItemAsync(item, token);
            return item.IdBusinessCatalogItem;
        }
    }

    public static readonly (string Code, string Name)[] IncidentReasons =
        [("RETARDO", "Retardo"), ("AUSENCIA", "Ausencia"), ("UNIFORME", "Incumplimiento de uniforme"),
         ("OPERATIVA", "Incidente operativo"), ("OTRO_AUTORIZADO", "Otro autorizado")];
    public static readonly (string Code, string Name)[] CoverageReasons =
        [("INCIDENCIA", "Incidencia del empleado"), ("FALTA", "Falta del empleado"),
         ("RETARDO", "Retardo fuera de tolerancia"), ("CLIENTE", "Solicitud del cliente"),
         ("REFUERZO", "Refuerzo operativo"), ("OTRO", "Otro motivo documentado")];

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
