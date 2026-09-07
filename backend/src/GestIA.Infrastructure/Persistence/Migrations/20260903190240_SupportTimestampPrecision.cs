using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SupportTimestampPrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint("CK_SupportSessions_Expiration", "SupportSessions", "dbo");
            migrationBuilder.AlterColumn<DateTime>(
                name: "StartsAt",
                schema: "dbo",
                table: "SupportSessions",
                type: "datetime2(7)",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2(0)");

            migrationBuilder.AlterColumn<DateTime>(
                name: "ExpiresAt",
                schema: "dbo",
                table: "SupportSessions",
                type: "datetime2(7)",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2(0)");

            migrationBuilder.AlterColumn<DateTime>(
                name: "EndedAt",
                schema: "dbo",
                table: "SupportSessions",
                type: "datetime2(7)",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2(0)",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint("CK_SupportSessions_Expiration", "SupportSessions", "[ExpiresAt] > [StartsAt]", "dbo");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint("CK_SupportSessions_Expiration", "SupportSessions", "dbo");
            migrationBuilder.AlterColumn<DateTime>(
                name: "StartsAt",
                schema: "dbo",
                table: "SupportSessions",
                type: "datetime2(0)",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2(7)");

            migrationBuilder.AlterColumn<DateTime>(
                name: "ExpiresAt",
                schema: "dbo",
                table: "SupportSessions",
                type: "datetime2(0)",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2(7)");

            migrationBuilder.AlterColumn<DateTime>(
                name: "EndedAt",
                schema: "dbo",
                table: "SupportSessions",
                type: "datetime2(0)",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2(7)",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint("CK_SupportSessions_Expiration", "SupportSessions", "[ExpiresAt] > [StartsAt]", "dbo");
        }
    }
}
