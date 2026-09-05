using GestIA.Application.Catalogs;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GestIA.Infrastructure.Persistence.DemoData;

/// <summary>
/// Siembra una organización demo con volumen suficiente para que las pantallas y las
/// consultas se comporten como en operación real.
///
/// Reglas de esta pieza:
/// <list type="bullet">
/// <item>Sólo corre si <c>DemoData__Enabled=true</c>. Nunca automáticamente.</item>
/// <item>Es idempotente: cada fase comprueba si ya existe antes de escribir, así que una
/// corrida interrumpida se puede reanudar sin duplicar.</item>
/// <item>No toca la ruta de alta de organizaciones reales. Reutiliza
/// <see cref="OrganizationCatalogDefaults"/> tal cual está para la geografía, y agrega
/// puestos y reglas de elegibilidad SÓLO a la organización demo.</item>
/// <item>No requiere ningún cambio de esquema: escribe filas sobre las tablas que ya
/// materializaron las 19 migraciones existentes.</item>
/// </list>
/// </summary>
/// <remarks>
/// <b>Por qué el sembrador apaga también el filtro de organización.</b> Corre al arrancar la
/// aplicación, fuera de cualquier petición, así que no hay guard que haya fijado una
/// organización autorizada y el filtro global no encontraría ninguna fila. Sus lecturas de
/// verificación —las que lo hacen idempotente— devolverían vacío y volvería a sembrar todo en
/// cada arranque.
///
/// No cruza organizaciones: trabaja con la única que él mismo crea. Está en la lista blanca de
/// <c>OrganizationFilterBypassTests</c>, que es lo que impide que el bypass se extienda en
/// silencio a otros archivos.
/// </remarks>
public sealed partial class DemoDataSeeder(
    GestIaDbContext dbContext,
    OrganizationCatalogDefaults catalogDefaults,
    IOptions<DemoDataOptions> options,
    ILogger<DemoDataSeeder> logger)
{
    /// <summary>Actor sintético. Distinto del bootstrap para poder filtrar auditoría demo.</summary>
    private static readonly Guid DemoActorId = Guid.Parse("00000000-0000-0000-0000-0000000000de");

    private const string DemoActorName = "GestIA Demo Seed";

    private readonly DemoDataOptions options = options.Value;

    private DateOnly Today => this.options.ReferenceDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

    private DateTime OccurredAt => Today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

    private Random Rng { get; set; } = new(20260904);

    public async Task<DemoSeedReport> SeedAsync(CancellationToken cancellationToken)
    {
        if (!this.options.Enabled)
        {
            DemoSeedLog.Disabled(logger);
            return DemoSeedReport.Skipped;
        }

        Rng = new Random(this.options.RandomSeed);
        var report = new DemoSeedReport();

        var organization = await EnsureOrganizationAsync(cancellationToken);
        report.IdOrganization = organization.IdOrganization;

        await EnsureCatalogsAsync(organization, report, cancellationToken);
        await EnsureEligibilityAsync(organization, report, cancellationToken);
        await EnsureClientsAsync(organization, report, cancellationToken);
        await EnsureServicesAsync(organization, report, cancellationToken);
        await EnsurePositionsAndPatternsAsync(organization, report, cancellationToken);
        await EnsureEmployeesAsync(organization, report, cancellationToken);
        await EnsureAssignmentsAsync(organization, report, cancellationToken);
        await EnsureSchedulesAsync(organization, report, cancellationToken);
        await EnsureOperationsAsync(organization, report, cancellationToken);
        await EnsureRequestsAsync(organization, report, cancellationToken);
        await EnsureBusinessDocumentsAsync(organization, report, cancellationToken);

        var summary = report.ToString();
        DemoSeedLog.Completed(logger, this.options.CodeOrganization, summary);

        return report;
    }

    private async Task<Organization> EnsureOrganizationAsync(CancellationToken cancellationToken)
    {
        var code = this.options.CodeOrganization.ToUpperInvariant();
        var existing = await dbContext.Organizations
            .IgnoreQueryFilters(["Active", "Organization"])
            .SingleOrDefaultAsync(item => item.CodeOrganization == code, cancellationToken);

        if (existing is not null)
        {
            return existing;
        }

        var organization = Organization.Create(
            code,
            this.options.LegalName,
            this.options.Rfc,
            DemoActorId,
            DemoActorName,
            OccurredAt);

        await dbContext.Organizations.AddAsync(organization, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        DemoSeedLog.OrganizationCreated(logger, code);
        return organization;
    }

    /// <summary>
    /// Reimporta la geografía versionada y los motivos operativos usando exactamente la misma
    /// pieza que usa el alta real, y encima agrega puestos y habilidades, que el alta real
    /// deliberadamente no inventa.
    /// </summary>
    private async Task EnsureCatalogsAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var hasGeography = await dbContext.BusinessCatalogItems
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(
                item => item.IdOrganization == organization.IdOrganization &&
                    item.Type == BusinessCatalogItemType.State,
                cancellationToken);

        if (!hasGeography)
        {
            await catalogDefaults.StageAsync(organization.IdOrganization, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var hasJobPositions = await dbContext.BusinessCatalogItems
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(
                item => item.IdOrganization == organization.IdOrganization &&
                    item.Type == BusinessCatalogItemType.JobPosition,
                cancellationToken);

        if (!hasJobPositions)
        {
            foreach (var (code, name) in DemoCatalog.JobPositions)
            {
                await AddCatalogItemAsync(organization, BusinessCatalogItemType.JobPosition, code, name, cancellationToken);
            }

            foreach (var (code, name) in DemoCatalog.Skills)
            {
                await AddCatalogItemAsync(organization, BusinessCatalogItemType.Skill, code, name, cancellationToken);
            }

            foreach (var (code, name) in DemoCatalog.Zones)
            {
                await AddCatalogItemAsync(organization, BusinessCatalogItemType.Zone, code, name, cancellationToken);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.CatalogItems = await dbContext.BusinessCatalogItems
            .IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
    }

    private async Task AddCatalogItemAsync(
        Organization organization,
        BusinessCatalogItemType type,
        string code,
        string name,
        CancellationToken cancellationToken)
    {
        var item = BusinessCatalogItem.Create(
            organization.IdOrganization,
            new BusinessCatalogItemProfile(type, code, name, null),
            DemoActorId,
            DemoActorName,
            OccurredAt);
        await dbContext.BusinessCatalogItems.AddAsync(item, cancellationToken);
    }

    /// <summary>
    /// Reglas de elegibilidad de la organización demo. El alta real no las inventa; aquí sí,
    /// porque sin ellas la validación de asignaciones no tiene nada que evaluar.
    /// </summary>
    private async Task EnsureEligibilityAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.EligibilityRequirements
            .IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);

        if (existing == 0)
        {
            foreach (var rule in DemoCatalog.EligibilityRules)
            {
                var requirement = EligibilityRequirement.Create(
                    organization.IdOrganization,
                    new EligibilityRequirementProfile(
                        EligibilityRequirementTargetType.Organization,
                        null,
                        null,
                        null,
                        rule.RequirementType,
                        rule.RequiredCode,
                        rule.Name,
                        rule.Description,
                        rule.IsBlocking),
                    DemoActorId,
                    DemoActorName,
                    OccurredAt);
                await dbContext.EligibilityRequirements.AddAsync(requirement, cancellationToken);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.EligibilityRules = await dbContext.EligibilityRequirements
            .IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
    }

    private DateOnly Days(int offset) => Today.AddDays(offset);

    private DateOnly Months(int offset) => Today.AddMonths(offset);

    private T Pick<T>(IReadOnlyList<T> source) => source[Rng.Next(source.Count)];
}

/// <summary>Resumen de lo sembrado, para reportarlo sin volver a consultar la base.</summary>
public sealed class DemoSeedReport
{
    public static DemoSeedReport Skipped { get; } = new() { WasSkipped = true };

    public bool WasSkipped { get; init; }
    public Guid IdOrganization { get; set; }
    public int CatalogItems { get; set; }
    public int EligibilityRules { get; set; }
    public int Clients { get; set; }
    public int ClientSites { get; set; }
    public int ClientContacts { get; set; }
    public int ServiceContracts { get; set; }
    public int Services { get; set; }
    public int ServiceConfigurations { get; set; }
    public int Positions { get; set; }
    public int ShiftPatterns { get; set; }
    public int ShiftSegments { get; set; }
    public int Employees { get; set; }
    public int EmployeeDocuments { get; set; }
    public int EmployeeEvaluations { get; set; }
    public int EmployeeSkills { get; set; }
    public int Assignments { get; set; }
    public int ScheduleVersions { get; set; }
    public int ScheduledShifts { get; set; }
    public int AttendanceRecords { get; set; }
    public int Incidents { get; set; }
    public int CoverageRecords { get; set; }
    public int OperationalRequests { get; set; }
    public int BusinessDocuments { get; set; }

    public override string ToString() =>
        $"clientes={Clients} sedes={ClientSites} contactos={ClientContacts} contratos={ServiceContracts} " +
        $"servicios={Services} configuraciones={ServiceConfigurations} posiciones={Positions} " +
        $"patrones={ShiftPatterns} segmentos={ShiftSegments} empleados={Employees} " +
        $"documentosEmpleado={EmployeeDocuments} evaluaciones={EmployeeEvaluations} habilidades={EmployeeSkills} " +
        $"asignaciones={Assignments} versiones={ScheduleVersions} turnos={ScheduledShifts} " +
        $"asistencia={AttendanceRecords} incidencias={Incidents} coberturas={CoverageRecords} " +
        $"solicitudes={OperationalRequests} documentos={BusinessDocuments} catalogos={CatalogItems} " +
        $"reglas={EligibilityRules}";
}

internal static partial class DemoSeedLog
{
    [LoggerMessage(
        EventId = 4001,
        Level = LogLevel.Information,
        Message = "Demo data seeding is disabled. Set DemoData__Enabled=true to run it.")]
    public static partial void Disabled(ILogger logger);

    [LoggerMessage(
        EventId = 4002,
        Level = LogLevel.Warning,
        Message = "Demo organization {CodeOrganization} was created. This data is synthetic and must never reach production.")]
    public static partial void OrganizationCreated(ILogger logger, string codeOrganization);

    [LoggerMessage(
        EventId = 4003,
        Level = LogLevel.Information,
        Message = "Demo data seeding completed for {CodeOrganization}: {Summary}")]
    public static partial void Completed(ILogger logger, string codeOrganization, string summary);

    [LoggerMessage(
        EventId = 4004,
        Level = LogLevel.Information,
        Message = "Demo phase {Phase} already present, skipped.")]
    public static partial void PhaseSkipped(ILogger logger, string phase);
}
