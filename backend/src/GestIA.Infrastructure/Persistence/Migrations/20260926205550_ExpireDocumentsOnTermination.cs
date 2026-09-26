using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExpireDocumentsOnTermination : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "OriginalExpiresDate",
                schema: "dbo",
                table: "EmployeeEvaluations",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "OriginalExpiresDate",
                schema: "dbo",
                table: "EmployeeDocuments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsExpiredOnTermination",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "bit",
                nullable: true);

            migrationBuilder.Sql(MarcaInicial);
        }

        /// <summary>
        /// Los tres tipos que el documento de la reunion pide marcar. Se marcan por nombre, en todas
        /// las organizaciones, y solo los que existen: lo que no exista queda sin marcar y se reporta.
        /// </summary>
        private const string MarcaInicial = """
            SET NOCOUNT ON;

            UPDATE dbo.BusinessCatalogItems
            SET IsExpiredOnTermination = 1
            WHERE Type IN (N'EmployeeDocumentCategory', N'EmployeeEvaluationCategory')
              AND Name IN (N'Examen toxicologico', N'Examen toxicológico', N'Antidoping',
                           N'Comprobante de domicilio', N'Prueba psicometrica', N'Prueba psicométrica');

            -- El resto del catalogo dice explicitamente que no vence con la baja, en vez de quedar
            -- nulo: nulo significaria "no se ha decidido", y aqui ya se decidio.
            UPDATE dbo.BusinessCatalogItems
            SET IsExpiredOnTermination = 0
            WHERE Type IN (N'EmployeeDocumentCategory', N'EmployeeEvaluationCategory')
              AND IsExpiredOnTermination IS NULL;
            """;

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OriginalExpiresDate",
                schema: "dbo",
                table: "EmployeeEvaluations");

            migrationBuilder.DropColumn(
                name: "OriginalExpiresDate",
                schema: "dbo",
                table: "EmployeeDocuments");

            migrationBuilder.DropColumn(
                name: "IsExpiredOnTermination",
                schema: "dbo",
                table: "BusinessCatalogItems");
        }
    }
}
