using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DocumentAuditSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AfterSnapshot",
                schema: "dbo",
                table: "BusinessDocumentEvents",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BeforeSnapshot",
                schema: "dbo",
                table: "BusinessDocumentEvents",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AfterSnapshot",
                schema: "dbo",
                table: "BusinessDocumentEvents");

            migrationBuilder.DropColumn(
                name: "BeforeSnapshot",
                schema: "dbo",
                table: "BusinessDocumentEvents");
        }
    }
}
