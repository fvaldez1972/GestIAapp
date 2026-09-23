using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// La marca del catálogo pasa de llamarse «bloqueante» a llamarse «obligatorio», también en la base.
    ///
    /// <para><b>No cambia ningún comportamiento ni ningún dato.</b> Son dos renombres de columna:
    /// <c>BusinessCatalogItems.IsBlocking</c> y <c>EligibilityRequirements.IsBlocking</c> pasan a
    /// <c>IsRequired</c>. Los valores viajan con la columna; ni una fila se toca.</para>
    ///
    /// <para><b>Por qué se hace, si no se ve.</b> El 22 de septiembre de 2026 el rótulo de pantalla
    /// pasó a «Informativa/Obligatorio». Dejar el modelo diciendo «blocking» habría dejado al
    /// proyecto con dos vocabularios para lo mismo, que es como se acumulan los malentendidos: quien
    /// lee el código busca una marca de bloqueo y quien lee la pantalla busca un obligatorio.</para>
    ///
    /// <para><b>Lo que NO se tocó, y hay que no tocar.</b> Las migraciones anteriores conservan sus
    /// nombres, sus cuerpos y sus <c>.Designer.cs</c> —incluidas
    /// <c>BlockingMarkBackfillToCatalog</c> y <c>RetireUndecidedBlockingMark</c>, cuyo SQL nombra
    /// <c>IsBlocking</c>—. Una migración desplegada no se reescribe, y además su orden las protege:
    /// corren antes que ésta, así que una base creada desde cero sigue funcionando.</para>
    ///
    /// <para><b>La trampa del retroceso.</b> Si alguien revirtiera <i>más atrás</i> de esta
    /// migración, el <c>Down</c> de aquellas dos buscaría <c>IsBlocking</c> sobre una columna que
    /// para entonces se llama así otra vez —porque el <c>Down</c> de ésta ya la habrá renombrado—.
    /// Funciona, pero sólo si se revierte en orden; saltarse ésta rompería aquéllas.</para>
    ///
    /// <para><b>La bitácora se queda como está.</b> 65 eventos de <c>OperationalEvents</c> guardan
    /// <c>"IsBlocking"</c> como clave dentro de su JSON. No se reescriben: la bitácora es de sólo
    /// agregar, y corregir el pasado para que se parezca al presente es justo lo que un historial no
    /// debe hacer. Los eventos nuevos dirán <c>"IsRequired"</c>. Ninguna pantalla lee esa clave.</para>
    /// </summary>
    public partial class RenameBlockingMarkToRequired : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "IsBlocking",
                schema: "dbo",
                table: "EligibilityRequirements",
                newName: "IsRequired");

            migrationBuilder.RenameColumn(
                name: "IsBlocking",
                schema: "dbo",
                table: "BusinessCatalogItems",
                newName: "IsRequired");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "IsRequired",
                schema: "dbo",
                table: "EligibilityRequirements",
                newName: "IsBlocking");

            migrationBuilder.RenameColumn(
                name: "IsRequired",
                schema: "dbo",
                table: "BusinessCatalogItems",
                newName: "IsBlocking");
        }
    }
}
