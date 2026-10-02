using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GeographicCatalogRelations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CountryCode",
                schema: "dbo",
                table: "Employees",
                type: "varchar(2)",
                unicode: false,
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdParentCatalogItem",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_BusinessCatalogItems_IdParentCatalogItem",
                schema: "dbo",
                table: "BusinessCatalogItems",
                column: "IdParentCatalogItem");

            migrationBuilder.AddForeignKey(
                name: "FK_BusinessCatalogItems_BusinessCatalogItems_IdParentCatalogItem",
                schema: "dbo",
                table: "BusinessCatalogItems",
                column: "IdParentCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);

            // A separate compilation scope allows the new parent column to be used in the SQL script batch.
            migrationBuilder.Sql("EXEC(N'" + """
                DECLARE @Seed TABLE (IdOrganization uniqueidentifier, Type varchar(40), Code varchar(80), Name nvarchar(160), IdParentCatalogItem uniqueidentifier NULL);
                INSERT @Seed
                SELECT IdOrganization, 'Country', 'MX', N'Mexico', NULL FROM dbo.Organizations WHERE Active = 1
                UNION
                SELECT c.IdOrganization, 'Country', UPPER(s.CountryCode), CASE WHEN s.CountryCode = 'MX' THEN N'Mexico' ELSE s.CountryCode END, NULL
                FROM dbo.ClientSites s JOIN dbo.Clients c ON c.IdClient=s.IdClient WHERE s.Active=1 AND c.Active=1 AND LEN(s.CountryCode)=2;
                INSERT dbo.BusinessCatalogItems (IdBusinessCatalogItem,IdOrganization,Type,Code,Name,IdParentCatalogItem,CreatedBy,CreatedByName)
                SELECT NEWID(), s.IdOrganization,s.Type,s.Code,s.Name,s.IdParentCatalogItem,'00000000-0000-0000-0000-000000000000',N'Catalog migration'
                FROM @Seed s WHERE NOT EXISTS (SELECT 1 FROM dbo.BusinessCatalogItems b WHERE b.IdOrganization=s.IdOrganization AND b.Type=s.Type AND b.Code=s.Code);
                DELETE @Seed;
                INSERT @Seed
                SELECT DISTINCT c.IdOrganization, 'State', 'STATE-'+CONVERT(varchar(64),HASHBYTES('SHA2_256',UPPER(s.CountryCode)+N'|'+LTRIM(RTRIM(s.State))),2), LTRIM(RTRIM(s.State)), country.IdBusinessCatalogItem
                FROM dbo.ClientSites s JOIN dbo.Clients c ON c.IdClient=s.IdClient
                JOIN dbo.BusinessCatalogItems country ON country.IdOrganization=c.IdOrganization AND country.Type='Country' AND country.Code=s.CountryCode
                WHERE s.Active=1 AND c.Active=1 AND LEN(LTRIM(RTRIM(s.State)))>0;
                INSERT dbo.BusinessCatalogItems (IdBusinessCatalogItem,IdOrganization,Type,Code,Name,IdParentCatalogItem,CreatedBy,CreatedByName)
                SELECT NEWID(), s.IdOrganization,s.Type,s.Code,s.Name,s.IdParentCatalogItem,'00000000-0000-0000-0000-000000000000',N'Catalog migration'
                FROM @Seed s WHERE NOT EXISTS (SELECT 1 FROM dbo.BusinessCatalogItems b WHERE b.IdOrganization=s.IdOrganization AND b.Type=s.Type AND b.Code=s.Code);
                DELETE @Seed;
                INSERT @Seed
                SELECT DISTINCT c.IdOrganization,'City','CITY-'+CONVERT(varchar(64),HASHBYTES('SHA2_256',UPPER(s.CountryCode)+N'|'+LTRIM(RTRIM(s.State))+N'|'+LTRIM(RTRIM(s.Municipality))),2),LTRIM(RTRIM(s.Municipality)),state.IdBusinessCatalogItem
                FROM dbo.ClientSites s JOIN dbo.Clients c ON c.IdClient=s.IdClient
                JOIN dbo.BusinessCatalogItems country ON country.IdOrganization=c.IdOrganization AND country.Type='Country' AND country.Code=s.CountryCode
                JOIN dbo.BusinessCatalogItems state ON state.IdParentCatalogItem=country.IdBusinessCatalogItem AND state.Type='State' AND state.Name=LTRIM(RTRIM(s.State))
                WHERE s.Active=1 AND c.Active=1 AND LEN(LTRIM(RTRIM(s.Municipality)))>0;
                INSERT dbo.BusinessCatalogItems (IdBusinessCatalogItem,IdOrganization,Type,Code,Name,IdParentCatalogItem,CreatedBy,CreatedByName)
                SELECT NEWID(), s.IdOrganization,s.Type,s.Code,s.Name,s.IdParentCatalogItem,'00000000-0000-0000-0000-000000000000',N'Catalog migration'
                FROM @Seed s WHERE NOT EXISTS (SELECT 1 FROM dbo.BusinessCatalogItems b WHERE b.IdOrganization=s.IdOrganization AND b.Type=s.Type AND b.Code=s.Code);
                DELETE @Seed;
                INSERT @Seed
                SELECT IdOrganization,'Nationality','NAT-MX',N'Mexicana',NULL FROM dbo.Organizations WHERE Active=1
                UNION
                SELECT IdOrganization,'Nationality','NAT-'+CONVERT(varchar(64),HASHBYTES('SHA2_256',LTRIM(RTRIM(Nationality))),2),LTRIM(RTRIM(Nationality)),NULL
                FROM dbo.Clients WHERE Active=1 AND LEN(LTRIM(RTRIM(Nationality)))>0 AND LTRIM(RTRIM(Nationality))<>N'Mexicana';
                INSERT @Seed
                SELECT DISTINCT IdOrganization,'JobPosition','JOB-'+CONVERT(varchar(64),HASHBYTES('SHA2_256',LTRIM(RTRIM(JobTitle))),2),LTRIM(RTRIM(JobTitle)),NULL
                FROM dbo.Employees WHERE Active=1 AND Status='Active' AND LEN(LTRIM(RTRIM(JobTitle)))>0;
                INSERT dbo.BusinessCatalogItems (IdBusinessCatalogItem,IdOrganization,Type,Code,Name,IdParentCatalogItem,CreatedBy,CreatedByName)
                SELECT NEWID(), s.IdOrganization,s.Type,s.Code,s.Name,NULL,'00000000-0000-0000-0000-000000000000',N'Catalog migration'
                FROM @Seed s WHERE NOT EXISTS (SELECT 1 FROM dbo.BusinessCatalogItems b WHERE b.IdOrganization=s.IdOrganization AND b.Type=s.Type AND (b.Code=s.Code OR b.Name=s.Name));
                DELETE @Seed;
                INSERT @Seed
                SELECT o.IdOrganization, 'IncidentReason', v.Code, v.Name, NULL FROM dbo.Organizations o
                CROSS JOIN (VALUES ('RETARDO',N'Retardo'),('AUSENCIA',N'Ausencia'),('UNIFORME',N'Incumplimiento de uniforme'),('OPERATIVA',N'Incidente operativo'),('OTRO_AUTORIZADO',N'Otro autorizado')) v(Code,Name) WHERE o.Active=1;
                INSERT @Seed
                SELECT o.IdOrganization,'CoverageReason',v.Code,v.Name,NULL FROM dbo.Organizations o
                CROSS JOIN (VALUES ('INCIDENCIA',N'Incidencia del empleado'),('FALTA',N'Falta del empleado'),('RETARDO',N'Retardo fuera de tolerancia'),('CLIENTE',N'Solicitud del cliente'),('REFUERZO',N'Refuerzo operativo'),('OTRO',N'Otro motivo documentado')) v(Code,Name) WHERE o.Active=1;
                INSERT dbo.BusinessCatalogItems (IdBusinessCatalogItem,IdOrganization,Type,Code,Name,IdParentCatalogItem,CatalogGroup,CreatedBy,CreatedByName)
                SELECT NEWID(),s.IdOrganization,s.Type,s.Code,s.Name,NULL,N'Operativo','00000000-0000-0000-0000-000000000000',N'Catalog migration'
                FROM @Seed s WHERE NOT EXISTS (SELECT 1 FROM dbo.BusinessCatalogItems b WHERE b.IdOrganization=s.IdOrganization AND b.Type=s.Type AND (b.Code=s.Code OR b.Name=s.Name));
                """.Replace("'", "''", StringComparison.Ordinal) + "');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BusinessCatalogItems_BusinessCatalogItems_IdParentCatalogItem",
                schema: "dbo",
                table: "BusinessCatalogItems");

            migrationBuilder.DropIndex(
                name: "IX_BusinessCatalogItems_IdParentCatalogItem",
                schema: "dbo",
                table: "BusinessCatalogItems");

            migrationBuilder.DropColumn(
                name: "CountryCode",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "IdParentCatalogItem",
                schema: "dbo",
                table: "BusinessCatalogItems");
        }
    }
}
