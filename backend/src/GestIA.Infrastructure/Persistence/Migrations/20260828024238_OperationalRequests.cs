using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OperationalRequests : Migration
    {
        private static readonly string[] IdOrganizationRequestTypeColumns = ["IdOrganization", "RequestType"];
        private static readonly string[] IdOrganizationStatusPriorityColumns = ["IdOrganization", "Status", "Priority"];
        private static readonly string[] IdOrganizationCodeOperationalRequestColumns = ["IdOrganization", "CodeOperationalRequest"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OperationalRequests",
                schema: "dbo",
                columns: table => new
                {
                    IdOperationalRequest = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdClient = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CodeOperationalRequest = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    RequestType = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    Priority = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    RequestedByName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    NeededByDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ResolutionNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_OperationalRequests_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_OperationalRequests_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationalRequests", x => x.IdOperationalRequest);
                    table.ForeignKey(
                        name: "FK_OperationalRequests_Clients_IdClient",
                        column: x => x.IdClient,
                        principalSchema: "dbo",
                        principalTable: "Clients",
                        principalColumn: "IdClient",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OperationalRequests_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OperationalRequests_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OperationalRequests_IdClient",
                schema: "dbo",
                table: "OperationalRequests",
                column: "IdClient");

            migrationBuilder.CreateIndex(
                name: "IX_OperationalRequests_IdOrganization_RequestType",
                schema: "dbo",
                table: "OperationalRequests",
                columns: IdOrganizationRequestTypeColumns);

            migrationBuilder.CreateIndex(
                name: "IX_OperationalRequests_IdOrganization_Status_Priority",
                schema: "dbo",
                table: "OperationalRequests",
                columns: IdOrganizationStatusPriorityColumns);

            migrationBuilder.CreateIndex(
                name: "IX_OperationalRequests_IdService",
                schema: "dbo",
                table: "OperationalRequests",
                column: "IdService");

            migrationBuilder.CreateIndex(
                name: "UX_OperationalRequests_IdOrganization_CodeOperationalRequest",
                schema: "dbo",
                table: "OperationalRequests",
                columns: IdOrganizationCodeOperationalRequestColumns,
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OperationalRequests",
                schema: "dbo");
        }
    }
}
