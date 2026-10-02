using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Se retira el alcance del contacto del cliente, por decision del 26 de septiembre de 2026.
    ///
    /// <para><b>Es un dato que no se ocupa.</b> Nunca decidio nada por si mismo: al crear un contacto
    /// se calculaba solo con si traia zona o no, y la unica pantalla que lo consultaba --la pestana de
    /// Zonas-- resuelve a quien llamar mirando la zona del contacto, no su alcance.</para>
    ///
    /// <para><b>Destructiva, y la columna no se conserva.</b> Volver atras la recrea vacia con
    /// «General» por omision. Se ejecuto con respaldo COPY_ONLY verificado y ensayo sobre copia
    /// restaurada.</para>
    /// </summary>
    public partial class RemoveClientContactScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Scope",
                schema: "dbo",
                table: "ClientContacts")
                .Annotation("Relational:DefaultConstraintName", "DF_ClientContacts_Scope");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Scope",
                schema: "dbo",
                table: "ClientContacts",
                type: "varchar(20)",
                unicode: false,
                maxLength: 20,
                nullable: false,
                defaultValue: "General")
                .Annotation("Relational:DefaultConstraintName", "DF_ClientContacts_Scope");
        }
    }
}
