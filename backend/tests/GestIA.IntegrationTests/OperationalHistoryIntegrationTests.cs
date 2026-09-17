using System.Globalization;
using System.Text.Json;
using GestIA.Application.History;
using GestIA.Domain.Clients;
using GestIA.Domain.Documents;
using GestIA.Domain.History;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence;
using GestIA.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// La bitácora funcional contra una base real.
///
/// Lo que estas pruebas demuestran, y que ninguna prueba de modelo puede demostrar: que el evento
/// y el cambio se guardan <b>juntos o no se guarda ninguno</b>, y que el evento no se puede
/// corregir después.
///
/// Corre contra una base temporal propia, creada y destruida por
/// <see cref="OperationalSqlDatabase"/>. Nunca toca <c>db-gestia-dev</c>.
/// </summary>
public sealed class OperationalHistoryIntegrationTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly Guid ActorId = Guid.Parse("0f4a7f4f-1f0e-4a35-8f2e-3f9d5a6b7c80");
    private const string ActorName = "Pruebas";
    private static readonly DateTime Now = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 5);
    private const string Reason = "Se corrigió la hora de entrada del turno";

    [OperationalSqlFact]
    public async Task TheEventAndTheChangeAreSavedTogether()
    {
        var seed = await SeedAsync("EVT");
        database.Reason.SetReason(Reason, true);

        await using (var context = database.Context())
        {
            var attendance = await context.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
            attendance.UpdateProfile(
                new(AttendanceStatus.Late, new TimeOnly(8, 30), new TimeOnly(16, 0), 30, null),
                ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        await using var check = database.Context();
        var events = await check.OperationalEvents
            .Where(item => item.RecordId == seed.AttendanceId)
            .ToArrayAsync();

        var item = Assert.Single(events);
        Assert.Equal(OperationalEntityType.AttendanceRecord, item.EntityType);
        Assert.Equal(OperationalEventActions.Updated, item.Action);
        Assert.Equal(seed.OrganizationId, item.IdOrganization);
        Assert.Equal(Reason, item.Reason);
        Assert.True(item.IsReasonRequired);
        Assert.Equal(ActorName, item.ActorName);

        // La foto previa trae el estado anterior y la posterior el nuevo: eso es lo que permite
        // reconstruir qué cambió sin haber guardado el texto libre del registro.
        Assert.Equal("Present", Field(item.BeforeSnapshot!, "Status"));
        Assert.Equal("Late", Field(item.AfterSnapshot, "Status"));
        Assert.Equal("0", Field(item.BeforeSnapshot!, "MinutesLate"));
        Assert.Equal("30", Field(item.AfterSnapshot, "MinutesLate"));
    }

    /// <summary>
    /// La prueba que demuestra que la bitácora no puede mentir: si el guardado falla, no queda ni
    /// el cambio ni el evento. Sin ella, "van en la misma transacción" es una afirmación.
    /// </summary>
    [OperationalSqlFact]
    public async Task WhenTheSaveFailsNeitherTheChangeNorTheEventSurvive()
    {
        var seed = await SeedAsync("FAL");
        database.Reason.SetReason(Reason, true);

        await using (var context = database.Context())
        {
            var attendance = await context.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
            attendance.UpdateProfile(
                new(AttendanceStatus.Absent, null, null, 0, null), ActorId, ActorName, Now);

            // Una incidencia que apunta a un servicio inexistente rompe la llave foránea, así que
            // el lote entero se revierte: el cambio de arriba y el evento que lo documenta.
            context.Incidents.Add(Incident.Create(
                seed.OrganizationId, Guid.NewGuid(),
                new(null, null, Day, "RETARDO", IncidentSeverity.Low, IncidentStatus.Open, "Rompe", null),
                ActorId, ActorName, Now));

            await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
        }

        await using var check = database.Context();
        Assert.Empty(await check.OperationalEvents.Where(item => item.RecordId == seed.AttendanceId).ToArrayAsync());

        var stored = await check.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
        Assert.Equal(AttendanceStatus.Present, stored.Status);
    }

    [OperationalSqlFact]
    public async Task AnEventCannotBeCorrectedOrDeletedAfterTheFact()
    {
        var seed = await SeedAsync("INM");
        database.Reason.SetReason(Reason, true);

        await using (var context = database.Context())
        {
            var attendance = await context.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
            attendance.UpdateProfile(new(AttendanceStatus.Absent, null, null, 0, null), ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        await using (var modify = database.Context())
        {
            var item = await modify.OperationalEvents.FirstAsync(entry => entry.RecordId == seed.AttendanceId);
            modify.Entry(item).State = EntityState.Modified;
            await Assert.ThrowsAsync<InvalidOperationException>(() => modify.SaveChangesAsync());
        }

        await using var remove = database.Context();
        var target = await remove.OperationalEvents.FirstAsync(entry => entry.RecordId == seed.AttendanceId);
        remove.OperationalEvents.Remove(target);
        await Assert.ThrowsAsync<InvalidOperationException>(() => remove.SaveChangesAsync());
    }

    /// <summary>
    /// Un motivo por operación de guardado, no por campo: corregir tres datos de la misma
    /// configuración es una sola corrección.
    /// </summary>
    [OperationalSqlFact]
    public async Task ThreeFieldsChangedInOneSaveLeaveOneEventWithOneReason()
    {
        var seed = await SeedAsync("UNO");
        database.Reason.SetReason("Se renegoció el contrato con el cliente", true);

        await using (var context = database.Context())
        {
            // El sujeto es el registro de asistencia: la configuracion del servicio se retiro del
            // modelo, y la asistencia es otra de las entidades con historial funcional.
            var attendance = await context.AttendanceRecords
                .SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);

            attendance.UpdateProfile(
                new(AttendanceStatus.Late, new TimeOnly(8, 30), new TimeOnly(16, 30), 35, null),
                ActorId,
                ActorName,
                Now);

            await context.SaveChangesAsync();
        }

        await using var check = database.Context();
        var events = await check.OperationalEvents
            .Where(item => item.RecordId == seed.AttendanceId)
            .ToArrayAsync();

        var item = Assert.Single(events);
        Assert.Equal("Se renegoció el contrato con el cliente", item.Reason);
        Assert.Equal("35", Field(item.AfterSnapshot, "MinutesLate"));
    }

    /// <summary>
    /// El motivo no se hereda: tras un guardado correcto se olvida, para que una corrección
    /// posterior no quede registrada con una justificación que no le corresponde.
    /// </summary>
    [OperationalSqlFact]
    public async Task AReasonIsNotInheritedByTheNextCorrection()
    {
        var seed = await SeedAsync("HER");
        database.Reason.SetReason(Reason, true);

        await using (var first = database.Context())
        {
            var attendance = await first.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
            attendance.UpdateProfile(new(AttendanceStatus.Late, new TimeOnly(8, 30), new TimeOnly(16, 0), 30, null), ActorId, ActorName, Now);
            await first.SaveChangesAsync();
        }

        await using (var second = database.Context())
        {
            var attendance = await second.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
            attendance.UpdateProfile(new(AttendanceStatus.Excused, null, null, 0, null), ActorId, ActorName, Now);
            await second.SaveChangesAsync();
        }

        await using var check = database.Context();
        var events = await check.OperationalEvents
            .Where(item => item.RecordId == seed.AttendanceId)
            .OrderBy(item => item.Action)
            .ToArrayAsync();

        Assert.Equal(2, events.Length);
        Assert.Single(events, item => item.Reason == Reason && item.IsReasonRequired);
        Assert.Single(events, item => item.Reason is null && !item.IsReasonRequired);
    }

    /// <summary>
    /// Las altas no se registran: no hay valor anterior que mostrar, y quién creó el registro y
    /// cuándo ya lo dicen sus propios campos de auditoría.
    /// </summary>
    [OperationalSqlFact]
    public async Task CreatingARecordLeavesNoEvent()
    {
        var seed = await SeedAsync("ALT");

        await using var check = database.Context();
        Assert.Empty(await check.OperationalEvents.Where(item => item.RecordId == seed.AttendanceId).ToArrayAsync());
    }

    /// <summary>
    /// El historial de un registro de otra organización no se ve: el filtro global de la tanda B
    /// cubre también la bitácora, que es la entidad número 24.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheHistoryOfAnotherOrganizationComesBackEmpty()
    {
        var mine = await SeedAsync("MIA");
        database.Reason.SetReason(Reason, true);

        await using (var context = database.Context())
        {
            var attendance = await context.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == mine.AttendanceId);
            attendance.UpdateProfile(new(AttendanceStatus.Absent, null, null, 0, null), ActorId, ActorName, Now);
            await context.SaveChangesAsync();
        }

        var other = await SeedAsync("OTR");

        // Parado en la otra organización, el historial del registro ajeno no existe.
        database.Organization.SetAuthorizedOrganization(other.OrganizationId);
        await using var foreignContext = database.Context();
        var foreignRepository = new OperationalHistoryRepository(foreignContext);
        Assert.Empty(await foreignRepository.ListAsync(
            OperationalEntityType.AttendanceRecord, mine.AttendanceId, CancellationToken.None));

        // Y desde la suya, sí.
        database.Organization.SetAuthorizedOrganization(mine.OrganizationId);
        await using var ownContext = database.Context();
        var ownRepository = new OperationalHistoryRepository(ownContext);
        Assert.Single(await ownRepository.ListAsync(
            OperationalEntityType.AttendanceRecord, mine.AttendanceId, CancellationToken.None));
    }

    /// <summary>El historial documental sigue protegido exactamente igual que antes.</summary>
    [OperationalSqlFact]
    public async Task TheDocumentHistoryKeepsItsOwnProtection()
    {
        var seed = await SeedAsync("DOC");

        Guid documentId;
        await using (var context = database.Context())
        {
            var document = BusinessDocument.Create(
                seed.OrganizationId,
                new(BusinessDocumentOwnerType.Client, seed.ClientId, "Contrato", "Documento",
                    BusinessDocumentStatus.PendingReview, null, null, "business-documents/DOC.pdf", false, null),
                ActorId, ActorName, Now);
            documentId = document.IdBusinessDocument;
            context.AddRange(document, BusinessDocumentEvent.Record(document, "Created", null, ActorId, ActorName, Now));
            await context.SaveChangesAsync();
        }

        await using var modify = database.Context();
        var item = await modify.BusinessDocumentEvents.FirstAsync(entry => entry.IdBusinessDocument == documentId);
        modify.Entry(item).State = EntityState.Modified;
        await Assert.ThrowsAsync<InvalidOperationException>(() => modify.SaveChangesAsync());
    }

    private static string Field(string json, string name)
    {
        using var document = JsonDocument.Parse(json);
        var value = document.RootElement.GetProperty(name);
        return value.ValueKind == JsonValueKind.String ? value.GetString()! : value.ToString();
    }

    private async Task<Seed> SeedAsync(string prefix)
    {
        database.Organization.Clear();
        database.Reason.Clear();
        await using var context = database.Context();

        var organization = Organization.Create(
            $"{prefix}{Guid.NewGuid():N}"[..24], $"Organización {prefix}", null, ActorId, ActorName, Now);
        var organizationId = organization.IdOrganization;

        var client = Client.Create(organizationId, $"{prefix}-CLI", "Cliente", "EXA010101AA1", ActorId, ActorName, Now);
        var site = ClientSite.Create(client.IdOrganization, client.IdClient, $"{prefix}-SED", "Sede", "Calle", "Ciudad", "Estado", "01000", ActorId, ActorName, Now);
        var service = Service.Create(organizationId, client.IdClient, site.IdClientSite, null, $"{prefix}-SER", "Servicio", "Servicio", Day, ActorId, ActorName, Now);
        var position = Position.Create(organizationId, service.IdService, $"{prefix}-PUE", new("Puesto", 1, null, null), ActorId, ActorName, Now);
        var employee = Employee.Create(organizationId, $"{prefix}-EMP", "Empleado", null, Day, ActorId, ActorName, Now);
        var version = ScheduleVersion.Create(organizationId, service.IdService, new("Versión", Day, Day.AddDays(1), null), ActorId, ActorName, Now);
        version.Publish(ActorId, ActorName, Now);
        var shift = ScheduledShift.Create(
            organizationId, version.IdScheduleVersion,
            new(position.IdPosition, employee.IdEmployee, Day, new TimeOnly(8, 0), new TimeOnly(16, 0), false, null),
            ActorId, ActorName, Now);
        var attendance = AttendanceRecord.Create(
            organizationId, shift.IdScheduledShift, employee.IdEmployee, Day,
            new(AttendanceStatus.Present, new TimeOnly(8, 0), new TimeOnly(16, 0), 0, null),
            ActorId, ActorName, Now);

        context.AddRange(organization, client, site, service, position, employee, version, shift, attendance);
        await context.SaveChangesAsync();

        database.Organization.SetAuthorizedOrganization(organizationId);
        return new(organizationId, client.IdClient, attendance.IdAttendanceRecord);
    }

    private sealed record Seed(Guid OrganizationId, Guid ClientId, Guid AttendanceId);
}
