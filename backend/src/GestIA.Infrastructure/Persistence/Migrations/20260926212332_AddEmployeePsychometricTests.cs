using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1861 // EF Core genera arreglos locales para los indices compuestos.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeePsychometricTests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeePsychometricTests",
                schema: "dbo",
                columns: table => new
                {
                    IdEmployeePsychometricTest = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApprovedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpiredOnDate = table.Column<DateOnly>(type: "date", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_EmployeePsychometricTests_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_EmployeePsychometricTests_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeePsychometricTests", x => x.IdEmployeePsychometricTest);
                    table.CheckConstraint("CK_EmployeePsychometricTests_ExpiredOnDate", "[ExpiredOnDate] IS NULL OR [ExpiredOnDate] >= [ApprovedDate]");
                    table.ForeignKey(
                        name: "FK_EmployeePsychometricTests_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeePsychometricTests_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePsychometricTests_IdEmployee_ApprovedDate",
                schema: "dbo",
                table: "EmployeePsychometricTests",
                columns: new[] { "IdEmployee", "ApprovedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePsychometricTests_IdOrganization",
                schema: "dbo",
                table: "EmployeePsychometricTests",
                column: "IdOrganization");

            migrationBuilder.CreateIndex(
                name: "UX_EmployeePsychometricTests_IdEmployee",
                schema: "dbo",
                table: "EmployeePsychometricTests",
                column: "IdEmployee",
                unique: true,
                filter: "[ExpiredOnDate] IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeePsychometricTests",
                schema: "dbo");
        }
    }
}

#pragma warning restore CA1861
