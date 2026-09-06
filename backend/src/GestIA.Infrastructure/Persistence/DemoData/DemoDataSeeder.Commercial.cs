using System.Globalization;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.DemoData;

/// <summary>
/// Fase comercial del sembrado: clientes, sedes, contactos, contratos, servicios,
/// configuraciones históricas, posiciones, patrones de turno y segmentos.
/// </summary>
public sealed partial class DemoDataSeeder
{
    private async Task EnsureClientsAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.Clients
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "clients");
        }
        else
        {
            foreach (var definition in DemoCatalog.Clients)
            {
                var client = Client.Create(
                    organization.IdOrganization,
                    definition.Code,
                    new ClientProfile(
                        definition.LegalName,
                        definition.TradeName,
                        definition.Rfc,
                        "Mexicana",
                        definition.TaxActivity,
                        $"{Pick(DemoCatalog.Streets)} {Rng.Next(10, 999)}, {Pick(DemoCatalog.Municipalities).Municipality}",
                        Days(-Rng.Next(900, 3000)),
                        $"FOLIO-{Rng.Next(10000, 99999)}",
                        $"REG-{Rng.Next(100000, 999999)}",
                        Days(-Rng.Next(1200, 4000)),
                        $"ESC-{Rng.Next(1000, 9999)}",
                        $"INS-{Rng.Next(1000, 9999)}"),
                    DemoActorId,
                    DemoActorName,
                    OccurredAt);
                await dbContext.Clients.AddAsync(client, cancellationToken);

                await AddSitesAsync(client, definition, cancellationToken);
                await AddContactsAsync(client, definition, cancellationToken);
                await AddContractsAsync(client, definition, cancellationToken);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.Clients = await dbContext.Clients.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
        report.ClientSites = await dbContext.ClientSites.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.Client.IdOrganization == organization.IdOrganization, cancellationToken);
        report.ClientContacts = await dbContext.ClientContacts.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.Client.IdOrganization == organization.IdOrganization, cancellationToken);
        report.ServiceContracts = await dbContext.ServiceContracts.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
    }

    private async Task AddSitesAsync(
        Client client,
        DemoCatalog.DemoClient definition,
        CancellationToken cancellationToken)
    {
        for (var index = 0; index < definition.SiteCount; index++)
        {
            var place = DemoCatalog.Municipalities[(index + definition.Code.Length) % DemoCatalog.Municipalities.Length];
            var site = ClientSite.Create(
                client.IdOrganization,
                client.IdClient,
                $"{definition.Code}-S{index + 1:00}",
                new ClientSiteAddress(
                    DemoCatalog.SiteNames[index % DemoCatalog.SiteNames.Length],
                    Pick(DemoCatalog.Streets),
                    Rng.Next(10, 999).ToString(CultureInfo.InvariantCulture),
                    index % 3 == 0 ? $"Piso {index + 1}" : null,
                    "Centro",
                    place.Municipality,
                    place.State,
                    place.PostalCode,
                    "MX",
                    index % 2 == 0 ? "Acceso por andén de carga, presentarse con identificación oficial." : null,
                    "America/Mexico_City"),
                DemoActorId,
                DemoActorName,
                OccurredAt);
            await dbContext.ClientSites.AddAsync(site, cancellationToken);
        }
    }

    private async Task AddContactsAsync(
        Client client,
        DemoCatalog.DemoClient definition,
        CancellationToken cancellationToken)
    {
        for (var index = 0; index < definition.ContactCount; index++)
        {
            var fullName = $"{Pick(DemoCatalog.ContactFirstNames)} {Pick(DemoCatalog.ContactLastNames)} {Pick(DemoCatalog.ContactLastNames)}";
            var contact = ClientContact.Create(
                client.IdOrganization,
                client.IdClient,
                null,
                new ClientContactDetails(
                    DemoCatalog.ContactPurposes[index % DemoCatalog.ContactPurposes.Length],
                    fullName,
                    Pick(DemoCatalog.JobPositions).Name,
                    $"contacto{index + 1}.{definition.Code.ToLowerInvariant()}@ejemplo.mx",
                    $"55{Rng.Next(10000000, 99999999)}",
                    index % 2 == 0 ? $"55{Rng.Next(10000000, 99999999)}" : null,
                    index == 0),
                DemoActorId,
                DemoActorName,
                OccurredAt);
            await dbContext.ClientContacts.AddAsync(contact, cancellationToken);
        }
    }

    private async Task AddContractsAsync(
        Client client,
        DemoCatalog.DemoClient definition,
        CancellationToken cancellationToken)
    {
        for (var index = 0; index < definition.ContractStatuses.Length; index++)
        {
            var status = definition.ContractStatuses[index];
            var from = Months(-12 - (index * 12));
            DateOnly? to = status switch
            {
                ServiceContractStatus.Expired => Months(-2),
                ServiceContractStatus.Terminated => Months(-1),
                ServiceContractStatus.Draft => null,
                _ => Months(12)
            };

            var contract = ServiceContract.Create(
                client.IdOrganization,
                client.IdClient,
                $"{definition.Code}-CTR-{index + 1:00}",
                new ServiceContractTerms(
                    status,
                    status is ServiceContractStatus.Draft or ServiceContractStatus.UnderReview ? null : from,
                    from,
                    to,
                    (short)(index % 2 == 0 ? 30 : 45),
                    (short)(index % 2 == 0 ? 30 : 60),
                    "MXN",
                    $"contratos/{definition.Code.ToLowerInvariant()}-{index + 1:00}.pdf",
                    status == ServiceContractStatus.Terminated
                        ? "Terminado anticipadamente a solicitud del cliente."
                        : null),
                DemoActorId,
                DemoActorName,
                OccurredAt);
            await dbContext.ServiceContracts.AddAsync(contract, cancellationToken);
        }
    }

    private async Task EnsureServicesAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.Services
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "services");
        }
        else
        {
            var clients = await dbContext.Clients
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeClient)
                .ToListAsync(cancellationToken);

            // Tres servicios reciben varias vigencias históricas; el resto una sola.
            var multiVersionCodes = new HashSet<string>(StringComparer.Ordinal)
            {
                "CLI-01-SRV-01",
                "CLI-01-SRV-03",
                "CLI-02-SRV-02"
            };

            foreach (var client in clients)
            {
                var definition = DemoCatalog.Clients.Single(item => item.Code == client.CodeClient);
                var sites = await dbContext.ClientSites
                    .IgnoreQueryFilters(["Active", "Organization"])
                    .Where(item => item.IdClient == client.IdClient)
                    .OrderBy(item => item.CodeClientSite)
                    .ToListAsync(cancellationToken);
                var contracts = await dbContext.ServiceContracts
                    .IgnoreQueryFilters(["Active", "Organization"])
                    .Where(item => item.IdClient == client.IdClient)
                    .OrderBy(item => item.CodeServiceContract)
                    .ToListAsync(cancellationToken);

                for (var index = 0; index < definition.ServiceCount; index++)
                {
                    var codeService = $"{definition.Code}-SRV-{index + 1:00}";
                    var site = sites[index % sites.Count];

                    // Un servicio a propósito sin contrato ligado, para que la ficha muestre el hueco.
                    var contract = index == definition.ServiceCount - 1 && contracts.Count > 0 && index % 3 == 2
                        ? null
                        : contracts.Count > 0 ? contracts[index % contracts.Count] : null;

                    var service = Service.Create(
                        client.IdOrganization,
                        client.IdClient,
                        site.IdClientSite,
                        contract?.IdServiceContract,
                        codeService,
                        new ServiceProfile(
                            DemoCatalog.ServiceNames[index % DemoCatalog.ServiceNames.Length],
                            $"Servicio operado para {client.TradeName} en {site.Name}. " +
                            "Cobertura conforme a la configuración vigente y a las instrucciones del sitio.",
                            $"{definition.TradeName} - {DemoCatalog.ServiceNames[index % DemoCatalog.ServiceNames.Length]}",
                            Months(-Rng.Next(6, 30)),
                            // Dos servicios cerrados: uno vencido hace un mes y otro que
                            // termina la semana entrante, para que la vigencia se note.
                            codeService is "CLI-03-SRV-03" ? Months(-1)
                                : codeService is "CLI-05-SRV-02" ? Days(7)
                                : null),
                        DemoActorId,
                        DemoActorName,
                        OccurredAt);
                    await dbContext.Services.AddAsync(service, cancellationToken);

                    var versions = multiVersionCodes.Contains(codeService) ? Rng.Next(2, 4) : 1;
                    await AddConfigurationsAsync(service, versions, cancellationToken);
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.Services = await dbContext.Services.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
        report.ServiceConfigurations = await dbContext.ServiceConfigurations.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
    }

    /// <summary>
    /// Crea vigencias encadenadas: cada versión cierra el día anterior al inicio de la siguiente
    /// y sólo la última queda abierta.
    /// </summary>
    private async Task AddConfigurationsAsync(
        Service service,
        int versions,
        CancellationToken cancellationToken)
    {
        for (var version = 0; version < versions; version++)
        {
            var from = Months(-(versions - version) * 6);
            DateOnly? to = version == versions - 1 ? null : Months(-(versions - version - 1) * 6).AddDays(-1);
            var workers = (short)Rng.Next(1, 9);
            var hoursPerDay = 8m + (version * 2);
            var daysPerWeek = (byte)Rng.Next(5, 8);

            var configuration = ServiceConfiguration.Create(
                service.IdOrganization,
                service.IdService,
                new ServiceConfigurationProfile(
                    from,
                    to,
                    workers,
                    hoursPerDay,
                    daysPerWeek,
                    Math.Round(hoursPerDay * daysPerWeek * 4.33m, 2),
                    (short)Rng.Next(3, 21),
                    $"Cobertura de {hoursPerDay:0.#} horas diarias, {daysPerWeek} días por semana.",
                    version == 0
                        ? "Vigencia inicial del servicio."
                        : "Ajuste de cobertura acordado con el cliente; conserva el histórico anterior.",
                    Math.Round(workers * hoursPerDay * daysPerWeek * 4.33m * 95m, 4),
                    "MXN",
                    version % 2 == 0),
                DemoActorId,
                DemoActorName,
                OccurredAt);
            await dbContext.ServiceConfigurations.AddAsync(configuration, cancellationToken);
        }
    }

    private async Task EnsurePositionsAndPatternsAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.Positions
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "positions");
        }
        else
        {
            var services = await dbContext.Services
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeService)
                .ToListAsync(cancellationToken);

            var jobPositions = await JobPositionCatalogAsync(organization, cancellationToken);

            var serviceIndex = 0;
            foreach (var service in services)
            {
                // Un servicio queda deliberadamente sin posiciones para probar el estado vacío.
                var positionCount = serviceIndex == services.Count - 1 ? 0 : Rng.Next(1, 3);

                for (var index = 0; index < positionCount; index++)
                {
                    var job = DemoCatalog.JobPositions[(serviceIndex + index) % DemoCatalog.JobPositions.Length];
                    var position = Position.Create(
                        service.IdOrganization,
                        service.IdService,
                        $"{service.CodeService}-P{index + 1:00}",
                        new PositionProfile(
                            job.Name,
                            Rng.Next(1, 5),
                            job.Name,
                            index == 0 ? "Posición principal del sitio." : "Posición de apoyo en horario pico.",
                            // Mismo motivo que en el empleado: la comparación es por identificador.
                            ResolveJobPosition(jobPositions, job.Name)),
                        DemoActorId,
                        DemoActorName,
                        OccurredAt);
                    await dbContext.Positions.AddAsync(position, cancellationToken);

                    await AddShiftPatternAsync(position, index, cancellationToken);
                }

                serviceIndex++;
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.Positions = await dbContext.Positions.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
        report.ShiftPatterns = await dbContext.ShiftPatterns.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
        report.ShiftSegments = await dbContext.ShiftSegments.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(
                item => item.IdOrganization == organization.IdOrganization,
                cancellationToken);
    }

    private async Task AddShiftPatternAsync(
        Position position,
        int positionIndex,
        CancellationToken cancellationToken)
    {
        var isNightPattern = positionIndex % 2 == 1;
        var pattern = ShiftPattern.Create(
            position.IdOrganization,
            position.IdPosition,
            $"{position.CodePosition}-PAT01",
            new ShiftPatternProfile(
                isNightPattern ? "Rol nocturno 12x12" : "Rol diurno lunes a sábado",
                isNightPattern
                    ? "Turno que cruza la medianoche; el segmento se marca como nocturno."
                    : "Turno diurno estándar.",
                Months(-6),
                null),
            DemoActorId,
            DemoActorName,
            OccurredAt);
        await dbContext.ShiftPatterns.AddAsync(pattern, cancellationToken);

        var days = isNightPattern
            ? new[] { DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday, DayOfWeek.Sunday }
            : [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday];

        foreach (var day in days)
        {
            var segment = ShiftSegment.Create(
                pattern.IdOrganization,
                pattern.IdShiftPattern,
                new ShiftSegmentProfile(
                    day,
                    isNightPattern ? new TimeOnly(20, 0) : new TimeOnly(7, 0),
                    isNightPattern ? new TimeOnly(8, 0) : new TimeOnly(19, 0),
                    isNightPattern,
                    Rng.Next(1, 3),
                    isNightPattern ? "Cruza medianoche." : null),
                DemoActorId,
                DemoActorName,
                OccurredAt);
            await dbContext.ShiftSegments.AddAsync(segment, cancellationToken);
        }
    }
}
