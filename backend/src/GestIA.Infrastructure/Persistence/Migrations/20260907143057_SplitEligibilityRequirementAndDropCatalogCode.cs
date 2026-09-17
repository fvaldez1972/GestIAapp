using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF Core genera arreglos locales para indices compuestos.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// El código se retira del catálogo, y el requisito de elegibilidad se parte en tres.
    ///
    /// <para><b>EF la generó al revés y hubo que reescribirla entera.</b> Puso los <c>DropColumn</c>
    /// de <c>RequiredCode</c> y <c>Code</c> <i>antes</i> de agregar las columnas nuevas, así que no
    /// habría quedado nada de donde migrar el dato: las siete reglas existentes habrían salido con
    /// los tres campos vacíos y la restricción las habría rechazado. Aquí el orden es agregar,
    /// rellenar, comprobar y sólo entonces borrar.</para>
    ///
    /// <para><b>Por qué tres columnas y no una.</b> <c>RequiredCode</c> guardaba tres cosas
    /// distintas según el tipo de regla: para una de habilidad, el código de una fila del catálogo;
    /// para una de documento o de evaluación, <b>el nombre de un enum de C#</b>. Al retirarse el
    /// código, la primera se quedó sin a qué apuntar y las otras dos nunca habían apuntado a un
    /// catálogo.</para>
    ///
    /// <para><b>La regla del relleno: lo que no mapea no se inventa ni se borra.</b> Si al terminar
    /// queda una sola regla sin decir qué exige, la migración se detiene y no toca nada más. Aflojar
    /// un control de elegibilidad en silencio es peor que no migrar.</para>
    /// </summary>
    public partial class SplitEligibilityRequirementAndDropCatalogCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. Las columnas nuevas, nulables ────────────────────────────────────────────
            migrationBuilder.AddColumn<Guid>(
                name: "IdRequiredCatalogItem",
                schema: "dbo",
                table: "EligibilityRequirements",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequiredDocumentType",
                schema: "dbo",
                table: "EligibilityRequirements",
                type: "varchar(60)",
                unicode: false,
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequiredEvaluationType",
                schema: "dbo",
                table: "EligibilityRequirements",
                type: "varchar(60)",
                unicode: false,
                maxLength: 60,
                nullable: true);

            // ── 2. Las reglas de habilidad: del codigo del catalogo a su identificador ──────
            //
            // Por (organizacion, tipo, codigo), que es exactamente la clave unica que esta
            // migracion va a retirar. Es la ultima vez que se usa.
            migrationBuilder.Sql(@"
UPDATE r
SET r.IdRequiredCatalogItem = c.IdBusinessCatalogItem
FROM dbo.EligibilityRequirements r
JOIN dbo.BusinessCatalogItems c
  ON c.IdOrganization = r.IdOrganization
 AND c.Type = 'Skill'
 AND c.Code = r.RequiredCode
WHERE r.RequirementType = 'Skill';");

            // ── 3. Documento y evaluacion: del nombre en mayusculas al valor del enum ───────
            //
            // El nombre viajaba en mayusculas porque la entidad lo normalizaba asi; el enum se
            // guarda con su nombre tal cual. La correspondencia va escrita a mano, valor por valor,
            // para que un nombre que no exista quede en NULL y lo detecte el paso 4 en vez de
            // colarse convertido en otra cosa.
            migrationBuilder.Sql(@"
UPDATE dbo.EligibilityRequirements
SET RequiredDocumentType = CASE UPPER(RequiredCode)
        WHEN 'EMPLOYMENTAPPLICATION' THEN 'EmploymentApplication'
        WHEN 'BIRTHCERTIFICATE' THEN 'BirthCertificate'
        WHEN 'MARRIAGECERTIFICATE' THEN 'MarriageCertificate'
        WHEN 'VOTERID' THEN 'VoterId'
        WHEN 'CURP' THEN 'Curp'
        WHEN 'SOCIALSECURITYNUMBER' THEN 'SocialSecurityNumber'
        WHEN 'RFC' THEN 'Rfc'
        WHEN 'TAXSTATUSCERTIFICATE' THEN 'TaxStatusCertificate'
        WHEN 'DRIVERLICENSE' THEN 'DriverLicense'
        WHEN 'PROOFOFADDRESS' THEN 'ProofOfAddress'
        WHEN 'PROOFOFSTUDIES' THEN 'ProofOfStudies'
        WHEN 'MILITARYSERVICECARD' THEN 'MilitaryServiceCard'
        WHEN 'CRIMINALRECORDCERTIFICATE' THEN 'CriminalRecordCertificate'
        WHEN 'OTHER' THEN 'Other'
    END
WHERE RequirementType = 'Document';");

            migrationBuilder.Sql(@"
UPDATE dbo.EligibilityRequirements
SET RequiredEvaluationType = CASE UPPER(RequiredCode)
        WHEN 'POLYGRAPH' THEN 'Polygraph'
        WHEN 'SOCIOECONOMICSTUDY' THEN 'SocioeconomicStudy'
        WHEN 'CRIMINALRECORDREVIEW' THEN 'CriminalRecordReview'
        WHEN 'DRUGTEST' THEN 'DrugTest'
        WHEN 'OTHER' THEN 'Other'
    END
WHERE RequirementType = 'Evaluation';");

            // ── 4. La comprobacion, antes de borrar nada ────────────────────────────────────
            //
            // Se detiene y nombra las reglas que no mapearon. Desactivarlas afloja un control de
            // elegibilidad, y eso no se hace sin que alguien lo decida.
            migrationBuilder.Sql(@"
DECLARE @huerfanas nvarchar(max);
SELECT @huerfanas = STRING_AGG(CONVERT(nvarchar(max), Name) + N' (' + CONVERT(nvarchar(max), RequirementType) + N': ' + CONVERT(nvarchar(max), RequiredCode) + N')', N'; ')
FROM dbo.EligibilityRequirements
WHERE (RequirementType = 'Skill'      AND IdRequiredCatalogItem IS NULL)
   OR (RequirementType = 'Document'   AND RequiredDocumentType IS NULL)
   OR (RequirementType = 'Evaluation' AND RequiredEvaluationType IS NULL);
IF @huerfanas IS NOT NULL
BEGIN
    DECLARE @mensaje nvarchar(2048) = N'Hay reglas de elegibilidad que no se pudieron migrar y la migracion se detiene sin tocar nada mas: '
        + LEFT(@huerfanas, 1500)
        + N'. Resuelvelas antes de reintentar: desactivarlas afloja un control y esa decision no es de la migracion.';
    THROW 50000, @mensaje, 1;
END;");

            // ── 5. Y las restricciones: las de tipo Restriction no exigen nada ──────────────
            migrationBuilder.Sql(@"
UPDATE dbo.EligibilityRequirements
SET IdRequiredCatalogItem = NULL, RequiredDocumentType = NULL, RequiredEvaluationType = NULL
WHERE RequirementType = 'Restriction';");

            // ── 6. Ahora si, fuera lo viejo ─────────────────────────────────────────────────
            migrationBuilder.DropIndex(
                name: "IX_EligibilityRequirements_IdOrganization_TargetType_RequirementType_RequiredCode",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.DropIndex(
                name: "UX_BusinessCatalogItems_IdOrganization_Type_Code",
                schema: "dbo",
                table: "BusinessCatalogItems");

            migrationBuilder.DropColumn(
                name: "RequiredCode",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.DropColumn(
                name: "Code",
                schema: "dbo",
                table: "BusinessCatalogItems");

            // ── 7. Los indices y la restriccion nuevos ──────────────────────────────────────
            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRequirements_IdOrganization_TargetType_RequirementType",
                schema: "dbo",
                table: "EligibilityRequirements",
                columns: new[] { "IdOrganization", "TargetType", "RequirementType" });

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRequirements_IdRequiredCatalogItem",
                schema: "dbo",
                table: "EligibilityRequirements",
                column: "IdRequiredCatalogItem");

            migrationBuilder.AddCheckConstraint(
                name: "CK_EligibilityRequirements_RequirementByType",
                schema: "dbo",
                table: "EligibilityRequirements",
                sql: "(RequirementType = 'Skill' AND IdRequiredCatalogItem IS NOT NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NULL) OR (RequirementType = 'Document' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NOT NULL AND RequiredEvaluationType IS NULL) OR (RequirementType = 'Evaluation' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NOT NULL) OR (RequirementType = 'Restriction' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_EligibilityRequirements_BusinessCatalogItems_IdRequiredCatalogItem",
                schema: "dbo",
                table: "EligibilityRequirements",
                column: "IdRequiredCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);
        }

        /// <summary>
        /// La vuelta atrás devuelve la forma, no el dato.
        ///
        /// <para>Los códigos del catálogo no se pueden reconstruir: eran cadenas que el usuario
        /// tecleó y que esta migración retira a propósito. Volver deja <c>Code</c> y
        /// <c>RequiredCode</c> vacíos, y quien vuelva tiene que restaurar de un respaldo si necesita
        /// los valores. Se dice aquí para que nadie confunda revertir con deshacer.</para>
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EligibilityRequirements_BusinessCatalogItems_IdRequiredCatalogItem",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.DropCheckConstraint(
                name: "CK_EligibilityRequirements_RequirementByType",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.DropIndex(
                name: "IX_EligibilityRequirements_IdRequiredCatalogItem",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.DropIndex(
                name: "IX_EligibilityRequirements_IdOrganization_TargetType_RequirementType",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.AddColumn<string>(
                name: "Code",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "varchar(80)",
                unicode: false,
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RequiredCode",
                schema: "dbo",
                table: "EligibilityRequirements",
                type: "varchar(80)",
                unicode: false,
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.DropColumn(
                name: "RequiredEvaluationType",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.DropColumn(
                name: "RequiredDocumentType",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.DropColumn(
                name: "IdRequiredCatalogItem",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.CreateIndex(
                name: "UX_BusinessCatalogItems_IdOrganization_Type_Code",
                schema: "dbo",
                table: "BusinessCatalogItems",
                columns: new[] { "IdOrganization", "Type", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EligibilityRequirements_IdOrganization_TargetType_RequirementType_RequiredCode",
                schema: "dbo",
                table: "EligibilityRequirements",
                columns: new[] { "IdOrganization", "TargetType", "RequirementType", "RequiredCode" });
        }
    }
}
