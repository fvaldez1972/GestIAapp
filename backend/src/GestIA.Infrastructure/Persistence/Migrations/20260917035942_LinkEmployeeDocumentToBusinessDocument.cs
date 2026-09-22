using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Liga el requisito documental del empleado con el archivo que lo cubre.
    ///
    /// <para><b>Por que hacia falta.</b> El expediente guarda el archivo como
    /// <c>BusinessDocument</c> —con su historial, su revision y su permiso de sensibles— y la
    /// vigencia documental se calcula sobre <c>EmployeeDocuments</c>. Las dos filas existian sin
    /// ninguna liga, asi que desde el requisito no se podia llegar al archivo que lo cubre.</para>
    ///
    /// <para><b>Aditiva y sin riesgo.</b> Una columna nulable y un indice filtrado: no reescribe
    /// nada, no necesita relleno, y no rompe la imagen publicada, que simplemente no la lee. Es lo
    /// contrario del renombre del precio, que hace inseparables el esquema y la imagen.</para>
    ///
    /// <para><b>Sin clave foranea, a proposito.</b> Un documento de negocio se archiva, y esta fila
    /// es historia del expediente: una restriccion impediria archivar el archivo o arrastraria la
    /// fila con el. El indice esta para poder ir del requisito al archivo, que es lo unico que se
    /// necesita.</para>
    ///
    /// <para><b>Los documentos que ya existen quedan con nulo</b>, y el nulo significa algo: «este
    /// requisito se registro sin pasar por la carga de un archivo». No se les inventa uno.</para>
    /// </summary>
    public partial class LinkEmployeeDocumentToBusinessDocument : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdBusinessDocument",
                schema: "dbo",
                table: "EmployeeDocuments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeDocuments_IdBusinessDocument",
                schema: "dbo",
                table: "EmployeeDocuments",
                column: "IdBusinessDocument",
                filter: "[IdBusinessDocument] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EmployeeDocuments_IdBusinessDocument",
                schema: "dbo",
                table: "EmployeeDocuments");

            migrationBuilder.DropColumn(
                name: "IdBusinessDocument",
                schema: "dbo",
                table: "EmployeeDocuments");
        }
    }
}
