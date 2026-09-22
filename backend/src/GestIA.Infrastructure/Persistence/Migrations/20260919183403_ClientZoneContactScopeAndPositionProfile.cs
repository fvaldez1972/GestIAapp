using System;
using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861 // EF Core generates local arrays for composite indexes.

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ClientZoneContactScopeAndPositionProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdAgeRangeCatalogItem",
                schema: "dbo",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdSexCatalogItem",
                schema: "dbo",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactRelationship",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Neighborhood",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsSensitive",
                schema: "dbo",
                table: "EmployeeDocuments",
                type: "bit",
                nullable: false,
                defaultValue: false)
                .Annotation("Relational:DefaultConstraintName", "DF_EmployeeDocuments_IsSensitive");

            migrationBuilder.AddColumn<Guid>(
                name: "IdContactJobPositionCatalogItem",
                schema: "dbo",
                table: "ClientContacts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdPurposeCatalogItem",
                schema: "dbo",
                table: "ClientContacts",
                type: "uniqueidentifier",
                nullable: true);

            // ------------------------------------------------------------------------------
            // Scope entra en TRES pasos, y no en uno.
            //
            // EF la genera como NOT NULL con defaultValue "", que sobre los 43 contactos vivos de
            // db-gestia-dev habria escrito una cadena vacia en todos. "" no es un valor de
            // ClientContactScope: al leerlos, el enum no sabria que son. Es la quinta vez que esta
            // trampa aparece en este repositorio.
            //
            // Asi que: nulable, se deduce de la zona que cada contacto ya tiene, y al final se
            // cierra a obligatoria. Lo que se deduce es cierto por construccion: hasta hoy un
            // contacto era de una zona si y solo si tenia IdClientSite.
            // ------------------------------------------------------------------------------
            migrationBuilder.AddColumn<string>(
                name: "Scope",
                schema: "dbo",
                table: "ClientContacts",
                type: "varchar(20)",
                unicode: false,
                maxLength: 20,
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE dbo.ClientContacts
                SET Scope = CASE WHEN IdClientSite IS NULL THEN 'General' ELSE 'Zone' END
                WHERE Scope IS NULL;

                -- Y el proposito y el puesto, contra las entradas que la migracion anterior sembro.
                UPDATE c
                SET IdPurposeCatalogItem = b.IdBusinessCatalogItem
                FROM dbo.ClientContacts c
                JOIN dbo.BusinessCatalogItems b
                    ON b.IdOrganization = c.IdOrganization
                   AND b.Type = 'ContactPurpose'
                   AND b.Name = CASE c.Purpose
                        WHEN 'Administrative'   THEN N'Administrativo'
                        WHEN 'Operational'      THEN N'Operativo'
                        WHEN 'Billing'          THEN N'Facturación'
                        WHEN 'Legal'            THEN N'Legal'
                        WHEN 'Emergency'        THEN N'Emergencia'
                        WHEN 'Payments'         THEN N'Pagos'
                        WHEN 'Purchasing'       THEN N'Compras'
                        WHEN 'InternalSecurity' THEN N'Seguridad interna'
                   END
                WHERE c.IdPurposeCatalogItem IS NULL;

                -- El puesto que cada contacto tenia como texto se lleva a su catalogo propio.
                --
                -- Se pliega el nombre antes de agrupar, y no basta con DISTINCT. El indice unico
                -- del catalogo es sobre el nombre PLEGADO —sin acentos, sin mayusculas y sin
                -- espacios de mas—, asi que «Supervisor de sitio» y «Supervisor de Sitio» son dos
                -- textos distintos y una sola entrada. El ensayo sobre la copia restaurada lo
                -- encontro: la primera version de esta migracion fallo justo con ese par.
                --
                -- El colapso de espacios interiores reproduce lo que hace CatalogName.Normalize:
                -- se marcan los espacios, se eliminan los pares, y se devuelve uno solo.
                ;WITH Puestos AS (
                    SELECT
                        c.IdOrganization,
                        LTRIM(RTRIM(c.JobTitle)) AS Nombre,
                        ROW_NUMBER() OVER (
                            PARTITION BY
                                c.IdOrganization,
                                REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(c.JobTitle)), ' ', '<>'), '><', ''), '<>', ' ')
                                    COLLATE Latin1_General_CI_AI
                            ORDER BY LTRIM(RTRIM(c.JobTitle))) AS Fila
                    FROM dbo.ClientContacts c
                    WHERE c.JobTitle IS NOT NULL AND LEN(LTRIM(RTRIM(c.JobTitle))) > 0
                )
                INSERT dbo.BusinessCatalogItems
                    (IdBusinessCatalogItem, IdOrganization, Type, Name, Description, Active,
                     CreatedAt, CreatedBy, CreatedByName, DisplayOrder, IdParentCatalogItem, IsBlocking)
                SELECT NEWID(), p.IdOrganization, 'ContactJobPosition', p.Nombre, NULL, 1,
                       SYSUTCDATETIME(), '00000000-0000-0000-0000-000000000000', N'Catalog migration', 1, NULL, NULL
                FROM Puestos p
                WHERE p.Fila = 1
                  AND NOT EXISTS (
                    SELECT 1 FROM dbo.BusinessCatalogItems b
                    WHERE b.IdOrganization = p.IdOrganization
                      AND b.Type = 'ContactJobPosition'
                      AND b.Name COLLATE Latin1_General_CI_AI = p.Nombre COLLATE Latin1_General_CI_AI);

                -- Y se emparejan tambien por nombre plegado, para que los dos que colapsaron en uno
                -- apunten a la misma entrada. Los que no correspondan a ninguna quedan nulos: es
                -- preferible a inventarles una.
                UPDATE c
                SET IdContactJobPositionCatalogItem = b.IdBusinessCatalogItem
                FROM dbo.ClientContacts c
                JOIN dbo.BusinessCatalogItems b
                    ON b.IdOrganization = c.IdOrganization
                   AND b.Type = 'ContactJobPosition'
                   AND REPLACE(REPLACE(REPLACE(b.Name, ' ', '<>'), '><', ''), '<>', ' ') COLLATE Latin1_General_CI_AI
                     = REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(c.JobTitle)), ' ', '<>'), '><', ''), '<>', ' ') COLLATE Latin1_General_CI_AI
                WHERE c.IdContactJobPositionCatalogItem IS NULL AND c.JobTitle IS NOT NULL;
            ");

            migrationBuilder.AlterColumn<string>(
                name: "Scope",
                schema: "dbo",
                table: "ClientContacts",
                type: "varchar(20)",
                unicode: false,
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldUnicode: false,
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "AdministrativeIncidents",
                schema: "dbo",
                columns: table => new
                {
                    IdAdministrativeIncident = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdIncidentTypeCatalogItem = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OccurredDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Details = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_AdministrativeIncidents_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_AdministrativeIncidents_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdministrativeIncidents", x => x.IdAdministrativeIncident);
                    table.ForeignKey(
                        name: "FK_AdministrativeIncidents_BusinessCatalogItems_IdIncidentTypeCatalogItem",
                        column: x => x.IdIncidentTypeCatalogItem,
                        principalSchema: "dbo",
                        principalTable: "BusinessCatalogItems",
                        principalColumn: "IdBusinessCatalogItem",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AdministrativeIncidents_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AdministrativeIncidents_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PositionRequiredEquipments",
                schema: "dbo",
                columns: table => new
                {
                    IdPositionRequiredEquipment = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdPosition = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEquipmentCatalogItem = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_PositionRequiredEquipments_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_PositionRequiredEquipments_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PositionRequiredEquipments", x => x.IdPositionRequiredEquipment);
                    table.ForeignKey(
                        name: "FK_PositionRequiredEquipments_BusinessCatalogItems_IdEquipmentCatalogItem",
                        column: x => x.IdEquipmentCatalogItem,
                        principalSchema: "dbo",
                        principalTable: "BusinessCatalogItems",
                        principalColumn: "IdBusinessCatalogItem",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PositionRequiredEquipments_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PositionRequiredEquipments_Positions_IdPosition",
                        column: x => x.IdPosition,
                        principalSchema: "dbo",
                        principalTable: "Positions",
                        principalColumn: "IdPosition",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Positions_IdAgeRangeCatalogItem",
                schema: "dbo",
                table: "Positions",
                column: "IdAgeRangeCatalogItem",
                filter: "[IdAgeRangeCatalogItem] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Positions_IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Positions",
                column: "IdEducationLevelCatalogItem",
                filter: "[IdEducationLevelCatalogItem] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Positions_IdSexCatalogItem",
                schema: "dbo",
                table: "Positions",
                column: "IdSexCatalogItem",
                filter: "[IdSexCatalogItem] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientContacts_IdContactJobPositionCatalogItem",
                schema: "dbo",
                table: "ClientContacts",
                column: "IdContactJobPositionCatalogItem",
                filter: "[IdContactJobPositionCatalogItem] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClientContacts_IdPurposeCatalogItem",
                schema: "dbo",
                table: "ClientContacts",
                column: "IdPurposeCatalogItem",
                filter: "[IdPurposeCatalogItem] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AdministrativeIncidents_IdEmployee_OccurredDate",
                schema: "dbo",
                table: "AdministrativeIncidents",
                columns: new[] { "IdEmployee", "OccurredDate" });

            migrationBuilder.CreateIndex(
                name: "IX_AdministrativeIncidents_IdIncidentTypeCatalogItem",
                schema: "dbo",
                table: "AdministrativeIncidents",
                column: "IdIncidentTypeCatalogItem");

            migrationBuilder.CreateIndex(
                name: "IX_AdministrativeIncidents_IdOrganization",
                schema: "dbo",
                table: "AdministrativeIncidents",
                column: "IdOrganization");

            migrationBuilder.CreateIndex(
                name: "IX_PositionRequiredEquipments_IdEquipmentCatalogItem",
                schema: "dbo",
                table: "PositionRequiredEquipments",
                column: "IdEquipmentCatalogItem");

            migrationBuilder.CreateIndex(
                name: "IX_PositionRequiredEquipments_IdOrganization",
                schema: "dbo",
                table: "PositionRequiredEquipments",
                column: "IdOrganization");

            migrationBuilder.CreateIndex(
                name: "UX_PositionRequiredEquipments_IdPosition_IdEquipmentCatalogItem",
                schema: "dbo",
                table: "PositionRequiredEquipments",
                columns: new[] { "IdPosition", "IdEquipmentCatalogItem" },
                unique: true);

            // Van despues del rellenado a proposito: es el que deja el proposito y el puesto
            // apuntando a filas que existen. Antes de el, los 43 contactos vivos los tenian en nulo.
            migrationBuilder.AddForeignKey(
                name: "FK_ClientContacts_BusinessCatalogItems_IdContactJobPositionCatalogItem",
                schema: "dbo",
                table: "ClientContacts",
                column: "IdContactJobPositionCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ClientContacts_BusinessCatalogItems_IdPurposeCatalogItem",
                schema: "dbo",
                table: "ClientContacts",
                column: "IdPurposeCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClientContacts_BusinessCatalogItems_IdContactJobPositionCatalogItem",
                schema: "dbo",
                table: "ClientContacts");

            migrationBuilder.DropForeignKey(
                name: "FK_ClientContacts_BusinessCatalogItems_IdPurposeCatalogItem",
                schema: "dbo",
                table: "ClientContacts");

            migrationBuilder.DropTable(
                name: "AdministrativeIncidents",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "PositionRequiredEquipments",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_Positions_IdAgeRangeCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_Positions_IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_Positions_IdSexCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_ClientContacts_IdContactJobPositionCatalogItem",
                schema: "dbo",
                table: "ClientContacts");

            migrationBuilder.DropIndex(
                name: "IX_ClientContacts_IdPurposeCatalogItem",
                schema: "dbo",
                table: "ClientContacts");

            migrationBuilder.DropColumn(
                name: "IdAgeRangeCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "IdSexCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "EmergencyContactRelationship",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "Neighborhood",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "IsSensitive",
                schema: "dbo",
                table: "EmployeeDocuments")
                .Annotation("Relational:DefaultConstraintName", "DF_EmployeeDocuments_IsSensitive");

            migrationBuilder.DropColumn(
                name: "IdContactJobPositionCatalogItem",
                schema: "dbo",
                table: "ClientContacts");

            migrationBuilder.DropColumn(
                name: "IdPurposeCatalogItem",
                schema: "dbo",
                table: "ClientContacts");

            migrationBuilder.DropColumn(
                name: "Scope",
                schema: "dbo",
                table: "ClientContacts");
        }
    }
}
