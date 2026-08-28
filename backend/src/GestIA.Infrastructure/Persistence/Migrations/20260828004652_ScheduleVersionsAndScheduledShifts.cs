using System;
using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScheduleVersionsAndScheduledShifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScheduleVersions",
                schema: "dbo",
                columns: table => new
                {
                    IdScheduleVersion = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    PeriodStartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PeriodEndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PublishedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PublishedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ScheduleVersions_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ScheduleVersions_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleVersions", x => x.IdScheduleVersion);
                    table.CheckConstraint("CK_ScheduleVersions_DateRange", "[PeriodEndDate] >= [PeriodStartDate]");
                    table.ForeignKey(
                        name: "FK_ScheduleVersions_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScheduledShifts",
                schema: "dbo",
                columns: table => new
                {
                    IdScheduledShift = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdScheduleVersion = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdPosition = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShiftDate = table.Column<DateOnly>(type: "date", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    IsOvernight = table.Column<bool>(type: "bit", nullable: false),
                    DurationMinutes = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ScheduledShifts_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ScheduledShifts_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduledShifts", x => x.IdScheduledShift);
                    table.CheckConstraint("CK_ScheduledShifts_DurationMinutes", "[DurationMinutes] > 0 AND [DurationMinutes] <= 1440");
                    table.ForeignKey(
                        name: "FK_ScheduledShifts_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduledShifts_Positions_IdPosition",
                        column: x => x.IdPosition,
                        principalSchema: "dbo",
                        principalTable: "Positions",
                        principalColumn: "IdPosition",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduledShifts_ScheduleVersions_IdScheduleVersion",
                        column: x => x.IdScheduleVersion,
                        principalSchema: "dbo",
                        principalTable: "ScheduleVersions",
                        principalColumn: "IdScheduleVersion",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledShifts_IdEmployee_ShiftDate_StartTime",
                schema: "dbo",
                table: "ScheduledShifts",
                columns: new[] { "IdEmployee", "ShiftDate", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledShifts_IdPosition_ShiftDate_StartTime",
                schema: "dbo",
                table: "ScheduledShifts",
                columns: new[] { "IdPosition", "ShiftDate", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledShifts_IdScheduleVersion_ShiftDate",
                schema: "dbo",
                table: "ScheduledShifts",
                columns: new[] { "IdScheduleVersion", "ShiftDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleVersions_IdService_PeriodStartDate_PeriodEndDate",
                schema: "dbo",
                table: "ScheduleVersions",
                columns: new[] { "IdService", "PeriodStartDate", "PeriodEndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleVersions_IdService_Status",
                schema: "dbo",
                table: "ScheduleVersions",
                columns: new[] { "IdService", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScheduledShifts",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ScheduleVersions",
                schema: "dbo");
        }
    }
}

#pragma warning restore CA1861
