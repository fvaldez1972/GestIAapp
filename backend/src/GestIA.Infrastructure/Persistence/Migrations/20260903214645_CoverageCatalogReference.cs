using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CoverageCatalogReference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdCoverageReason",
                schema: "dbo",
                table: "CoverageRecords",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CoverageRecords_IdCoverageReason",
                schema: "dbo",
                table: "CoverageRecords",
                column: "IdCoverageReason");

            migrationBuilder.AddForeignKey(
                name: "FK_CoverageRecords_BusinessCatalogItems_IdCoverageReason",
                schema: "dbo",
                table: "CoverageRecords",
                column: "IdCoverageReason",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);

            // Keep legacy notes intact; associate only unambiguous catalog matches in the same tenant.
            migrationBuilder.Sql("EXEC(N'" + """
                UPDATE coverage SET IdCoverageReason = reason.IdBusinessCatalogItem
                FROM dbo.CoverageRecords coverage
                JOIN dbo.ScheduledShifts shift ON shift.IdScheduledShift=coverage.IdScheduledShift
                JOIN dbo.ScheduleVersions version ON version.IdScheduleVersion=shift.IdScheduleVersion
                JOIN dbo.Services service ON service.IdService=version.IdService
                JOIN dbo.Clients client ON client.IdClient=service.IdClient
                CROSS APPLY (SELECT MIN(LTRIM(RTRIM(value))) AS Line FROM STRING_SPLIT(REPLACE(coverage.Notes,CHAR(13),''),CHAR(10)) WHERE LTRIM(value) LIKE N'Motivo:%' HAVING COUNT(*)=1) note
                CROSS APPLY (SELECT MIN(CONVERT(varchar(36),IdBusinessCatalogItem)) AS IdBusinessCatalogItem FROM dbo.BusinessCatalogItems
                    WHERE IdOrganization=client.IdOrganization AND Type='CoverageReason' AND Name=LTRIM(SUBSTRING(note.Line,8,1000)) HAVING COUNT(*)=1) reason
                WHERE coverage.IdCoverageReason IS NULL AND reason.IdBusinessCatalogItem IS NOT NULL;
                """.Replace("'", "''", StringComparison.Ordinal) + "');");

            var geography = GestIA.Application.Catalogs.OrganizationCatalogDefaults.GeographyJson.Replace("'", "''", StringComparison.Ordinal);
            migrationBuilder.Sql("DECLARE @geo nvarchar(max)=N'" + geography + "';\n" + """
                DECLARE @states TABLE (Code varchar(2), Name nvarchar(160), Cities nvarchar(max));
                INSERT @states SELECT Code,Name,Cities FROM OPENJSON(@geo,'$.States')
                    WITH(Code varchar(2),Name nvarchar(160),Cities nvarchar(max) AS JSON);
                INSERT dbo.BusinessCatalogItems(IdBusinessCatalogItem,IdOrganization,Type,Code,Name,IdParentCatalogItem,CreatedBy,CreatedByName)
                SELECT NEWID(),country.IdOrganization,'State','MX-'+state.Code,state.Name,country.IdBusinessCatalogItem,
                    '00000000-0000-0000-0000-000000000000',N'INEGI catalog 2026-09-03'
                FROM dbo.BusinessCatalogItems country JOIN dbo.Organizations org ON org.IdOrganization=country.IdOrganization AND org.Active=1
                CROSS JOIN @states state
                WHERE country.Type='Country' AND country.Code='MX' AND NOT EXISTS (
                    SELECT 1 FROM dbo.BusinessCatalogItems existing WHERE existing.IdOrganization=country.IdOrganization AND existing.Type='State'
                    AND (existing.Code='MX-'+state.Code OR (existing.IdParentCatalogItem=country.IdBusinessCatalogItem AND existing.Name COLLATE Latin1_General_100_CI_AI=state.Name COLLATE Latin1_General_100_CI_AI)));
                INSERT dbo.BusinessCatalogItems(IdBusinessCatalogItem,IdOrganization,Type,Code,Name,IdParentCatalogItem,CreatedBy,CreatedByName)
                SELECT NEWID(),country.IdOrganization,'City','MX-'+city.Code,city.Name,parent.IdBusinessCatalogItem,
                    '00000000-0000-0000-0000-000000000000',N'INEGI catalog 2026-09-03'
                FROM dbo.BusinessCatalogItems country JOIN dbo.Organizations org ON org.IdOrganization=country.IdOrganization AND org.Active=1
                CROSS JOIN @states state
                CROSS APPLY (SELECT TOP(1) item.IdBusinessCatalogItem FROM dbo.BusinessCatalogItems item WHERE item.IdOrganization=country.IdOrganization
                    AND item.Type='State' AND item.IdParentCatalogItem=country.IdBusinessCatalogItem
                    AND (item.Code='MX-'+state.Code OR item.Name COLLATE Latin1_General_100_CI_AI=state.Name COLLATE Latin1_General_100_CI_AI)
                    ORDER BY item.IdBusinessCatalogItem) parent
                CROSS APPLY OPENJSON(state.Cities) WITH(Code varchar(5),Name nvarchar(160)) city
                WHERE country.Type='Country' AND country.Code='MX' AND NOT EXISTS (
                    SELECT 1 FROM dbo.BusinessCatalogItems existing WHERE existing.IdOrganization=country.IdOrganization AND existing.Type='City'
                    AND (existing.Code='MX-'+city.Code OR (existing.IdParentCatalogItem=parent.IdBusinessCatalogItem AND existing.Name COLLATE Latin1_General_100_CI_AI=city.Name COLLATE Latin1_General_100_CI_AI)));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CoverageRecords_BusinessCatalogItems_IdCoverageReason",
                schema: "dbo",
                table: "CoverageRecords");

            migrationBuilder.DropIndex(
                name: "IX_CoverageRecords_IdCoverageReason",
                schema: "dbo",
                table: "CoverageRecords");

            migrationBuilder.DropColumn(
                name: "IdCoverageReason",
                schema: "dbo",
                table: "CoverageRecords");
        }
    }
}
