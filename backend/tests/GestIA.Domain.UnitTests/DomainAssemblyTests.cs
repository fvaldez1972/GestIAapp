using System.Xml.Linq;

namespace GestIA.Domain.UnitTests;

public sealed class DomainProjectTests
{
    [Fact]
    public void DomainTargetsDotNetTen()
    {
        var project = LoadProject("backend", "src", "GestIA.Domain", "GestIA.Domain.csproj");
        var targetFramework = project.Descendants("TargetFramework").Single().Value;

        Assert.Equal("net10.0", targetFramework);
    }

    private static XDocument LoadProject(params string[] segments)
    {
        var root = FindRepositoryRoot();
        return XDocument.Load(Path.Combine([root.FullName, .. segments]));
    }

    private static DirectoryInfo FindRepositoryRoot()
    {
        for (var current = new DirectoryInfo(AppContext.BaseDirectory); current is not null; current = current.Parent)
        {
            if (File.Exists(Path.Combine(current.FullName, "GestIA.slnx")))
            {
                return current;
            }
        }

        throw new DirectoryNotFoundException("Could not locate the GestIA repository root.");
    }
}
