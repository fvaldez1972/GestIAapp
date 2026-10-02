using System;
using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OperationsAttendanceIncidentsCoverages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AttendanceRecords",
                schema: "dbo",
                columns: table => new
                {
                    IdAttendanceRecord = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdScheduledShift = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AttendanceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    ActualStartTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    ActualEndTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    MinutesLate = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_AttendanceRecords_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_AttendanceRecords_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceRecords", x => x.IdAttendanceRecord);
                    table.CheckConstraint("CK_AttendanceRecords_MinutesLate", "[MinutesLate] >= 0");
                    table.ForeignKey(
                        name: "FK_AttendanceRecords_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AttendanceRecords_ScheduledShifts_IdScheduledShift",
                        column: x => x.IdScheduledShift,
                        principalSchema: "dbo",
                        principalTable: "ScheduledShifts",
                        principalColumn: "IdScheduledShift",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CoverageRecords",
                schema: "dbo",
                columns: table => new
                {
                    IdCoverageRecord = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdScheduledShift = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOriginalEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdReplacementEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoverageStartTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    CoverageEndTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    IsOvernight = table.Column<bool>(type: "bit", nullable: false),
                    DurationMinutes = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_CoverageRecords_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_CoverageRecords_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoverageRecords", x => x.IdCoverageRecord);
                    table.CheckConstraint("CK_CoverageRecords_DurationMinutes", "[DurationMinutes] > 0 AND [DurationMinutes] <= 1440");
                    table.ForeignKey(
                        name: "FK_CoverageRecords_Employees_IdOriginalEmployee",
                        column: x => x.IdOriginalEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CoverageRecords_Employees_IdReplacementEmployee",
                        column: x => x.IdReplacementEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CoverageRecords_ScheduledShifts_IdScheduledShift",
                        column: x => x.IdScheduledShift,
                        principalSchema: "dbo",
                        principalTable: "ScheduledShifts",
                        principalColumn: "IdScheduledShift",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Incidents",
                schema: "dbo",
                columns: table => new
                {
                    IdIncident = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdScheduledShift = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IncidentDate = table.Column<DateOnly>(type: "date", nullable: false),
                    IncidentType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Severity = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    ResolutionNotes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Incidents_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Incidents_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Incidents", x => x.IdIncident);
                    table.ForeignKey(
                        name: "FK_Incidents_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Incidents_ScheduledShifts_IdScheduledShift",
                        column: x => x.IdScheduledShift,
                        principalSchema: "dbo",
                        principalTable: "ScheduledShifts",
                        principalColumn: "IdScheduledShift",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Incidents_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceRecords_IdEmployee_AttendanceDate",
                schema: "dbo",
                table: "AttendanceRecords",
                columns: new[] { "IdEmployee", "AttendanceDate" });

            migrationBuilder.CreateIndex(
                name: "UX_AttendanceRecords_IdScheduledShift",
                schema: "dbo",
                table: "AttendanceRecords",
                column: "IdScheduledShift",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CoverageRecords_IdOriginalEmployee",
                schema: "dbo",
                table: "CoverageRecords",
                column: "IdOriginalEmployee");

            migrationBuilder.CreateIndex(
                name: "IX_CoverageRecords_IdReplacementEmployee",
                schema: "dbo",
                table: "CoverageRecords",
                column: "IdReplacementEmployee");

            migrationBuilder.CreateIndex(
                name: "IX_CoverageRecords_IdScheduledShift",
                schema: "dbo",
                table: "CoverageRecords",
                column: "IdScheduledShift");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_IdEmployee_IncidentDate",
                schema: "dbo",
                table: "Incidents",
                columns: new[] { "IdEmployee", "IncidentDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_IdScheduledShift",
                schema: "dbo",
                table: "Incidents",
                column: "IdScheduledShift");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_IdService_IncidentDate",
                schema: "dbo",
                table: "Incidents",
                columns: new[] { "IdService", "IncidentDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttendanceRecords",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "CoverageRecords",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Incidents",
                schema: "dbo");
        }
    }
}

#pragma warning restore CA1861
