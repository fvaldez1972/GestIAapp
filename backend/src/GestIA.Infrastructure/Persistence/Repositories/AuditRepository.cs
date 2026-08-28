using GestIA.Application.Audit;
using GestIA.Application.Common;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class AuditRepository(GestIaDbContext dbContext) : IAuditRepository
{
    private static readonly string[] EntityNames =
    [
        "Organizaciones",
        "Clientes",
        "Sedes",
        "Contactos",
        "Contratos",
        "Servicios",
        "Configuraciones",
        "Personal",
        "Documentos",
        "Evaluaciones",
        "Posiciones",
        "Patrones",
        "Segmentos",
        "Versiones",
        "Turnos",
        "Asistencia",
        "Incidencias",
        "Coberturas",
        "Evidencias",
        "Solicitudes"
    ];

    public async Task<AuditResult> SearchAsync(AuditQuery query, CancellationToken cancellationToken)
    {
        var rows = new List<AuditRow>();
        var entity = Normalize(query.Entity);

        if (Matches(entity, "Organizaciones"))
        {
            AddRows(rows, await dbContext.Organizations
                .IgnoreQueryFilters()
                .Where(item => item.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Organizaciones",
                    item.LegalName,
                    item.IdOrganization,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.CodeOrganization))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Clientes"))
        {
            AddRows(rows, await dbContext.Clients
                .IgnoreQueryFilters()
                .Where(item => item.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Clientes",
                    item.TradeName ?? item.LegalName,
                    item.IdClient,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.CodeClient))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Sedes"))
        {
            AddRows(rows, await dbContext.ClientSites
                .IgnoreQueryFilters()
                .Where(item => item.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Sedes",
                    item.Name,
                    item.IdClientSite,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.Client.TradeName ?? item.Client.LegalName))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Contactos"))
        {
            AddRows(rows, await dbContext.ClientContacts
                .IgnoreQueryFilters()
                .Where(item => item.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Contactos",
                    item.FullName,
                    item.IdClientContact,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.Client.TradeName ?? item.Client.LegalName))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Contratos"))
        {
            AddRows(rows, await dbContext.ServiceContracts
                .IgnoreQueryFilters()
                .Where(item => item.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Contratos",
                    item.CodeServiceContract,
                    item.IdServiceContract,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.Client.TradeName ?? item.Client.LegalName))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Servicios"))
        {
            AddRows(rows, await dbContext.Services
                .IgnoreQueryFilters()
                .Where(item => item.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Servicios",
                    item.Name,
                    item.IdService,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.CodeService))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Configuraciones"))
        {
            AddRows(rows, await dbContext.ServiceConfigurations
                .IgnoreQueryFilters()
                .Where(item => item.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Configuraciones",
                    item.Service.Name,
                    item.IdServiceConfiguration,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.WorkScheduleDescription))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Personal"))
        {
            AddRows(rows, await dbContext.Employees
                .IgnoreQueryFilters()
                .Where(item => item.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Personal",
                    item.FullName,
                    item.IdEmployee,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.CodeEmployee))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Documentos"))
        {
            AddRows(rows, await dbContext.EmployeeDocuments
                .IgnoreQueryFilters()
                .Where(item => item.Employee.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Documentos",
                    item.Employee.FullName,
                    item.IdEmployeeDocument,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.DocumentType.ToString()))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Evaluaciones"))
        {
            AddRows(rows, await dbContext.EmployeeEvaluations
                .IgnoreQueryFilters()
                .Where(item => item.Employee.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Evaluaciones",
                    item.Employee.FullName,
                    item.IdEmployeeEvaluation,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.EvaluationType.ToString()))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Posiciones"))
        {
            AddRows(rows, await dbContext.Positions
                .IgnoreQueryFilters()
                .Where(item => item.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Posiciones",
                    item.Name,
                    item.IdPosition,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.CodePosition))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Patrones"))
        {
            AddRows(rows, await dbContext.ShiftPatterns
                .IgnoreQueryFilters()
                .Where(item => item.Position.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Patrones",
                    item.Name,
                    item.IdShiftPattern,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.CodeShiftPattern))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Segmentos"))
        {
            AddRows(rows, await dbContext.ShiftSegments
                .IgnoreQueryFilters()
                .Where(item => item.ShiftPattern.Position.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Segmentos",
                    item.ShiftPattern.Name,
                    item.IdShiftSegment,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.DayOfWeek.ToString()))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Versiones"))
        {
            AddRows(rows, await dbContext.ScheduleVersions
                .IgnoreQueryFilters()
                .Where(item => item.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Versiones",
                    item.Name,
                    item.IdScheduleVersion,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.Status.ToString()))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Turnos"))
        {
            AddRows(rows, await dbContext.ScheduledShifts
                .IgnoreQueryFilters()
                .Where(item => item.ScheduleVersion.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Turnos",
                    item.Employee.FullName,
                    item.IdScheduledShift,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.ShiftDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Asistencia"))
        {
            AddRows(rows, await dbContext.AttendanceRecords
                .IgnoreQueryFilters()
                .Where(item => item.ScheduledShift.ScheduleVersion.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Asistencia",
                    item.Employee.FullName,
                    item.IdAttendanceRecord,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.Status.ToString()))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Incidencias"))
        {
            AddRows(rows, await dbContext.Incidents
                .IgnoreQueryFilters()
                .Where(item => item.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Incidencias",
                    item.IncidentType,
                    item.IdIncident,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.Status.ToString()))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Coberturas"))
        {
            AddRows(rows, await dbContext.CoverageRecords
                .IgnoreQueryFilters()
                .Where(item => item.ScheduledShift.ScheduleVersion.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Coberturas",
                    item.ReplacementEmployee.FullName,
                    item.IdCoverageRecord,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.Status.ToString()))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Evidencias"))
        {
            AddRows(rows, await dbContext.OperationEvidences
                .IgnoreQueryFilters()
                .Where(item => item.Service.Client.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Evidencias",
                    item.Title,
                    item.IdOperationEvidence,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.EvidenceType.ToString()))
                .ToArrayAsync(cancellationToken));
        }

        if (Matches(entity, "Solicitudes"))
        {
            AddRows(rows, await dbContext.OperationalRequests
                .IgnoreQueryFilters()
                .Where(item => item.IdOrganization == query.IdOrganization)
                .Select(item => new AuditableRecord(
                    "Solicitudes",
                    item.Title,
                    item.IdOperationalRequest,
                    item.Active,
                    item.CreatedByName,
                    item.CreatedAt,
                    item.UpdatedByName,
                    item.UpdatedAt,
                    item.CodeOperationalRequest))
                .ToArrayAsync(cancellationToken));
        }

        var startAt = query.FromDate?.ToDateTime(TimeOnly.MinValue);
        var endBefore = query.ToDate?.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var filtered = rows.Where(row =>
            (!startAt.HasValue || row.OccurredAt >= startAt.Value) &&
            (!endBefore.HasValue || row.OccurredAt < endBefore.Value));

        var search = query.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            filtered = filtered.Where(row =>
                Contains(row.Entity, search) ||
                Contains(row.EntityName, search) ||
                Contains(row.Action, search) ||
                Contains(row.ActorName, search) ||
                Contains(row.Details, search));
        }

        var ordered = filtered
            .OrderByDescending(row => row.OccurredAt)
            .ThenBy(row => row.Entity)
            .ToArray();
        var pageItems = ordered
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(row => new AuditEventResponse(
                row.Entity,
                row.EntityName,
                row.RecordId,
                row.Action,
                row.ActorName,
                row.OccurredAt,
                row.Active,
                row.Details))
            .ToArray();

        return new AuditResult(
            new PagedResult<AuditEventResponse>(pageItems, ordered.Length, query.Page, query.PageSize),
            EntityNames);
    }

    private static void AddRows(List<AuditRow> rows, IEnumerable<AuditableRecord> records)
    {
        foreach (var record in records)
        {
            rows.Add(new AuditRow(
                record.Entity,
                record.EntityName,
                record.RecordId,
                "Alta",
                record.CreatedByName,
                record.CreatedAt,
                record.Active,
                record.Details));

            if (record.UpdatedAt is not null)
            {
                rows.Add(new AuditRow(
                    record.Entity,
                    record.EntityName,
                    record.RecordId,
                    record.Active ? "Actualización" : "Baja lógica",
                    record.UpdatedByName ?? "Sistema",
                    record.UpdatedAt.Value,
                    record.Active,
                    record.Details));
            }
        }
    }

    private static bool Matches(string? requestedEntity, string entity) =>
        string.IsNullOrWhiteSpace(requestedEntity) ||
        string.Equals(requestedEntity, entity, StringComparison.OrdinalIgnoreCase);

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool Contains(string? value, string search) =>
        value?.Contains(search, StringComparison.OrdinalIgnoreCase) == true;

    private sealed record AuditableRecord(
        string Entity,
        string EntityName,
        Guid RecordId,
        bool Active,
        string CreatedByName,
        DateTime CreatedAt,
        string? UpdatedByName,
        DateTime? UpdatedAt,
        string? Details);

    private sealed record AuditRow(
        string Entity,
        string EntityName,
        Guid RecordId,
        string Action,
        string ActorName,
        DateTime OccurredAt,
        bool Active,
        string? Details);
}
