using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Agrega el token de concurrencia a las seis entidades que se corrigen después de creadas:
    /// las cinco con bitácora más el cierre de día operativo.
    ///
    /// <para><b>Esta migración fue reescrita a mano, y por dos motivos.</b> EF la generó con
    /// <c>nullable: false, defaultValue: new byte[0]</c>, que es el mismo patrón que ya nos habría
    /// corrompido datos dos veces. Aquí además ni siquiera habría llegado a hacerlo: SQL Server
    /// <b>rechaza</b> un <c>DEFAULT</c> sobre una columna <c>rowversion</c>, así que la migración
    /// habría fallado al aplicarse.</para>
    ///
    /// <para>La forma correcta es un <c>ALTER TABLE … ADD RowVersion rowversion NOT NULL</c> sin
    /// valor por omisión: SQL Server genera el token de cada fila existente al agregar la columna,
    /// y lo mantiene solo en cada escritura posterior. Por eso esta migración no necesita relleno
    /// ni guarda, a diferencia de las de organización.</para>
    /// </summary>
    /// <inheritdoc />
    public partial class AddConcurrencyTokens : Migration
    {
        private static readonly string[] Tables =
        [
            "AttendanceRecords",
            "ServiceConfigurations",
            "Incidents",
            "CoverageRecords",
            "ServiceAssignments",
            "OperationDayClosures"
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.Sql($"ALTER TABLE [dbo].[{table}] ADD [RowVersion] rowversion NOT NULL;");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.DropColumn(name: "RowVersion", schema: "dbo", table: table);
            }
        }
    }
}
