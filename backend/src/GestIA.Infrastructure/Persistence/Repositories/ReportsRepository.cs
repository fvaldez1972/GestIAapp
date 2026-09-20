using GestIA.Application.Reports;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Operations;
using GestIA.Domain.Planning;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.Repositories;

public sealed class ReportsRepository(GestIaDbContext dbContext) : IReportsRepository
{
    public async Task<OperationsSummaryResponse> GetOperationsSummaryAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken)
    {
        var attendanceQuery = dbContext.AttendanceRecords
            .AsNoTracking()
            .Where(item => item.IdOrganization == query.IdOrganization);

        if (query.IdClient is not null)
        {
            attendanceQuery = attendanceQuery.Where(
                item => item.ScheduledShift.ScheduleVersion.Service.IdClient == query.IdClient);
        }

        if (query.IdService is not null)
        {
            attendanceQuery = attendanceQuery.Where(
                item => item.ScheduledShift.ScheduleVersion.IdService == query.IdService);
        }

        if (query.FromDate is not null)
        {
            attendanceQuery = attendanceQuery.Where(item => item.AttendanceDate >= query.FromDate);
        }

        if (query.ToDate is not null)
        {
            attendanceQuery = attendanceQuery.Where(item => item.AttendanceDate <= query.ToDate);
        }

        var incidentQuery = dbContext.Incidents
            .AsNoTracking()
            .Where(item => item.IdOrganization == query.IdOrganization);

        if (query.IdClient is not null)
        {
            incidentQuery = incidentQuery.Where(item => item.Service.IdClient == query.IdClient);
        }

        if (query.IdService is not null)
        {
            incidentQuery = incidentQuery.Where(item => item.IdService == query.IdService);
        }

        if (query.FromDate is not null)
        {
            incidentQuery = incidentQuery.Where(item => item.IncidentDate >= query.FromDate);
        }

        if (query.ToDate is not null)
        {
            incidentQuery = incidentQuery.Where(item => item.IncidentDate <= query.ToDate);
        }

        var coverageQuery = dbContext.CoverageRecords
            .AsNoTracking()
            .Where(item => item.IdOrganization == query.IdOrganization);

        if (query.IdClient is not null)
        {
            coverageQuery = coverageQuery.Where(
                item => item.ScheduledShift.ScheduleVersion.Service.IdClient == query.IdClient);
        }

        if (query.IdService is not null)
        {
            coverageQuery = coverageQuery.Where(
                item => item.ScheduledShift.ScheduleVersion.IdService == query.IdService);
        }

        if (query.FromDate is not null)
        {
            coverageQuery = coverageQuery.Where(item => item.ScheduledShift.ShiftDate >= query.FromDate);
        }

        if (query.ToDate is not null)
        {
            coverageQuery = coverageQuery.Where(item => item.ScheduledShift.ShiftDate <= query.ToDate);
        }

        var approvalQuery = dbContext.ApprovalRequests
            .AsNoTracking()
            .Where(item => item.IdOrganization == query.IdOrganization);

        if (query.IdService is not null)
        {
            approvalQuery = approvalQuery.Where(item => item.IdService == query.IdService);
        }

        var closureQuery = dbContext.OperationDayClosures
            .AsNoTracking()
            .Where(item => item.IdOrganization == query.IdOrganization && item.Status == OperationDayClosureStatus.Closed);

        if (query.IdService is not null)
        {
            closureQuery = closureQuery.Where(item => item.IdService == query.IdService);
        }

        if (query.FromDate is not null)
        {
            closureQuery = closureQuery.Where(item => item.OperationDate >= query.FromDate);
        }

        if (query.ToDate is not null)
        {
            closureQuery = closureQuery.Where(item => item.OperationDate <= query.ToDate);
        }

        var attendanceRecords = await attendanceQuery.CountAsync(cancellationToken);
        var presentAttendance = await attendanceQuery.CountAsync(
            item => item.Status == AttendanceStatus.Present,
            cancellationToken);
        var lateAttendance = await attendanceQuery.CountAsync(
            item => item.Status == AttendanceStatus.Late,
            cancellationToken);
        var absentAttendance = await attendanceQuery.CountAsync(
            item => item.Status == AttendanceStatus.Absent,
            cancellationToken);
        var excusedAttendance = await attendanceQuery.CountAsync(
            item => item.Status == AttendanceStatus.Excused,
            cancellationToken);

        var incidents = await incidentQuery.CountAsync(cancellationToken);
        var openIncidents = await incidentQuery.CountAsync(
            item => item.Status == IncidentStatus.Open || item.Status == IncidentStatus.InReview,
            cancellationToken);
        var criticalIncidents = await incidentQuery.CountAsync(
            item => item.Severity == IncidentSeverity.Critical,
            cancellationToken);

        var coverageRecords = await coverageQuery.CountAsync(cancellationToken);
        var confirmedCoverages = await coverageQuery.CountAsync(
            item => item.Status == CoverageStatus.Confirmed,
            cancellationToken);
        var completedCoverages = await coverageQuery.CountAsync(
            item => item.Status == CoverageStatus.Completed,
            cancellationToken);
        var coveredMinutes = await coverageQuery.SumAsync(item => item.DurationMinutes, cancellationToken);
        var pendingApprovals = await approvalQuery.CountAsync(
            item => item.Status == ApprovalRequestStatus.Pending,
            cancellationToken);
        var closedOperationDays = await closureQuery.CountAsync(cancellationToken);

        return new OperationsSummaryResponse(
            attendanceRecords,
            presentAttendance,
            lateAttendance,
            absentAttendance,
            excusedAttendance,
            incidents,
            openIncidents,
            criticalIncidents,
            coverageRecords,
            confirmedCoverages,
            completedCoverages,
            coveredMinutes,
            pendingApprovals,
            closedOperationDays);
    }

    public async Task<IReadOnlyList<OperationsServiceSummaryResponse>> GetOperationsByServiceAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken)
    {
        var services = dbContext.Services
            .AsNoTracking()
            .Include(service => service.Client)
            .Where(service => service.IdOrganization == query.IdOrganization);

        if (query.IdClient is not null)
        {
            services = services.Where(service => service.IdClient == query.IdClient);
        }

        if (query.IdService is not null)
        {
            services = services.Where(service => service.IdService == query.IdService);
        }

        var serviceRows = await services
            .OrderBy(service => service.Client.TradeName ?? service.Client.LegalName)
            .ThenBy(service => service.Name)
            .Select(service => new
            {
                service.IdClient,
                ClientName = service.Client.TradeName ?? service.Client.LegalName,
                service.IdService,
                service.CodeService,
                service.Name
            })
            .ToArrayAsync(cancellationToken);

        var rows = new List<OperationsServiceSummaryResponse>(serviceRows.Length);

        foreach (var service in serviceRows)
        {
            var attendanceQuery = dbContext.AttendanceRecords
                .AsNoTracking()
                .Where(item => item.ScheduledShift.ScheduleVersion.IdService == service.IdService);

            if (query.FromDate is not null)
            {
                attendanceQuery = attendanceQuery.Where(item => item.AttendanceDate >= query.FromDate);
            }

            if (query.ToDate is not null)
            {
                attendanceQuery = attendanceQuery.Where(item => item.AttendanceDate <= query.ToDate);
            }

            var incidentQuery = dbContext.Incidents
                .AsNoTracking()
                .Where(item => item.IdService == service.IdService);

            if (query.FromDate is not null)
            {
                incidentQuery = incidentQuery.Where(item => item.IncidentDate >= query.FromDate);
            }

            if (query.ToDate is not null)
            {
                incidentQuery = incidentQuery.Where(item => item.IncidentDate <= query.ToDate);
            }

            var coverageQuery = dbContext.CoverageRecords
                .AsNoTracking()
                .Where(item => item.ScheduledShift.ScheduleVersion.IdService == service.IdService);

            if (query.FromDate is not null)
            {
                coverageQuery = coverageQuery.Where(item => item.ScheduledShift.ShiftDate >= query.FromDate);
            }

            if (query.ToDate is not null)
            {
                coverageQuery = coverageQuery.Where(item => item.ScheduledShift.ShiftDate <= query.ToDate);
            }

            var attendanceRecords = await attendanceQuery.CountAsync(cancellationToken);
            var presentAttendance = await attendanceQuery.CountAsync(
                item => item.Status == AttendanceStatus.Present,
                cancellationToken);
            var lateAttendance = await attendanceQuery.CountAsync(
                item => item.Status == AttendanceStatus.Late,
                cancellationToken);
            var absentAttendance = await attendanceQuery.CountAsync(
                item => item.Status == AttendanceStatus.Absent,
                cancellationToken);
            var excusedAttendance = await attendanceQuery.CountAsync(
                item => item.Status == AttendanceStatus.Excused,
                cancellationToken);

            var incidents = await incidentQuery.CountAsync(cancellationToken);
            var openIncidents = await incidentQuery.CountAsync(
                item => item.Status == IncidentStatus.Open || item.Status == IncidentStatus.InReview,
                cancellationToken);
            var criticalIncidents = await incidentQuery.CountAsync(
                item => item.Severity == IncidentSeverity.Critical,
                cancellationToken);

            var coverageRecords = await coverageQuery.CountAsync(cancellationToken);
            var confirmedCoverages = await coverageQuery.CountAsync(
                item => item.Status == CoverageStatus.Confirmed,
                cancellationToken);
            var completedCoverages = await coverageQuery.CountAsync(
                item => item.Status == CoverageStatus.Completed,
                cancellationToken);
            var coveredMinutes = await coverageQuery.SumAsync(item => item.DurationMinutes, cancellationToken);
            var pendingApprovals = await dbContext.ApprovalRequests
                .AsNoTracking()
                .CountAsync(
                    item =>
                        item.IdService == service.IdService &&
                        item.Status == ApprovalRequestStatus.Pending,
                    cancellationToken);
            var closedOperationDays = await dbContext.OperationDayClosures
                .AsNoTracking()
                .CountAsync(
                    item =>
                        item.IdService == service.IdService &&
                        item.Status == OperationDayClosureStatus.Closed &&
                        (!query.FromDate.HasValue || item.OperationDate >= query.FromDate.Value) &&
                        (!query.ToDate.HasValue || item.OperationDate <= query.ToDate.Value),
                    cancellationToken);

            rows.Add(new OperationsServiceSummaryResponse(
                service.IdClient,
                service.ClientName,
                service.IdService,
                service.CodeService,
                service.Name,
                attendanceRecords,
                presentAttendance,
                lateAttendance,
                absentAttendance,
                excusedAttendance,
                incidents,
                openIncidents,
                criticalIncidents,
                coverageRecords,
                confirmedCoverages,
                completedCoverages,
                coveredMinutes,
                pendingApprovals,
                closedOperationDays));
        }

        return rows;
    }

    public async Task<IReadOnlyList<WorkforceEligibilityResponse>> GetWorkforceEligibilityAsync(
        WorkforceEligibilityQuery query,
        CancellationToken cancellationToken)
    {
        var employeesQuery = dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.IdOrganization == query.IdOrganization);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            employeesQuery = employeesQuery.Where(employee =>
                employee.CodeEmployee.Contains(search) ||
                employee.FullName.Contains(search) ||
                (employee.JobTitle != null && employee.JobTitle.Contains(search)));
        }

        var employees = await employeesQuery
            .OrderBy(employee => employee.FullName)
            .Take(250)
            .ToArrayAsync(cancellationToken);
        var employeeIds = employees.Select(employee => employee.IdEmployee).ToArray();

        var documents = await dbContext.EmployeeDocuments
            .AsNoTracking()
            .Where(document => employeeIds.Contains(document.IdEmployee))
            .ToArrayAsync(cancellationToken);
        var evaluations = await dbContext.EmployeeEvaluations
            .AsNoTracking()
            .Where(evaluation => employeeIds.Contains(evaluation.IdEmployee))
            .ToArrayAsync(cancellationToken);
        var skills = await dbContext.EmployeeSkills
            .AsNoTracking()
            .Include(skill => skill.SkillCatalogItem)
            .Where(skill => employeeIds.Contains(skill.IdEmployee))
            .ToArrayAsync(cancellationToken);
        var incidents = await dbContext.AdministrativeIncidents
            .AsNoTracking()
            .Include(incident => incident.IncidentTypeCatalogItem)
            .Where(incident => employeeIds.Contains(incident.IdEmployee) && incident.Active)
            .ToArrayAsync(cancellationToken);
        var organizationRequirements = await dbContext.EligibilityRequirements
            .AsNoTracking()
            // La entrada del catalogo, que es de donde sale la severidad cuando la regla no la
            // fija. Sin este Include, una regla que hereda su marca se leeria como informativa y el
            // reporte diria que alguien es elegible mientras el motor le niega la asignacion.
            .Include(requirement => requirement.RequiredCatalogItem)
            .Where(requirement =>
                requirement.IdOrganization == query.IdOrganization &&
                requirement.Active &&
                requirement.TargetType == EligibilityRequirementTargetType.Organization)
            .ToArrayAsync(cancellationToken);

        return employees.Select(employee =>
        {
            var employeeDocuments = documents.Where(document => document.IdEmployee == employee.IdEmployee).ToArray();
            var employeeEvaluations = evaluations.Where(evaluation => evaluation.IdEmployee == employee.IdEmployee).ToArray();
            var employeeSkills = skills.Where(skill => skill.IdEmployee == employee.IdEmployee).ToArray();
            var employeeIncidents = incidents.Where(incident => incident.IdEmployee == employee.IdEmployee).ToArray();
            var expiredDocuments = employeeDocuments.Count(document =>
                document.Status == EmployeeDocumentStatus.Expired ||
                (document.ExpiresDate.HasValue && document.ExpiresDate.Value < query.ReferenceDate));
            var rejectedDocuments = employeeDocuments.Count(document => document.Status == EmployeeDocumentStatus.Rejected);
            var invalidEvaluations = employeeEvaluations.Count(evaluation =>
                evaluation.Result is EmployeeEvaluationResult.NotApproved or EmployeeEvaluationResult.Inconclusive ||
                (evaluation.ExpiresDate.HasValue && evaluation.ExpiresDate.Value < query.ReferenceDate));
            var reasons = new List<string>();

            if (employee.Status != EmployeeStatus.Active)
            {
                reasons.Add($"Estatus {employee.Status}.");
            }

            if (expiredDocuments > 0)
            {
                reasons.Add($"{expiredDocuments} documento(s) vencido(s).");
            }

            if (rejectedDocuments > 0)
            {
                reasons.Add($"{rejectedDocuments} documento(s) rechazado(s).");
            }

            if (invalidEvaluations > 0)
            {
                reasons.Add($"{invalidEvaluations} evaluación(es) vencida(s) o no aprobada(s).");
            }

            foreach (var requirement in organizationRequirements)
            {
                // Por identificador del catalogo, igual que el motor, con el enum de respaldo solo
                // para las filas que la conversion del 19 de septiembre todavia no emparejo.
                //
                // Antes esto comparaba SOLO por enum, y desde la conversion una regla nueva puede no
                // llevarlo: el reporte daba por incumplido lo que el motor daba por cubierto. Dos
                // pantallas del mismo sistema contradiciendose, que es el defecto que este proyecto
                // ya persiguio en el listado de personal.
                var passed = requirement.RequirementType switch
                {
                    EligibilityRequirementType.Skill => employeeSkills.Any(skill =>
                        skill.Active &&
                        skill.IdSkillCatalogItem == requirement.IdRequiredCatalogItem &&
                        (!skill.ExpiresDate.HasValue || skill.ExpiresDate.Value >= query.ReferenceDate)),
                    EligibilityRequirementType.Document => employeeDocuments.Any(document =>
                        document.Active &&
                        (document.IdDocumentCategoryCatalogItem.HasValue
                            ? document.IdDocumentCategoryCatalogItem == requirement.IdRequiredCatalogItem
                            : document.DocumentType == requirement.RequiredDocumentType) &&
                        (document.Status is EmployeeDocumentStatus.Validated or EmployeeDocumentStatus.Received) &&
                        (!document.ExpiresDate.HasValue || document.ExpiresDate.Value >= query.ReferenceDate)),
                    EligibilityRequirementType.Evaluation => employeeEvaluations.Any(evaluation =>
                        evaluation.Active &&
                        (evaluation.IdEvaluationCategoryCatalogItem.HasValue
                            ? evaluation.IdEvaluationCategoryCatalogItem == requirement.IdRequiredCatalogItem
                            : evaluation.EvaluationType == requirement.RequiredEvaluationType) &&
                        (evaluation.Result is EmployeeEvaluationResult.Approved or EmployeeEvaluationResult.ApprovedWithObservations) &&
                        (!evaluation.ExpiresDate.HasValue || evaluation.ExpiresDate.Value >= query.ReferenceDate)),
                    EligibilityRequirementType.Restriction => false,
                    _ => false
                };

                // Misma resolución que en la elegibilidad, y tiene que seguir siéndolo: la marca sale
                // de la entrada del catálogo. Cuando estas dos resoluciones se separaron, el reporte
                // y el motor dijeron cosas distintas sobre la misma persona durante un día.
                if (!passed && (requirement.RequiredCatalogItem?.IsBlocking ?? false))
                {
                    reasons.Add($"Regla obligatoria no cumplida: {requirement.Name}.");
                }
            }

            // Las incidencias activas, con el mismo criterio que el motor: bloquea la que tenga el
            // tipo marcado bloqueante en el catalogo, y deja de bloquear al retirarse.
            foreach (var incident in employeeIncidents.Where(item => item.IncidentTypeCatalogItem?.IsBlocking == true))
            {
                reasons.Add(
                    $"Incidencia administrativa activa: {incident.IncidentTypeCatalogItem!.Name}, " +
                    $"del {incident.OccurredDate:dd/MM/yyyy}.");
            }

            // Sin reglas no se concluye. La cuenta mira las reglas que APLICAN a esta persona,
            // no los documentos ni las evaluaciones que tenga: el estado responde «¿había algo
            // contra que comprobar?», y si no lo habia, decir «elegible» seria afirmar de mas.
            var sinReglas = organizationRequirements.Length == 0;

            if (reasons.Count == 0)
            {
                reasons.Add(sinReglas
                    ? "Sin reglas configuradas que apliquen: no se comprobó nada."
                    : "Elegible con las reglas actuales.");
            }

            return new WorkforceEligibilityResponse(
                employee.IdEmployee,
                employee.CodeEmployee,
                employee.FullName,
                employee.JobTitle,
                // Elegible es lo que pasa las reglas; sin reglas NO es elegible, es otra cosa, y
                // por eso va en su propia bandera en vez de colarse aqui como un si.
                !sinReglas && reasons.Count == 1 && reasons[0] == "Elegible con las reglas actuales.",
                sinReglas,
                reasons,
                expiredDocuments,
                rejectedDocuments,
                invalidEvaluations);
        }).ToArray();
    }
}
