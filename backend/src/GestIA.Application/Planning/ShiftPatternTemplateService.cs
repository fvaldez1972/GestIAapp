using GestIA.Application.Common;
using GestIA.Domain.Catalogs;
using GestIA.Domain.Planning;

namespace GestIA.Application.Planning;

/// <summary>
/// El catálogo de patrones de turno de la organización.
///
/// <para><b>Lo que se guarda y lo que se calcula.</b> Se guardan el nombre, la jornada, la longitud
/// del ciclo, la vigencia y qué es cada día. Las horas por semana, si excede la jornada legal y cómo
/// se describe el descanso <b>se calculan al leer</b>: el límite legal cambia con la ley, así que un
/// valor guardado hoy estaría equivocado el año que entra sin que nadie tocara el patrón.</para>
///
/// <para><b>Un patrón que excede no se rechaza.</b> Se guarda y se avisa por cuántas horas, que es
/// lo decidido: si el sistema no deja registrar lo que pasa en la realidad, se registra fuera del
/// sistema y se pierde.</para>
/// </summary>
public sealed class ShiftPatternTemplateService(
    IShiftPatternTemplateRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IShiftPatternTemplateService
{
    public async Task<IReadOnlyList<ShiftPatternTemplateResponse>> ListAsync(
        Guid idOrganization,
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        var plantillas = await repository.ListAsync(idOrganization, includeInactive, cancellationToken);
        return [.. plantillas.Select(Map)];
    }

    public async Task<IReadOnlyList<ShiftPatternTemplateOptionResponse>> ListOptionsAsync(
        Guid idOrganization,
        CancellationToken cancellationToken)
    {
        var plantillas = await repository.ListAsync(idOrganization, false, cancellationToken);

        // Se ofrecen todas las que declaren al menos un día de trabajo.
        //
        // <para>Antes sólo se ofrecían las que declaraban los siete días del ciclo, y el efecto no
        // era el que se buscaba: de diez plantillas del catálogo, el selector de la posición
        // ofrecía <b>una</b>. Obligaba a decidir los siete días —incluido cuál se descansa— antes
        // de poder usar el patrón para nada, y ese no es el momento de decidirlo: el descanso se
        // resuelve al planear la semana, caso por caso.</para>
        //
        // <para>Un día sin declarar significa «aquí no hay turno propuesto», no «aquí está
        // prohibido trabajar». La pantalla sigue diciendo cuáles están completas, porque saberlo
        // es útil; lo que ya no hace es esconder las demás.</para>
        return
        [
            .. plantillas
                .Where(plantilla => plantilla.Days.Any(day => day.Active && !day.IsRest))
                .Select(plantilla =>
                {
                    var evaluacion = Assess(plantilla);

                    return new ShiftPatternTemplateOptionResponse(
                        plantilla.IdShiftPatternTemplate,
                        plantilla.Name,
                        plantilla.Daypart,
                        plantilla.CycleDays,
                        WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays),
                        evaluacion.Compliance,
                        evaluacion.ExcessHours);
                })
        ];
    }

    public async Task<ShiftPatternTemplateResponse> CreateAsync(
        CreateShiftPatternTemplateRequest request,
        CancellationToken cancellationToken)
    {
        Validate(request.Name, request.Description, request.CycleDays, request.Days);

        var normalizado = CatalogName.Normalize(request.Name);

        if (await repository.IsNameInUseAsync(request.IdOrganization, normalizado, null, cancellationToken))
        {
            throw new ResourceConflictException(NombreEnUso(request.Name));
        }

        var plantilla = ShiftPatternTemplate.Create(
            request.IdOrganization,
            new ShiftPatternTemplateProfile(
                request.Name,
                request.Description,
                request.Daypart,
                request.CycleDays,
                request.EffectiveFromDate,
                request.EffectiveToDate),
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        // En el alta la plantilla entera entra como nueva, y sus días con ella: no hace falta
        // darlos de alta aparte.
        Declare(plantilla, request.Days);

        await repository.AddAsync(plantilla, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(plantilla);
    }

    public async Task<ShiftPatternTemplateResponse> UpdateAsync(
        Guid idShiftPatternTemplate,
        UpdateShiftPatternTemplateRequest request,
        CancellationToken cancellationToken)
    {
        Validate(request.Name, request.Description, request.CycleDays, request.Days);

        var plantilla = await repository.GetTrackedAsync(idShiftPatternTemplate, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el patrón solicitado.");

        var normalizado = CatalogName.Normalize(request.Name);

        if (await repository.IsNameInUseAsync(
                request.IdOrganization, normalizado, idShiftPatternTemplate, cancellationToken))
        {
            throw new ResourceConflictException(NombreEnUso(request.Name));
        }

        plantilla.UpdateProfile(
            new ShiftPatternTemplateProfile(
                request.Name,
                request.Description,
                request.Daypart,
                request.CycleDays,
                request.EffectiveFromDate,
                request.EffectiveToDate),
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        // Los días que nacen en esta edición se dan de alta explícitamente. Ver AddDaysAsync: sin
        // esto EF los guarda como la modificación de una fila que no existe, y la pantalla recibe
        // un conflicto de concurrencia que nadie provocó.
        var nuevos = Declare(plantilla, request.Days);
        await repository.AddDaysAsync(nuevos, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(plantilla);
    }

    public async Task DeactivateAsync(
        Guid idOrganization,
        Guid idShiftPatternTemplate,
        CancellationToken cancellationToken)
    {
        var plantilla = await repository.GetTrackedAsync(idShiftPatternTemplate, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el patrón solicitado.");

        var enUso = await repository.CountPositionsUsingAsync(idShiftPatternTemplate, cancellationToken);

        if (enUso > 0)
        {
            throw new ResourceConflictException(
                enUso == 1
                    ? "Una posición sigue este patrón. Cámbiala antes de retirarlo."
                    : $"{enUso} posiciones siguen este patrón. Cámbialas antes de retirarlo.");
        }

        plantilla.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static string NombreEnUso(string name) =>
        $"Ya existe un patrón con el nombre {name.Trim()}.";

    private static void Validate(
        string name,
        string? description,
        int cycleDays,
        IReadOnlyList<ShiftPatternTemplateDayInput> days)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        InputValidation.Required(name, nameof(name), 150, errors);
        InputValidation.Optional(description, nameof(description), 1000, errors);

        if (cycleDays is < 1 or > 366)
        {
            errors[nameof(cycleDays)] = ["El ciclo debe tener entre 1 y 366 días."];
        }

        // Un día declarado dos veces no rompe el dominio —la segunda corrige la primera— pero sí es
        // un error de captura: la pantalla mandó dos verdades del mismo día.
        var repetidos = days
            .GroupBy(day => day.CycleDayNumber)
            .Where(grupo => grupo.Count() > 1)
            .Select(grupo => grupo.Key.ToString(System.Globalization.CultureInfo.InvariantCulture))
            .ToArray();

        if (repetidos.Length > 0)
        {
            errors[nameof(days)] =
                [$"Hay días del ciclo declarados más de una vez: {string.Join(", ", repetidos)}."];
        }

        InputValidation.ThrowIfInvalid(errors);
    }

    /// <summary>Declara los días y devuelve los que acabaron de nacer.</summary>
    private List<ShiftPatternTemplateDay> Declare(
        ShiftPatternTemplate plantilla,
        IReadOnlyList<ShiftPatternTemplateDayInput> days)
    {
        var nuevos = new List<ShiftPatternTemplateDay>();

        foreach (var day in days.OrderBy(item => item.CycleDayNumber))
        {
            var nuevo = plantilla.DeclareDay(
                day.CycleDayNumber,
                day.StartTime,
                day.EndTime,
                day.IsRest,
                actorContext.ActorId,
                actorContext.ActorName,
                clock.UtcNow);

            if (nuevo is not null)
            {
                nuevos.Add(nuevo);
            }
        }

        return nuevos;
    }

    /// <summary>
    /// Juzga el patrón contra el límite vigente <b>desde que el patrón rige</b>, no contra el de hoy.
    ///
    /// <para>Un patrón declarado para 2026 no se vuelve ilegal porque el calendario avance, y uno
    /// que empieza a regir el año que entra se juzga con el límite de entonces.</para>
    /// </summary>
    private (WeeklyHoursCompliance Compliance, decimal Limit, decimal ExcessHours) Assess(
        ShiftPatternTemplate plantilla)
    {
        var fecha = plantilla.EffectiveFromDate > clock.Today ? plantilla.EffectiveFromDate : clock.Today;
        return WeeklyHoursRules.Assess(plantilla.CycleWorkMinutes, plantilla.CycleDays, fecha);
    }

    private ShiftPatternTemplateResponse Map(ShiftPatternTemplate plantilla)
    {
        var evaluacion = Assess(plantilla);
        var descansos = plantilla.Days.Count(day => day.Active && day.IsRest);

        return new ShiftPatternTemplateResponse(
            plantilla.IdShiftPatternTemplate,
            plantilla.Name,
            plantilla.Description,
            plantilla.Daypart,
            plantilla.CycleDays,
            plantilla.EffectiveFromDate,
            plantilla.EffectiveToDate,
            plantilla.Active,
            [
                .. plantilla.Days
                    .Where(day => day.Active)
                    .OrderBy(day => day.CycleDayNumber)
                    .Select(day => new ShiftPatternTemplateDayResponse(
                        day.IdShiftPatternTemplateDay,
                        day.CycleDayNumber,
                        day.StartTime,
                        day.EndTime,
                        day.IsRest,
                        day.IsOvernight,
                        day.DurationMinutes))
            ],
            plantilla.IsComplete,
            descansos,
            WeeklyHoursRules.WeeklyHours(plantilla.CycleWorkMinutes, plantilla.CycleDays),
            evaluacion.Limit,
            evaluacion.Compliance,
            evaluacion.ExcessHours,
            WeeklyHoursRules.DescribeRest(descansos, plantilla.CycleDays));
    }
}
