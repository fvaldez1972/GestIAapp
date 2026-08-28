using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OperationEvidences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OperationEvidences",
                schema: "dbo",
                columns: table => new
                {
                    IdOperationEvidence = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdAttendanceRecord = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdIncident = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdCoverageRecord = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    EvidenceType = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    StorageReference = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_OperationEvidences_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_OperationEvidences_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationEvidences", x => x.IdOperationEvidence);
                    table.CheckConstraint("CK_OperationEvidences_RelatedRecord_ExactlyOne", "(([IdAttendanceRecord] IS NOT NULL AND [IdIncident] IS NULL AND [IdCoverageRecord] IS NULL) OR ([IdAttendanceRecord] IS NULL AND [IdIncident] IS NOT NULL AND [IdCoverageRecord] IS NULL) OR ([IdAttendanceRecord] IS NULL AND [IdIncident] IS NULL AND [IdCoverageRecord] IS NOT NULL))");
                    table.ForeignKey(
                        name: "FK_OperationEvidences_AttendanceRecords_IdAttendanceRecord",
                        column: x => x.IdAttendanceRecord,
                        principalSchema: "dbo",
                        principalTable: "AttendanceRecords",
                        principalColumn: "IdAttendanceRecord",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OperationEvidences_CoverageRecords_IdCoverageRecord",
                        column: x => x.IdCoverageRecord,
                        principalSchema: "dbo",
                        principalTable: "CoverageRecords",
                        principalColumn: "IdCoverageRecord",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OperationEvidences_Incidents_IdIncident",
                        column: x => x.IdIncident,
                        principalSchema: "dbo",
                        principalTable: "Incidents",
                        principalColumn: "IdIncident",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OperationEvidences_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OperationEvidences_EvidenceType",
                schema: "dbo",
                table: "OperationEvidences",
                column: "EvidenceType");

            migrationBuilder.CreateIndex(
                name: "IX_OperationEvidences_IdAttendanceRecord",
                schema: "dbo",
                table: "OperationEvidences",
                column: "IdAttendanceRecord");

            migrationBuilder.CreateIndex(
                name: "IX_OperationEvidences_IdCoverageRecord",
                schema: "dbo",
                table: "OperationEvidences",
                column: "IdCoverageRecord");

            migrationBuilder.CreateIndex(
                name: "IX_OperationEvidences_IdIncident",
                schema: "dbo",
                table: "OperationEvidences",
                column: "IdIncident");

            migrationBuilder.CreateIndex(
                name: "IX_OperationEvidences_IdService",
                schema: "dbo",
                table: "OperationEvidences",
                column: "IdService");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OperationEvidences",
                schema: "dbo");
        }
    }
}
