using System.Text;
using System.Text.RegularExpressions;

namespace GestIA.Architecture.Tests;

/// <summary>
/// Vigila los apagados de filtros globales en <c>backend/src</c>, leyendo el código fuente igual
/// que <see cref="LayerDependencyTests"/> lee los <c>.csproj</c>.
///
/// Hay dos filtros con nombre: <c>Active</c>, el borrado lógico, y <c>Organization</c>, el
/// aislamiento entre organizaciones. Sin estas pruebas, tres cosas se pueden colar sin que nadie
/// se entere:
///
/// <list type="number">
/// <item><c>IgnoreQueryFilters()</c> sin argumentos apaga <b>los dos</b>: quien sólo quería ver
/// registros inactivos termina viendo también los de las demás organizaciones.</item>
/// <item>Un nombre mal escrito no falla en ninguna parte: EF ignora las claves que no conoce,
/// así que el apagado simplemente no ocurre y la consulta devuelve otra cosa de la que el autor
/// creía.</item>
/// <item>El bypass de organización se copia a un archivo nuevo. Cada uno es un agujero, y la
/// lista blanca de abajo sólo debe crecer con una decisión revisada, visible en el diff.</item>
/// </list>
/// </summary>
public sealed class OrganizationFilterBypassTests
{
    private const string OrganizationFilter = "Organization";
    private const string ActiveFilter = "Active";

    /// <summary>Los únicos nombres de filtro que existen en el modelo.</summary>
    private static readonly HashSet<string> KnownFilters = new(StringComparer.Ordinal)
    {
        ActiveFilter,
        OrganizationFilter
    };

    /// <summary>
    /// Las constantes que se usan donde C# no admite expresiones de colección: dentro de un árbol
    /// de expresión. Se declaran en <c>QueryFilterNames</c>.
    /// </summary>
    private static readonly Dictionary<string, string[]> NamedArgumentLists = new(StringComparer.Ordinal)
    {
        ["QueryFilterNames.ActiveOnly"] = [ActiveFilter],
        ["QueryFilterNames.ActiveAndOrganization"] = [ActiveFilter, OrganizationFilter]
    };

    /// <summary>
    /// Los únicos archivos autorizados a apagar el aislamiento entre organizaciones.
    ///
    /// <list type="bullet">
    /// <item><b>OrganizationGovernanceRepository</b>: vista de plataforma del super admin, que
    /// lista todas las organizaciones con sus clientes. El endpoint exige
    /// <c>PLATFORM.ADMIN</c>.</item>
    /// <item><b>DemoDataSeeder</b> y sus parciales: corren al arrancar, fuera de toda petición,
    /// así que no hay organización autorizada que el filtro pueda usar.</item>
    /// </list>
    ///
    /// Rutas relativas a <c>backend/</c>, con separador <c>/</c>.
    /// </summary>
    private static readonly HashSet<string> OrganizationBypassAllowList = new(StringComparer.Ordinal)
    {
        "src/GestIA.Infrastructure/Persistence/Repositories/OrganizationGovernanceRepository.cs",
        "src/GestIA.Infrastructure/Persistence/DemoData/DemoDataSeeder.cs",
        "src/GestIA.Infrastructure/Persistence/DemoData/DemoDataSeeder.Commercial.cs",
        "src/GestIA.Infrastructure/Persistence/DemoData/DemoDataSeeder.Daily.cs",
        "src/GestIA.Infrastructure/Persistence/DemoData/DemoDataSeeder.Operational.cs"
    };

    [Fact]
    public void NoQueryIgnoresEveryFilterAtOnce()
    {
        var offenders = Calls()
            .Where(call => call.Arguments.Length == 0)
            .Select(call => $"{call.File}:{call.Line}")
            .ToArray();

        Assert.True(
            offenders.Length == 0,
            "IgnoreQueryFilters() sin argumentos apaga TODOS los filtros, incluido el " +
            "aislamiento entre organizaciones. Hay que decir cuál se apaga. " +
            $"Encontrado en:{Environment.NewLine}{string.Join(Environment.NewLine, offenders)}");
    }

    [Fact]
    public void EveryIgnoredFilterNameExists()
    {
        var offenders = Calls()
            .SelectMany(call => call.Arguments
                .Where(name => !KnownFilters.Contains(name))
                .Select(name => $"{call.File}:{call.Line} -> {name}"))
            .ToArray();

        Assert.True(
            offenders.Length == 0,
            "EF ignora en silencio las claves de filtro que no conoce: un nombre mal escrito no " +
            "apaga nada y la consulta devuelve algo distinto de lo que el autor cree. Los " +
            $"nombres válidos son {string.Join(" y ", KnownFilters.Order())}. " +
            $"Encontrado en:{Environment.NewLine}{string.Join(Environment.NewLine, offenders)}");
    }

    [Fact]
    public void OnlyAllowListedFilesTurnOffTheOrganizationIsolation()
    {
        var offenders = Calls()
            .Where(call => call.Arguments.Contains(OrganizationFilter, StringComparer.Ordinal))
            .Where(call => !OrganizationBypassAllowList.Contains(call.File))
            .Select(call => $"{call.File}:{call.Line}")
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        Assert.True(
            offenders.Length == 0,
            "Apagar el filtro de organización deja ver los datos de todas las organizaciones. " +
            "Sólo pueden hacerlo los archivos de la lista blanca de esta prueba, y agregar uno " +
            "es una decisión que debe revisarse en el diff. " +
            $"Encontrado en:{Environment.NewLine}{string.Join(Environment.NewLine, offenders)}");
    }

    /// <summary>
    /// La lista blanca no sirve de nada si queda apuntando a archivos que ya no usan el bypass:
    /// se convierte en permiso latente para quien retome el nombre.
    /// </summary>
    [Fact]
    public void TheAllowListHasNoLeftovers()
    {
        var actual = Calls()
            .Where(call => call.Arguments.Contains(OrganizationFilter, StringComparer.Ordinal))
            .Select(call => call.File)
            .ToHashSet(StringComparer.Ordinal);

        var stale = OrganizationBypassAllowList.Except(actual, StringComparer.Ordinal).ToArray();

        Assert.True(
            stale.Length == 0,
            "Estos archivos están autorizados a apagar el aislamiento entre organizaciones pero " +
            "ya no lo hacen. Hay que quitarlos de la lista blanca en lugar de dejar el permiso " +
            $"abierto: {string.Join(", ", stale)}");
    }

    private static IEnumerable<QueryFilterCall> Calls()
    {
        var root = FindBackendRoot();
        var source = Path.Combine(root.FullName, "src");

        foreach (var path in Directory.EnumerateFiles(source, "*.cs", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(root.FullName, path).Replace('\\', '/');
            var text = StripComments(File.ReadAllText(path));

            foreach (Match match in Regex.Matches(text, @"IgnoreQueryFilters\s*\("))
            {
                var open = match.Index + match.Length - 1;
                var inner = ReadArgumentList(text, open);
                var line = text.Take(match.Index).Count(character => character == '\n') + 1;

                yield return new QueryFilterCall(relative, line, ParseArguments(inner));
            }
        }
    }

    /// <summary>Texto entre el paréntesis de apertura y el que lo cierra, con anidamiento.</summary>
    private static string ReadArgumentList(string text, int open)
    {
        var depth = 0;

        for (var index = open; index < text.Length; index++)
        {
            if (text[index] == '(')
            {
                depth++;
            }
            else if (text[index] == ')')
            {
                depth--;

                if (depth == 0)
                {
                    return text[(open + 1)..index];
                }
            }
        }

        throw new InvalidOperationException("Unbalanced parentheses after IgnoreQueryFilters.");
    }

    private static string[] ParseArguments(string inner)
    {
        if (string.IsNullOrWhiteSpace(inner))
        {
            return [];
        }

        var literals = Regex.Matches(inner, "\"([^\"]*)\"")
            .Select(match => match.Groups[1].Value)
            .ToArray();

        if (literals.Length > 0)
        {
            return literals;
        }

        foreach (var (name, filters) in NamedArgumentLists)
        {
            if (inner.Contains(name, StringComparison.Ordinal))
            {
                return filters;
            }
        }

        // Un argumento que esta prueba no sabe leer es igual de opaco para quien revisa el diff.
        return [$"expresión no reconocida: {inner.Trim()}"];
    }

    /// <summary>
    /// Quita comentarios de línea, de bloque y de documentación, para que un ejemplo escrito en
    /// un comentario no cuente como llamada. Respeta las cadenas literales, donde una diagonal
    /// doble es texto y no comentario.
    /// </summary>
    private static string StripComments(string text)
    {
        var result = new StringBuilder(text.Length);
        var index = 0;

        while (index < text.Length)
        {
            if (text[index] == '"')
            {
                var end = index + 1;

                while (end < text.Length && text[end] != '"' && text[end] != '\n')
                {
                    end += text[end] == '\\' ? 2 : 1;
                }

                var stop = Math.Min(end + 1, text.Length);
                result.Append(text[index..stop]);
                index = stop;
            }
            else if (text[index] == '/' && index + 1 < text.Length && text[index + 1] == '/')
            {
                while (index < text.Length && text[index] != '\n')
                {
                    index++;
                }
            }
            else if (text[index] == '/' && index + 1 < text.Length && text[index + 1] == '*')
            {
                var end = text.IndexOf("*/", index + 2, StringComparison.Ordinal);
                var stop = end < 0 ? text.Length : end + 2;

                for (var scan = index; scan < stop; scan++)
                {
                    if (text[scan] == '\n')
                    {
                        result.Append('\n');
                    }
                }

                index = stop;
            }
            else
            {
                result.Append(text[index]);
                index++;
            }
        }

        return result.ToString();
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

    private sealed record QueryFilterCall(string File, int Line, string[] Arguments);
}
