using GestIA.Domain.Common;

namespace GestIA.Domain.Workforce;

/// <summary>
/// Un periodo laboral: desde que una persona ingresa hasta que causa baja.
///
/// <para><b>Por qué una tabla y no dos columnas en el expediente.</b> Una persona puede entrar,
/// salir y volver a entrar <i>n</i> veces, y cada ciclo es un hecho distinto con su propia fecha de
/// ingreso, su propia baja y su propio motivo. Con dos columnas en <c>Employees</c>, el segundo
/// ingreso borraría el primero, y la antigüedad —que se cuenta desde el último ingreso— no tendría
/// dónde apoyarse para demostrar que los anteriores no suman.</para>
///
/// <para><b>Un periodo cerrado no se vuelve a abrir ni se modifica.</b> Es un hecho ocurrido: la
/// persona trabajó de tal día a tal día y salió por tal motivo. Corregir esos datos, si algún día se
/// necesita, será una corrección con su propio motivo y su propio rastro, no un método que los
/// sobreescriba en silencio. Volver a trabajar no reabre el periodo anterior: abre uno nuevo.</para>
///
/// <para><b>El motivo es texto libre y obligatorio al cerrar.</b> Libre para no atarlo a un catálogo
/// que nadie pidió; obligatorio porque una baja sin motivo no se puede explicar después. Y es el
/// motivo <i>del hecho</i> —por qué la persona deja de trabajar—, que no es lo mismo que el motivo de
/// una corrección: si mañana alguien arregla una fecha mal capturada, eso pedirá su propio motivo y
/// no será éste.</para>
/// </summary>
public sealed class EmploymentPeriod : AuditableEntity, IOrganizationScopedEntity, IActivatableEntity
{
    /// <summary>Lo mínimo que se acepta como motivo. Menos que esto no explica nada.</summary>
    public const int ReasonMinLength = 5;

    public const int ReasonMaxLength = 500;

    private EmploymentPeriod()
    {
    }

    private EmploymentPeriod(
        Guid idEmploymentPeriod,
        Guid idOrganization,
        Guid idEmployee,
        DateOnly startDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        IdEmploymentPeriod = idEmploymentPeriod;
        IdOrganization = idOrganization;
        IdEmployee = idEmployee;
        StartDate = startDate;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmploymentPeriod { get; private set; }
    public Guid IdOrganization { get; private set; }
    public Guid IdEmployee { get; private set; }

    /// <summary>La fecha de ingreso de <b>este</b> periodo. No hay «fecha de reingreso».</summary>
    public DateOnly StartDate { get; private set; }

    /// <summary>La fecha de baja. Nula mientras el periodo siga abierto.</summary>
    public DateOnly? EndDate { get; private set; }

    /// <summary>Por qué la persona causó baja. Nulo mientras el periodo siga abierto.</summary>
    public string? TerminationReason { get; private set; }

    /// <summary>
    /// Token de concurrencia. Lo genera y lo mantiene SQL Server; nadie lo asigna.
    ///
    /// <para>Aquí importa porque cerrar un periodo es irreversible: dos personas dando de baja al
    /// mismo empleado desde dos pantallas tienen que enterarse, no pisarse.</para>
    /// </summary>
    public byte[] RowVersion { get; private set; } = [];

    public Employee Employee { get; private set; } = null!;

    /// <summary>Si la persona sigue contratada en este periodo.</summary>
    public bool IsOpen => EndDate is null;

    public static EmploymentPeriod Open(
        Guid idOrganization,
        Guid idEmployee,
        DateOnly startDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt) =>
        new(Guid.NewGuid(), idOrganization, idEmployee, startDate, actorId, actorName, occurredAt);

    /// <summary>
    /// Cierra el periodo con la fecha de baja y su motivo.
    ///
    /// <para>Falla si el periodo ya estaba cerrado, si la baja es anterior al ingreso, o si el motivo
    /// viene vacío o demasiado corto. Las tres son la misma idea: un periodo cerrado es un hecho, y
    /// un hecho a medias no se guarda.</para>
    /// </summary>
    public void Close(
        DateOnly endDate,
        string terminationReason,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        if (!IsOpen)
        {
            throw new DomainRuleException(
                "El periodo laboral ya está cerrado. Un periodo cerrado no se modifica: para volver a " +
                "trabajar se abre uno nuevo.");
        }

        if (endDate < StartDate)
        {
            throw new DomainRuleException("La fecha de baja no puede ser anterior a la fecha de ingreso.");
        }

        var motivo = terminationReason?.Trim() ?? string.Empty;

        if (motivo.Length < ReasonMinLength)
        {
            throw new DomainRuleException(
                $"El motivo de baja es obligatorio y debe tener al menos {ReasonMinLength} caracteres.");
        }

        if (motivo.Length > ReasonMaxLength)
        {
            throw new DomainRuleException(
                $"El motivo de baja no puede exceder {ReasonMaxLength} caracteres.");
        }

        EndDate = endDate;
        TerminationReason = motivo;
        RegisterUpdate(actorId, actorName, occurredAt);
    }
}
