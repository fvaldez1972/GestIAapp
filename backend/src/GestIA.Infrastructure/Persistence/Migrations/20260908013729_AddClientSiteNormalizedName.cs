using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861 // EF Core genera arreglos locales para los indices compuestos.

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Dos sedes del mismo cliente no pueden llamarse igual.
    ///
    /// <para>Nace de un defecto visto en vivo: el formulario de alta no se limpiaba al guardar, y
    /// pulsar otra vez creaba una sede identica. En <c>db-gestia-dev</c> quedaron cuatro «Vicente
    /// Eguia» del mismo cliente, creadas en dieciseis segundos.</para>
    ///
    /// <para><b>La guarda va primero y detiene la migracion si quedan duplicados.</b> Resolverlos
    /// es una decision sobre datos reales —renombrar o desactivar— y no la toma una migracion por
    /// su cuenta. Es la misma regla que se siguio al partir <c>RequiredCode</c>.</para>
    /// </summary>
    public partial class AddClientSiteNormalizedName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF EXISTS (
                    SELECT 1
                    FROM dbo.ClientSites
                    GROUP BY IdClient, UPPER(LTRIM(RTRIM([Name])))
                    HAVING COUNT(*) > 1)
                BEGIN
                    DECLARE @detalle nvarchar(2000) = (
                        SELECT STRING_AGG(CAST(CONCAT(c, ' x ', n) AS nvarchar(200)), '; ')
                        FROM (
                            SELECT UPPER(LTRIM(RTRIM([Name]))) AS n, COUNT(*) AS c
                            FROM dbo.ClientSites
                            GROUP BY IdClient, UPPER(LTRIM(RTRIM([Name])))
                            HAVING COUNT(*) > 1) d);

                    DECLARE @mensaje nvarchar(3000) = CONCAT(
                        'Hay sedes duplicadas por cliente y no se pueden dejar asi: ', @detalle,
                        '. Resuelvelas antes de aplicar esta migracion. Renombrar conserva las dos; ',
                        'desactivar no basta, porque el indice cubre activas e inactivas.');

                    THROW 50000, @mensaje, 1;
                END
                """);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                schema: "dbo",
                table: "ClientSites",
                type: "varchar(200)",
                nullable: false,
                computedColumnSql: "CAST(UPPER(LTRIM(RTRIM(\r\n    REPLACE(\r\n        REPLACE(\r\n            REPLACE(\r\n                REPLACE(REPLACE(REPLACE([Name], CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '),\r\n                ' ', CHAR(1) + CHAR(2)),\r\n            CHAR(2) + CHAR(1), ''),\r\n        CHAR(1) + CHAR(2), ' ')\r\n))) AS varchar(200))",
                stored: true,
                collation: "Latin1_General_CI_AI");

            migrationBuilder.CreateIndex(
                name: "UX_ClientSites_IdClient_NormalizedName",
                schema: "dbo",
                table: "ClientSites",
                columns: new[] { "IdClient", "NormalizedName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_ClientSites_IdClient_NormalizedName",
                schema: "dbo",
                table: "ClientSites");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                schema: "dbo",
                table: "ClientSites");
        }
    }
}
