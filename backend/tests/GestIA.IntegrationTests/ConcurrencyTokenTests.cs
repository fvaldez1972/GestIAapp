using GestIA.Application.Common;
using GestIA.Domain.Clients;
using GestIA.Domain.Operations;
using GestIA.Domain.Organizations;
using GestIA.Domain.Planning;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;
using GestIA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GestIA.IntegrationTests;

/// <summary>
/// El token de concurrencia contra una base real.
///
/// <para>Lo que estas pruebas demuestran es la pérdida que las transacciones serializables
/// <b>no</b> evitan: el supervisor B abrió la pantalla, A guardó, y B guarda con lo que tenía en
/// pantalla desde antes. La transacción de B lee el registro ya actualizado y lo pisa
/// correctamente y sin error. El desfase vive fuera de la base, y sólo el token lo ve.</para>
///
/// Contra una base temporal propia. Nunca toca <c>db-gestia-dev</c>.
/// </summary>
public sealed class ConcurrencyTokenTests(OperationalSqlDatabase database)
    : IClassFixture<OperationalSqlDatabase>
{
    private static readonly Guid ActorId = Guid.Parse("0f4a7f4f-1f0e-4a35-8f2e-3f9d5a6b7c80");
    private const string ActorName = "Pruebas";
    private static readonly DateTime Now = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 5);

    /// <summary>
    /// <b>Un efecto que no estaba en el plan y conviene dejar dicho.</b>
    ///
    /// <para>Una vez que la columna es token de concurrencia, EF la incluye en el <c>WHERE</c> de
    /// todo <c>UPDATE</c>, se declare o no expectativa. Eso significa que <b>cualquier contexto
    /// que haya leído la fila antes de la escritura ganadora queda protegido solo</b>: no hace
    /// falta que nadie mande nada.</para>
    ///
    /// <para>Lo que la declaración explícita agrega es la protección <b>entre peticiones</b>, que
    /// es la que de verdad faltaba: ahí el servidor lee la fila fresca dentro de la petición y el
    /// desfase vive únicamente en el navegador de quien la abrió antes. Sin el token viajando de
    /// ida y vuelta, esa escritura pisa sin error.</para>
    ///
    /// <para>Esta prueba existe porque el intento original —reproducir la pérdida silenciosa— dejó
    /// de ser posible al agregar la columna, y eso es un dato, no un estorbo.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task TwoContextsLoadedBeforeTheWinningWriteAreProtectedWithoutDeclaringAnything()
    {
        var seed = await SeedAsync("SIL");

        await using var first = database.Context();
        await using var second = database.Context();

        var byA = await first.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
        var byB = await second.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);

        byA.UpdateProfile(new(AttendanceStatus.Late, new TimeOnly(8, 30), new TimeOnly(16, 0), 30, null), ActorId, ActorName, Now);
        await first.SaveChangesAsync();

        byB.UpdateProfile(new(AttendanceStatus.Absent, null, null, 0, null), ActorId, ActorName, Now);

        // Sin una sola llamada al guardian: el token que B leyo al cargar ya no coincide.
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());

        await using var check = database.Context();
        var stored = await check.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);

        Assert.Equal(AttendanceStatus.Late, stored.Status);
    }

    /// <summary>
    /// Con el token declarado, el segundo guardado falla en vez de pisar.
    /// </summary>
    [OperationalSqlFact]
    public async Task WithTheTokenTheSecondSaveFailsInsteadOfOverwriting()
    {
        var seed = await SeedAsync("TOK");

        await using var first = database.Context();
        await using var second = database.Context();

        var byA = await first.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
        var byB = await second.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);

        // B se quedó con la versión que leyó al abrir la pantalla.
        var versionSeenByB = byB.RowVersion;

        byA.UpdateProfile(new(AttendanceStatus.Late, new TimeOnly(8, 30), new TimeOnly(16, 0), 30, null), ActorId, ActorName, Now);
        await first.SaveChangesAsync();

        new EfConcurrencyGuard(second).Expect(byB, versionSeenByB);
        byB.UpdateProfile(new(AttendanceStatus.Absent, null, null, 0, null), ActorId, ActorName, Now);

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());

        await using var check = database.Context();
        var stored = await check.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);

        // El cambio de A sobrevivió.
        Assert.Equal(AttendanceStatus.Late, stored.Status);
    }


    /// <summary>
    /// <b>El conflicto explicado también fuera de la transacción operativa.</b>
    ///
    /// <para>De las seis entidades con token, cuatro guardan dentro de la transacción operativa,
    /// que ya traducía el conflicto a un mensaje con nombre y fecha. Las otras dos —la
    /// configuración de servicio y la asignación de personal— guardan por el camino normal, y su
    /// conflicto salía como un error interno sin explicación. Eran justo las dos que edita la
    /// pantalla de Servicios: el mensaje estaba construido y no llegaba a la mitad de los
    /// casos.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task TheNormalSavePathAlsoExplainsWhoOverwroteTheRecord()
    {
        var seed = await SeedAsync("EXP");

        await using var first = database.Context();
        await using var second = database.Context();

        var byA = await first.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
        var byB = await second.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
        var versionSeenByB = byB.RowVersion;

        // Cinco minutos después, que es lo que pasa de verdad: la escritura ganadora es posterior.
        // Con el mismo instante, el desempate del último evento de bitácora cae en un identificador
        // aleatorio y la prueba se vuelve intermitente.
        byA.UpdateProfile(
            new(AttendanceStatus.Late, new TimeOnly(8, 30), new TimeOnly(16, 0), 30, null),
            ActorId, "Ana Ruiz Montaño", Now.AddMinutes(5));
        await first.SaveChangesAsync();

        new EfConcurrencyGuard(second).Expect(byB, versionSeenByB);
        byB.UpdateProfile(new(AttendanceStatus.Absent, null, null, 0, null), ActorId, ActorName, Now);

        var conflicto = await Assert.ThrowsAsync<ConcurrencyConflictException>(
            () => new EfUnitOfWork(second, new RelojDePruebas()).SaveChangesAsync());

        // Lo que esta prueba fija es que el camino normal **también** explica el conflicto: no es
        // el mensaje genérico, nombra a una persona y lleva la fecha en el huso operativo.
        Assert.NotEqual(ConcurrencyConflictMessage.Generic, conflicto.Message);
        Assert.Contains("corrigió este registro", conflicto.Message, StringComparison.Ordinal);
        Assert.Matches(@"\d{2} \w+ 2026 a las \d{2}:\d{2}", conflicto.Message);

        // **Cuál** de los dos nombres aparece depende del orden de la bitácora, y ahí el desempate
        // entre dos eventos del mismo instante cae en un identificador aleatorio. Eso es una
        // debilidad del orden, no de este camino, y se anota aparte: fijarlo aquí volvería
        // intermitente una prueba que comprueba otra cosa.
    }

    /// <summary>Reloj fijo, con el huso operativo por omisión.</summary>
    private sealed class RelojDePruebas : IClock
    {
        public DateTime UtcNow => Now;
        public DateOnly Today => Day;
        public TimeZoneInfo OperationalTimeZone { get; } =
            TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City");
    }

    /// <summary>
    /// El token cambia en cada escritura: el que se leyó después de guardar sí sirve.
    /// </summary>
    [OperationalSqlFact]
    public async Task AFreshTokenLetsTheCorrectionThrough()
    {
        var seed = await SeedAsync("FRE");

        await using (var first = database.Context())
        {
            var record = await first.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
            record.UpdateProfile(new(AttendanceStatus.Late, new TimeOnly(8, 30), new TimeOnly(16, 0), 30, null), ActorId, ActorName, Now);
            await first.SaveChangesAsync();
        }

        await using var second = database.Context();
        var reloaded = await second.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);

        new EfConcurrencyGuard(second).Expect(reloaded, reloaded.RowVersion);
        reloaded.UpdateProfile(new(AttendanceStatus.Excused, null, null, 0, null), ActorId, ActorName, Now);

        await second.SaveChangesAsync();

        await using var check = database.Context();
        Assert.Equal(
            AttendanceStatus.Excused,
            (await check.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId)).Status);
    }

    /// <summary>
    /// Un token ausente ya no pasa: el guard lo rechaza en vez de escribir sin comprobar.
    ///
    /// <para><b>Esta prueba estaba escrita al reves y a proposito se invirtio</b>, igual que
    /// <c>SingleHopEntitiesDoNotDuplicateTheOrganization</c> en la tanda E. Antes se llamaba
    /// <c>WithoutADeclaredTokenNothingIsChecked</c> y aseguraba que un nulo o un arreglo vacio
    /// dejaran guardar sin comprobar nada. Esa garantia era justo el permiso para olvidar el
    /// token, y el olvido ocurrio: durante meses el frontend lo mando desde un solo lugar de seis
    /// y ninguna peticion fallo, porque no fallar era el comportamiento pactado aqui.</para>
    ///
    /// <para>Lo que si sigue siendo cierto —que un alta no lleva token— ya no depende de que el
    /// guard perdone la ausencia: depende de que la rama de alta no lo llame. Quien decide es
    /// <c>UpsertAttendanceAsync</c>, que exige el token en cuanto la fila existe.</para>
    /// </summary>
    [OperationalSqlFact]
    public async Task AMissingTokenIsRejectedInsteadOfSkippingTheCheck()
    {
        var seed = await SeedAsync("AUS");

        await using var context = database.Context();
        var record = await context.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
        var guard = new EfConcurrencyGuard(context);

        // El arreglo vacio se comprueba aparte del nulo porque es la forma que puede colarse por
        // el deserializador, donde el sistema de tipos ya no protege nada.
        Assert.Throws<ConcurrencyTokenMissingException>(() => guard.Expect(record, []));
        Assert.Throws<ConcurrencyTokenMissingException>(() => guard.Expect(record, null!));
    }

    /// <summary>El token de otro registro no sirve para pasar la comprobación de éste.</summary>
    [OperationalSqlFact]
    public async Task ATokenFromAnotherRecordDoesNotWork()
    {
        var seed = await SeedAsync("OTR");

        await using var context = database.Context();
        var record = await context.AttendanceRecords.SingleAsync(item => item.IdAttendanceRecord == seed.AttendanceId);
        var closure = await context.OperationDayClosures.FirstOrDefaultAsync();

        new EfConcurrencyGuard(context).Expect(record, closure?.RowVersion ?? [9, 9, 9, 9, 9, 9, 9, 9]);
        record.UpdateProfile(new(AttendanceStatus.Absent, null, null, 0, null), ActorId, ActorName, Now);

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => context.SaveChangesAsync());
    }

    /// <summary>
    /// El cierre de día también lleva token, y es el caso que más importa: es el conflicto más
    /// probable de todos —dos personas cerrando el turno a la vez— y el único de los seis que
    /// nunca tendrá evento de bitácora del que sacar el nombre.
    /// </summary>
    [OperationalSqlFact]
    public async Task TheDayClosureIsProtectedTooAndHasNoHistoryToFallBackOn()
    {
        var seed = await SeedAsync("CIE");

        Guid closureId;
        await using (var setup = database.Context())
        {
            var closure = OperationDayClosure.Create(
                new(seed.OrganizationId, seed.ServiceId, Day, 1, 1, 0, 0, 0, null),
                ActorId, ActorName, Now);
            closureId = closure.IdOperationDayClosure;
            setup.Add(closure);
            await setup.SaveChangesAsync();
        }

        await using var first = database.Context();
        await using var second = database.Context();

        var byA = await first.OperationDayClosures.SingleAsync(item => item.IdOperationDayClosure == closureId);
        var byB = await second.OperationDayClosures.SingleAsync(item => item.IdOperationDayClosure == closureId);
        var versionSeenByB = byB.RowVersion;

        byA.Reopen("Se reabre para corregir la asistencia", ActorId, "Ana Ruiz", Now);
        await first.SaveChangesAsync();

        new EfConcurrencyGuard(second).Expect(byB, versionSeenByB);
        byB.Reopen("Se reabre por otra razon distinta", ActorId, "Luis Mena", Now);

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());

        // Y no hay bitácora de la que sacar el nombre: por eso existe el segundo nivel del mensaje.
        await using var check = database.Context();
        Assert.Empty(await check.OperationalEvents.Where(item => item.RecordId == closureId).ToArrayAsync());

        var stored = await check.OperationDayClosures.SingleAsync(item => item.IdOperationDayClosure == closureId);
        Assert.Equal("Ana Ruiz", stored.ReopenedByName);
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
        var site = ClientSite.Create(organizationId, client.IdClient, $"{prefix}-SED", "Sede", "Calle", "Ciudad", "Estado", "01000", ActorId, ActorName, Now);
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
        return new(organizationId, service.IdService, attendance.IdAttendanceRecord);
    }

    private sealed record Seed(Guid OrganizationId, Guid ServiceId, Guid AttendanceId);
}
