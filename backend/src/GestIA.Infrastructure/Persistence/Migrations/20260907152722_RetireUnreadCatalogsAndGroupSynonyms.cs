using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Se retiran los seis catálogos que nadie leía, y las dos columnas que nadie leía.
    ///
    /// <para><b>Los seis tipos</b> —<c>Zone</c>, <c>CancellationReason</c>, <c>DocumentRequirement</c>,
    /// <c>EvaluationRequirement</c>, <c>ClientRestriction</c> y <c>ServiceRestriction</c>— no tenían
    /// ningún lector fuera de la propia pantalla de Catálogos. <c>Zone</c> era el único con datos, y
    /// perdió su último consumidor cuando se retiró el camino de configuración de Inicio, que era
    /// quien contaba las zonas.</para>
    ///
    /// <para><b>Sus filas se borran físicamente, y es la excepción a la regla.</b> Aquí los
    /// registros no se borran, pero el tipo deja de existir en el enum: una fila con ese valor haría
    /// fallar la lectura del modelo, no sólo esconderse. No es un registro operativo —es un valor de
    /// catálogo que nadie referencia— y la migración se detiene si alguno resultara referenciado.</para>
    ///
    /// <para><b><c>CatalogGroup</c> y <c>Synonyms</c></b> quedaron sin lectores al rehacerse la
    /// pantalla: agrupar catorce catálogos en tres cajones no ayudaba a encontrarlos, y los sinónimos
    /// sólo alimentaban un buscador que ahora busca por nombre. <c>DisplayOrder</c> se queda,
    /// pendiente de la reunión con Óscar y Joab.</para>
    /// </summary>
    public partial class RetireUnreadCatalogsAndGroupSynonyms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Que nadie referencie lo que se va a borrar. Si algo lo referencia, la migracion se
            //    detiene: un catalogo referenciado no se retira aunque su pantalla no lo lea.
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1 FROM dbo.BusinessCatalogItems c
    WHERE c.Type IN ('Zone','CancellationReason','DocumentRequirement','EvaluationRequirement','ClientRestriction','ServiceRestriction')
      AND (EXISTS (SELECT 1 FROM dbo.Employees e WHERE e.IdJobPositionCatalogItem = c.IdBusinessCatalogItem)
        OR EXISTS (SELECT 1 FROM dbo.EmployeeSkills s WHERE s.IdSkillCatalogItem = c.IdBusinessCatalogItem)
        OR EXISTS (SELECT 1 FROM dbo.CoverageRecords r WHERE r.IdCoverageReason = c.IdBusinessCatalogItem)
        OR EXISTS (SELECT 1 FROM dbo.EligibilityRequirements q WHERE q.IdRequiredCatalogItem = c.IdBusinessCatalogItem)
        OR EXISTS (SELECT 1 FROM dbo.BusinessCatalogItems h WHERE h.IdParentCatalogItem = c.IdBusinessCatalogItem)))
    THROW 50000, 'Hay valores de los catalogos retirados que algo referencia. La migracion se detiene sin borrar nada: un catalogo referenciado no se retira.', 1;");

            // 2. Y ahora si, fuera. Son valores de catalogo sin referentes, no registros operativos.
            migrationBuilder.Sql(@"
DELETE FROM dbo.BusinessCatalogItems
WHERE Type IN ('Zone','CancellationReason','DocumentRequirement','EvaluationRequirement','ClientRestriction','ServiceRestriction');");

            // 3. Las dos columnas sin lectores.
            migrationBuilder.DropColumn(
                name: "CatalogGroup",
                schema: "dbo",
                table: "BusinessCatalogItems")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_CatalogGroup");

            migrationBuilder.DropColumn(
                name: "Synonyms",
                schema: "dbo",
                table: "BusinessCatalogItems")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_Synonyms");
        }

        /// <inheritdoc />
        /// <summary>
        /// La vuelta atrás devuelve las dos columnas vacías, no los valores borrados ni los suyos.
        /// Quien vuelva y necesite los datos restaura del respaldo.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CatalogGroup",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "General")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_CatalogGroup");

            migrationBuilder.AddColumn<string>(
                name: "Synonyms",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "nvarchar(max)",
                nullable: false,
                defaultValueSql: "N'[]'")
                .Annotation("Relational:DefaultConstraintName", "DF_BusinessCatalogItems_Synonyms");
        }
    }
}
