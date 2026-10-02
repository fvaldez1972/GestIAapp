using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BusinessCatalogsAndEligibility : Migration
    {
        private static readonly string[] BusinessCatalogItemUniqueColumns = ["IdOrganization", "Type", "Code"];
        private static readonly string[] EligibilityRequirementLookupColumns = ["IdOrganization", "TargetType", "RequirementType", "RequiredCode"];
        private static readonly string[] EmployeeSkillUniqueColumns = ["IdEmployee", "IdSkillCatalogItem"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BusinessCatalogItems",
                schema: "dbo",
                columns: table => new
                {
                    IdBusinessCatalogItem = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    Code = table.Column<string>(type: "varchar(80)", unicode: false, maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessCatalogItems", x => x.IdBusinessCatalogItem);
                    table.ForeignKey(
                        name: "FK_BusinessCatalogItems_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EligibilityRequirements",
                schema: "dbo",
                columns: table => new
                {
                    IdEligibilityRequirement = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TargetType = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    IdClient = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdPosition = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RequirementType = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    RequiredCode = table.Column<string>(type: "varchar(80)", unicode: false, maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsBlocking = table.Column<bool>(type: "bit", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_EligibilityRequirements_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_EligibilityRequirements_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EligibilityRequirements", x => x.IdEligibilityRequirement);
                    table.CheckConstraint("CK_EligibilityRequirements_Target_ExactlyOne", "([TargetType] = 'Organization' AND [IdClient] IS NULL AND [IdService] IS NULL AND [IdPosition] IS NULL) OR ([TargetType] = 'Client' AND [IdClient] IS NOT NULL AND [IdService] IS NULL AND [IdPosition] IS NULL) OR ([TargetType] = 'Service' AND [IdClient] IS NULL AND [IdService] IS NOT NULL AND [IdPosition] IS NULL) OR ([TargetType] = 'Position' AND [IdClient] IS NULL AND [IdService] IS NULL AND [IdPosition] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_EligibilityRequirements_Clients_IdClient",
                        column: x => x.IdClient,
                        principalSchema: "dbo",
                        principalTable: "Clients",
                        principalColumn: "IdClient",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EligibilityRequirements_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EligibilityRequirements_Positions_IdPosition",
                        column: x => x.IdPosition,
                        principalSchema: "dbo",
                        principalTable: "Positions",
                        principalColumn: "IdPosition",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EligibilityRequirements_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeSkills",
                schema: "dbo",
                columns: table => new
                {
                    IdEmployeeSkill = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdSkillCatalogItem = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AcquiredDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpiresDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_EmployeeSkills_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_EmployeeSkills_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeSkills", x => x.IdEmployeeSkill);
                    table.CheckConstraint("CK_EmployeeSkills_DateRange", "[ExpiresDate] IS NULL OR [AcquiredDate] IS NULL OR [ExpiresDate] >= [AcquiredDate]");
                    table.ForeignKey(
                        name: "FK_EmployeeSkills_BusinessCatalogItems_IdSkillCatalogItem",
                        column: x => x.IdSkillCatalogItem,
                        principalSchema: "dbo",
                        principalTable: "BusinessCatalogItems",
                        principalColumn: "IdBusinessCatalogItem",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeSkills_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "UX_BusinessCatalogItems_IdOrganization_Type_Code",
                schema: "dbo",
                table: "BusinessCatalogItems",
                columns: BusinessCatalogItemUniqueColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRequirements_IdClient",
                schema: "dbo",
                table: "EligibilityRequirements",
                column: "IdClient");

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRequirements_IdOrganization_TargetType_RequirementType_RequiredCode",
                schema: "dbo",
                table: "EligibilityRequirements",
                columns: EligibilityRequirementLookupColumns);

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRequirements_IdPosition",
                schema: "dbo",
                table: "EligibilityRequirements",
                column: "IdPosition");

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRequirements_IdService",
                schema: "dbo",
                table: "EligibilityRequirements",
                column: "IdService");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeSkills_ExpiresDate",
                schema: "dbo",
                table: "EmployeeSkills",
                column: "ExpiresDate");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeSkills_IdSkillCatalogItem",
                schema: "dbo",
                table: "EmployeeSkills",
                column: "IdSkillCatalogItem");

            migrationBuilder.CreateIndex(
                name: "UX_EmployeeSkills_IdEmployee_IdSkillCatalogItem",
                schema: "dbo",
                table: "EmployeeSkills",
                columns: EmployeeSkillUniqueColumns,
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EligibilityRequirements",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "EmployeeSkills",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "BusinessCatalogItems",
                schema: "dbo");
        }
    }
}
