using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExpiryPolicyOnCatalogTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasOwnExpiry",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxIssueAgeMonths",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(PoliticaInicial);
        }

        /// <summary>
        /// La politica inicial: todo tipo de documento o evaluacion maneja vigencia, que es como se
        /// comportaba el sistema hasta ahora, salvo el comprobante de domicilio, que vale mientras dure
        /// el ingreso y solo admite emision de hasta tres meses.
        /// </summary>
        private const string PoliticaInicial = """
            SET NOCOUNT ON;

            UPDATE dbo.BusinessCatalogItems
            SET HasOwnExpiry = 1
            WHERE Type IN (N'EmployeeDocumentCategory', N'EmployeeEvaluationCategory')
              AND HasOwnExpiry IS NULL;

            UPDATE dbo.BusinessCatalogItems
            SET HasOwnExpiry = 0,
                MaxIssueAgeMonths = 3
            WHERE Type = N'EmployeeDocumentCategory'
              AND Name IN (N'Comprobante de domicilio', N'Comprobante de domicilio ');
            """;


        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasOwnExpiry",
                schema: "dbo",
                table: "BusinessCatalogItems");

            migrationBuilder.DropColumn(
                name: "MaxIssueAgeMonths",
                schema: "dbo",
                table: "BusinessCatalogItems");
        }
    }
}
