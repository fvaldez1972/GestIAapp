using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FormalApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AssignedApproverName",
                schema: "dbo",
                table: "ApprovalRequests",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdOperationEvidence",
                schema: "dbo",
                table: "ApprovalRequests",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssignedApproverName",
                schema: "dbo",
                table: "ApprovalRequests");

            migrationBuilder.DropColumn(
                name: "IdOperationEvidence",
                schema: "dbo",
                table: "ApprovalRequests");
        }
    }
}
