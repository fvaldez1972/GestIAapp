using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace GestIA.IntegrationTests;

public sealed class GestIaApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting(
            "ConnectionStrings:GestIa",
            "Server=localhost,1433;Database=db-gestia-test;User Id=sa;" +
            "Password=Only_for_configuration_tests_2026!;Encrypt=True;TrustServerCertificate=True");
        builder.UseSetting("Jwt:Issuer", "GestIA.Tests");
        builder.UseSetting("Jwt:Audience", "GestIA.Tests");
        builder.UseSetting("Jwt:Secret", "GestIA_Tests_Jwt_Secret_2026_Minimum_32_Characters");
        builder.UseSetting("BootstrapAdmin:Email", "admin.tests@gestia.local");
        builder.UseSetting("BootstrapAdmin:Password", "GestIA.Tests.2026!");
        builder.UseSetting("SecuritySeed:Enabled", "false");
    }
}
