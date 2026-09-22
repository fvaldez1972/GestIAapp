using GestIA.Application.Common;
using GestIA.Domain.Operations;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Application.UnitTests;

/// <summary>
/// Cuándo una corrección exige motivo.
///
/// La regla no es "toda corrección lo pide": eso lo convierte en un trámite que se llena sin
/// leer. Pide motivo cuando se toca algo ya cerrado o vencido, y —en el caso comercial— cuando
/// se toca el dinero.
/// </summary>
public sealed class CorrectionReasonPolicyTests
{
    private static readonly Guid ActorId = Guid.NewGuid();
    private const string ActorName = "Supervisor";
    private static readonly DateTime Now = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2026, 9, 5);

    [Fact]
    public void AClosedDayRequiresAReasonAndAReopenedOneDoesNot()
    {
        var closure = OperationDayClosure.Create(
            new(Guid.NewGuid(), Guid.NewGuid(), Today, 1, 1, 0, 0, 0, null), ActorId, ActorName, Now);

        Assert.NotNull(CorrectionReasonPolicy.DayClosureRequirement(closure));

        // Reabrir el día ya fue, en sí misma, una decisión justificada.
        closure.Reopen("Se reabre para corregir la asistencia", ActorId, ActorName, Now);
        Assert.Null(CorrectionReasonPolicy.DayClosureRequirement(closure));

        // Un día que nunca se cerró tampoco lo exige: capturar no es corregir.
        Assert.Null(CorrectionReasonPolicy.DayClosureRequirement(null));
    }

    [Fact]
    public void AnAssignmentThatEndedRequiresAReasonAndAnOpenOneDoesNot()
    {
        Assert.NotNull(CorrectionReasonPolicy.AssignmentRequirement(Assignment(Today.AddDays(-1)), Today));

        // Sin fecha de fin sigue viva: editarla es operación normal.
        Assert.Null(CorrectionReasonPolicy.AssignmentRequirement(Assignment(null), Today));

        // El día en que termina todavía cuenta como vigente.
        Assert.Null(CorrectionReasonPolicy.AssignmentRequirement(Assignment(Today), Today));
    }

    [Fact]
    public void AMissingReasonIsOnlyAnErrorWhenTheRuleAsksForOne()
    {
        var required = new Dictionary<string, string[]>();
        Assert.Null(CorrectionReasonPolicy.Validate(null, "corrige algo cerrado", "CorrectionReason", required));
        Assert.Single(required);

        var optional = new Dictionary<string, string[]>();
        Assert.Null(CorrectionReasonPolicy.Validate("   ", null, "CorrectionReason", optional));
        Assert.Empty(optional);
    }

    /// <summary>
    /// El mínimo existe para descartar "ok", "ya" o "error": un motivo que no explica nada es
    /// igual de inútil que no tenerlo, pero además aparenta cumplir.
    /// </summary>
    [Fact]
    public void AReasonTooShortIsRejectedEvenWhenItWasNotRequired()
    {
        var errors = new Dictionary<string, string[]>();
        CorrectionReasonPolicy.Validate("ya", null, "CorrectionReason", errors);

        Assert.Single(errors);
    }

    [Fact]
    public void AValidReasonComesBackTrimmed()
    {
        var errors = new Dictionary<string, string[]>();
        var reason = CorrectionReasonPolicy.Validate(
            "  Se corrigió la hora de entrada  ", "corrige algo cerrado", "CorrectionReason", errors);

        Assert.Empty(errors);
        Assert.Equal("Se corrigió la hora de entrada", reason);
    }

    private static ServiceAssignment Assignment(DateOnly? endDate) => ServiceAssignment.Create(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
        new(Guid.NewGuid(), ServiceAssignmentType.Primary, Today.AddMonths(-6), endDate, true, null),
        ActorId, ActorName, Now);
}
