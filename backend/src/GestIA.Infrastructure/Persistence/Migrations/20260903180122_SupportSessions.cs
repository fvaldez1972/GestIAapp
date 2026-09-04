using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SupportSessions : Migration
    {
        private static readonly string[] ActorIndexColumns = ["CreatedBy", "Active", "ExpiresAt"];
        private static readonly string[] OrganizationIndexColumns = ["IdOrganization", "StartsAt"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SupportSessions",
                schema: "dbo",
                columns: table => new
                {
                    IdSupportSession = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    StartsAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    EndedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    EndedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_SupportSessions_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_SupportSessions_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportSessions", x => x.IdSupportSession);
                    table.CheckConstraint("CK_SupportSessions_Expiration", "[ExpiresAt] > [StartsAt]");
                    table.ForeignKey(
                        name: "FK_SupportSessions_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SupportSessions_CreatedBy_Active_ExpiresAt",
                schema: "dbo",
                table: "SupportSessions",
                columns: ActorIndexColumns);

            migrationBuilder.CreateIndex(
                name: "IX_SupportSessions_IdOrganization_StartsAt",
                schema: "dbo",
                table: "SupportSessions",
                columns: OrganizationIndexColumns);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SupportSessions",
                schema: "dbo");
        }
    }
}
