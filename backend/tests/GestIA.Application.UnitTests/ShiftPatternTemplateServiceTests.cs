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

    /// <summary>
    /// Una plantilla con días sin declarar <b>sí</b> se ofrece.
    ///
    /// <para><b>Esta prueba decía lo contrario hasta el 20 de septiembre de 2026</b>, y la regla que
    /// fijaba salió cara: de las diez plantillas del catálogo, el selector de la posición ofrecía
    /// <b>una</b>. Exigir el ciclo completo obliga a decidir los siete días —incluido cuál se
    /// descansa— antes de poder usar el patrón para nada, y ése no es el momento de decidirlo: la
    /// semana que de verdad se trabaja se resuelve al planear.</para>
    ///
    /// <para>Un día sin declarar significa «aquí no hay turno propuesto», no «aquí está prohibido
    /// trabajar». Nada impide programar a alguien ese día.</para>
    /// </summary>
    [Fact]
    public async Task ATemplateWithUndeclaredDaysIsStillOffered()
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

        Assert.Equal(["12x12 diurno", "12x12 nocturno"], opciones.Select(opcion => opcion.Name).Order());
    }

    /// <summary>
    /// Lo único que sigue sin ofrecerse: una plantilla que no declara ni un día de trabajo.
    ///
    /// <para>Es el control de la prueba anterior. Sin él, «se ofrecen las incompletas» no
    /// distinguiría la regla nueva de no tener ninguna regla, y una plantilla que sólo declara
    /// descansos no es un patrón de turno: no propondría un solo turno nunca.</para>
    /// </summary>
    [Fact]
    public async Task ATemplateWithoutASingleWorkingDayIsNotOffered()
    {
        var soloDescansos = Plantilla("Vacía", cycleDays: 2, (1, null, null, true), (2, null, null, true));
        var conTrabajo = Plantilla("Diurno", cycleDays: 2, (1, new TimeOnly(7, 0), new TimeOnly(19, 0), false));

        var servicio = Servicio(new FakeRepository([soloDescansos, conTrabajo]));

        var opciones = await servicio.ListOptionsAsync(Organizacion, CancellationToken.None);

        Assert.Equal(["Diurno"], opciones.Select(opcion => opcion.Name));
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

    /// <summary>
    /// La regresión del 409 que nadie provocaba.
    ///
    /// <para>Al completar un patrón promovido —darle el día que le faltaba— el día nuevo tiene que
    /// llegar al repositorio para darse de alta. Si se queda sólo colgado de la colección, EF lo
    /// guarda como la modificación de una fila que no existe, el UPDATE afecta cero filas, y la
    /// pantalla recibe «los datos cambiaron mientras editabas» sin que nadie los haya cambiado.</para>
    /// </summary>
    [Fact]
    public async Task ADayBornWhileEditingIsHandedToTheRepository()
    {
        var plantilla = Plantilla("12x12 diurno", cycleDays: 2, (1, new TimeOnly(7, 0), new TimeOnly(19, 0), false));
        var repositorio = new FakeRepository([plantilla]);
        var servicio = Servicio(repositorio);

        await servicio.UpdateAsync(
            plantilla.IdShiftPatternTemplate,
            new UpdateShiftPatternTemplateRequest(
                Organizacion,
                "12x12 diurno",
                null,
                ShiftDaypart.Day,
                2,
                new DateOnly(2026, 1, 1),
                null,
                [
                    new ShiftPatternTemplateDayInput(1, new TimeOnly(7, 0), new TimeOnly(19, 0), false),
                    new ShiftPatternTemplateDayInput(2, null, null, true)
                ]),
            CancellationToken.None);

        // Sólo el día 2 es nuevo. El día 1 ya existía y se corrige, no se da de alta.
        var nuevo = Assert.Single(repositorio.AddedDays);
        Assert.Equal(2, nuevo.CycleDayNumber);
        Assert.True(nuevo.IsRest);
        Assert.True(plantilla.IsComplete);
    }

    /// <summary>
    /// Acortar el ciclo retira los días que quedaron fuera, y volver a alargarlo los reactiva en
    /// lugar de crear otra fila con el mismo número, que la clave única rechazaría.
    /// </summary>
    [Fact]
    public async Task ShorteningTheCycleRetiresTheDaysLeftOutsideIt()
    {
        var plantilla = Plantilla(
            "Rol de tres",
            cycleDays: 3,
            (1, new TimeOnly(7, 0), new TimeOnly(19, 0), false),
            (2, new TimeOnly(7, 0), new TimeOnly(19, 0), false),
            (3, null, null, true));

        var repositorio = new FakeRepository([plantilla]);
        var servicio = Servicio(repositorio);

        await servicio.UpdateAsync(
            plantilla.IdShiftPatternTemplate,
            new UpdateShiftPatternTemplateRequest(
                Organizacion, "Rol de tres", null, ShiftDaypart.Day, 2, new DateOnly(2026, 1, 1), null,
                [
                    new ShiftPatternTemplateDayInput(1, new TimeOnly(7, 0), new TimeOnly(19, 0), false),
                    new ShiftPatternTemplateDayInput(2, null, null, true)
                ]),
            CancellationToken.None);

        // El día 3 sigue existiendo —aquí no se borra nada— pero ya no cuenta ni se ve.
        Assert.Equal(3, plantilla.Days.Count);
        Assert.False(plantilla.Days.Single(day => day.CycleDayNumber == 3).Active);
        Assert.True(plantilla.IsComplete);
        Assert.Empty(repositorio.AddedDays);

        await servicio.UpdateAsync(
            plantilla.IdShiftPatternTemplate,
            new UpdateShiftPatternTemplateRequest(
                Organizacion, "Rol de tres", null, ShiftDaypart.Day, 3, new DateOnly(2026, 1, 1), null,
                [
                    new ShiftPatternTemplateDayInput(1, new TimeOnly(7, 0), new TimeOnly(19, 0), false),
                    new ShiftPatternTemplateDayInput(2, new TimeOnly(7, 0), new TimeOnly(19, 0), false),
                    new ShiftPatternTemplateDayInput(3, null, null, true)
                ]),
            CancellationToken.None);

        Assert.Equal(3, plantilla.Days.Count);
        Assert.True(plantilla.Days.Single(day => day.CycleDayNumber == 3).Active);
        Assert.Empty(repositorio.AddedDays);
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

        public List<ShiftPatternTemplateDay> AddedDays { get; } = [];

        public Task AddDaysAsync(
            IReadOnlyCollection<ShiftPatternTemplateDay> days,
            CancellationToken cancellationToken)
        {
            AddedDays.AddRange(days);
            return Task.CompletedTask;
        }
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
