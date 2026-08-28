using GestIA.Application.Reports;
using GestIA.Domain.Operations;
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
}
