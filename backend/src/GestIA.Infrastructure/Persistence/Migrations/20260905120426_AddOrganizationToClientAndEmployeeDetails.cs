using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1861 // EF Core generates inline arrays for migration index definitions.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Denormaliza <c>IdOrganization</c> en las cinco entidades que llegaban a su organización por
    /// el padre: sedes y contactos por el cliente, documentos, evaluaciones y habilidades por el
    /// empleado.
    ///
    /// <para><b>Esta migración fue reescrita a mano.</b> EF la generó con
    /// <c>nullable: false, defaultValue: Guid.Empty</c>, que habría llenado en silencio todas las
    /// filas existentes con un identificador de ceros: sin error, sin aviso, y con el filtro global
    /// devolviendo cero filas para siempre. El patrón correcto es el de la tanda A —columna
    /// nulable, relleno por JOIN al padre, guarda, y sólo entonces NOT NULL— y es el que sigue.</para>
    /// </summary>
    /// <inheritdoc />
    public partial class AddOrganizationToClientAndEmployeeDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Las cinco columnas nacen NULABLES. Nada se rellena con un valor inventado.
            foreach (var table in new[]
                     {
                         "ClientSites", "ClientContacts",
                         "EmployeeDocuments", "EmployeeEvaluations", "EmployeeSkills"
                     })
            {
                migrationBuilder.AddColumn<Guid>(
                    name: "IdOrganization",
                    schema: "dbo",
                    table: table,
                    type: "uniqueidentifier",
                    nullable: true);
            }

            // 2. Relleno desde el padre. Las cinco cuelgan directo de Clients o Employees, así que
            //    no hay cadena que respetar; el orden es sólo de lectura.
            migrationBuilder.Sql("""
                UPDATE child
                    SET child.IdOrganization = parent.IdOrganization
                    FROM dbo.ClientSites AS child
                    INNER JOIN dbo.Clients AS parent ON parent.IdClient = child.IdClient;
                """);

            migrationBuilder.Sql("""
                UPDATE child
                    SET child.IdOrganization = parent.IdOrganization
                    FROM dbo.ClientContacts AS child
                    INNER JOIN dbo.Clients AS parent ON parent.IdClient = child.IdClient;
                """);

            migrationBuilder.Sql("""
                UPDATE child
                    SET child.IdOrganization = parent.IdOrganization
                    FROM dbo.EmployeeDocuments AS child
                    INNER JOIN dbo.Employees AS parent ON parent.IdEmployee = child.IdEmployee;
                """);

            migrationBuilder.Sql("""
                UPDATE child
                    SET child.IdOrganization = parent.IdOrganization
                    FROM dbo.EmployeeEvaluations AS child
                    INNER JOIN dbo.Employees AS parent ON parent.IdEmployee = child.IdEmployee;
                """);

            migrationBuilder.Sql("""
                UPDATE child
                    SET child.IdOrganization = parent.IdOrganization
                    FROM dbo.EmployeeSkills AS child
                    INNER JOIN dbo.Employees AS parent ON parent.IdEmployee = child.IdEmployee;
                """);

            // 3. La guarda. Si una fila quedó sin organización es porque su padre no existe, y eso
            //    es un dato roto que hay que mirar, no completar con un valor cualquiera. El
            //    mensaje nombra la tabla para no tener que buscarla.
            migrationBuilder.Sql("""
                DECLARE @orphans nvarchar(400) = STUFF((
                    SELECT ', ' + t.name + ' (' + CAST(t.n AS nvarchar(20)) + ')'
                    FROM (
                        SELECT 'ClientSites' AS name, COUNT(*) AS n FROM dbo.ClientSites WHERE IdOrganization IS NULL
                        UNION ALL SELECT 'ClientContacts', COUNT(*) FROM dbo.ClientContacts WHERE IdOrganization IS NULL
                        UNION ALL SELECT 'EmployeeDocuments', COUNT(*) FROM dbo.EmployeeDocuments WHERE IdOrganization IS NULL
                        UNION ALL SELECT 'EmployeeEvaluations', COUNT(*) FROM dbo.EmployeeEvaluations WHERE IdOrganization IS NULL
                        UNION ALL SELECT 'EmployeeSkills', COUNT(*) FROM dbo.EmployeeSkills WHERE IdOrganization IS NULL
                    ) AS t
                    WHERE t.n > 0
                    FOR XML PATH(''), TYPE).value('.', 'nvarchar(400)'), 1, 2, '');

                IF @orphans IS NOT NULL
                BEGIN
                    DECLARE @message nvarchar(600) =
                        N'Quedaron filas sin organizacion tras el relleno: ' + @orphans +
                        N'. Su registro padre no existe. Corrige esos datos antes de reintentar.';
                    THROW 50000, @message, 1;
                END
                """);

            // 4. Sólo con las cinco tablas completas: NOT NULL, índice y llave foránea.
            foreach (var table in new[]
                     {
                         "ClientSites", "ClientContacts",
                         "EmployeeDocuments", "EmployeeEvaluations", "EmployeeSkills"
                     })
            {
                migrationBuilder.AlterColumn<Guid>(
                    name: "IdOrganization",
                    schema: "dbo",
                    table: table,
                    type: "uniqueidentifier",
                    nullable: false,
                    oldClrType: typeof(Guid),
                    oldType: "uniqueidentifier",
                    oldNullable: true);
            }

            migrationBuilder.CreateIndex(
                name: "IX_ClientSites_IdOrganization_CodeClientSite",
                schema: "dbo",
                table: "ClientSites",
                columns: new[] { "IdOrganization", "CodeClientSite" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientContacts_IdOrganization_Purpose",
                schema: "dbo",
                table: "ClientContacts",
                columns: new[] { "IdOrganization", "Purpose" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeDocuments_IdOrganization_DocumentType",
                schema: "dbo",
                table: "EmployeeDocuments",
                columns: new[] { "IdOrganization", "DocumentType" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeEvaluations_IdOrganization_EvaluationType",
                schema: "dbo",
                table: "EmployeeEvaluations",
                columns: new[] { "IdOrganization", "EvaluationType" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeSkills_IdOrganization_IdSkillCatalogItem",
                schema: "dbo",
                table: "EmployeeSkills",
                columns: new[] { "IdOrganization", "IdSkillCatalogItem" });

            foreach (var table in new[]
                     {
                         "ClientSites", "ClientContacts",
                         "EmployeeDocuments", "EmployeeEvaluations", "EmployeeSkills"
                     })
            {
                migrationBuilder.AddForeignKey(
                    name: $"FK_{table}_Organizations_IdOrganization",
                    schema: "dbo",
                    table: table,
                    column: "IdOrganization",
                    principalSchema: "dbo",
                    principalTable: "Organizations",
                    principalColumn: "IdOrganization",
                    onDelete: ReferentialAction.Restrict);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in new[]
                     {
                         "ClientSites", "ClientContacts",
                         "EmployeeDocuments", "EmployeeEvaluations", "EmployeeSkills"
                     })
            {
                migrationBuilder.DropForeignKey(
                    name: $"FK_{table}_Organizations_IdOrganization",
                    schema: "dbo",
                    table: table);
            }

            migrationBuilder.DropIndex(
                name: "IX_ClientSites_IdOrganization_CodeClientSite",
                schema: "dbo",
                table: "ClientSites");

            migrationBuilder.DropIndex(
                name: "IX_ClientContacts_IdOrganization_Purpose",
                schema: "dbo",
                table: "ClientContacts");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeDocuments_IdOrganization_DocumentType",
                schema: "dbo",
                table: "EmployeeDocuments");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeEvaluations_IdOrganization_EvaluationType",
                schema: "dbo",
                table: "EmployeeEvaluations");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeSkills_IdOrganization_IdSkillCatalogItem",
                schema: "dbo",
                table: "EmployeeSkills");

            foreach (var table in new[]
                     {
                         "ClientSites", "ClientContacts",
                         "EmployeeDocuments", "EmployeeEvaluations", "EmployeeSkills"
                     })
            {
                migrationBuilder.DropColumn(
                    name: "IdOrganization",
                    schema: "dbo",
                    table: table);
            }
        }
    }
}

#pragma warning restore CA1861
