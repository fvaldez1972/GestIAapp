using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace GestIA.IntegrationTests;

public sealed class GestIaApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting(
            "ConnectionStrings:GestIa",
            "Server=localhost,1433;Database=GestIA_Tests;User Id=sa;" +
            "Password=Only_for_configuration_tests_2026!;Encrypt=True;TrustServerCertificate=True");
    }
}
