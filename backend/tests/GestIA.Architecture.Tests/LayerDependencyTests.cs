using System.Xml.Linq;

namespace GestIA.Architecture.Tests;

public sealed class LayerDependencyTests
{
    [Fact]
    public void DomainHasNoProjectReferences()
    {
        Assert.Empty(GetProjectReferences("GestIA.Domain"));
    }

    [Fact]
    public void ApplicationOnlyReferencesDomain()
    {
        Assert.Equal(["GestIA.Domain"], GetProjectReferences("GestIA.Application"));
    }

    [Fact]
    public void InfrastructureReferencesApplicationAndDomain()
    {
        Assert.Equal(
            ["GestIA.Application", "GestIA.Domain"],
            GetProjectReferences("GestIA.Infrastructure").Order(StringComparer.Ordinal));
    }

    [Fact]
    public void ApiReferencesApplicationAndInfrastructure()
    {
        Assert.Equal(
            ["GestIA.Application", "GestIA.Infrastructure"],
            GetProjectReferences("GestIA.Api").Order(StringComparer.Ordinal));
    }

    private static string[] GetProjectReferences(string projectName)
    {
        var root = FindRepositoryRoot();
        var projectFile = Path.Combine(root.FullName, "backend", "src", projectName, $"{projectName}.csproj");
        var project = XDocument.Load(projectFile);

        return project
            .Descendants("ProjectReference")
            .Select(reference => reference.Attribute("Include")?.Value.Replace('\\', '/'))
            .OfType<string>()
            .Select(path => Path.GetFileNameWithoutExtension(path))
            .ToArray();
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
