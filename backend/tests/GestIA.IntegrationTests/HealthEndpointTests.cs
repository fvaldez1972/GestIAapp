using System.Net;

namespace GestIA.IntegrationTests;

public sealed class HealthEndpointTests : IClassFixture<GestIaApiFactory>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(GestIaApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/health/live")]
    public async Task LivenessEndpointReturnsOk(string endpoint)
    {
        using var response = await _client.GetAsync(endpoint);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
