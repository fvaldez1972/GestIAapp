using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// La retrocarga que hace que retirar la doble fuente de bloqueo no cambie nada.
    ///
    /// <para><b>El problema que resuelve.</b> RF-POS-010 pide una sola fuente para la naturaleza de
    /// un requisito: el catálogo dice qué tan grave es, la regla dice a quién aplica. Aplicarlo sin
    /// más habría sido una regresión silenciosa. En <c>db-gestia-dev</c>, las 19 reglas activas
    /// tenían su propia marca y <b>sólo 2 de los 175 valores de catálogo marcables tenían la
    /// suya</b>. Al dejar de leer la de la regla, <c>catálogo ?? false</c> habría devuelto falso y
    /// las <b>13 reglas que impedían asignar habrían pasado a informativas</b> el día del
    /// despliegue, sin aviso y sin que nadie tocara nada.</para>
    ///
    /// <para><b>Por qué es determinista.</b> Ningún valor de catálogo tenía dos severidades
    /// distintas entre sus reglas, así que cada uno recibe la única marca que sus reglas le daban.
    /// No hay que elegir entre dos verdades: sólo hay una, y estaba escrita en el sitio
    /// equivocado.</para>
    ///
    /// <para><b>La columna de la regla no se borra.</b> Queda sin lector, que es distinto de
    /// vaciarla: es el rastro de lo que cada regla decidía, y aquí los registros no se pierden. El
    /// perfil de la entidad dejó de llevarla, así que editar una regla tampoco la pisa.</para>
    /// </summary>
    public partial class BlockingMarkBackfillToCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                -- Sólo donde el catálogo todavía no ha decidido. Si alguien ya marcó una entrada a
                -- mano, esa decisión es más reciente y más deliberada que la de la regla, y gana.
                --
                -- MAX() no elige entre severidades en conflicto: se comprobó que no las hay. Está
                -- por la forma del GROUP BY, y si mañana hubiera dos, la marca bloqueante ganaría,
                -- que es el lado seguro del error.
                UPDATE catalogo
                SET IsBlocking = severidad.Marca,
                    UpdatedAt = SYSUTCDATETIME(),
                    UpdatedBy = '00000000-0000-0000-0000-000000000000',
                    UpdatedByName = N'Catalog migration'
                FROM dbo.BusinessCatalogItems catalogo
                JOIN (
                    SELECT r.IdRequiredCatalogItem AS Id, MAX(CAST(r.IsBlocking AS int)) AS Marca
                    FROM dbo.EligibilityRequirements r
                    WHERE r.Active = 1
                      AND r.IsBlocking IS NOT NULL
                      AND r.IdRequiredCatalogItem IS NOT NULL
                    GROUP BY r.IdRequiredCatalogItem
                ) severidad ON severidad.Id = catalogo.IdBusinessCatalogItem
                WHERE catalogo.IsBlocking IS NULL
                  AND catalogo.Type IN ('Skill', 'EmployeeDocumentCategory',
                                        'EmployeeEvaluationCategory', 'AdministrativeIncidentType');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // La vuelta atrás retira sólo las marcas que puso esta migración, reconocibles por el
            // actor que las escribió. Las que alguien haya decidido después se quedan: volver atrás
            // el código no es motivo para deshacer el trabajo de una persona.
            migrationBuilder.Sql(@"
                UPDATE dbo.BusinessCatalogItems
                SET IsBlocking = NULL
                WHERE UpdatedByName = N'Catalog migration'
                  AND IsBlocking IS NOT NULL;
            ");
        }
    }
}
