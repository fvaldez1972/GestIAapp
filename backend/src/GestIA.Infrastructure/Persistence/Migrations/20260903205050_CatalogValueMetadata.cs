using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CatalogValueMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CatalogGroup",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "General")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_CatalogGroup");

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "int",
                nullable: false,
                defaultValue: 1)
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_DisplayOrder");

            migrationBuilder.AddColumn<string>(
                name: "Synonyms",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "nvarchar(max)",
                nullable: false,
                defaultValueSql: "N'[]'")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_Synonyms");

            migrationBuilder.Sql("""
                EXEC(N'UPDATE dbo.BusinessCatalogItems
                SET CatalogGroup = CASE
                    WHEN Type IN (''IncidentReason'', ''CoverageReason'', ''CancellationReason'') THEN N''Operativo''
                    WHEN Type IN (''DocumentRequirement'', ''EvaluationRequirement'', ''ClientRestriction'', ''ServiceRestriction'') THEN N''Elegibilidad''
                    ELSE N''General'' END;');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CatalogGroup",
                schema: "dbo",
                table: "BusinessCatalogItems")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_CatalogGroup");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                schema: "dbo",
                table: "BusinessCatalogItems")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_DisplayOrder");

            migrationBuilder.DropColumn(
                name: "Synonyms",
                schema: "dbo",
                table: "BusinessCatalogItems")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_Synonyms");
        }
    }
}
