using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// <b>Vacía a propósito.</b>
    ///
    /// <para>El cambio es del modelo, no del esquema: tres claves pasan de «las genera la base» a
    /// «las pone el dominio», que es lo que ya hacían. En SQL Server una clave <c>uniqueidentifier</c>
    /// sin valor por omisión se ve igual de los dos modos, así que no hay DDL que emitir.</para>
    ///
    /// <para>Existe para que la foto del modelo quede al día. Sin ella, la siguiente migración
    /// arrastraría este cambio mezclado con lo suyo.</para>
    /// </summary>
    public partial class ElIdentificadorDelPeriodoLoPoneElDominio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Sin DDL: ver el resumen de la clase.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sin DDL: ver el resumen de la clase.
        }
    }
}
