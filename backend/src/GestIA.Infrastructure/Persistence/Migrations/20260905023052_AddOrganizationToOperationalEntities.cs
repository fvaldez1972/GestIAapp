using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1861 // EF Core generates inline arrays for migration index definitions.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationToOperationalEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ShiftSegments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ShiftPatterns",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "Services",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceContracts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceConfigurations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceAssignments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ScheduleVersions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ScheduledShifts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "OperationEvidences",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "Incidents",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "CoverageRecords",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "AttendanceRecords",
                type: "uniqueidentifier",
                nullable: true);


            // Relleno en orden de dependencia: cada tabla toma la organizacion de un padre
            // que ya la tiene. Sin esto la columna quedaria en el Guid vacio para todas las
            // filas, que es lo que EF genera por omision y no falla ruidosamente.
            migrationBuilder.Sql(@"
UPDATE t SET t.IdOrganization = c.IdOrganization
FROM dbo.Services t JOIN dbo.Clients c ON c.IdClient = t.IdClient;

UPDATE t SET t.IdOrganization = c.IdOrganization
FROM dbo.ServiceContracts t JOIN dbo.Clients c ON c.IdClient = t.IdClient;

UPDATE t SET t.IdOrganization = s.IdOrganization
FROM dbo.ServiceConfigurations t JOIN dbo.Services s ON s.IdService = t.IdService;

UPDATE t SET t.IdOrganization = s.IdOrganization
FROM dbo.Positions t JOIN dbo.Services s ON s.IdService = t.IdService;

UPDATE t SET t.IdOrganization = s.IdOrganization
FROM dbo.ScheduleVersions t JOIN dbo.Services s ON s.IdService = t.IdService;

UPDATE t SET t.IdOrganization = s.IdOrganization
FROM dbo.ServiceAssignments t JOIN dbo.Services s ON s.IdService = t.IdService;

UPDATE t SET t.IdOrganization = s.IdOrganization
FROM dbo.Incidents t JOIN dbo.Services s ON s.IdService = t.IdService;

UPDATE t SET t.IdOrganization = s.IdOrganization
FROM dbo.OperationEvidences t JOIN dbo.Services s ON s.IdService = t.IdService;

UPDATE t SET t.IdOrganization = p.IdOrganization
FROM dbo.ShiftPatterns t JOIN dbo.Positions p ON p.IdPosition = t.IdPosition;

UPDATE t SET t.IdOrganization = sp.IdOrganization
FROM dbo.ShiftSegments t JOIN dbo.ShiftPatterns sp ON sp.IdShiftPattern = t.IdShiftPattern;

UPDATE t SET t.IdOrganization = v.IdOrganization
FROM dbo.ScheduledShifts t JOIN dbo.ScheduleVersions v ON v.IdScheduleVersion = t.IdScheduleVersion;

UPDATE t SET t.IdOrganization = sh.IdOrganization
FROM dbo.AttendanceRecords t JOIN dbo.ScheduledShifts sh ON sh.IdScheduledShift = t.IdScheduledShift;

UPDATE t SET t.IdOrganization = sh.IdOrganization
FROM dbo.CoverageRecords t JOIN dbo.ScheduledShifts sh ON sh.IdScheduledShift = t.IdScheduledShift;
");

            // Guarda: si alguna fila quedo sin organizacion, se aborta antes de tocar mas.
            migrationBuilder.Sql(@"
DECLARE @pendientes int = 0;
SELECT @pendientes = @pendientes
    + (SELECT COUNT(*) FROM dbo.Services WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.ServiceContracts WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.ServiceConfigurations WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.Positions WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.ScheduleVersions WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.ServiceAssignments WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.Incidents WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.OperationEvidences WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.ShiftPatterns WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.ShiftSegments WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.ScheduledShifts WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.AttendanceRecords WHERE IdOrganization IS NULL)
    + (SELECT COUNT(*) FROM dbo.CoverageRecords WHERE IdOrganization IS NULL);
IF @pendientes > 0
    THROW 50000, 'Quedaron filas sin organizacion tras el relleno: se aborta la migracion.', 1;
");

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ShiftSegments",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ShiftPatterns",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceContracts",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceConfigurations",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "Services",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceAssignments",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ScheduleVersions",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "ScheduledShifts",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "OperationEvidences",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "Incidents",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "CoverageRecords",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdOrganization",
                schema: "dbo",
                table: "AttendanceRecords",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShiftSegments_IdOrganization_DayOfWeek",
                schema: "dbo",
                table: "ShiftSegments",
                columns: new[] { "IdOrganization", "DayOfWeek" });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftPatterns_IdOrganization_CodeShiftPattern",
                schema: "dbo",
                table: "ShiftPatterns",
                columns: new[] { "IdOrganization", "CodeShiftPattern" });

            migrationBuilder.CreateIndex(
                name: "IX_Services_IdOrganization_CodeService",
                schema: "dbo",
                table: "Services",
                columns: new[] { "IdOrganization", "CodeService" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceContracts_IdOrganization_Status",
                schema: "dbo",
                table: "ServiceContracts",
                columns: new[] { "IdOrganization", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceConfigurations_IdOrganization_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations",
                columns: new[] { "IdOrganization", "EffectiveFromDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceAssignments_IdOrganization_StartDate",
                schema: "dbo",
                table: "ServiceAssignments",
                columns: new[] { "IdOrganization", "StartDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleVersions_IdOrganization_Status",
                schema: "dbo",
                table: "ScheduleVersions",
                columns: new[] { "IdOrganization", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledShifts_IdOrganization_ShiftDate",
                schema: "dbo",
                table: "ScheduledShifts",
                columns: new[] { "IdOrganization", "ShiftDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Positions_IdOrganization_CodePosition",
                schema: "dbo",
                table: "Positions",
                columns: new[] { "IdOrganization", "CodePosition" });

            migrationBuilder.CreateIndex(
                name: "IX_OperationEvidences_IdOrganization_EvidenceType",
                schema: "dbo",
                table: "OperationEvidences",
                columns: new[] { "IdOrganization", "EvidenceType" });

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_IdOrganization_IncidentDate",
                schema: "dbo",
                table: "Incidents",
                columns: new[] { "IdOrganization", "IncidentDate" });

            migrationBuilder.CreateIndex(
                name: "IX_CoverageRecords_IdOrganization_Status",
                schema: "dbo",
                table: "CoverageRecords",
                columns: new[] { "IdOrganization", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceRecords_IdOrganization_AttendanceDate",
                schema: "dbo",
                table: "AttendanceRecords",
                columns: new[] { "IdOrganization", "AttendanceDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_AttendanceRecords_Organizations_IdOrganization",
                schema: "dbo",
                table: "AttendanceRecords",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CoverageRecords_Organizations_IdOrganization",
                schema: "dbo",
                table: "CoverageRecords",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Incidents_Organizations_IdOrganization",
                schema: "dbo",
                table: "Incidents",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OperationEvidences_Organizations_IdOrganization",
                schema: "dbo",
                table: "OperationEvidences",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Positions_Organizations_IdOrganization",
                schema: "dbo",
                table: "Positions",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduledShifts_Organizations_IdOrganization",
                schema: "dbo",
                table: "ScheduledShifts",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduleVersions_Organizations_IdOrganization",
                schema: "dbo",
                table: "ScheduleVersions",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceAssignments_Organizations_IdOrganization",
                schema: "dbo",
                table: "ServiceAssignments",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceConfigurations_Organizations_IdOrganization",
                schema: "dbo",
                table: "ServiceConfigurations",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceContracts_Organizations_IdOrganization",
                schema: "dbo",
                table: "ServiceContracts",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Services_Organizations_IdOrganization",
                schema: "dbo",
                table: "Services",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShiftPatterns_Organizations_IdOrganization",
                schema: "dbo",
                table: "ShiftPatterns",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShiftSegments_Organizations_IdOrganization",
                schema: "dbo",
                table: "ShiftSegments",
                column: "IdOrganization",
                principalSchema: "dbo",
                principalTable: "Organizations",
                principalColumn: "IdOrganization",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AttendanceRecords_Organizations_IdOrganization",
                schema: "dbo",
                table: "AttendanceRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_CoverageRecords_Organizations_IdOrganization",
                schema: "dbo",
                table: "CoverageRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_Incidents_Organizations_IdOrganization",
                schema: "dbo",
                table: "Incidents");

            migrationBuilder.DropForeignKey(
                name: "FK_OperationEvidences_Organizations_IdOrganization",
                schema: "dbo",
                table: "OperationEvidences");

            migrationBuilder.DropForeignKey(
                name: "FK_Positions_Organizations_IdOrganization",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropForeignKey(
                name: "FK_ScheduledShifts_Organizations_IdOrganization",
                schema: "dbo",
                table: "ScheduledShifts");

            migrationBuilder.DropForeignKey(
                name: "FK_ScheduleVersions_Organizations_IdOrganization",
                schema: "dbo",
                table: "ScheduleVersions");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceAssignments_Organizations_IdOrganization",
                schema: "dbo",
                table: "ServiceAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceConfigurations_Organizations_IdOrganization",
                schema: "dbo",
                table: "ServiceConfigurations");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceContracts_Organizations_IdOrganization",
                schema: "dbo",
                table: "ServiceContracts");

            migrationBuilder.DropForeignKey(
                name: "FK_Services_Organizations_IdOrganization",
                schema: "dbo",
                table: "Services");

            migrationBuilder.DropForeignKey(
                name: "FK_ShiftPatterns_Organizations_IdOrganization",
                schema: "dbo",
                table: "ShiftPatterns");

            migrationBuilder.DropForeignKey(
                name: "FK_ShiftSegments_Organizations_IdOrganization",
                schema: "dbo",
                table: "ShiftSegments");

            migrationBuilder.DropIndex(
                name: "IX_ShiftSegments_IdOrganization_DayOfWeek",
                schema: "dbo",
                table: "ShiftSegments");

            migrationBuilder.DropIndex(
                name: "IX_ShiftPatterns_IdOrganization_CodeShiftPattern",
                schema: "dbo",
                table: "ShiftPatterns");

            migrationBuilder.DropIndex(
                name: "IX_Services_IdOrganization_CodeService",
                schema: "dbo",
                table: "Services");

            migrationBuilder.DropIndex(
                name: "IX_ServiceContracts_IdOrganization_Status",
                schema: "dbo",
                table: "ServiceContracts");

            migrationBuilder.DropIndex(
                name: "IX_ServiceConfigurations_IdOrganization_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations");

            migrationBuilder.DropIndex(
                name: "IX_ServiceAssignments_IdOrganization_StartDate",
                schema: "dbo",
                table: "ServiceAssignments");

            migrationBuilder.DropIndex(
                name: "IX_ScheduleVersions_IdOrganization_Status",
                schema: "dbo",
                table: "ScheduleVersions");

            migrationBuilder.DropIndex(
                name: "IX_ScheduledShifts_IdOrganization_ShiftDate",
                schema: "dbo",
                table: "ScheduledShifts");

            migrationBuilder.DropIndex(
                name: "IX_Positions_IdOrganization_CodePosition",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_OperationEvidences_IdOrganization_EvidenceType",
                schema: "dbo",
                table: "OperationEvidences");

            migrationBuilder.DropIndex(
                name: "IX_Incidents_IdOrganization_IncidentDate",
                schema: "dbo",
                table: "Incidents");

            migrationBuilder.DropIndex(
                name: "IX_CoverageRecords_IdOrganization_Status",
                schema: "dbo",
                table: "CoverageRecords");

            migrationBuilder.DropIndex(
                name: "IX_AttendanceRecords_IdOrganization_AttendanceDate",
                schema: "dbo",
                table: "AttendanceRecords");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "ShiftSegments");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "ShiftPatterns");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "Services");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceContracts");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceConfigurations");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "ServiceAssignments");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "ScheduleVersions");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "ScheduledShifts");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "OperationEvidences");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "Incidents");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "CoverageRecords");

            migrationBuilder.DropColumn(
                name: "IdOrganization",
                schema: "dbo",
                table: "AttendanceRecords");
        }
    }
}
#pragma warning restore CA1861
