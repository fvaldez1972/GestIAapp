using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF Core generates inline arrays for migration index definitions.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlanningPositionsAndShifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Positions",
                schema: "dbo",
                columns: table => new
                {
                    IdPosition = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodePosition = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    RequiredWorkerCount = table.Column<int>(type: "int", nullable: false),
                    RequiredSkillProfile = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Positions_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Positions_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Positions", x => x.IdPosition);
                    table.CheckConstraint("CK_Positions_RequiredWorkerCount", "[RequiredWorkerCount] > 0");
                    table.ForeignKey(
                        name: "FK_Positions_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShiftPatterns",
                schema: "dbo",
                columns: table => new
                {
                    IdShiftPattern = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdPosition = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeShiftPattern = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    EffectiveFromDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveToDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ShiftPatterns_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ShiftPatterns_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftPatterns", x => x.IdShiftPattern);
                    table.CheckConstraint("CK_ShiftPatterns_EffectiveDateRange", "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]");
                    table.ForeignKey(
                        name: "FK_ShiftPatterns_Positions_IdPosition",
                        column: x => x.IdPosition,
                        principalSchema: "dbo",
                        principalTable: "Positions",
                        principalColumn: "IdPosition",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShiftSegments",
                schema: "dbo",
                columns: table => new
                {
                    IdShiftSegment = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdShiftPattern = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DayOfWeek = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    IsOvernight = table.Column<bool>(type: "bit", nullable: false),
                    RequiredWorkerCount = table.Column<int>(type: "int", nullable: false),
                    DurationMinutes = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ShiftSegments_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ShiftSegments_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftSegments", x => x.IdShiftSegment);
                    table.CheckConstraint("CK_ShiftSegments_DurationMinutes", "[DurationMinutes] > 0 AND [DurationMinutes] <= 1440");
                    table.CheckConstraint("CK_ShiftSegments_RequiredWorkerCount", "[RequiredWorkerCount] > 0");
                    table.ForeignKey(
                        name: "FK_ShiftSegments_ShiftPatterns_IdShiftPattern",
                        column: x => x.IdShiftPattern,
                        principalSchema: "dbo",
                        principalTable: "ShiftPatterns",
                        principalColumn: "IdShiftPattern",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "UX_Positions_IdService_CodePosition",
                schema: "dbo",
                table: "Positions",
                columns: new[] { "IdService", "CodePosition" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ShiftPatterns_IdPosition_CodeShiftPattern",
                schema: "dbo",
                table: "ShiftPatterns",
                columns: new[] { "IdPosition", "CodeShiftPattern" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSegments_IdShiftPattern_DayOfWeek_StartTime",
                schema: "dbo",
                table: "ShiftSegments",
                columns: new[] { "IdShiftPattern", "DayOfWeek", "StartTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShiftSegments",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ShiftPatterns",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Positions",
                schema: "dbo");
        }
    }
}
#pragma warning restore CA1861
