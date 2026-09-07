using GestIA.Domain.Catalogs;
using GestIA.Domain.Documents;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Requests;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.DemoData;

/// <summary>
/// Operación diaria del mes publicado, solicitudes operativas en los siete estados del enum
/// y documentos de negocio por entidad propietaria.
/// </summary>
public sealed partial class DemoDataSeeder
{
    private async Task EnsureOperationsAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.AttendanceRecords
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(
                item => item.IdOrganization == organization.IdOrganization,
                cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "operations");
        }
        else
        {
            var shifts = await dbContext.ScheduledShifts
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization &&
                    item.ScheduleVersion.Status == GestIA.Domain.Planning.ScheduleVersionStatus.Published)
                .OrderBy(item => item.ShiftDate)
                .ThenBy(item => item.IdScheduledShift)
                .ToListAsync(cancellationToken);

            var coverageReasons = await dbContext.BusinessCatalogItems
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization &&
                    item.Type == BusinessCatalogItemType.CoverageReason)
                .OrderBy(item => item.Code)
                .ToListAsync(cancellationToken);

            var replacements = await dbContext.Employees
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization &&
                    item.Status == EmployeeStatus.Active)
                .OrderBy(item => item.CodeEmployee)
                .Select(item => item.IdEmployee)
                .ToListAsync(cancellationToken);

            var serviceByShift = await dbContext.ScheduledShifts
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .Select(item => new { item.IdScheduledShift, item.ScheduleVersion.IdService })
                .ToDictionaryAsync(item => item.IdScheduledShift, item => item.IdService, cancellationToken);

            var index = 0;
            foreach (var shift in shifts)
            {
                index++;

                // Distribución del mes: mayoría presente, con retardos, faltas, justificadas
                // y algunos turnos futuros que siguen sólo esperados.
                var status = (index % 20) switch
                {
                    0 or 1 => AttendanceStatus.Absent,
                    2 or 3 or 4 => AttendanceStatus.Late,
                    5 => AttendanceStatus.Excused,
                    6 => AttendanceStatus.Expected,
                    _ => AttendanceStatus.Present
                };

                var minutesLate = status == AttendanceStatus.Late ? Rng.Next(6, 95) : 0;
                var actualStart = status is AttendanceStatus.Absent or AttendanceStatus.Expected
                    ? (TimeOnly?)null
                    : shift.StartTime.AddMinutes(minutesLate);
                var actualEnd = status is AttendanceStatus.Absent or AttendanceStatus.Expected
                    ? (TimeOnly?)null
                    : shift.EndTime;

                await dbContext.AttendanceRecords.AddAsync(
                    AttendanceRecord.Create(
                        organization.IdOrganization,
                        shift.IdScheduledShift,
                        shift.IdEmployee,
                        shift.ShiftDate,
                        new AttendanceRecordProfile(
                            status,
                            actualStart,
                            actualEnd,
                            minutesLate,
                            status switch
                            {
                                AttendanceStatus.Absent => "Sin presentarse y sin aviso previo.",
                                AttendanceStatus.Excused => "Ausencia justificada con comprobante médico.",
                                AttendanceStatus.Late => $"Ingresó {minutesLate} minutos tarde.",
                                _ => null
                            }),
                        DemoActorId,
                        DemoActorName,
                        OccurredAt),
                    cancellationToken);

                if (status is AttendanceStatus.Absent or AttendanceStatus.Late &&
                    serviceByShift.TryGetValue(shift.IdScheduledShift, out var idService))
                {
                    await AddIncidentAsync(organization.IdOrganization, idService, shift.IdScheduledShift, shift.IdEmployee, shift.ShiftDate, status, cancellationToken);
                }

                if (status == AttendanceStatus.Absent && replacements.Count > 0 && coverageReasons.Count > 0)
                {
                    var replacement = replacements.FirstOrDefault(candidate => candidate != shift.IdEmployee);
                    if (replacement != Guid.Empty)
                    {
                        var reason = coverageReasons[index % coverageReasons.Count];
                        var target = (index % 80) switch
                        {
                            0 or 1 => CoverageStatus.Requested,
                            20 or 21 => CoverageStatus.Confirmed,
                            40 or 41 => CoverageStatus.Completed,
                            _ => CoverageStatus.Cancelled
                        };

                        var coverage = CoverageRecord.Create(
                            organization.IdOrganization,
                            shift.IdScheduledShift,
                            shift.IdEmployee,
                            new CoverageRecordProfile(
                                replacement,
                                shift.StartTime,
                                shift.EndTime,
                                shift.IsOvernight,
                                CoverageStatus.Requested,
                                null,
                                reason.IdBusinessCatalogItem),
                            DemoActorId,
                            DemoActorName,
                            OccurredAt);

                        // Create() fija siempre Requested; los demás estados se alcanzan
                        // caminando la máquina de estados de UpdateProfile.
                        WalkCoverage(coverage, replacement, shift.StartTime, shift.EndTime, shift.IsOvernight,
                            reason.IdBusinessCatalogItem, target);

                        await dbContext.CoverageRecords.AddAsync(coverage, cancellationToken);
                    }
                }

                // Guardado por lotes para no acumular un change tracker enorme.
                if (index % 500 == 0)
                {
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.AttendanceRecords = await dbContext.AttendanceRecords.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(
                item => item.IdOrganization == organization.IdOrganization,
                cancellationToken);
        report.Incidents = await dbContext.Incidents.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
        report.CoverageRecords = await dbContext.CoverageRecords.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(
                item => item.IdOrganization == organization.IdOrganization,
                cancellationToken);
    }

    /// <summary>
    /// Lleva una cobertura recién creada hasta el estado objetivo respetando las transiciones
    /// permitidas: Requested -> Confirmed -> Completed, y Cancelled desde cualquiera de las dos.
    /// </summary>
    private void WalkCoverage(
        CoverageRecord coverage,
        Guid replacement,
        TimeOnly start,
        TimeOnly end,
        bool isOvernight,
        Guid idReason,
        CoverageStatus target)
    {
        if (target == CoverageStatus.Requested)
        {
            return;
        }

        Move(CoverageStatus.Confirmed, null);

        if (target == CoverageStatus.Completed)
        {
            Move(CoverageStatus.Completed, "Cobertura cubierta y cerrada por el supervisor.");
        }
        else if (target == CoverageStatus.Cancelled)
        {
            Move(CoverageStatus.Cancelled, "Cobertura cancelada: el titular se presentó tarde.");
        }

        void Move(CoverageStatus status, string? notes) =>
            coverage.UpdateProfile(
                new CoverageRecordProfile(replacement, start, end, isOvernight, status, notes, idReason),
                DemoActorId,
                DemoActorName,
                OccurredAt);
    }

    private async Task AddIncidentAsync(
        Guid idOrganization,
        Guid idService,
        Guid idScheduledShift,
        Guid idEmployee,
        DateOnly date,
        AttendanceStatus attendance,
        CancellationToken cancellationToken)
    {
        var severity = attendance == AttendanceStatus.Absent ? IncidentSeverity.High : IncidentSeverity.Low;
        var status = (date.Day % 4) switch
        {
            0 => IncidentStatus.Open,
            1 => IncidentStatus.InReview,
            2 => IncidentStatus.Resolved,
            _ => IncidentStatus.Cancelled
        };

        var type = attendance == AttendanceStatus.Absent ? "Ausencia" : "Retardo";
        var description = attendance == AttendanceStatus.Absent
            ? "El elemento no se presentó al turno programado y no avisó al supervisor."
            : "El elemento ingresó fuera de la tolerancia acordada con el cliente.";

        var incident = Incident.Create(
            idOrganization,
            idService,
            new IncidentProfile(idScheduledShift, idEmployee, date, type, severity, IncidentStatus.Open, description, null),
            DemoActorId,
            DemoActorName,
            OccurredAt);

        // Create() fija siempre Open; los demás estados se alcanzan por UpdateProfile,
        // que valida la transición y exige nota de resolución al cerrar o cancelar.
        if (status != IncidentStatus.Open)
        {
            if (status == IncidentStatus.Resolved)
            {
                Move(IncidentStatus.InReview, null);
            }

            Move(
                status,
                status is IncidentStatus.Resolved or IncidentStatus.Cancelled
                    ? "Atendida por el supervisor de sitio; se documentó el seguimiento."
                    : null);
        }

        await dbContext.Incidents.AddAsync(incident, cancellationToken);

        void Move(IncidentStatus next, string? notes) =>
            incident.UpdateProfile(
                new IncidentProfile(idScheduledShift, idEmployee, date, type, severity, next, description, notes),
                DemoActorId,
                DemoActorName,
                OccurredAt);
    }

    /// <summary>
    /// Solicitudes que recorren los siete estados. Como <c>ChangeStatus</c> valida la
    /// transición, cada solicitud se camina por la ruta permitida hasta su estado final.
    /// </summary>
    private async Task EnsureRequestsAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.OperationalRequests
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "requests");
        }
        else
        {
            var clients = await dbContext.Clients
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeClient)
                .ToListAsync(cancellationToken);

            var services = await dbContext.Services
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeService)
                .ToListAsync(cancellationToken);

            var targets = new[]
            {
                OperationalRequestStatus.Draft,
                OperationalRequestStatus.Submitted,
                OperationalRequestStatus.InReview,
                OperationalRequestStatus.Approved,
                OperationalRequestStatus.Rejected,
                OperationalRequestStatus.Cancelled,
                OperationalRequestStatus.Completed
            };

            var number = 0;
            // Tres vueltas para que cada estado tenga más de un registro y las listas paginen.
            for (var round = 0; round < 3; round++)
            {
                foreach (var target in targets)
                {
                    number++;
                    var client = clients[number % clients.Count];
                    var service = services[number % services.Count];
                    var type = (OperationalRequestType)(number % 5 == 4 ? 99 : number % 5);

                    var request = OperationalRequest.Create(
                        organization.IdOrganization,
                        client.IdClient,
                        number % 3 == 0 ? service.IdService : null,
                        $"SOL-{number:0000}",
                        type,
                        (OperationalRequestPriority)(number % 4),
                        $"Solicitud {number:0000} · {DescribeType(type)}",
                        $"Solicitud sintética generada por el sembrador demo para {client.TradeName}. " +
                        "Su único propósito es poblar el tablero de solicitudes con volumen realista.",
                        $"{Pick(DemoCatalog.ContactFirstNames)} {Pick(DemoCatalog.ContactLastNames)}",
                        Days(Rng.Next(-30, 45)),
                        DemoActorId,
                        DemoActorName,
                        OccurredAt);

                    WalkToStatus(request, target);
                    await dbContext.OperationalRequests.AddAsync(request, cancellationToken);
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.OperationalRequests = await dbContext.OperationalRequests.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
    }

    private static string DescribeType(OperationalRequestType type) => type switch
    {
        OperationalRequestType.NewClient => "Alta de cliente",
        OperationalRequestType.NewService => "Alta de servicio",
        OperationalRequestType.ServiceChange => "Cambio de servicio",
        OperationalRequestType.CoverageSupport => "Apoyo de cobertura",
        OperationalRequestType.StaffChange => "Cambio de personal",
        _ => "Otro"
    };

    /// <summary>Camina la máquina de estados por transiciones permitidas.</summary>
    private void WalkToStatus(OperationalRequest request, OperationalRequestStatus target)
    {
        const string CancelNote = "Cancelada por el solicitante antes de concluir.";
        const string RejectNote = "Rechazada: no cumple los requisitos operativos mínimos.";

        switch (target)
        {
            case OperationalRequestStatus.Draft:
                return;

            case OperationalRequestStatus.Submitted:
                Change(OperationalRequestStatus.Submitted, null);
                return;

            case OperationalRequestStatus.InReview:
                Change(OperationalRequestStatus.Submitted, null);
                Change(OperationalRequestStatus.InReview, null);
                return;

            case OperationalRequestStatus.Approved:
                Change(OperationalRequestStatus.Submitted, null);
                Change(OperationalRequestStatus.InReview, null);
                Change(OperationalRequestStatus.Approved, null);
                return;

            case OperationalRequestStatus.Rejected:
                Change(OperationalRequestStatus.Submitted, null);
                Change(OperationalRequestStatus.InReview, null);
                Change(OperationalRequestStatus.Rejected, RejectNote);
                return;

            case OperationalRequestStatus.Cancelled:
                Change(OperationalRequestStatus.Submitted, null);
                Change(OperationalRequestStatus.Cancelled, CancelNote);
                return;

            case OperationalRequestStatus.Completed:
                Change(OperationalRequestStatus.Submitted, null);
                Change(OperationalRequestStatus.InReview, null);
                Change(OperationalRequestStatus.Approved, null);
                Change(OperationalRequestStatus.Completed, null);
                return;

            default:
                return;
        }

        void Change(OperationalRequestStatus status, string? notes) =>
            request.ChangeStatus(status, notes, DemoActorId, DemoActorName, OccurredAt);
    }

    /// <summary>
    /// Documentos de negocio por entidad propietaria, con vencidos y por vencer, sensibles
    /// y en los cinco estados de revisión.
    /// </summary>
    private async Task EnsureBusinessDocumentsAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.BusinessDocuments
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "business-documents");
        }
        else
        {
            var clients = await dbContext.Clients.IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeClient)
                .Select(item => new { item.IdClient, item.CodeClient })
                .ToListAsync(cancellationToken);
            var contracts = await dbContext.ServiceContracts.IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeServiceContract)
                .Select(item => new { item.IdServiceContract, item.CodeServiceContract })
                .ToListAsync(cancellationToken);
            var services = await dbContext.Services.IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeService)
                .Select(item => new { item.IdService, item.CodeService })
                .ToListAsync(cancellationToken);
            var employees = await dbContext.Employees.IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeEmployee)
                .Take(40)
                .Select(item => new { item.IdEmployee, item.CodeEmployee })
                .ToListAsync(cancellationToken);

            var number = 0;

            foreach (var client in clients)
            {
                await AddDocumentAsync(organization, BusinessDocumentOwnerType.Client, client.IdClient,
                    "Acta constitutiva", $"{client.CodeClient} · acta constitutiva", ++number, cancellationToken);
                await AddDocumentAsync(organization, BusinessDocumentOwnerType.Client, client.IdClient,
                    "Constancia fiscal", $"{client.CodeClient} · constancia de situación fiscal", ++number, cancellationToken);
            }

            foreach (var contract in contracts)
            {
                await AddDocumentAsync(organization, BusinessDocumentOwnerType.ServiceContract, contract.IdServiceContract,
                    "Contrato firmado", $"{contract.CodeServiceContract} · contrato firmado", ++number, cancellationToken);
            }

            foreach (var service in services)
            {
                await AddDocumentAsync(organization, BusinessDocumentOwnerType.Service, service.IdService,
                    "Instrucciones de sitio", $"{service.CodeService} · instrucciones de sitio", ++number, cancellationToken);
            }

            foreach (var employee in employees)
            {
                await AddDocumentAsync(organization, BusinessDocumentOwnerType.Employee, employee.IdEmployee,
                    "Expediente laboral", $"{employee.CodeEmployee} · expediente laboral", ++number, cancellationToken);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.BusinessDocuments = await dbContext.BusinessDocuments.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
    }

    private async Task AddDocumentAsync(
        Organization organization,
        BusinessDocumentOwnerType ownerType,
        Guid ownerId,
        string category,
        string title,
        int number,
        CancellationToken cancellationToken)
    {
        var status = (BusinessDocumentStatus)(number % 5);

        // Igual que en el expediente de personal: el vencimiento se deriva de la expedición
        // para respetar la invariante ExpiresDate >= IssuedDate.
        var issuedOffset = -Rng.Next(200, 900);
        var issued = Days(issuedOffset);

        DateOnly? expires = (number % 6) switch
        {
            0 => Days(Rng.Next(issuedOffset + 30, 0)),
            1 => Days(Rng.Next(1, 21)),
            2 => null,
            _ => Days(Rng.Next(90, 900))
        };

        var document = BusinessDocument.Create(
            organization.IdOrganization,
            new BusinessDocumentProfile(
                ownerType,
                ownerId,
                category,
                title,
                status,
                issued,
                expires,
                $"business-documents/demo/{ownerType.ToString().ToLowerInvariant()}-{number:0000}.pdf",
                number % 7 == 0,
                number % 5 == 3 ? "Documento rechazado por ilegibilidad; se solicitó reposición." : null),
            DemoActorId,
            DemoActorName,
            OccurredAt);

        // Create() deja siempre PendingReview; los estados finales se alcanzan por Review/Archive.
        if (status is BusinessDocumentStatus.Validated or BusinessDocumentStatus.Rejected)
        {
            document.Review(
                status,
                status == BusinessDocumentStatus.Rejected
                    ? "Rechazado: el documento no corresponde a la entidad propietaria."
                    : "Validado contra el original.",
                DemoActorId,
                DemoActorName,
                OccurredAt);
        }
        else if (status == BusinessDocumentStatus.Archived)
        {
            document.Archive(DemoActorId, DemoActorName, OccurredAt);
        }

        await dbContext.BusinessDocuments.AddAsync(document, cancellationToken);
    }
}
