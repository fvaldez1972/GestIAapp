using GestIA.Application.Common;
using GestIA.Application.Planning;
using GestIA.Domain.Planning;

namespace GestIA.Application.UnitTests;

/// <summary>
/// Las tres decisiones del catálogo de patrones que no viven en el dominio.
///
/// <para>Lo que sí vive en el dominio —la duración de un turno que cruza la medianoche, las horas
/// por semana de un ciclo, el límite legal con su vigencia— ya lo cubren las pruebas de
/// <c>ShiftPatternTemplate</c> y <c>WeeklyHoursRules</c>. Aquí se prueba lo que decide el servicio:
/// qué se ofrece en el desplegable, qué se puede retirar, y contra qué fecha se juzga.</para>
/// </summary>
public class ShiftPatternTemplateServiceTests
{
    private static readonly Guid Organizacion = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task IncompleteTemplatesAreNotOffered()
    {
        // Doce por doce, pero sólo con el día 1 declarado: falta el día 2.
        var incompleta = Plantilla("12x12 diurno", cycleDays: 2, (1, new TimeOnly(7, 0), new TimeOnly(19, 0), false));
        var completa = Plantilla(
            "12x12 nocturno",
            cycleDays: 2,
            (1, new TimeOnly(19, 0), new TimeOnly(7, 0), false),
            (2, null, null, true));

        var servicio = Servicio(new FakeRepository([incompleta, completa]));

        var opciones = await servicio.ListOptionsAsync(Organizacion, CancellationToken.None);

        // Una plantilla con días sin declarar generaría turnos con huecos, y elegirla parecería que
        // el patrón ya está listo.
        Assert.Equal(["12x12 nocturno"], opciones.Select(opcion => opcion.Name));
    }

    [Fact]
    public async Task ATemplateInUseIsNotWithdrawn()
    {
        var plantilla = Plantilla("24x24", cycleDays: 2, (1, new TimeOnly(7, 0), new TimeOnly(7, 0), false), (2, null, null, true));
        var repositorio = new FakeRepository([plantilla]) { PositionsUsing = 3 };
        var servicio = Servicio(repositorio);

        var error = await Assert.ThrowsAsync<ResourceConflictException>(() =>
            servicio.DeactivateAsync(Organizacion, plantilla.IdShiftPatternTemplate, CancellationToken.None));

        // El mensaje dice cuántas, porque «no se puede» sin el número deja a quien lo lee sin
        // saber si le faltan tres cambios o treinta.
        Assert.Contains("3 posiciones", error.Message, StringComparison.Ordinal);
        Assert.True(plantilla.Active);
    }

    [Fact]
    public async Task ATemplateNobodyFollowsIsWithdrawnAndKeepsItsName()
    {
        var plantilla = Plantilla("12x36", cycleDays: 2, (1, new TimeOnly(7, 0), new TimeOnly(19, 0), false), (2, null, null, true));
        var repositorio = new FakeRepository([plantilla]);
        var servicio = Servicio(repositorio);

        await servicio.DeactivateAsync(Organizacion, plantilla.IdShiftPatternTemplate, CancellationToken.None);

        Assert.False(plantilla.Active);
    }

    [Fact]
    public async Task ARepeatedNameIsRefused()
    {
        var servicio = Servicio(new FakeRepository([]) { NameInUse = true });

        var error = await Assert.ThrowsAsync<ResourceConflictException>(() =>
            servicio.CreateAsync(
                new CreateShiftPatternTemplateRequest(
                    Organizacion,
                    "12x12 Diurno",
                    null,
                    ShiftDaypart.Day,
                    2,
                    new DateOnly(2026, 1, 1),
                    null,
                    []),
                CancellationToken.None));

        Assert.Contains("12x12 Diurno", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ADayDeclaredTwiceIsACaptureError()
    {
        var servicio = Servicio(new FakeRepository([]));

        var error = await Assert.ThrowsAsync<RequestValidationException>(() =>
            servicio.CreateAsync(
                new CreateShiftPatternTemplateRequest(
                    Organizacion,
                    "Rol raro",
                    null,
                    ShiftDaypart.Day,
                    2,
                    new DateOnly(2026, 1, 1),
                    null,
                    [
                        new ShiftPatternTemplateDayInput(1, new TimeOnly(7, 0), new TimeOnly(19, 0), false),
                        new ShiftPatternTemplateDayInput(1, new TimeOnly(19, 0), new TimeOnly(7, 0), false)
                    ]),
                CancellationToken.None));

        // El dominio dejaría que la segunda corrigiera a la primera, y entonces el patrón guardado
        // no sería el que la pantalla mandó: se avisa en lugar de elegir una de las dos.
        Assert.Contains("days", error.Errors.Keys);
    }

    [Fact]
    public async Task TheVerdictUsesTheLimitInForceWhenThePatternStartsRuling()
    {
        // Un rol 6x1 de ocho horas: cuarenta y ocho exactas, que es el límite y no lo excede.
        var plantilla = Plantilla(
            "Rol 6x1",
            cycleDays: 7,
            (1, new TimeOnly(8, 0), new TimeOnly(16, 0), false),
            (2, new TimeOnly(8, 0), new TimeOnly(16, 0), false),
            (3, new TimeOnly(8, 0), new TimeOnly(16, 0), false),
            (4, new TimeOnly(8, 0), new TimeOnly(16, 0), false),
            (5, new TimeOnly(8, 0), new TimeOnly(16, 0), false),
            (6, new TimeOnly(8, 0), new TimeOnly(16, 0), false),
            (7, null, null, true));

        var servicio = Servicio(new FakeRepository([plantilla]));

        var filas = await servicio.ListAsync(Organizacion, false, CancellationToken.None);
        var fila = Assert.Single(filas);

        Assert.Equal(48m, fila.WeeklyHours);
        Assert.Equal(48m, fila.WeeklyLimit);
        Assert.Equal(WeeklyHoursCompliance.Compliant, fila.Compliance);
        Assert.Equal(0m, fila.ExcessHours);
        Assert.True(fila.IsComplete);
        Assert.Equal(1, fila.RestDays);
    }

    private static ShiftPatternTemplateService Servicio(FakeRepository repositorio) =>
        new(repositorio, new StubUnitOfWork(), new StubActorContext(), new StubClock());

    private static ShiftPatternTemplate Plantilla(
        string nombre,
        int cycleDays,
        params (int Day, TimeOnly? Start, TimeOnly? End, bool IsRest)[] dias)
    {
        var plantilla = ShiftPatternTemplate.Create(
            Organizacion,
            new ShiftPatternTemplateProfile(nombre, null, ShiftDaypart.Day, cycleDays, new DateOnly(2026, 1, 1), null),
            Guid.NewGuid(),
            "Tester",
            DateTime.UtcNow);

        foreach (var dia in dias)
        {
            plantilla.DeclareDay(dia.Day, dia.Start, dia.End, dia.IsRest, Guid.NewGuid(), "Tester", DateTime.UtcNow);
        }

        return plantilla;
    }

    private sealed class FakeRepository(IReadOnlyList<ShiftPatternTemplate> plantillas) : IShiftPatternTemplateRepository
    {
        public int PositionsUsing { get; init; }

        public bool NameInUse { get; init; }

        public Task<IReadOnlyList<ShiftPatternTemplate>> ListAsync(
            Guid idOrganization,
            bool includeInactive,
            CancellationToken cancellationToken) =>
            Task.FromResult(plantillas);

        public Task<ShiftPatternTemplate?> GetTrackedAsync(
            Guid idShiftPatternTemplate,
            CancellationToken cancellationToken) =>
            Task.FromResult(plantillas.FirstOrDefault(
                plantilla => plantilla.IdShiftPatternTemplate == idShiftPatternTemplate));

        public Task<bool> IsNameInUseAsync(
            Guid idOrganization,
            string normalizedName,
            Guid? excluding,
            CancellationToken cancellationToken) =>
            Task.FromResult(NameInUse);

        public Task<int> CountPositionsUsingAsync(
            Guid idShiftPatternTemplate,
            CancellationToken cancellationToken) =>
            Task.FromResult(PositionsUsing);

        public Task<bool> IsAssignableAsync(
            Guid idOrganization,
            Guid idShiftPatternTemplate,
            CancellationToken cancellationToken) =>
            Task.FromResult(plantillas.Any(plantilla =>
                plantilla.IdShiftPatternTemplate == idShiftPatternTemplate && plantilla.IsComplete));

        public Task AddAsync(ShiftPatternTemplate pattern, CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }

    private sealed class StubUnitOfWork : IUnitOfWork
    {
        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class StubActorContext : IActorContext
    {
        public Guid ActorId { get; } = Guid.Parse("22222222-2222-2222-2222-222222222222");

        public string ActorName => "Tester";
    }

    /// <summary>El reloj se fija en 2026 para que el límite juzgado no dependa del día que corre.</summary>
    private sealed class StubClock : IClock
    {
        public DateTime UtcNow => new(2026, 9, 17, 12, 0, 0, DateTimeKind.Utc);

        public DateOnly Today => DateOnly.FromDateTime(UtcNow);

        public TimeZoneInfo OperationalTimeZone => TimeZoneInfo.Utc;
    }
}
