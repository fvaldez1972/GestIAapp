using GestIA.Domain.Catalogs;
using GestIA.Domain.Documents;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Requests;
using GestIA.Domain.Workforce;
using Microsoft.EntityFrameworkCore;

namespace GestIA.Infrastructure.Persistence.DemoData;

/// <summary>
/// Fase operativa del sembrado: personal con su expediente, asignaciones, planeación,
/// un mes de operación diaria, solicitudes y documentos de negocio.
/// </summary>
public sealed partial class DemoDataSeeder
{
    /// <summary>120 empleados repartidos en los cinco estados del enum.</summary>
    private static readonly (EmployeeStatus Status, int Count)[] EmployeeDistribution =
    [
        (EmployeeStatus.Candidate, 15),
        (EmployeeStatus.Active, 70),
        (EmployeeStatus.OnLeave, 10),
        (EmployeeStatus.Inactive, 12),
        (EmployeeStatus.Terminated, 13)
    ];

    private async Task EnsureEmployeesAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.Employees
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "employees");
        }
        else
        {
            var skills = await dbContext.BusinessCatalogItems
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization &&
                    item.Type == BusinessCatalogItemType.Skill)
                .OrderBy(item => item.Name)
                .ToListAsync(cancellationToken);

            var jobPositions = await JobPositionCatalogAsync(organization, cancellationToken);

            var number = 0;
            foreach (var (status, count) in EmployeeDistribution)
            {
                for (var index = 0; index < count; index++)
                {
                    number++;
                    var employee = BuildEmployee(organization, number, status, jobPositions);
                    await dbContext.Employees.AddAsync(employee, cancellationToken);

                    await AddEmployeeDocumentsAsync(employee, number, cancellationToken);
                    await AddEmployeeEvaluationsAsync(employee, number, cancellationToken);
                    await AddEmployeeSkillsAsync(employee, number, skills, cancellationToken);
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.Employees = await dbContext.Employees.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
        report.EmployeeDocuments = await dbContext.EmployeeDocuments.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.Employee.IdOrganization == organization.IdOrganization, cancellationToken);
        report.EmployeeEvaluations = await dbContext.EmployeeEvaluations.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.Employee.IdOrganization == organization.IdOrganization, cancellationToken);
        report.EmployeeSkills = await dbContext.EmployeeSkills.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.Employee.IdOrganization == organization.IdOrganization, cancellationToken);
    }

    private Employee BuildEmployee(
        Organization organization,
        int number,
        EmployeeStatus status,
        IReadOnlyDictionary<string, Guid> jobPositions)
    {
        var first = DemoCatalog.EmployeeFirstNames[number % DemoCatalog.EmployeeFirstNames.Length];
        var paternal = DemoCatalog.EmployeeLastNames[number % DemoCatalog.EmployeeLastNames.Length];
        var maternal = DemoCatalog.EmployeeLastNames[(number * 7) % DemoCatalog.EmployeeLastNames.Length];
        var place = DemoCatalog.Municipalities[number % DemoCatalog.Municipalities.Length];
        var job = DemoCatalog.JobPositions[number % DemoCatalog.JobPositions.Length];
        var hireDate = Days(-Rng.Next(30, 2200));

        // RFC, CURP y credenciales viven en columnas varchar: se generan sobre un alfabeto
        // ASCII propio y no a partir del nombre, que sí lleva acentos y eñes a propósito.
        var initials = AsciiInitials(number);

        var employee = Employee.Create(
            organization.IdOrganization,
            $"EMP-{number:000}",
            new EmployeeProfile(
                $"{first} {paternal} {maternal}",
                job,
                hireDate,
                hireDate.AddYears(-Rng.Next(20, 45)),
                place.Municipality,
                number % 3 == 0 ? "Femenino" : "Masculino",
                number % 4 == 0 ? "Casado" : "Soltero",
                $"{initials}{number:000000}{number % 90:00}",
                $"{initials}{number:000000}HDFRRL{number % 90:00}",
                $"{Rng.Next(10000000, 99999999)}{number % 100:00}",
                $"VOTER{number:0000000}",
                number % 5 == 0 ? $"LIC{number:000000}" : null,
                number % 6 == 0 ? $"MIL{number:000000}" : null,
                $"empleado{number:000}@ejemplo.mx",
                $"55{Rng.Next(10000000, 99999999)}",
                number % 3 == 0 ? $"55{Rng.Next(10000000, 99999999)}" : null,
                $"{Pick(DemoCatalog.ContactFirstNames)} {Pick(DemoCatalog.ContactLastNames)}",
                $"55{Rng.Next(10000000, 99999999)}",
                $"{Pick(DemoCatalog.Streets)} {Rng.Next(10, 999)}",
                place.Municipality,
                place.State,
                place.PostalCode,
                number % 2 == 0 ? "Propia" : "Rentada",
                Days(-Rng.Next(200, 3000)),
                "MX",
                // El identificador, además del nombre. Sin él la persona queda con el puesto sólo
                // como texto y nadie puede comprobar que corresponde al perfil de una posición.
                ResolveJobPosition(jobPositions, job)),
            DemoActorId,
            DemoActorName,
            OccurredAt);

        // Employee.Create arranca siempre en Active, así que el estado se fija sin excepciones,
        // incluido Candidate. Omitirlo convertía a los candidatos en activos.
        employee.ChangeStatus(status, DemoActorId, DemoActorName, OccurredAt);

        // La baja se expresa con EmployeeStatus.Terminated, NO con el borrado lógico
        // transversal. Desactivar además al empleado lo saca del filtro global de EF y
        // desaparece de la pantalla de Personal, que es justo donde se quiere ver la baja.
        return employee;
    }

    private static string AsciiInitials(int number)
    {
        const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Create(3, number, (span, seed) =>
        {
            span[0] = Alphabet[seed % Alphabet.Length];
            span[1] = Alphabet[(seed * 3) % Alphabet.Length];
            span[2] = Alphabet[(seed * 7) % Alphabet.Length];
        });
    }

    /// <summary>
    /// Expediente documental que recorre los seis estados de revisión, con vencidos
    /// y por vencer explícitos para que los indicadores tengan qué mostrar.
    /// </summary>
    private async Task AddEmployeeDocumentsAsync(
        Employee employee,
        int number,
        CancellationToken cancellationToken)
    {
        var statuses = new[]
        {
            EmployeeDocumentStatus.Pending,
            EmployeeDocumentStatus.Received,
            EmployeeDocumentStatus.Validated,
            EmployeeDocumentStatus.Rejected,
            EmployeeDocumentStatus.Expired,
            EmployeeDocumentStatus.NotApplicable
        };

        var types = new[]
        {
            EmployeeDocumentType.Curp,
            EmployeeDocumentType.ProofOfAddress,
            EmployeeDocumentType.CriminalRecordCertificate,
            EmployeeDocumentType.VoterId,
            EmployeeDocumentType.ProofOfStudies,
            EmployeeDocumentType.SocialSecurityNumber
        };

        for (var index = 0; index < types.Length; index++)
        {
            var status = statuses[(number + index) % statuses.Length];

            // La expedición siempre queda bien atrás; el vencimiento se deriva de ella para
            // no violar la invariante ExpiresDate >= IssuedDate del dominio.
            var issuedOffset = -Rng.Next(200, 900);
            var issued = Days(issuedOffset);

            // Vencido de verdad, por vencer dentro de 15 días, sin vencimiento, o vigente.
            DateOnly? expires = ((number + index) % 5) switch
            {
                0 => Days(Rng.Next(issuedOffset + 30, 0)),
                1 => Days(Rng.Next(1, 16)),
                2 => null,
                _ => Days(Rng.Next(60, 700))
            };

            if (status == EmployeeDocumentStatus.Expired)
            {
                expires = Days(Rng.Next(issuedOffset + 30, 0));
            }

            var document = EmployeeDocument.Create(
                employee.IdOrganization,
                employee.IdEmployee,
                new EmployeeDocumentProfile(
                    types[index],
                    status,
                    $"DOC-{number:000}-{index + 1:00}",
                    status == EmployeeDocumentStatus.Pending ? null : issued.AddDays(Rng.Next(1, 20)),
                    status == EmployeeDocumentStatus.Pending ? null : issued,
                    expires,
                    status is EmployeeDocumentStatus.Pending or EmployeeDocumentStatus.NotApplicable
                        ? null
                        : $"business-documents/demo/{employee.CodeEmployee.ToLowerInvariant()}-{index + 1:00}.pdf",
                    status == EmployeeDocumentStatus.Rejected
                        ? "Documento ilegible, se solicitó reposición."
                        : null),
                DemoActorId,
                DemoActorName,
                OccurredAt);
            await dbContext.EmployeeDocuments.AddAsync(document, cancellationToken);
        }
    }

    private async Task AddEmployeeEvaluationsAsync(
        Employee employee,
        int number,
        CancellationToken cancellationToken)
    {
        var results = new[]
        {
            EmployeeEvaluationResult.Pending,
            EmployeeEvaluationResult.Approved,
            EmployeeEvaluationResult.ApprovedWithObservations,
            EmployeeEvaluationResult.NotApproved,
            EmployeeEvaluationResult.Inconclusive
        };

        var types = new[]
        {
            EmployeeEvaluationType.Polygraph,
            EmployeeEvaluationType.SocioeconomicStudy,
            EmployeeEvaluationType.CriminalRecordReview
        };

        for (var index = 0; index < types.Length; index++)
        {
            var result = results[(number + index) % results.Length];

            // La fecha evaluada entra en el índice único (empleado, tipo, fecha): se separa por índice.
            var evaluatedDate = Days(-(30 + (index * 45) + (number % 20)));

            var evaluation = EmployeeEvaluation.Create(
                employee.IdOrganization,
                employee.IdEmployee,
                new EmployeeEvaluationProfile(
                    types[index],
                    result,
                    evaluatedDate,
                    result == EmployeeEvaluationResult.Pending ? null : evaluatedDate.AddYears(1),
                    result == EmployeeEvaluationResult.Pending ? null : $"CERT-{number:000}-{index + 1:00}",
                    result == EmployeeEvaluationResult.Pending
                        ? null
                        : $"business-documents/demo/eval-{employee.CodeEmployee.ToLowerInvariant()}-{index + 1:00}.pdf",
                    result == EmployeeEvaluationResult.NotApproved
                        ? "Resultado no aprobatorio; no elegible para asignación."
                        : null),
                DemoActorId,
                DemoActorName,
                OccurredAt);
            await dbContext.EmployeeEvaluations.AddAsync(evaluation, cancellationToken);
        }
    }

    private async Task AddEmployeeSkillsAsync(
        Employee employee,
        int number,
        List<BusinessCatalogItem> skills,
        CancellationToken cancellationToken)
    {
        if (skills.Count == 0)
        {
            return;
        }

        var assigned = new HashSet<Guid>();
        var howMany = Rng.Next(1, 4);
        for (var index = 0; index < howMany; index++)
        {
            var skill = skills[(number + index) % skills.Count];
            if (!assigned.Add(skill.IdBusinessCatalogItem))
            {
                continue;
            }

            var employeeSkill = EmployeeSkill.Create(
                employee.IdOrganization,
                employee.IdEmployee,
                new EmployeeSkillProfile(
                    skill.IdBusinessCatalogItem,
                    Days(-Rng.Next(100, 1500)),
                    index % 3 == 0 ? Days(Rng.Next(-30, 400)) : null,
                    null),
                DemoActorId,
                DemoActorName,
                OccurredAt);
            await dbContext.EmployeeSkills.AddAsync(employeeSkill, cancellationToken);
        }
    }

    /// <summary>
    /// Asignaciones de personal activo a posiciones, incluyendo a propósito un traslape de
    /// fechas para el mismo empleado. El traslape es representable en el esquema; lo que lo
    /// rechaza es <c>AssignmentService</c>, así que al editarlo desde la API responde 409.
    /// </summary>
    private async Task EnsureAssignmentsAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.ServiceAssignments
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(item => item.Employee.IdOrganization == organization.IdOrganization, cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "assignments");
        }
        else
        {
            var positions = await dbContext.Positions
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodePosition)
                .ToListAsync(cancellationToken);

            var employees = await dbContext.Employees
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization &&
                    item.Status == EmployeeStatus.Active)
                .OrderBy(item => item.CodeEmployee)
                .ToListAsync(cancellationToken);

            if (positions.Count > 0 && employees.Count > 0)
            {
                for (var index = 0; index < employees.Count; index++)
                {
                    var employee = employees[index];
                    var position = positions[index % positions.Count];
                    var start = Days(-Rng.Next(20, 300));

                    await dbContext.ServiceAssignments.AddAsync(
                        ServiceAssignment.Create(
                            position.IdOrganization,
                            employee.IdEmployee,
                            position.IdService,
                            new ServiceAssignmentProfile(
                                position.IdPosition,
                                index % 4 == 0 ? ServiceAssignmentType.Support : ServiceAssignmentType.Primary,
                                start,
                                index % 9 == 8 ? start.AddDays(Rng.Next(30, 120)) : null,
                                index % 4 != 0,
                                null),
                            DemoActorId,
                            DemoActorName,
                            OccurredAt),
                        cancellationToken);
                }

                // Traslape deliberado: el primer empleado recibe una segunda asignación abierta
                // que se encima con la anterior, en una posición de otro servicio.
                if (positions.Count > 1)
                {
                    var conflicted = employees[0];
                    var otherPosition = positions[1];
                    await dbContext.ServiceAssignments.AddAsync(
                        ServiceAssignment.Create(
                            otherPosition.IdOrganization,
                            conflicted.IdEmployee,
                            otherPosition.IdService,
                            new ServiceAssignmentProfile(
                                otherPosition.IdPosition,
                                ServiceAssignmentType.Relief,
                                Days(-10),
                                null,
                                false,
                                "CASO FEO: traslape deliberado con la asignación principal del mismo empleado. " +
                                "AssignmentService responde 409 al intentar editarla desde la API."),
                            DemoActorId,
                            DemoActorName,
                            OccurredAt),
                        cancellationToken);
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.Assignments = await dbContext.ServiceAssignments.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.Employee.IdOrganization == organization.IdOrganization, cancellationToken);
    }

    /// <summary>
    /// Tres versiones de planeación por servicio elegido: una publicada, una en borrador y
    /// una sustituida. Sólo la publicada lleva turnos suficientes para un mes de operación.
    /// </summary>
    private async Task EnsureSchedulesAsync(
        Organization organization,
        DemoSeedReport report,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.ScheduleVersions
            .IgnoreQueryFilters(["Active", "Organization"])
            .AnyAsync(
                item => item.IdOrganization == organization.IdOrganization,
                cancellationToken);

        if (existing)
        {
            DemoSeedLog.PhaseSkipped(logger, "schedules");
        }
        else
        {
            var services = await dbContext.Services
                .IgnoreQueryFilters(["Active", "Organization"])
                .Where(item => item.IdOrganization == organization.IdOrganization)
                .OrderBy(item => item.CodeService)
                .ToListAsync(cancellationToken);

            var periodStart = new DateOnly(Today.Year, Today.Month, 1).AddMonths(-1);
            var periodEnd = periodStart.AddMonths(1).AddDays(-1);

            foreach (var service in services)
            {
                var positions = await dbContext.Positions
                    .IgnoreQueryFilters(["Active", "Organization"])
                    .Where(item => item.IdService == service.IdService)
                    .OrderBy(item => item.CodePosition)
                    .ToListAsync(cancellationToken);

                if (positions.Count == 0)
                {
                    continue;
                }

                var assignedEmployees = await dbContext.ServiceAssignments
                    .IgnoreQueryFilters(["Active", "Organization"])
                    .Where(item => item.IdService == service.IdService)
                    .Select(item => item.IdEmployee)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                if (assignedEmployees.Count == 0)
                {
                    continue;
                }

                // Sustituida: periodo anterior, ya reemplazada.
                var superseded = ScheduleVersion.Create(
                    service.IdOrganization,
                    service.IdService,
                    new ScheduleVersionProfile(
                        $"{service.CodeService} · {periodStart.AddMonths(-1):yyyy-MM} v1",
                        periodStart.AddMonths(-1),
                        periodStart.AddDays(-1),
                        "Versión sustituida por un ajuste de cobertura."),
                    DemoActorId,
                    DemoActorName,
                    OccurredAt);
                superseded.Publish(DemoActorId, DemoActorName, OccurredAt);
                superseded.MarkSuperseded(DemoActorId, DemoActorName, OccurredAt);
                await dbContext.ScheduleVersions.AddAsync(superseded, cancellationToken);

                // Publicada: el mes que alimenta la operación diaria.
                var published = ScheduleVersion.Create(
                    service.IdOrganization,
                    service.IdService,
                    new ScheduleVersionProfile(
                        $"{service.CodeService} · {periodStart:yyyy-MM} v2",
                        periodStart,
                        periodEnd,
                        "Versión publicada y vigente."),
                    DemoActorId,
                    DemoActorName,
                    OccurredAt);
                published.Publish(DemoActorId, DemoActorName, OccurredAt);
                await dbContext.ScheduleVersions.AddAsync(published, cancellationToken);

                // Borrador: el periodo siguiente, todavía editable.
                var draft = ScheduleVersion.Create(
                    service.IdOrganization,
                    service.IdService,
                    new ScheduleVersionProfile(
                        $"{service.CodeService} · {periodEnd.AddDays(1):yyyy-MM} v1",
                        periodEnd.AddDays(1),
                        periodEnd.AddMonths(1),
                        "Borrador en preparación."),
                    DemoActorId,
                    DemoActorName,
                    OccurredAt);
                await dbContext.ScheduleVersions.AddAsync(draft, cancellationToken);

                await AddScheduledShiftsAsync(published, positions, assignedEmployees, periodStart, periodEnd, cancellationToken);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        report.ScheduleVersions = await dbContext.ScheduleVersions.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(item => item.IdOrganization == organization.IdOrganization, cancellationToken);
        report.ScheduledShifts = await dbContext.ScheduledShifts.IgnoreQueryFilters(["Active", "Organization"])
            .CountAsync(
                item => item.IdOrganization == organization.IdOrganization,
                cancellationToken);
    }

    private async Task AddScheduledShiftsAsync(
        ScheduleVersion version,
        List<Position> positions,
        List<Guid> employees,
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken cancellationToken)
    {
        var employeeIndex = 0;
        for (var date = periodStart; date <= periodEnd; date = date.AddDays(1))
        {
            if (date.DayOfWeek == DayOfWeek.Sunday)
            {
                continue;
            }

            foreach (var position in positions)
            {
                var isNight = position.CodePosition.EndsWith("P02", StringComparison.Ordinal);
                var shift = ScheduledShift.Create(
                    version.IdOrganization,
                    version.IdScheduleVersion,
                    new ScheduledShiftProfile(
                        position.IdPosition,
                        employees[employeeIndex % employees.Count],
                        date,
                        isNight ? new TimeOnly(20, 0) : new TimeOnly(7, 0),
                        isNight ? new TimeOnly(8, 0) : new TimeOnly(19, 0),
                        isNight,
                        null),
                    DemoActorId,
                    DemoActorName,
                    OccurredAt);
                await dbContext.ScheduledShifts.AddAsync(shift, cancellationToken);
                employeeIndex++;
            }
        }
    }
}
