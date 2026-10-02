using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// El precio del puesto gana su periodo, y la organizacion declara cada cuando paga.
    ///
    /// <para><b>Por que se renombra la columna.</b> Se llamaba <c>MonthlyPrice</c> y desde que el
    /// precio se puede pactar por semana ese nombre describiria mal la mitad de los casos. El
    /// importe <b>no se convierte</b>: se queda tal como se pacto y el periodo va al lado. Pasarlo
    /// todo a mensual para conservar el nombre habria metido un redondeo en un dato que nadie pidio
    /// redondear.</para>
    ///
    /// <para><b>El renombre conserva los datos</b> —es un <c>RenameColumn</c>, no un par de
    /// columnas— asi que los precios de los 64 puestos vivos siguen siendo los mismos numeros.</para>
    ///
    /// <para><b>La generada por EF traia el defecto conocido del proyecto:</b>
    /// <c>defaultValue: ""</c> en una columna <c>NOT NULL</c> sobre datos existentes. La cadena
    /// vacia no es ningun valor del enum, asi que las 64 posiciones habrian quedado con un periodo
    /// ilegible y la primera lectura habria reventado. Se reescribio a mano con el patron de
    /// siempre: columna nulable, relleno explicito, y despues obligatoria. Sin <c>DEFAULT</c>
    /// permanente, que dejaria la base con una restriccion que el modelo no declara.</para>
    ///
    /// <para><b>El relleno es <c>Monthly</c> y no es una suposicion:</b> la columna se llamaba
    /// <c>MonthlyPrice</c>, asi que eso es exactamente lo que significaban esos importes.</para>
    ///
    /// <para><b>La periodicidad de pago de la organizacion queda nulable a proposito.</b> Nulo es
    /// «nadie lo ha declarado». Poner «semanal» por omision a las ocho organizaciones que ya
    /// existen habria afirmado en su nombre algo que nadie capturo.</para>
    /// </summary>
    public partial class AddPositionPriceFrequencyAndPayrollFrequency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // La restriccion nombra la columna, asi que se retira antes del renombre y se vuelve a
            // crear con el nombre nuevo. Dejarla apuntando a `MonthlyPrice` dejaria el nombre viejo
            // vivo en el esquema.
            migrationBuilder.DropCheckConstraint(
                name: "CK_Positions_MonthlyPrice",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.RenameColumn(
                name: "MonthlyPrice",
                schema: "dbo",
                table: "Positions",
                newName: "Price");

            // Nulable primero: sobre filas existentes una columna obligatoria necesita un valor, y
            // el que EF propone es la cadena vacia.
            migrationBuilder.AddColumn<string>(
                name: "PriceFrequency",
                schema: "dbo",
                table: "Positions",
                type: "varchar(20)",
                unicode: false,
                maxLength: 20,
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE dbo.Positions SET PriceFrequency = 'Monthly' WHERE PriceFrequency IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "PriceFrequency",
                schema: "dbo",
                table: "Positions",
                type: "varchar(20)",
                unicode: false,
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldUnicode: false,
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PayrollFrequency",
                schema: "dbo",
                table: "Organizations",
                type: "varchar(20)",
                unicode: false,
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Positions_Price",
                schema: "dbo",
                table: "Positions",
                sql: "[Price] >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Positions_Price",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "PriceFrequency",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "PayrollFrequency",
                schema: "dbo",
                table: "Organizations");

            migrationBuilder.RenameColumn(
                name: "Price",
                schema: "dbo",
                table: "Positions",
                newName: "MonthlyPrice");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Positions_MonthlyPrice",
                schema: "dbo",
                table: "Positions",
                sql: "[MonthlyPrice] >= 0");
        }
    }
}
