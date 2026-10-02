using System.Reflection;
using GestIA.Domain.Documents;

namespace GestIA.Architecture.Tests;

/// <summary>
/// Las bitácoras son de sólo agregar, y esa garantía vive en una guarda de
/// <c>GestIaDbContext.SaveChanges</c> que enumera las tablas a mano.
///
/// El riesgo es silencioso: una bitácora nueva que nadie agregue a esa lista queda editable, y
/// nada lo advierte hasta que alguien corrige un evento y borra el rastro que el evento existía
/// para conservar. Esta prueba cierra ese hueco leyendo el código fuente, igual que
/// <see cref="LayerDependencyTests"/> lee los <c>.csproj</c>.
/// </summary>
public sealed class HistoryImmutabilityTests
{
    private const string GuardMethod = "EnsureHistoryIsAppendOnly";

    /// <summary>
    /// Qué cuenta como bitácora: una entidad que guarda la foto de antes y la de después. Es un
    /// rasgo de forma y no un nombre, para que renombrar una clase no la saque de la vigilancia.
    /// </summary>
    private static Type[] HistoryEntities() =>
        typeof(BusinessDocumentEvent).Assembly.GetTypes()
            .Where(type => type is { IsClass: true, IsAbstract: false })
            .Where(HasBothSnapshots)
            .OrderBy(type => type.Name)
            .ToArray();

    [Fact]
    public void EveryHistoryTableIsProtectedByTheAppendOnlyGuard()
    {
        var guard = ReadGuardBody();

        var unprotected = HistoryEntities()
            .Where(type => !guard.Contains($"Entries<{type.Name}>()", StringComparison.Ordinal))
            .Select(type => type.Name)
            .ToArray();

        Assert.True(
            unprotected.Length == 0,
            $"Estas bitácoras no están en la guarda {GuardMethod} de GestIaDbContext, así que se " +
            "pueden modificar y eliminar como cualquier tabla. Una bitácora corregible no sirve " +
            $"para lo único que sirve: {string.Join(", ", unprotected)}");
    }

    /// <summary>
    /// Hoy son dos. El conteo está a mano para que agregar una tercera obligue a pasar por aquí
    /// y por la guarda, en vez de aparecer sola.
    /// </summary>
    [Fact]
    public void ThereAreTwoHistoryTables() => Assert.Equal(2, HistoryEntities().Length);

    [Fact]
    public void TheGuardRejectsBothModificationAndDeletion()
    {
        var guard = ReadGuardBody();

        Assert.Contains("EntityState.Modified", guard, StringComparison.Ordinal);
        Assert.Contains("EntityState.Deleted", guard, StringComparison.Ordinal);
    }

    private static bool HasBothSnapshots(Type type) =>
        type.GetProperty("BeforeSnapshot", BindingFlags.Public | BindingFlags.Instance) is not null &&
        type.GetProperty("AfterSnapshot", BindingFlags.Public | BindingFlags.Instance) is not null;

    private static string ReadGuardBody()
    {
        var root = FindBackendRoot();
        var path = Path.Combine(root.FullName, "src", "GestIA.Infrastructure", "Persistence", "GestIaDbContext.cs");
        var source = File.ReadAllText(path);

        var start = source.IndexOf($"private void {GuardMethod}()", StringComparison.Ordinal);
        Assert.True(start >= 0, $"No se encontró la guarda {GuardMethod} en GestIaDbContext.");

        // El cuerpo va del primer '{' tras la firma hasta el '}' que lo cierra.
        var open = source.IndexOf('{', start);
        var depth = 0;

        for (var index = open; index < source.Length; index++)
        {
            if (source[index] == '{')
            {
                depth++;
            }
            else if (source[index] == '}' && --depth == 0)
            {
                return source[open..index];
            }
        }

        throw new InvalidOperationException($"El cuerpo de {GuardMethod} no está balanceado.");
    }

    private static DirectoryInfo FindBackendRoot()
    {
        for (var current = new DirectoryInfo(AppContext.BaseDirectory); current is not null; current = current.Parent)
        {
            if (File.Exists(Path.Combine(current.FullName, "GestIA.sln")))
            {
                return current;
            }
        }

        throw new DirectoryNotFoundException("Could not locate the GestIA backend root.");
    }
}
