using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Retira el tercer estado de la marca de bloqueo: lo que estaba «sin decidir» queda informativo.
    ///
    /// <para><b>No cambia el esquema.</b> La columna sigue siendo nulable, porque el nulo conserva
    /// un significado legítimo: los catálogos que no participan en la elegibilidad no llevan marca.
    /// Lo que deja de existir es el nulo en los cuatro que sí la llevan.</para>
    ///
    /// <para><b>Por qué se retira en vez de arreglarse.</b> «Sin decidir» no salía de la matriz
    /// —que pide dos estados, «impide asignar y publicar» o «sólo deja constancia»— sino del
    /// modelo: la marca nació nulable para no declarar informativas de golpe las entradas que ya
    /// existían cuando se creó. Ese recurso de conversión se asomó a la pantalla como si fuera una
    /// opción de negocio, y además no se podía guardar: «no te mando la marca» y «déjala sin
    /// decidir» viajan los dos como nulo, así que el servidor conservaba la anterior y quien la
    /// elegía veía un guardado correcto sin ningún cambio.</para>
    ///
    /// <para><b>No cambia ningún comportamiento, y eso se puede comprobar.</b> Los dos únicos
    /// lugares que consultan la marca de una entrada del catálogo la resuelven con
    /// <c>?? false</c>: una entrada sin decidir ya se comportaba exactamente como informativa. Esta
    /// migración no decide nada nuevo, sólo deja escrito lo que el sistema ya hacía.</para>
    ///
    /// <para><b>Lo que sí cambia es quién lo ve.</b> Hasta hoy, 136 entradas de
    /// <c>db-gestia-dev</c> —90 tipos de documento, 32 tipos de evaluación y 14 experiencias—
    /// aparecían como pendientes de revisar. Ya no aparecerán, así que si alguna debía bloquear
    /// —el INE, el polígrafo— hay que marcarla a mano. La lista de las 136 quedó en
    /// <c>docs/requerimientos/</c> para esa revisión.</para>
    /// </summary>
    public partial class RetireUndecidedBlockingMark : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE dbo.BusinessCatalogItems
                SET IsBlocking = 0,
                    UpdatedAt = SYSUTCDATETIME(),
                    UpdatedBy = '00000000-0000-0000-0000-000000000000',
                    UpdatedByName = N'Blocking mark migration'
                WHERE IsBlocking IS NULL
                  AND Type IN (
                      'Skill',
                      'EmployeeDocumentCategory',
                      'EmployeeEvaluationCategory',
                      'AdministrativeIncidentType');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sólo vuelve a nulo lo que esta migración escribió, reconocible por el actor. Una
            // entrada que una persona haya marcado como informativa después se queda informativa:
            // volver atrás el código no es motivo para deshacer la decisión de alguien.
            migrationBuilder.Sql(@"
                UPDATE dbo.BusinessCatalogItems
                SET IsBlocking = NULL
                WHERE IsBlocking = 0
                  AND UpdatedByName = N'Blocking mark migration'
                  AND Type IN (
                      'Skill',
                      'EmployeeDocumentCategory',
                      'EmployeeEvaluationCategory',
                      'AdministrativeIncidentType');
            ");
        }
    }
}
