using GestIA.Domain.Workforce;

namespace GestIA.Domain.UnitTests;

/// <summary>
/// El nombre de una persona vive en tres partes y se muestra como una sola cadena. Estas pruebas
/// son la definición de esa relación.
///
/// <para><b>Por qué importa tener pruebas de algo tan pequeño.</b> Antes de RQ-06 el nombre
/// completo era un campo que alguien teclearba, y ahora se deriva. El riesgo de una derivación es
/// que se desincronice: que una ruta escriba las partes sin recomponer el completo, o al revés. Lo
/// que se comprueba aquí es que no hay ninguna ruta así.</para>
/// </summary>
public class EmployeeNameTests
{
    private static readonly Guid ActorId = Guid.NewGuid();
    private const string ActorName = "Tester";
    private static readonly DateTime Now = new(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly HireDate = new(2026, 1, 15);

    /// <summary>
    /// El caso corriente: tres partes, un espacio entre cada una.
    /// </summary>
    [Fact]
    public void ComposeJoinsTheThreePartsWithASingleSpace() =>
        Assert.Equal("Adrián Escobar Ibáñez", EmployeeName.Compose("Adrián", "Escobar", "Ibáñez"));

    /// <summary>
    /// El caso que motivó tener un método en vez de una interpolación: hay personas con un solo
    /// apellido, y el materno vacío no puede dejar un espacio final.
    ///
    /// <para><b>El control es la interpolación ingenua.</b> Se comprueba que el resultado difiere
    /// de <c>$"{a} {b} {c}"</c>, porque si algún día alguien «simplifica» <c>Compose</c> a eso, la
    /// primera aserción seguiría pasando y sólo esta segunda se pondría roja.</para>
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ComposeWithoutMaternalLeavesNoTrailingSpace(string? maternal)
    {
        var compuesto = EmployeeName.Compose("Adrián", "Escobar", maternal);

        Assert.Equal("Adrián Escobar", compuesto);
        Assert.NotEqual($"Adrián Escobar {maternal}", compuesto);
    }

    /// <summary>
    /// Los bordes de cada parte se recortan antes de unir. Un nombre pegado desde otra pantalla
    /// llega con espacios, y ese espacio viajaría a la búsqueda y al orden alfabético.
    /// </summary>
    [Fact]
    public void ComposeTrimsEachPart() =>
        Assert.Equal("Adrián Escobar Ibáñez", EmployeeName.Compose("  Adrián ", " Escobar", "Ibáñez  "));

    /// <summary>
    /// <see cref="EmployeeName.Normalize"/> es la forma en la que se comparan dos nombres: sin
    /// bordes y con un solo espacio entre palabras. Es lo que hace comparable el nombre original de
    /// una fila con el nombre rearmado de sus partes.
    /// </summary>
    [Theory]
    [InlineData("  Adrián   Escobar  Ibáñez ", "Adrián Escobar Ibáñez")]
    [InlineData("Adrián Escobar", "Adrián Escobar")]
    [InlineData("yahir", "yahir")]
    public void NormalizeCollapsesSpacesAndTrims(string crudo, string esperado) =>
        Assert.Equal(esperado, EmployeeName.Normalize(crudo));

    /// <summary>
    /// Las tres partes caben en el completo por construcción, y ésta es la prueba que sostiene la
    /// longitud elegida: tres partes al máximo más dos espacios tienen que caber en la columna del
    /// derivado. Con 120 por parte —la propuesta que se descartó— esta prueba sería roja.
    /// </summary>
    [Fact]
    public void ThreeMaximumPartsFitInTheComposedLength()
    {
        var parte = new string('A', EmployeeName.PartMaxLength);

        Assert.True(EmployeeName.Compose(parte, parte, parte).Length <= EmployeeName.FullMaxLength);
    }

    /// <summary>
    /// Crear una persona compone su nombre completo. Nadie lo pasa.
    /// </summary>
    [Fact]
    public void CreateDerivesTheFullName()
    {
        var employee = Employee.Create(
            Guid.NewGuid(), "EMP-1", "Adrián", "Escobar", "Ibáñez", "Guardia", HireDate, ActorId, ActorName, Now);

        Assert.Equal("Adrián Escobar Ibáñez", employee.FullName);
    }

    /// <summary>
    /// Editar el nombre vuelve a componerlo, y <b>el control de esta prueba es el estado inicial</b>:
    /// la persona nace con otro nombre, así que el valor final sólo puede venir de la edición.
    /// </summary>
    [Fact]
    public void UpdatingTheNameRecomposesTheFullName()
    {
        var employee = Employee.Create(
            Guid.NewGuid(), "EMP-1", "Adrián", "Escobar", "Ibáñez", "Guardia", HireDate, ActorId, ActorName, Now);
        Assert.Equal("Adrián Escobar Ibáñez", employee.FullName);

        employee.UpdateProfile(Profile("Ana", "Pérez", null), ActorId, ActorName, Now);

        Assert.Equal("Ana", employee.FirstName);
        Assert.Equal("Pérez", employee.LastNamePaternal);
        Assert.Null(employee.LastNameMaternal);
        Assert.Equal("Ana Pérez", employee.FullName);
    }

    /// <summary>
    /// Quitar el apellido materno de alguien que lo tenía deja el nombre completo sin rastro de él.
    /// Es el caso que un <c>UPDATE</c> parcial rompería: partes nuevas con el completo viejo.
    /// </summary>
    [Fact]
    public void RemovingTheMaternalLastNameRemovesItFromTheFullName()
    {
        var employee = Employee.Create(
            Guid.NewGuid(), "EMP-1", "Adrián", "Escobar", "Ibáñez", "Guardia", HireDate, ActorId, ActorName, Now);

        employee.UpdateProfile(Profile("Adrián", "Escobar", null), ActorId, ActorName, Now);

        Assert.Equal("Adrián Escobar", employee.FullName);
        Assert.DoesNotContain("Ibáñez", employee.FullName, StringComparison.Ordinal);
    }

    /// <summary>
    /// Las dos partes obligatorias lo son en el dominio, no sólo en el formulario: una persona sin
    /// apellido paterno no se puede construir ni pasando por el perfil.
    /// </summary>
    [Theory]
    [InlineData("", "Escobar")]
    [InlineData("   ", "Escobar")]
    [InlineData("Adrián", "")]
    [InlineData("Adrián", "   ")]
    public void TheTwoRequiredPartsCannotBeBlank(string firstName, string lastNamePaternal)
    {
        var employee = Employee.Create(
            Guid.NewGuid(), "EMP-1", "Adrián", "Escobar", "Ibáñez", "Guardia", HireDate, ActorId, ActorName, Now);

        Assert.Throws<ArgumentException>(() =>
            employee.UpdateProfile(Profile(firstName, lastNamePaternal, null), ActorId, ActorName, Now));
    }

    private static EmployeeProfile Profile(string firstName, string lastNamePaternal, string? lastNameMaternal) =>
        new(firstName, lastNamePaternal, lastNameMaternal, "Guardia", HireDate,
            null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, null, null, null);
}
