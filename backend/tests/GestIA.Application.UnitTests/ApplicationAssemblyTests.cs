using System.Xml.Linq;

namespace GestIA.Application.UnitTests;

public sealed class ApplicationProjectTests
{
    [Fact]
    public void ApplicationReferencesDomain()
    {
        var project = LoadProject("backend", "src", "GestIA.Application", "GestIA.Application.csproj");
        var projectReferences = project
            .Descendants("ProjectReference")
            .Select(reference => reference.Attribute("Include")?.Value.Replace('\\', '/'))
            .OfType<string>()
            .Select(path => Path.GetFileNameWithoutExtension(path))
            .ToArray();

        Assert.Equal<string>(["GestIA.Domain"], projectReferences);
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
