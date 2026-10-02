using GestIA.Domain.Common;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.UnitTests;

/// <summary>
/// El historial laboral: ingreso, baja, reingreso, y la antigüedad que sale de ellos.
///
/// <para>Estas pruebas <b>son</b> las reglas de RQ-07. Lo que aquí se pueda hacer es lo que el sistema
/// permite, y lo que aquí falle es lo que ninguna pantalla debería ofrecer.</para>
/// </summary>
public class EmploymentPeriodTests
{
    private static readonly Guid ActorId = Guid.NewGuid();
    private const string ActorName = "Tester";
    private static readonly DateTime Now = new(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Ingreso = new(2024, 1, 15);
    private const string Motivo = "Renuncia voluntaria por cambio de residencia";

    /// <summary>Una persona recién dada de alta: activa, con su primer periodo abierto.</summary>
    private static Employee Contratada(DateOnly? desde = null)
    {
        var employee = Employee.Create(
            Guid.NewGuid(), "EMP-1", "Adrián", "Escobar", "Ibáñez", "Guardia",
            desde ?? Ingreso, ActorId, ActorName, Now);

        employee.ChangeStatus(EmployeeStatus.Candidate, ActorId, ActorName, Now);
        employee.Hire(desde ?? Ingreso, ActorId, ActorName, Now);
        return employee;
    }

    // ── Contratación ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Contratar a quien está en candidatura abre su primer periodo y la deja activa.
    ///
    /// <para><b>El control es el estado de partida</b>: la persona empieza en candidatura y sin
    /// periodos, así que lo que se comprueba después sólo puede venir de la contratación.</para>
    /// </summary>
    [Fact]
    public void HiringACandidateOpensTheFirstPeriod()
    {
        var employee = Employee.Create(
            Guid.NewGuid(), "EMP-1", "Adrián", "Escobar", null, "Guardia", Ingreso, ActorId, ActorName, Now);
        employee.ChangeStatus(EmployeeStatus.Candidate, ActorId, ActorName, Now);

        Assert.Empty(employee.EmploymentPeriods);
        Assert.Null(employee.SeniorityStartDate);

        employee.Hire(Ingreso, ActorId, ActorName, Now);

        var periodo = Assert.Single(employee.EmploymentPeriods);
        Assert.Equal(Ingreso, periodo.StartDate);
        Assert.True(periodo.IsOpen);
        Assert.Equal(EmployeeStatus.Active, employee.Status);
        Assert.Equal(Ingreso, employee.SeniorityStartDate);
    }

    /// <summary>Contratar dos veces no es contratar: la segunda vez es un reingreso.</summary>
    [Fact]
    public void HiringSomeoneWhoAlreadyHasHistoryFails()
    {
        var employee = Contratada();

        Assert.Throws<DomainRuleException>(() => employee.Hire(Ingreso, ActorId, ActorName, Now));
    }

    // ── Baja ─────────────────────────────────────────────────────────────────────────────────

    /// <summary>La baja cierra el periodo abierto con su fecha y su motivo.</summary>
    [Fact]
    public void TerminationClosesTheOpenPeriodWithItsReason()
    {
        var employee = Contratada();
        var baja = Ingreso.AddYears(1);

        employee.Terminate(baja, Motivo, ActorId, ActorName, Now);

        var periodo = Assert.Single(employee.EmploymentPeriods);
        Assert.Equal(baja, periodo.EndDate);
        Assert.Equal(Motivo, periodo.TerminationReason);
        Assert.False(periodo.IsOpen);
        Assert.Equal(EmployeeStatus.Terminated, employee.Status);
        Assert.Null(employee.OpenEmploymentPeriod);
    }

    /// <summary>
    /// Sin motivo no hay baja, y un motivo de dos letras tampoco explica nada.
    ///
    /// <para><b>El control es la última línea</b>: con un motivo de verdad sí se guarda. Sin ella,
    /// una implementación que rechazara <i>cualquier</i> baja pasaría las cuatro primeras.</para>
    /// </summary>
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("no")]
    [InlineData("baja")]
    public void TerminationWithoutAUsableReasonIsRefused(string motivo)
    {
        var employee = Contratada();

        Assert.Throws<DomainRuleException>(
            () => employee.Terminate(Ingreso.AddYears(1), motivo, ActorId, ActorName, Now));

        Assert.True(Assert.Single(employee.EmploymentPeriods).IsOpen);
        Assert.NotEqual(EmployeeStatus.Terminated, employee.Status);

        employee.Terminate(Ingreso.AddYears(1), Motivo, ActorId, ActorName, Now);
        Assert.False(Assert.Single(employee.EmploymentPeriods).IsOpen);
    }

    /// <summary>La baja no puede ser anterior al ingreso del periodo que cierra.</summary>
    [Fact]
    public void TerminationBeforeTheHireDateIsRefused()
    {
        var employee = Contratada();

        Assert.Throws<DomainRuleException>(
            () => employee.Terminate(Ingreso.AddDays(-1), Motivo, ActorId, ActorName, Now));
    }

    /// <summary>
    /// <b>Un periodo cerrado no se modifica.</b> Es un hecho ocurrido, y volver a cerrarlo sería
    /// reescribir cuándo y por qué salió una persona.
    /// </summary>
    [Fact]
    public void AClosedPeriodCannotBeClosedAgain()
    {
        var employee = Contratada();
        employee.Terminate(Ingreso.AddYears(1), Motivo, ActorId, ActorName, Now);
        var periodo = Assert.Single(employee.EmploymentPeriods);

        Assert.Throws<DomainRuleException>(
            () => periodo.Close(Ingreso.AddYears(2), "Otro motivo distinto", ActorId, ActorName, Now));

        Assert.Equal(Ingreso.AddYears(1), periodo.EndDate);
        Assert.Equal(Motivo, periodo.TerminationReason);
    }

    // ── Permiso ──────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// <b>Un permiso no es una baja.</b> Quien está en permiso sigue contratada, su periodo sigue
    /// abierto y su antigüedad no se interrumpe.
    ///
    /// <para>El control es la segunda mitad: la misma persona, dada de baja, sí cierra el periodo. Sin
    /// ella, un dominio que nunca cerrara nada pasaría la primera.</para>
    /// </summary>
    [Fact]
    public void ALeaveDoesNotCloseThePeriod()
    {
        var employee = Contratada();

        employee.ChangeStatus(EmployeeStatus.OnLeave, ActorId, ActorName, Now);

        Assert.True(Assert.Single(employee.EmploymentPeriods).IsOpen);
        Assert.Equal(Ingreso, employee.SeniorityStartDate);

        employee.ChangeStatus(EmployeeStatus.Active, ActorId, ActorName, Now);
        employee.Terminate(Ingreso.AddYears(1), Motivo, ActorId, ActorName, Now);

        Assert.False(Assert.Single(employee.EmploymentPeriods).IsOpen);
    }

    // ── Reingreso ────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// El reingreso abre un periodo nuevo <b>y no toca el anterior</b>: el historial conserva la
    /// primera salida con su fecha y su motivo.
    /// </summary>
    [Fact]
    public void RehiringOpensANewPeriodAndKeepsTheClosedOne()
    {
        var employee = Contratada();
        var baja = Ingreso.AddYears(1);
        employee.Terminate(baja, Motivo, ActorId, ActorName, Now);

        var reingreso = baja.AddMonths(6);
        employee.Rehire(reingreso, ActorId, ActorName, Now);

        Assert.Equal(2, employee.EmploymentPeriods.Count);

        var cerrado = employee.EmploymentPeriods.Single(periodo => !periodo.IsOpen);
        Assert.Equal(baja, cerrado.EndDate);
        Assert.Equal(Motivo, cerrado.TerminationReason);

        var abierto = employee.OpenEmploymentPeriod!;
        Assert.Equal(reingreso, abierto.StartDate);
        Assert.Equal(EmployeeStatus.Active, employee.Status);
    }

    /// <summary>
    /// El reingreso sólo se registra sobre alguien dado de baja.
    ///
    /// <para>El control es la segunda mitad: sobre alguien dado de baja sí pasa. Esta regla está además
    /// en la base, como índice único filtrado, porque esconder un botón no es una restricción.</para>
    /// </summary>
    [Fact]
    public void RehiringSomeoneStillWorkingIsRefused()
    {
        var employee = Contratada();

        Assert.Throws<DomainRuleException>(
            () => employee.Rehire(Ingreso.AddYears(1), ActorId, ActorName, Now));

        employee.Terminate(Ingreso.AddYears(1), Motivo, ActorId, ActorName, Now);
        employee.Rehire(Ingreso.AddYears(2), ActorId, ActorName, Now);

        Assert.Equal(2, employee.EmploymentPeriods.Count);
    }

    /// <summary>El reingreso no puede ser anterior a la baja que lo precede.</summary>
    [Fact]
    public void RehiringBeforeThePrecedingTerminationIsRefused()
    {
        var employee = Contratada();
        var baja = Ingreso.AddYears(1);
        employee.Terminate(baja, Motivo, ActorId, ActorName, Now);

        Assert.Throws<DomainRuleException>(
            () => employee.Rehire(baja.AddDays(-1), ActorId, ActorName, Now));
    }

    /// <summary>El ciclo se repite sin límite: tres vueltas, y el historial conserva las tres.</summary>
    [Fact]
    public void TheCycleRepeatsWithoutLimit()
    {
        var employee = Contratada();
        var fecha = Ingreso;

        for (var vuelta = 0; vuelta < 3; vuelta++)
        {
            fecha = fecha.AddYears(1);
            employee.Terminate(fecha, $"{Motivo} ({vuelta})", ActorId, ActorName, Now);
            fecha = fecha.AddMonths(2);
            employee.Rehire(fecha, ActorId, ActorName, Now);
        }

        Assert.Equal(4, employee.EmploymentPeriods.Count);
        Assert.Equal(3, employee.EmploymentPeriods.Count(periodo => !periodo.IsOpen));
        Assert.Equal(fecha, employee.SeniorityStartDate);
    }

    // ── Antigüedad ───────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// <b>La antigüedad parte del último ingreso; los anteriores no suman.</b> Es la regla que el
    /// documento de la reunión marcó como la buena.
    ///
    /// <para>El control está en los números: contar desde el primer ingreso daría 2028, y desde el
    /// último da 2026. Si la implementación tomara el mínimo en vez del máximo, esta prueba lo
    /// diría.</para>
    /// </summary>
    [Fact]
    public void SeniorityCountsFromTheLatestHiring()
    {
        var primero = new DateOnly(2018, 3, 1);
        var employee = Contratada(primero);
        employee.Terminate(new DateOnly(2020, 6, 30), Motivo, ActorId, ActorName, Now);

        var ultimo = new DateOnly(2026, 2, 10);
        employee.Rehire(ultimo, ActorId, ActorName, Now);

        Assert.Equal(ultimo, employee.SeniorityStartDate);
        Assert.NotEqual(primero, employee.SeniorityStartDate);
        Assert.Equal(ultimo, employee.HireDate);
    }

    /// <summary>
    /// Editar el expediente no mueve una fecha de ingreso que ya es un hecho registrado.
    ///
    /// <para>El control es el primer <c>Assert</c>: antes de la edición la fecha ya era la del periodo,
    /// y después de intentar cambiarla sigue siéndolo.</para>
    /// </summary>
    [Fact]
    public void EditingTheProfileCannotMoveARegisteredHireDate()
    {
        var employee = Contratada();
        Assert.Equal(Ingreso, employee.HireDate);

        employee.UpdateProfile(
            new EmployeeProfile(
                "Adrián", "Escobar", "Ibáñez", "Guardia", Ingreso.AddYears(5),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null),
            ActorId, ActorName, Now);

        Assert.Equal(Ingreso, employee.HireDate);
    }
}
