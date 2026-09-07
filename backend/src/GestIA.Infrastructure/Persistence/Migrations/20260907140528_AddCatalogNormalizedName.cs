using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF Core genera arreglos locales para indices compuestos.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogNormalizedName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "varchar(200)",
                nullable: false,
                computedColumnSql: "CAST(UPPER(LTRIM(RTRIM(\r\n    REPLACE(\r\n        REPLACE(\r\n            REPLACE(\r\n                REPLACE(REPLACE(REPLACE([Name], CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '),\r\n                ' ', CHAR(1) + CHAR(2)),\r\n            CHAR(2) + CHAR(1), ''),\r\n        CHAR(1) + CHAR(2), ' ')\r\n))) AS varchar(200))",
                stored: true,
                collation: "Latin1_General_CI_AI");

            migrationBuilder.CreateIndex(
                name: "UX_BusinessCatalogItems_IdOrganization_Type_IdParentCatalogItem_NormalizedName",
                schema: "dbo",
                table: "BusinessCatalogItems",
                columns: new[] { "IdOrganization", "Type", "IdParentCatalogItem", "NormalizedName" },
                unique: true,
                filter: "[Type] <> 'Country' AND [Type] <> 'State' AND [Type] <> 'City'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_BusinessCatalogItems_IdOrganization_Type_IdParentCatalogItem_NormalizedName",
                schema: "dbo",
                table: "BusinessCatalogItems");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                schema: "dbo",
                table: "BusinessCatalogItems");
        }
    }
}
