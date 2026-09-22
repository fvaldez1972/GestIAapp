using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Retira la geografía por organización: se desactiva, no se borra.
    ///
    /// <para><b>No cambia el esquema.</b> Las filas siguen en <c>BusinessCatalogItems</c> con
    /// <c>Active = 0</c>. Borrarlas habría sido más limpio de ver y va contra el tercer principio
    /// del proyecto —los registros no se eliminan—, y además contra algo concreto: los domicilios
    /// ya capturados guardan el <b>nombre</b> del estado y del municipio, no su identificador, así
    /// que la fila del catálogo es la única constancia de de dónde salió ese texto.</para>
    ///
    /// <para><b>Qué deja de leerse.</b> En <c>db-gestia-dev</c> son 20 092 filas de 8
    /// organizaciones: 8 países, 258 estados y 19 826 municipios. Unas 2 511 por empresa de unos
    /// datos que son los mismos para todas. Desde el 22 de septiembre de 2026 los domicilios los
    /// leen de <c>GeoCountries</c>, <c>GeoStates</c> y <c>GeoMunicipalities</c>, que no llevan
    /// organización, así que estas filas ya no las consulta nadie.</para>
    ///
    /// <para><b>El índice único conserva su filtro, y eso no es un descuido.</b>
    /// <c>UX_BusinessCatalogItems_...</c> excluye <c>Country</c>, <c>State</c> y <c>City</c> porque
    /// el catálogo del INEGI tiene municipios homónimos dentro de un mismo estado —Oaxaca tiene dos
    /// San Juan Mixtepec, distinguidos por distrito—. Desactivar una fila no la saca de un índice
    /// filtrado por <c>Type</c>, así que quitar el filtro hoy haría fallar la reconstrucción del
    /// índice contra esos duplicados. El filtro se irá el día que las filas se vayan, si se van.</para>
    ///
    /// <para><b>La pantalla vieja de Catálogos ya no las ofrece</b>, así que no queda ningún camino
    /// para crear una nueva. Sin eso, desactivarlas sólo habría durado hasta el siguiente alta.</para>
    /// </summary>
    public partial class DeactivateOrganizationGeography : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE dbo.BusinessCatalogItems
                SET Active = 0,
                    UpdatedAt = SYSUTCDATETIME(),
                    UpdatedBy = '00000000-0000-0000-0000-000000000000',
                    UpdatedByName = N'Shared geography migration'
                WHERE Active = 1
                  AND Type IN ('Country', 'State', 'City');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sólo vuelve a activar lo que esta migración desactivó, reconocible por el actor. Una
            // fila que alguien hubiera desactivado a mano antes se queda como estaba: volver atrás
            // el código no es motivo para deshacer la decisión de una persona.
            migrationBuilder.Sql(@"
                UPDATE dbo.BusinessCatalogItems
                SET Active = 1
                WHERE Active = 0
                  AND UpdatedByName = N'Shared geography migration'
                  AND Type IN ('Country', 'State', 'City');
            ");
        }
    }
}
