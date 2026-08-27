using GestIA.Domain.Clients;
using GestIA.Domain.Services;

namespace GestIA.Domain.UnitTests;

public sealed class BusinessEntityTests
{
    private static readonly Guid ActorId = Guid.Parse("93b9d6c4-8f34-4c0a-8dc7-44328993b6df");
    private static readonly DateTime OccurredAt = new(2026, 8, 26, 20, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ClientCreationNormalizesRequiredTextAndAuditData()
    {
        var client = Client.Create(
            Guid.NewGuid(),
            " CLI-001 ",
            " Example Client, S.A. de C.V. ",
            " EXA010101AA1 ",
            ActorId,
            " Dany ",
            OccurredAt);

        Assert.Equal("CLI-001", client.CodeClient);
        Assert.Equal("Example Client, S.A. de C.V.", client.LegalName);
        Assert.Equal("EXA010101AA1", client.Rfc);
        Assert.Equal("Dany", client.CreatedByName);
        Assert.Equal(DateTimeKind.Utc, client.CreatedAt.Kind);
        Assert.True(client.Active);
    }

    [Fact]
    public void ClientProfileUpdateNormalizesValuesAndRegistersAuditData()
    {
        var client = Client.Create(
            Guid.NewGuid(),
            "cli-002",
            "Cliente inicial",
            "EXA010101AA1",
            ActorId,
            "Dany",
            OccurredAt);
        var updateAt = OccurredAt.AddHours(1);

        client.UpdateProfile(
            new ClientProfile(
                " Cliente actualizado ",
                " Nombre comercial ",
                "exa010101aa1",
                " Mexicana ",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null),
            ActorId,
            "Dany",
            updateAt);

        Assert.Equal("CLI-002", client.CodeClient);
        Assert.Equal("Cliente actualizado", client.LegalName);
        Assert.Equal("Nombre comercial", client.TradeName);
        Assert.Equal("EXA010101AA1", client.Rfc);
        Assert.Equal(updateAt, client.UpdatedAt);
    }

    [Fact]
    public void ServiceConfigurationKeepsTheContractedMonthlyHours()
    {
        var configuration = ServiceConfiguration.Create(
            Guid.NewGuid(),
            new DateOnly(2026, 9, 1),
            1,
            24,
            7,
            729,
            20,
            "24 hours, 7 days per week",
            42_500,
            false,
            ActorId,
            "Dany",
            OccurredAt);

        Assert.Equal(168, configuration.AverageWeeklyHours);
        Assert.Equal(729, configuration.AverageMonthlyHours);
        Assert.Equal(20, configuration.PreparationLeadDays);
    }

    [Fact]
    public void ServiceConfigurationRejectsMoreThanSevenDaysPerWeek()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => ServiceConfiguration.Create(
            Guid.NewGuid(),
            new DateOnly(2026, 9, 1),
            1,
            24,
            8,
            729,
            20,
            "Invalid schedule",
            42_500,
            false,
            ActorId,
            "Dany",
            OccurredAt));
    }
}
