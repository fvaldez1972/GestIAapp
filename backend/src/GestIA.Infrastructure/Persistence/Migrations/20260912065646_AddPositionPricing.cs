using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// El precio se muda del servicio al puesto.
    ///
    /// <para>En seguridad privada se cotiza por puesto: un servicio con caseta, rondin y
    /// monitorista tiene tres precios, no uno. Estaba en una configuracion del servicio, que
    /// obligaba a un solo numero para todos los puestos.</para>
    ///
    /// <para>Aditiva y sin perdida: solo agrega columnas. El retiro de la configuracion va en una
    /// migracion aparte, para poder distinguir despues si un problema vino de una cosa o de la
    /// otra.</para>
    /// </summary>
    public partial class AddPositionPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CurrencyCode",
                schema: "dbo",
                table: "Positions",
                type: "varchar(3)",
                nullable: false,
                // MXN y no cadena vacia: el dominio exige moneda, y las posiciones que ya existen
                // quedarian con un valor que la propia entidad rechaza al releerlas.
                defaultValue: "MXN");

            migrationBuilder.AddColumn<bool>(
                name: "IsTaxIncluded",
                schema: "dbo",
                table: "Positions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyPrice",
                schema: "dbo",
                table: "Positions",
                type: "decimal(19,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Positions_MonthlyPrice",
                schema: "dbo",
                table: "Positions",
                sql: "[MonthlyPrice] >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Positions_MonthlyPrice",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "CurrencyCode",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "IsTaxIncluded",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "MonthlyPrice",
                schema: "dbo",
                table: "Positions");
        }
    }
}
