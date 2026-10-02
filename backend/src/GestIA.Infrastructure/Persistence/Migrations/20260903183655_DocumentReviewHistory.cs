using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DocumentReviewHistory : Migration
    {
        private static readonly string[] HistoryIndexColumns = ["IdOrganization", "IdBusinessDocument", "OccurredAt"];
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReviewNotes",
                schema: "dbo",
                table: "BusinessDocuments",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                schema: "dbo",
                table: "BusinessDocuments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedBy",
                schema: "dbo",
                table: "BusinessDocuments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedByName",
                schema: "dbo",
                table: "BusinessDocuments",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BusinessDocumentEvents",
                schema: "dbo",
                columns: table => new
                {
                    IdBusinessDocumentEvent = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdBusinessDocument = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessDocumentEvents", x => x.IdBusinessDocumentEvent);
                    table.ForeignKey(
                        name: "FK_BusinessDocumentEvents_BusinessDocuments_IdBusinessDocument",
                        column: x => x.IdBusinessDocument,
                        principalSchema: "dbo",
                        principalTable: "BusinessDocuments",
                        principalColumn: "IdBusinessDocument",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocumentEvents_IdBusinessDocument",
                schema: "dbo",
                table: "BusinessDocumentEvents",
                column: "IdBusinessDocument");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessDocumentEvents_IdOrganization_IdBusinessDocument_OccurredAt",
                schema: "dbo",
                table: "BusinessDocumentEvents",
                columns: HistoryIndexColumns);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BusinessDocumentEvents",
                schema: "dbo");

            migrationBuilder.DropColumn(
                name: "ReviewNotes",
                schema: "dbo",
                table: "BusinessDocuments");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                schema: "dbo",
                table: "BusinessDocuments");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                schema: "dbo",
                table: "BusinessDocuments");

            migrationBuilder.DropColumn(
                name: "ReviewedByName",
                schema: "dbo",
                table: "BusinessDocuments");
        }
    }
}
