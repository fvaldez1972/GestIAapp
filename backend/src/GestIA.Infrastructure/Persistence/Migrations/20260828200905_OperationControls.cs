using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OperationControls : Migration
    {
        private static readonly string[] ApprovalRequestsOrganizationStatusColumns = ["IdOrganization", "Status"];
        private static readonly string[] ApprovalRequestsServiceEntityColumns = ["IdService", "EntityType", "EntityId"];
        private static readonly string[] OperationDayClosuresOrganizationDateColumns = ["IdOrganization", "OperationDate"];
        private static readonly string[] OperationDayClosuresServiceDateColumns = ["IdService", "OperationDate"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ApprovalRequests",
                schema: "dbo",
                columns: table => new
                {
                    IdApprovalRequest = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApprovalType = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: false),
                    EntityType = table.Column<string>(type: "varchar(80)", unicode: false, maxLength: 80, nullable: false),
                    EntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: false),
                    RequestedChangeSummary = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DecidedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DecidedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DecisionNotes = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ApprovalRequests_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ApprovalRequests_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApprovalRequests", x => x.IdApprovalRequest);
                    table.ForeignKey(
                        name: "FK_ApprovalRequests_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OperationDayClosures",
                schema: "dbo",
                columns: table => new
                {
                    IdOperationDayClosure = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OperationDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpectedShifts = table.Column<int>(type: "int", nullable: false),
                    AttendanceRecords = table.Column<int>(type: "int", nullable: false),
                    PendingAttendance = table.Column<int>(type: "int", nullable: false),
                    OpenIncidents = table.Column<int>(type: "int", nullable: false),
                    CoverageRecords = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ClosedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClosedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ReopenedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReopenedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReopenedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ReopenReason = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_OperationDayClosures_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_OperationDayClosures_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperationDayClosures", x => x.IdOperationDayClosure);
                    table.CheckConstraint("CK_OperationDayClosures_AttendanceRecords", "[AttendanceRecords] >= 0");
                    table.CheckConstraint("CK_OperationDayClosures_CoverageRecords", "[CoverageRecords] >= 0");
                    table.CheckConstraint("CK_OperationDayClosures_ExpectedShifts", "[ExpectedShifts] >= 0");
                    table.CheckConstraint("CK_OperationDayClosures_OpenIncidents", "[OpenIncidents] >= 0");
                    table.CheckConstraint("CK_OperationDayClosures_PendingAttendance", "[PendingAttendance] >= 0");
                    table.ForeignKey(
                        name: "FK_OperationDayClosures_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalRequests_IdOrganization_Status",
                schema: "dbo",
                table: "ApprovalRequests",
                columns: ApprovalRequestsOrganizationStatusColumns);

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalRequests_IdService_EntityType_EntityId",
                schema: "dbo",
                table: "ApprovalRequests",
                columns: ApprovalRequestsServiceEntityColumns);

            migrationBuilder.CreateIndex(
                name: "IX_OperationDayClosures_IdOrganization_OperationDate",
                schema: "dbo",
                table: "OperationDayClosures",
                columns: OperationDayClosuresOrganizationDateColumns);

            migrationBuilder.CreateIndex(
                name: "UX_OperationDayClosures_IdService_OperationDate",
                schema: "dbo",
                table: "OperationDayClosures",
                columns: OperationDayClosuresServiceDateColumns,
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApprovalRequests",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "OperationDayClosures",
                schema: "dbo");
        }
    }
}
