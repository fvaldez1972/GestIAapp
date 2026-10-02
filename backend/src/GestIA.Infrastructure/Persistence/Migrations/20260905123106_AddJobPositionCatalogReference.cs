using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1861 // EF Core generates inline arrays for migration index definitions.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Reemplaza el perfil de puesto en texto libre por una referencia al catálogo
    /// <c>JobPosition</c>, en posiciones y en empleados.
    ///
    /// <para><b>El relleno es tolerante</b>: compara sin distinguir mayúsculas ni acentos y
    /// recortando espacios, porque los valores existentes los escribió una persona. Lo que no
    /// hace es adivinar: si un texto no corresponde a ninguna entrada del catálogo, la columna
    /// queda <b>nula</b> y el texto original se conserva intacto. Un nulo dice "no sabemos cuál es
    /// su puesto", no "no cumple", y la elegibilidad no bloquea por eso.</para>
    ///
    /// <para><b>Y antes de rellenar, comprueba que la tolerancia sea segura</b>: si dos entradas
    /// activas del catálogo de una misma organización colapsan al mismo texto normalizado, la
    /// migración se detiene. Sin esa guarda, la tolerancia uniría en silencio dos puestos que el
    /// negocio distingue, que es el único riesgo real de comparar de forma laxa.</para>
    /// </summary>
    /// <inheritdoc />
    public partial class AddJobPositionCatalogReference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Employees",
                type: "uniqueidentifier",
                nullable: true);

            // 1. Guarda: la tolerancia no puede unir dos puestos que el negocio distingue.
            migrationBuilder.Sql("""
                DECLARE @collisions nvarchar(400) = STUFF((
                    SELECT ', ' + x.Normalized + ' (' + CAST(x.n AS nvarchar(10)) + ')'
                    FROM (
                        SELECT LTRIM(RTRIM(Name)) COLLATE Latin1_General_100_CI_AI AS Normalized,
                               IdOrganization,
                               COUNT(*) AS n
                        FROM dbo.BusinessCatalogItems
                        WHERE Type = 'JobPosition' AND Active = 1
                        GROUP BY LTRIM(RTRIM(Name)) COLLATE Latin1_General_100_CI_AI, IdOrganization
                        HAVING COUNT(*) > 1
                    ) AS x
                    FOR XML PATH(''), TYPE).value('.', 'nvarchar(400)'), 1, 2, '');

                IF @collisions IS NOT NULL
                BEGIN
                    DECLARE @message nvarchar(600) =
                        N'El catalogo de puestos tiene entradas que solo se distinguen por ' +
                        N'mayusculas, acentos o espacios: ' + @collisions +
                        N'. El mapeo tolerante las uniria en silencio. Resuelvelas antes de migrar.';
                    THROW 50000, @message, 1;
                END
                """);

            // 2. Relleno tolerante: sin distinguir mayúsculas ni acentos, recortando espacios.
            //    Lo que no mapea queda nulo, y el texto original se conserva.
            migrationBuilder.Sql("""
                UPDATE p
                    SET p.IdJobPositionCatalogItem = c.IdBusinessCatalogItem
                    FROM dbo.Positions AS p
                    INNER JOIN dbo.BusinessCatalogItems AS c
                        ON c.IdOrganization = p.IdOrganization
                       AND c.Type = 'JobPosition'
                       AND c.Active = 1
                       AND LTRIM(RTRIM(c.Name)) COLLATE Latin1_General_100_CI_AI
                         = LTRIM(RTRIM(p.RequiredSkillProfile)) COLLATE Latin1_General_100_CI_AI
                    WHERE p.RequiredSkillProfile IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE e
                    SET e.IdJobPositionCatalogItem = c.IdBusinessCatalogItem
                    FROM dbo.Employees AS e
                    INNER JOIN dbo.BusinessCatalogItems AS c
                        ON c.IdOrganization = e.IdOrganization
                       AND c.Type = 'JobPosition'
                       AND c.Active = 1
                       AND LTRIM(RTRIM(c.Name)) COLLATE Latin1_General_100_CI_AI
                         = LTRIM(RTRIM(e.JobTitle)) COLLATE Latin1_General_100_CI_AI
                    WHERE e.JobTitle IS NOT NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Positions_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Positions",
                column: "IdJobPositionCatalogItem");

            migrationBuilder.CreateIndex(
                name: "IX_Positions_IdOrganization_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Positions",
                columns: new[] { "IdOrganization", "IdJobPositionCatalogItem" });

            migrationBuilder.CreateIndex(
                name: "IX_Employees_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Employees",
                column: "IdJobPositionCatalogItem");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_IdOrganization_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Employees",
                columns: new[] { "IdOrganization", "IdJobPositionCatalogItem" });

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_BusinessCatalogItems_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Employees",
                column: "IdJobPositionCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Positions_BusinessCatalogItems_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Positions",
                column: "IdJobPositionCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Employees_BusinessCatalogItems_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropForeignKey(
                name: "FK_Positions_BusinessCatalogItems_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_Positions_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_Positions_IdOrganization_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_Employees_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_IdOrganization_IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "IdJobPositionCatalogItem",
                schema: "dbo",
                table: "Employees");
        }
    }
}

#pragma warning restore CA1861
