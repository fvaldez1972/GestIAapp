using GestIA.Application.Reports;
using GestIA.Domain.Operations;
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
            .Where(item => item.ScheduledShift.ScheduleVersion.Service.Client.IdOrganization == query.IdOrganization);

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
            .Where(item => item.Service.Client.IdOrganization == query.IdOrganization);

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
            .Where(item => item.ScheduledShift.ScheduleVersion.Service.Client.IdOrganization == query.IdOrganization);

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
            coveredMinutes);
    }

    public async Task<IReadOnlyList<OperationsServiceSummaryResponse>> GetOperationsByServiceAsync(
        OperationsSummaryQuery query,
        CancellationToken cancellationToken)
    {
        var services = dbContext.Services
            .AsNoTracking()
            .Include(service => service.Client)
            .Where(service => service.Client.IdOrganization == query.IdOrganization);

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
                coveredMinutes));
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

        return employees.Select(employee =>
        {
            var employeeDocuments = documents.Where(document => document.IdEmployee == employee.IdEmployee).ToArray();
            var employeeEvaluations = evaluations.Where(evaluation => evaluation.IdEmployee == employee.IdEmployee).ToArray();
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

            if (reasons.Count == 0)
            {
                reasons.Add("Elegible con las reglas actuales.");
            }

            return new WorkforceEligibilityResponse(
                employee.IdEmployee,
                employee.CodeEmployee,
                employee.FullName,
                employee.JobTitle,
                reasons.Count == 1 && reasons[0] == "Elegible con las reglas actuales.",
                reasons,
                expiredDocuments,
                rejectedDocuments,
                invalidEvaluations);
        }).ToArray();
    }
}
