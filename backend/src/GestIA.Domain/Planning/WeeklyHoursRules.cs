namespace GestIA.Domain.Planning;

/// <summary>Cómo queda un patrón frente al límite legal de jornada semanal.</summary>
public enum WeeklyHoursCompliance
{
    /// <summary>No excede el límite vigente.</summary>
    Compliant,

    /// <summary>Excede el límite vigente. No se prohíbe: se avisa por cuánto.</summary>
    Exceeds
}

/// <summary>
/// Las horas por semana de un patrón, y si exceden la jornada legal.
///
/// <para><b>Nada de esto se guarda.</b> Sale de las horas declaradas en el ciclo y de su longitud,
/// así que guardarlo obligaría a recalcularlo en cada camino que lo afecte, y basta que uno se
/// olvide para que la fila quede mintiendo. Y en el caso del límite hay una razón más fuerte: la
/// respuesta cambia con la ley, así que un valor guardado en 2026 estaría equivocado en 2027 sin
/// que nadie hubiera tocado el patrón.</para>
/// </summary>
public static class WeeklyHoursRules
{
    /// <summary>
    /// El límite de jornada semanal, por vigencia.
    ///
    /// <para><b>Es un parámetro con fecha, no una constante.</b> La reforma de jornada baja el
    /// límite por etapas, así que el mismo patrón puede ser conforme hoy y exceder el año que
    /// entra. Con una constante habría que recordar cambiarla, y el día que cambiara reescribiría
    /// el pasado: un patrón declarado en 2026 se leería contra el límite de 2028.</para>
    ///
    /// <para>De momento son 48 horas desde siempre. Cuando la reforma fije sus etapas, se agregan
    /// aquí con su fecha y la pantalla sigue diciendo contra qué límite juzga.</para>
    /// </summary>
    private static readonly (DateOnly From, decimal Hours)[] Limits =
    [
        (new DateOnly(1917, 2, 5), 48m)
    ];

    /// <summary>El límite vigente en una fecha.</summary>
    public static decimal WeeklyLimitOn(DateOnly date) =>
        Limits.Where(limit => limit.From <= date).OrderByDescending(limit => limit.From).First().Hours;

    /// <summary>
    /// Las horas por semana que declara un ciclo.
    ///
    /// <para>La fórmula es <c>horas del ciclo x 7 / dias del ciclo</c>, con el ciclo <b>declarado</b>
    /// y no ajustado. Un 12x48 son tres días y 28 horas por semana, no 33.6: lo decidido es que el
    /// patrón dice de cuántos días es su ciclo, y un promedio esconde que la persona trabaja un día
    /// de cada tres.</para>
    /// </summary>
    public static decimal WeeklyHours(int cycleWorkMinutes, int cycleDays)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(cycleDays, 1);

        return Math.Round(cycleWorkMinutes * 7m / (cycleDays * 60m), 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>Si el patrón excede el límite vigente en esa fecha, y por cuántas horas.</summary>
    public static (WeeklyHoursCompliance Compliance, decimal Limit, decimal ExcessHours) Assess(
        int cycleWorkMinutes,
        int cycleDays,
        DateOnly on)
    {
        var horas = WeeklyHours(cycleWorkMinutes, cycleDays);
        var limite = WeeklyLimitOn(on);
        var exceso = Math.Round(horas - limite, 2, MidpointRounding.AwayFromZero);

        return exceso > 0
            ? (WeeklyHoursCompliance.Exceeds, limite, exceso)
            : (WeeklyHoursCompliance.Compliant, limite, 0m);
    }

    /// <summary>
    /// Cómo se describe el descanso de un ciclo, con lo que de verdad se puede afirmar.
    ///
    /// <para><b>No intenta reproducir «Alterno» ni «Escalonado», y la razón importa.</b> En la tabla
    /// del cliente un 12x12 sale como «Alterno» y un 12x36 como «Escalonado», y los dos son ciclos
    /// de dos días con un descanso: la diferencia entre ellos no está en el número de días ni en
    /// cuántos se descansa, sino en cómo se corre la hora de entrada de un ciclo al siguiente. De
    /// los datos que esta función recibe, esas dos palabras <b>no se pueden deducir</b>, y devolver
    /// una de ellas sería adivinar.</para>
    ///
    /// <para>Así que se dice lo que se sabe: cuántos días de descanso en cuántos de ciclo, y si el
    /// ciclo cuadra con la semana o se corre respecto a ella —que sí sale de la aritmética—. El
    /// nombre del cliente para el patrón y su matiz van en la descripción de la plantilla, que la
    /// escribe quien la captura.</para>
    /// </summary>
    private static readonly string[] Semana =
        ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

    /// <summary>
    /// Cómo se lee el descanso de un patrón.
    ///
    /// <para><b>En un ciclo de siete días se dicen los días por su nombre</b> —«Descansa martes y
    /// domingo»— en vez de contarlos. «5 días de descanso en ciclo de 7 días» obligaba a abrir el
    /// patrón para saber cuáles, que es justo lo que la columna venía a ahorrar.</para>
    ///
    /// <para><b>El día 1 es lunes</b>, y hay que decirlo porque no está en el modelo: la plantilla
    /// numera los días y no declara en qué fecha empieza a contar. Lunes es lo que dicen los
    /// nombres de las plantillas —«Rol diurno lunes a sábado»— y es el ancla que usó la migración
    /// que enlazó las posiciones. Si algún día el ciclo declara su inicio, esto lo lee de ahí.</para>
    ///
    /// <para><b>Fuera de los siete días se siguen contando</b>, y no es una limitación que valga la
    /// pena quitar: un ciclo de seis cae en días distintos cada semana, así que no hay un «martes»
    /// que nombrar. Decir «se corre respecto a la semana» es la única respuesta cierta.</para>
    /// </summary>
    public static string DescribeRest(int restDays, int cycleDays) =>
        DescribeRest(restDays, cycleDays, []);

    /// <param name="restDayNumbers">Qué días del ciclo son de descanso, empezando en 1.</param>
    public static string DescribeRest(int restDays, int cycleDays, IReadOnlyCollection<int> restDayNumbers)
    {
        if (restDays == 0)
        {
            return "Sin descanso declarado";
        }

        if (cycleDays == 7 && restDayNumbers.Count > 0)
        {
            var nombres = restDayNumbers
                .Where(numero => numero >= 1 && numero <= 7)
                .OrderBy(numero => numero)
                .Select(numero => Semana[numero - 1])
                .ToArray();

            if (nombres.Length > 0)
            {
                return nombres.Length == 1
                    ? $"Descansa {nombres[0]}"
                    : $"Descansa {string.Join(", ", nombres[..^1])} y {nombres[^1]}";
            }
        }

        var dias = restDays == 1 ? "1 día de descanso" : $"{restDays} días de descanso";
        var ciclo = cycleDays == 1 ? "ciclo de 1 día" : $"ciclo de {cycleDays} días";

        // Un ciclo que no divide a la semana cae en un día distinto cada semana. Eso sí se deduce, y
        // es lo que hace que el descanso «se corra».
        return cycleDays % 7 == 0
            ? $"{dias} en {ciclo}, en el mismo día cada semana"
            : $"{dias} en {ciclo}, se corre respecto a la semana";
    }
}
