using GestIA.Domain.Catalogs;
using GestIA.Domain.Clients;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.DemoData;

/// <summary>
/// Los casos feos: los datos que rompen una pantalla mal hecha.
///
/// <para>Una demo con datos parejos —todos los nombres de largo medio, todos los clientes con
/// sede y contrato, todo activo— hace que una tabla se vea bien y se rompa el primer día en
/// producción. Estos registros existen para que se rompa antes, aquí.</para>
///
/// <para><b>Es incremental.</b> Se agrega sobre la demo que ya existe en vez de resembrar desde
/// cero, para no perder los datos de bitácora ya escritos, que son historial real y no se pueden
/// inventar de nuevo. Como el resto del sembrador, es idempotente: se reconoce por el prefijo
/// <c>FEO-</c> y si ya está, no hace nada.</para>
///
/// <para>Los nombres largos van <b>exactamente al límite de la columna</b>, no por encima: el
/// caso interesante es el que la base acepta y la pantalla no, no el que ni siquiera se
/// guarda.</para>
/// </summary>
public sealed partial class DemoDataSeeder
{
    private const string HardCasePrefix = "FEO";

    /// <summary>Largo máximo de <c>Client.LegalName</c> y <c>Client.TradeName</c>.</summary>
    private const int ClientNameMaxLength = 200;

    private async Task EnsureHardCasesAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(organization);
        ArgumentNullException.ThrowIfNull(report);

        var already = await dbContext.Clients
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(
                item => item.IdOrganization == organization.IdOrganization &&
                        item.CodeClient.StartsWith(HardCasePrefix),
                cancellationToken);

        if (already)
        {
            DemoSeedLog.PhaseSkipped(logger, "hard-cases");
            return;
        }

        var organizationId = organization.IdOrganization;

        // 1. Nombre exactamente en el límite de la columna, y nombre de una sola letra.
        var longName = BuildLongName();
        var longNamed = Client.Create(organizationId, $"{HardCasePrefix}-LARGO", longName, "LAR010101AA1", DemoActorId, DemoActorName, OccurredAt);
        var shortNamed = Client.Create(organizationId, $"{HardCasePrefix}-1", "Ñ", "UNO010101AA1", DemoActorId, DemoActorName, OccurredAt);

        // 2. Acentos y eñes en razón social, nombre comercial, código de sede y calle.
        var accented = Client.Create(organizationId, $"{HardCasePrefix}-ACENTO", "Señalización Ñandú, S.A. de C.V.", "ACE010101AA1", DemoActorId, DemoActorName, OccurredAt);
        accented.UpdateProfile(
            new ClientProfile(
                "Señalización Ñandú, S.A. de C.V.", "Señalización Ñandú", "ACE010101AA1",
                "Mexicana", null, "Calle Ñuño de Guzmán 14, Coyoacán", null, null, null, null, null, null),
            DemoActorId, DemoActorName, OccurredAt);

        // 3. Cliente sin sede: no se le puede dar de alta un servicio, y la pantalla tiene que
        //    decirlo en vez de ofrecer un selector vacío.
        var withoutSite = Client.Create(organizationId, $"{HardCasePrefix}-SINSEDE", "Cliente sin sede", "SIN010101AA1", DemoActorId, DemoActorName, OccurredAt);

        // 4. Cliente con un solo servicio, y cliente con doce: paginación real.
        var one = Client.Create(organizationId, $"{HardCasePrefix}-UNO", "Cliente de un servicio", "ONE010101AA1", DemoActorId, DemoActorName, OccurredAt);
        var twelve = Client.Create(organizationId, $"{HardCasePrefix}-DOCE", "Cliente de doce servicios", "TWE010101AA1", DemoActorId, DemoActorName, OccurredAt);

        var clients = new[] { longNamed, shortNamed, accented, withoutSite, one, twelve };
        dbContext.AddRange(clients);

        // Sedes, salvo la del cliente que deliberadamente no tiene.
        var sites = new Dictionary<Guid, ClientSite>();
        foreach (var client in clients.Where(item => item.IdClient != withoutSite.IdClient))
        {
            var site = ClientSite.Create(
                organizationId, client.IdClient, $"{client.CodeClient}-S01",
                new ClientSiteAddress(
                    "Sede Ñoño Peñón", "Avenida Álvaro Obregón", "48", null, "Roma Norte",
                    "Ciudad de México", "Ciudad de México", "06700", "MX", null, "America/Mexico_City"),
                DemoActorId, DemoActorName, OccurredAt);

            sites[client.IdClient] = site;
            dbContext.Add(site);
        }

        // 5. Contrato ya vencido: el cliente existe, opera, y no tiene contrato vigente.
        var expiredContract = ServiceContract.Create(
            organizationId, one.IdClient, $"{HardCasePrefix}-UNO-C01",
            new ServiceContractTerms(
                ServiceContractStatus.Expired, Today.AddYears(-2), Today.AddYears(-2), Today.AddDays(-40),
                30, 30, "MXN", null, "Contrato vencido a propósito para la demo."),
            DemoActorId, DemoActorName, OccurredAt);
        dbContext.Add(expiredContract);

        // 6. Servicio sin fecha de término, y 7. servicio con vigencia ya terminada.
        var openEnded = Service.Create(
            organizationId, accented.IdClient, sites[accented.IdClient].IdClientSite, null,
            $"{HardCasePrefix}-ACENTO-SRV-01", "Vigilancia sin término", "Servicio de vigencia abierta",
            Today.AddMonths(-8), DemoActorId, DemoActorName, OccurredAt);

        var finished = Service.Create(
            organizationId, one.IdClient, sites[one.IdClient].IdClientSite, expiredContract.IdServiceContract,
            $"{HardCasePrefix}-UNO-SRV-01", "Vigilancia terminada", "Servicio cuya vigencia ya terminó",
            Today.AddYears(-1), DemoActorId, DemoActorName, OccurredAt);
        finished.UpdateProfile(
            sites[one.IdClient].IdClientSite,
            expiredContract.IdServiceContract,
            new ServiceProfile(
                "Vigilancia terminada", "Servicio cuya vigencia ya terminó", null,
                Today.AddYears(-1), Today.AddDays(-30)),
            DemoActorId, DemoActorName, OccurredAt);

        dbContext.AddRange(openEnded, finished);

        // La configuración del servicio terminado también está vencida, y ése es el caso que de
        // verdad ejercita la regla de la tanda C: corregirla exige motivo. El servicio en sí no
        // lleva bitácora —sólo lo hacen las cinco entidades con historial—, así que sin esta
        // configuración el caso "vigencia terminada" se vería en la pantalla pero no probaría la
        // regla.
        dbContext.Add(ServiceConfiguration.Create(
            organizationId, finished.IdService,
            new ServiceConfigurationProfile(
                Today.AddYears(-1), Today.AddDays(-30), 1, 8m, 6, 208m, 10,
                "Turno diurno de vigencia terminada", null, 18500m, "MXN", true),
            DemoActorId, DemoActorName, OccurredAt));

        // 8. Doce servicios en un solo cliente, para que la paginación tenga qué paginar.
        var many = new List<Service>();
        for (var index = 1; index <= 12; index++)
        {
            many.Add(Service.Create(
                organizationId, twelve.IdClient, sites[twelve.IdClient].IdClientSite, null,
                $"{HardCasePrefix}-DOCE-SRV-{index:00}", $"Servicio número {index}",
                "Uno de doce, para paginar", Today.AddMonths(-6), DemoActorId, DemoActorName, OccurredAt));
        }

        dbContext.AddRange(many);

        // Los dos servicios con nombre y código en el límite necesitan una posición para aparecer
        // con carga en la lista de Servicios.
        var position = Position.Create(
            organizationId, openEnded.IdService, $"{HardCasePrefix}-ACENTO-P01",
            new PositionProfile("Puesto con acentos: Añil", 2, null, null),
            DemoActorId, DemoActorName, OccurredAt);
        dbContext.Add(position);

        // 9. Empleado sin ningún documento, y 10. empleado con un documento vencido.
        var withoutDocuments = Employee.Create(
            organizationId, $"{HardCasePrefix}-E-SINDOC", "Empleado sin documentos", "Guardia de seguridad",
            Today.AddYears(-1), DemoActorId, DemoActorName, OccurredAt);

        var withExpired = Employee.Create(
            organizationId, $"{HardCasePrefix}-E-VENCIDO", "Ñáñez Ibáñez Muñoz", "Guardia de seguridad",
            Today.AddYears(-2), DemoActorId, DemoActorName, OccurredAt);

        dbContext.AddRange(withoutDocuments, withExpired);

        dbContext.Add(EmployeeDocument.Create(
            organizationId, withExpired.IdEmployee,
            new EmployeeDocumentProfile(
                EmployeeDocumentType.VoterId, EmployeeDocumentStatus.Expired, "VENCIDO-01",
                Today.AddYears(-3), Today.AddYears(-3), Today.AddDays(-15),
                $"employee-documents/{HardCasePrefix.ToLowerInvariant()}-vencido.pdf",
                "Documento vencido a propósito para la demo."),
            DemoActorId, DemoActorName, OccurredAt));

        await dbContext.SaveChangesAsync(cancellationToken);

        // 11. Al menos un registro inactivo de cada entidad que la interfaz lista, para que el
        //     filtro de estado tenga algo que mostrar y no se vea siempre igual.
        await DeactivateOneOfEachAsync(organizationId, longNamed, sites, many, cancellationToken);

        report.HardCaseClients = clients.Length;
        report.HardCaseServices = many.Count + 2;
        DemoSeedLog.HardCasesCreated(logger, clients.Length, many.Count + 2);
    }

    private async Task DeactivateOneOfEachAsync(
        Guid organizationId,
        Client client,
        Dictionary<Guid, ClientSite> sites,
        IReadOnlyList<Service> services,
        CancellationToken cancellationToken)
    {
        // Una sede inactiva del cliente de nombre largo.
        sites[client.IdClient].Deactivate(DemoActorId, DemoActorName, OccurredAt);

        // El último de los doce servicios, para que la paginación muestre uno dado de baja.
        services[^1].Deactivate(DemoActorId, DemoActorName, OccurredAt);

        var contact = ClientContact.Create(
            organizationId, client.IdClient, null,
            new ClientContactDetails(
                ClientContactPurpose.Operational, "Contacto dado de baja", "Coordinador operativo",
                null, null, null, false),
            DemoActorId, DemoActorName, OccurredAt);
        contact.Deactivate(DemoActorId, DemoActorName, OccurredAt);
        dbContext.Add(contact);

        var employee = Employee.Create(
            organizationId, $"{HardCasePrefix}-E-INACTIVO", "Empleado dado de baja", "Guardia de seguridad",
            Today.AddYears(-3), DemoActorId, DemoActorName, OccurredAt);
        employee.Deactivate(DemoActorId, DemoActorName, OccurredAt);
        dbContext.Add(employee);

        var catalogItem = BusinessCatalogItem.Create(
            organizationId,
            new BusinessCatalogItemProfile(BusinessCatalogItemType.Zone, $"{HardCasePrefix}-ZONA", "Zona dada de baja", null),
            DemoActorId, DemoActorName, OccurredAt);
        catalogItem.Deactivate(DemoActorId, DemoActorName, OccurredAt);
        dbContext.Add(catalogItem);

        var inactiveClient = Client.Create(
            organizationId, $"{HardCasePrefix}-INACTIVO", "Cliente dado de baja", "INA010101AA1",
            DemoActorId, DemoActorName, OccurredAt);
        inactiveClient.Deactivate(DemoActorId, DemoActorName, OccurredAt);
        dbContext.Add(inactiveClient);

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Un nombre de exactamente <see cref="ClientNameMaxLength"/> caracteres, con acentos, para
    /// que además de largo sea difícil de truncar bien.
    /// </summary>
    private static string BuildLongName()
    {
        const string seed = "Corporación Iberoamericana de Señalización, Vigilancia y Custodia Especializada del Bajío ";
        var name = string.Concat(Enumerable.Repeat(seed, 4))[..ClientNameMaxLength];
        return name.TrimEnd() + new string('o', ClientNameMaxLength - name.TrimEnd().Length);
    }
}
