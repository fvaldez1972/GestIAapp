using Microsoft.EntityFrameworkCore.Migrations;

// Las migraciones generadas pasan arreglos literales; es lo que hacen todas las demas de este
// repositorio y no se reescriben a mano.
#pragma warning disable CA1861

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EvaluacionUnicaPorCategoriaDelCatalogo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_EmployeeEvaluations_IdEmployee_EvaluationType_EvaluatedDate",
                schema: "dbo",
                table: "EmployeeEvaluations");

            migrationBuilder.CreateIndex(
                name: "UX_EmployeeEvaluations_IdEmployee_EvaluationType_EvaluatedDate",
                schema: "dbo",
                table: "EmployeeEvaluations",
                columns: new[] { "IdEmployee", "EvaluationType", "EvaluatedDate" },
                unique: true,
                filter: "[IdEvaluationCategoryCatalogItem] IS NULL");

            migrationBuilder.CreateIndex(
                name: "UX_EmployeeEvaluations_IdEmployee_IdEvaluationCategoryCatalogItem_EvaluatedDate",
                schema: "dbo",
                table: "EmployeeEvaluations",
                columns: new[] { "IdEmployee", "IdEvaluationCategoryCatalogItem", "EvaluatedDate" },
                unique: true,
                filter: "[IdEvaluationCategoryCatalogItem] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_EmployeeEvaluations_IdEmployee_EvaluationType_EvaluatedDate",
                schema: "dbo",
                table: "EmployeeEvaluations");

            migrationBuilder.DropIndex(
                name: "UX_EmployeeEvaluations_IdEmployee_IdEvaluationCategoryCatalogItem_EvaluatedDate",
                schema: "dbo",
                table: "EmployeeEvaluations");

            migrationBuilder.CreateIndex(
                name: "UX_EmployeeEvaluations_IdEmployee_EvaluationType_EvaluatedDate",
                schema: "dbo",
                table: "EmployeeEvaluations",
                columns: new[] { "IdEmployee", "EvaluationType", "EvaluatedDate" },
                unique: true);
        }
    }
}
#pragma warning restore CA1861
