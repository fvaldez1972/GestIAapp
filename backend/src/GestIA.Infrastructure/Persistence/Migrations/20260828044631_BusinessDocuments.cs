using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BusinessDocuments : Migration
    {
        private static readonly string[] OwnerTypeOwnerIdColumns = ["OwnerType", "OwnerId"];
        private static readonly string[] StatusExpiresDateColumns = ["Status", "ExpiresDate"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BusinessDocuments",
                schema: "dbo",
                columns: table => new
                {
                    IdBusinessDocument = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerType = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    OwnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdClient = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdServiceContract = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdEmployeeEvaluation = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IdOperationalRequest = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    IssuedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpiresDate = table.Column<DateOnly>(type: "date", nullable: true),
                    StorageReference = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IsSensitive = table.Column<bool>(type: "bit", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_BusinessDocuments_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_BusinessDocuments_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessDocuments", x => x.IdBusinessDocument);
                    table.CheckConstraint("CK_BusinessDocuments_ExpiryDateRange", "[ExpiresDate] IS NULL OR [IssuedDate] IS NULL OR [ExpiresDate] >= [IssuedDate]");
                    table.CheckConstraint("CK_BusinessDocuments_RelatedRecord_ExactlyOne", "(([IdClient] IS NOT NULL AND [IdServiceContract] IS NULL AND [IdService] IS NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NULL) OR ([IdClient] IS NULL AND [IdServiceContract] IS NOT NULL AND [IdService] IS NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NULL) OR ([IdClient] IS NULL AND [IdServiceContract] IS NULL AND [IdService] IS NOT NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NULL) OR ([IdClient] IS NULL AND [IdServiceContract] IS NULL AND [IdService] IS NULL AND [IdEmployee] IS NOT NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NULL) OR ([IdClient] IS NULL AND [IdServiceContract] IS NULL AND [IdService] IS NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NOT NULL AND [IdOperationalRequest] IS NULL) OR ([IdClient] IS NULL AND [IdServiceContract] IS NULL AND [IdService] IS NULL AND [IdEmployee] IS NULL AND [IdEmployeeEvaluation] IS NULL AND [IdOperationalRequest] IS NOT NULL))");
                    table.ForeignKey(
                        name: "FK_BusinessDocuments_Clients_IdClient",
                        column: x => x.IdClient,
                        principalSchema: "dbo",
                        principalTable: "Clients",
                        principalColumn: "IdClient",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BusinessDocuments_EmployeeEvaluations_IdEmployeeEvaluation",
                        column: x => x.IdEmployeeEvaluation,
                        principalSchema: "dbo",
                        principalTable: "EmployeeEvaluations",
                        principalColumn: "IdEmployeeEvaluation",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BusinessDocuments_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BusinessDocuments_OperationalRequests_IdOperationalRequest",
                        column: x => x.IdOperationalRequest,
                        principalSchema: "dbo",
                        principalTable: "OperationalRequests",
                        principalColumn: "IdOperationalRequest",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BusinessDocuments_ServiceContracts_IdServiceContract",
                        column: x => x.IdServiceContract,
                        principalSchema: "dbo",
                        principalTable: "ServiceContracts",
                        principalColumn: "IdServiceContract",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BusinessDocuments_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_IdClient",
                schema: "dbo",
                table: "BusinessDocuments",
                column: "IdClient");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_IdEmployee",
                schema: "dbo",
                table: "BusinessDocuments",
                column: "IdEmployee");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_IdEmployeeEvaluation",
                schema: "dbo",
                table: "BusinessDocuments",
                column: "IdEmployeeEvaluation");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_IdOperationalRequest",
                schema: "dbo",
                table: "BusinessDocuments",
                column: "IdOperationalRequest");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_IdOrganization",
                schema: "dbo",
                table: "BusinessDocuments",
                column: "IdOrganization");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_IdService",
                schema: "dbo",
                table: "BusinessDocuments",
                column: "IdService");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_IdServiceContract",
                schema: "dbo",
                table: "BusinessDocuments",
                column: "IdServiceContract");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_OwnerType_OwnerId",
                schema: "dbo",
                table: "BusinessDocuments",
                columns: OwnerTypeOwnerIdColumns);

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocuments_Status_ExpiresDate",
                schema: "dbo",
                table: "BusinessDocuments",
                columns: StatusExpiresDateColumns);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BusinessDocuments",
                schema: "dbo");
        }
    }
}
