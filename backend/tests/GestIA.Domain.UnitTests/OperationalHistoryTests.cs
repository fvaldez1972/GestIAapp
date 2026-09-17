using System.Reflection;
using System.Text.Json;
using GestIA.Domain.History;
using GestIA.Domain.Operations;
using GestIA.Domain.Services;
using GestIA.Domain.Workforce;

namespace GestIA.Domain.UnitTests;

/// <summary>
/// La bitácora funcional: qué guardan las fotos, qué se quedan deliberadamente fuera, y por qué
/// el evento no se puede tocar una vez escrito.
/// </summary>
public sealed class OperationalHistoryTests
{
    private static readonly Guid ActorId = Guid.NewGuid();
    private const string ActorName = "Supervisor";
    private static readonly DateTime Now = new(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Day = new(2026, 9, 5);

    private static readonly Type[] SnapshotTypes =
    [
        typeof(AttendanceRecordSnapshot),
        typeof(IncidentSnapshot),
        typeof(CoverageRecordSnapshot),
        typeof(ServiceAssignmentSnapshot)
    ];

    /// <summary>
    /// Los únicos campos de texto que pueden viajar en una foto: códigos y catálogos, no relatos.
    /// La lista es corta a propósito; alargarla debería costar una discusión.
    /// </summary>
    private static readonly HashSet<string> AllowedTextFields = new(StringComparer.Ordinal)
    {
        // La moneda de la configuracion salio de la lista con la propia entidad: el precio vive
        // ahora en el puesto.
        nameof(IncidentSnapshot.IncidentType)
    };

    /// <summary>
    /// La prueba que comprueba <b>la regla</b> y no la lista de hoy: recorre los cinco tipos por
    /// reflexión y falla si aparece cualquier campo de texto fuera de la lista blanca.
    ///
    /// Sin ella, agregar mañana un <c>Notes</c> o un <c>Description</c> a una foto pasaría
    /// desapercibido, y la bitácora se volvería una segunda copia de datos personales que se
    /// consulta con el permiso de la bitácora y no con el del registro.
    /// </summary>
    [Fact]
    public void NoSnapshotCarriesFreeText()
    {
        var offenders = SnapshotTypes
            .SelectMany(type => type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(property => property.PropertyType == typeof(string))
                .Where(property => !AllowedTextFields.Contains(property.Name))
                .Select(property => $"{type.Name}.{property.Name}"))
            .Order()
            .ToArray();

        Assert.True(
            offenders.Length == 0,
            "Una foto de historial no guarda texto libre: guarda si el campo estaba lleno o vacío. " +
            "Copiarlo lo saca del control de permisos del registro original, y puede llevar " +
            "nombres de terceros. Usa un booleano Has… en su lugar, o agrega el campo a la lista " +
            $"blanca si de verdad es un código: {string.Join(", ", offenders)}");
    }

    /// <summary>
    /// Principio 4 del README: se conserva por identificador, no por nombre visible. Si un nombre
    /// se corrige después, no debe quedar una copia vieja regada en el historial.
    /// </summary>
    [Fact]
    public void NoSnapshotCarriesVisibleNames()
    {
        var offenders = SnapshotTypes
            .SelectMany(type => type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(property => property.Name.EndsWith("Name", StringComparison.Ordinal))
                .Select(property => $"{type.Name}.{property.Name}"))
            .Order()
            .ToArray();

        Assert.True(
            offenders.Length == 0,
            $"En las fotos viajan identificadores, no nombres: {string.Join(", ", offenders)}");
    }

    [Fact]
    public void AnEventCannotBeChangedOnceWritten()
    {
        var setters = typeof(OperationalEvent)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(property => property.SetMethod is { IsPublic: true })
            .Select(property => property.Name)
            .ToArray();

        Assert.True(setters.Length == 0, $"OperationalEvent expone setters públicos: {string.Join(", ", setters)}");

        // IsSpecialName descarta los descriptores de acceso de las propiedades: lo que se busca
        // es un método de negocio que cambie el evento, no el get_ de cada campo.
        var mutators = typeof(OperationalEvent)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(method => !method.IsSpecialName)
            .Select(method => method.Name)
            .ToArray();

        Assert.True(mutators.Length == 0, $"OperationalEvent expone métodos de instancia: {string.Join(", ", mutators)}");
    }

    /// <summary>
    /// La validación del motivo vive en la capa de aplicación, que sí puede consultar el cierre.
    /// Que el dominio vuelva a comprobarlo no es redundancia: si alguien escribe una ruta que
    /// salta esa validación, esto lo detiene en vez de escribir un evento sin justificación.
    /// </summary>
    [Fact]
    public void AnEventThatNeededAReasonCannotBeWrittenWithoutOne()
    {
        var capture = OperationalSnapshot.Capture(Attendance());

        Assert.Throws<InvalidOperationException>(() => OperationalEvent.Record(
            capture, null, OperationalEventActions.Updated, "   ", true, ActorId, ActorName, Now));
    }

    [Fact]
    public void AnEventKeepsItsReasonAndItsInstantInUtc()
    {
        var capture = OperationalSnapshot.Capture(Attendance());

        var item = OperationalEvent.Record(
            capture, null, OperationalEventActions.Updated, "  Se corrigió la hora de entrada  ",
            true, ActorId, ActorName, new DateTime(2026, 9, 5, 12, 0, 0, DateTimeKind.Unspecified));

        Assert.Equal("Se corrigió la hora de entrada", item.Reason);
        Assert.True(item.IsReasonRequired);
        Assert.Equal(DateTimeKind.Utc, item.OccurredAt.Kind);
    }

    [Theory]
    [MemberData(nameof(Records))]
    public void EveryTrackedRecordCapturesItsIdentityAndNothingElse(object entity, OperationalEntityType expected)
    {
        var capture = OperationalSnapshot.Capture(entity);

        Assert.Equal(expected, capture.EntityType);
        Assert.NotEqual(Guid.Empty, capture.RecordId);
        Assert.NotEqual(Guid.Empty, capture.IdOrganization);

        // La foto es JSON plano y no contiene el texto libre que sí tiene el registro.
        using var document = JsonDocument.Parse(capture.Json);
        Assert.DoesNotContain("Confidencial", capture.Json, StringComparison.Ordinal);
    }

    /// <summary>
    /// Los enums de la foto se guardan por nombre. Si se guardaran por número, agregar mañana un
    /// valor a media enumeración cambiaría el significado de todas las fotos ya escritas.
    /// </summary>
    [Fact]
    public void EnumsTravelByNameAndNotByNumber()
    {
        var capture = OperationalSnapshot.Capture(Attendance());

        using var document = JsonDocument.Parse(capture.Json);
        Assert.Equal("Late", document.RootElement.GetProperty("Status").GetString());
    }

    [Fact]
    public void AnEntityWithoutHistoryIsRejectedInsteadOfIgnored()
    {
        Assert.False(OperationalSnapshot.IsTracked("cualquier cosa"));
        Assert.Throws<ArgumentException>(() => OperationalSnapshot.Capture("cualquier cosa"));
    }

    public static TheoryData<object, OperationalEntityType> Records() => new()
    {
        { Attendance(), OperationalEntityType.AttendanceRecord },
        { NewIncident(), OperationalEntityType.Incident },
        { Coverage(), OperationalEntityType.CoverageRecord },
        { Assignment(), OperationalEntityType.ServiceAssignment }
    };

    private static AttendanceRecord Attendance() => AttendanceRecord.Create(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Day,
        new(AttendanceStatus.Late, new TimeOnly(8, 15), new TimeOnly(16, 0), 15, "Confidencial: llegó tarde"),
        ActorId, ActorName, Now);

    private static Incident NewIncident() => Incident.Create(
        Guid.NewGuid(), Guid.NewGuid(),
        new(null, null, Day, "RETARDO", IncidentSeverity.Low, IncidentStatus.Open,
            "Confidencial: relato del hecho", null),
        ActorId, ActorName, Now);

    private static CoverageRecord Coverage() => CoverageRecord.Create(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
        new(Guid.NewGuid(), new TimeOnly(8, 0), new TimeOnly(16, 0), false, CoverageStatus.Requested,
            "Confidencial: nota de cobertura"),
        ActorId, ActorName, Now);

    private static ServiceAssignment Assignment() => ServiceAssignment.Create(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
        new(Guid.NewGuid(), ServiceAssignmentType.Primary, Day, null, true, "Confidencial: nota de asignación"),
        ActorId, ActorName, Now);
}
