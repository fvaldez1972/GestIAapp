using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF Core genera arreglos locales para indices compuestos.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Dos configuraciones del mismo servicio pueden empezar el mismo día.
    ///
    /// <para>Lo pidió el usuario el 10 de septiembre de 2026, después de que se le explicara que la
    /// unicidad estaba puesta a propósito: si dos empiezan el mismo día no hay forma de saber cuál
    /// rige. Hoy eso no rompe nada porque <b>nada resuelve la configuración vigente por fecha</b>
    /// —sólo se listan, se abren por identificador y se auditan—. El día que algo tenga que elegir
    /// una, ese código tendrá que decidir con qué criterio.</para>
    ///
    /// <para>El índice se conserva, sin unicidad: el listado busca por servicio y ordena por esta
    /// fecha. Lo que se retira es la restricción, no la búsqueda.</para>
    ///
    /// <para><b>La vuelta atrás puede fallar, y es correcto que falle.</b> `Down` recrea el índice
    /// único; si para entonces ya existen dos configuraciones con la misma fecha, SQL Server lo
    /// rechazará. Deshacer esta decisión exige antes decidir cuál de las empatadas se conserva, y
    /// eso no lo puede inventar una migración.</para>
    /// </summary>
    public partial class AllowSameStartDateServiceConfigurations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_ServiceConfigurations_IdService_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceConfigurations_IdService_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations",
                columns: new[] { "IdService", "EffectiveFromDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServiceConfigurations_IdService_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations");

            migrationBuilder.CreateIndex(
                name: "UX_ServiceConfigurations_IdService_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations",
                columns: new[] { "IdService", "EffectiveFromDate" },
                unique: true);
        }
    }
}
