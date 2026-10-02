using System;
using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ServiceAssignmentsPosition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdPosition",
                schema: "dbo",
                table: "ServiceAssignments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceAssignments_IdPosition_StartDate",
                schema: "dbo",
                table: "ServiceAssignments",
                columns: new[] { "IdPosition", "StartDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceAssignments_Positions_IdPosition",
                schema: "dbo",
                table: "ServiceAssignments",
                column: "IdPosition",
                principalSchema: "dbo",
                principalTable: "Positions",
                principalColumn: "IdPosition",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceAssignments_Positions_IdPosition",
                schema: "dbo",
                table: "ServiceAssignments");

            migrationBuilder.DropIndex(
                name: "IX_ServiceAssignments_IdPosition_StartDate",
                schema: "dbo",
                table: "ServiceAssignments");

            migrationBuilder.DropColumn(
                name: "IdPosition",
                schema: "dbo",
                table: "ServiceAssignments");
        }
    }
}

#pragma warning restore CA1861
