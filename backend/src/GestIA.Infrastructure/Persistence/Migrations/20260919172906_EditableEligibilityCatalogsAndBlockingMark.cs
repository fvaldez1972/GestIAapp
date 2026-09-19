using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EditableEligibilityCatalogsAndBlockingMark : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_EligibilityRequirements_RequirementByType",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.AddColumn<Guid>(
                name: "IdEvaluationCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeEvaluations",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdDocumentCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeDocuments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "IsBlocking",
                schema: "dbo",
                table: "EligibilityRequirements",
                type: "bit",
                nullable: true,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AddColumn<bool>(
                name: "IsBlocking",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "bit",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeEvaluations_IdEvaluationCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeEvaluations",
                column: "IdEvaluationCategoryCatalogItem",
                filter: "[IdEvaluationCategoryCatalogItem] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeDocuments_IdDocumentCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeDocuments",
                column: "IdDocumentCategoryCatalogItem",
                filter: "[IdDocumentCategoryCatalogItem] IS NOT NULL");


            // ----------------------------------------------------------------------------------
            // Los datos, y van AQUI a proposito: entre las columnas nuevas y la restriccion.
            //
            // La restriccion nueva exige que toda regla de documento o de evaluacion apunte a una
            // entrada del catalogo. Agregarla antes de rellenar habria fallado el mismo dia: en
            // db-gestia-dev hay nueve reglas de documento y cuatro de evaluacion, y ninguna tenia
            // ese identificador porque hasta hoy no existia a que apuntar.
            //
            // Todo lo de abajo es idempotente. Nada se borra: la conversion agrega identificadores
            // y deja los enums donde estaban.
            // ----------------------------------------------------------------------------------
            migrationBuilder.Sql(@"
                DECLARE @Actor uniqueidentifier = '00000000-0000-0000-0000-000000000000';
                DECLARE @ActorName nvarchar(160) = N'Catalog migration';

                -- Los valores que hasta hoy vivian en tres enums de C#. Se siembran por organizacion
                -- porque desde ahora cada una edita los suyos.
                DECLARE @Seed TABLE (Type varchar(40), EnumValue varchar(60), Name nvarchar(160), DisplayOrder int);
                INSERT @Seed (Type, EnumValue, Name, DisplayOrder) VALUES
                    ('EmployeeDocumentCategory','EmploymentApplication',N'Solicitud de empleo',1),
                    ('EmployeeDocumentCategory','BirthCertificate',N'Acta de nacimiento',2),
                    ('EmployeeDocumentCategory','MarriageCertificate',N'Acta de matrimonio',3),
                    ('EmployeeDocumentCategory','VoterId',N'INE',4),
                    ('EmployeeDocumentCategory','Curp',N'CURP',5),
                    ('EmployeeDocumentCategory','SocialSecurityNumber',N'NSS',6),
                    ('EmployeeDocumentCategory','Rfc',N'RFC',7),
                    ('EmployeeDocumentCategory','TaxStatusCertificate',N'Constancia de situación fiscal',8),
                    ('EmployeeDocumentCategory','DriverLicense',N'Licencia de conducir',9),
                    ('EmployeeDocumentCategory','ProofOfAddress',N'Comprobante de domicilio',10),
                    ('EmployeeDocumentCategory','ProofOfStudies',N'Comprobante de estudios',11),
                    ('EmployeeDocumentCategory','MilitaryServiceCard',N'Cartilla militar',12),
                    ('EmployeeDocumentCategory','CriminalRecordCertificate',N'Constancia de antecedentes',13),
                    ('EmployeeDocumentCategory','Other',N'Otro documento',14),
                    ('EmployeeEvaluationCategory','Polygraph',N'Polígrafo',1),
                    ('EmployeeEvaluationCategory','SocioeconomicStudy',N'Estudio socioeconómico',2),
                    ('EmployeeEvaluationCategory','CriminalRecordReview',N'Revisión de antecedentes',3),
                    ('EmployeeEvaluationCategory','DrugTest',N'Examen toxicológico',4),
                    ('EmployeeEvaluationCategory','Other',N'Otra evaluación',5),
                    ('ContactPurpose','Administrative',N'Administrativo',1),
                    ('ContactPurpose','Operational',N'Operativo',2),
                    ('ContactPurpose','Billing',N'Facturación',3),
                    ('ContactPurpose','Legal',N'Legal',4),
                    ('ContactPurpose','Emergency',N'Emergencia',5),
                    ('ContactPurpose','Payments',N'Pagos',6),
                    ('ContactPurpose','Purchasing',N'Compras',7),
                    ('ContactPurpose','InternalSecurity',N'Seguridad interna',8);

                -- IsBlocking se queda NULL a proposito. Nulo quiere decir «todavia no se ha
                -- decidido», y la severidad la siguen poniendo las reglas, que ya la traen
                -- explicita. Sembrar aqui un valor habria cambiado comportamiento el dia de la
                -- migracion, y esta migracion no cambia ninguno.
                INSERT dbo.BusinessCatalogItems
                    (IdBusinessCatalogItem, IdOrganization, Type, Name, Description, Active,
                     CreatedAt, CreatedBy, CreatedByName, DisplayOrder, IdParentCatalogItem, IsBlocking)
                SELECT NEWID(), o.IdOrganization, s.Type, s.Name, NULL, 1,
                       SYSUTCDATETIME(), @Actor, @ActorName, s.DisplayOrder, NULL, NULL
                FROM dbo.Organizations o
                CROSS JOIN @Seed s
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.BusinessCatalogItems b
                    WHERE b.IdOrganization = o.IdOrganization AND b.Type = s.Type AND b.Name = s.Name);

                -- Cada documento del personal queda apuntando a la entrada de su organizacion.
                UPDATE d
                SET IdDocumentCategoryCatalogItem = b.IdBusinessCatalogItem
                FROM dbo.EmployeeDocuments d
                JOIN @Seed s ON s.Type = 'EmployeeDocumentCategory' AND s.EnumValue = d.DocumentType
                JOIN dbo.BusinessCatalogItems b
                    ON b.IdOrganization = d.IdOrganization AND b.Type = s.Type AND b.Name = s.Name
                WHERE d.IdDocumentCategoryCatalogItem IS NULL;

                UPDATE e
                SET IdEvaluationCategoryCatalogItem = b.IdBusinessCatalogItem
                FROM dbo.EmployeeEvaluations e
                JOIN @Seed s ON s.Type = 'EmployeeEvaluationCategory' AND s.EnumValue = e.EvaluationType
                JOIN dbo.BusinessCatalogItems b
                    ON b.IdOrganization = e.IdOrganization AND b.Type = s.Type AND b.Name = s.Name
                WHERE e.IdEvaluationCategoryCatalogItem IS NULL;

                -- Y las reglas, que es lo que la restriccion va a exigir en cuanto se agregue.
                UPDATE r
                SET IdRequiredCatalogItem = b.IdBusinessCatalogItem
                FROM dbo.EligibilityRequirements r
                JOIN @Seed s ON s.Type = 'EmployeeDocumentCategory' AND s.EnumValue = r.RequiredDocumentType
                JOIN dbo.BusinessCatalogItems b
                    ON b.IdOrganization = r.IdOrganization AND b.Type = s.Type AND b.Name = s.Name
                WHERE r.RequirementType = 'Document' AND r.IdRequiredCatalogItem IS NULL;

                UPDATE r
                SET IdRequiredCatalogItem = b.IdBusinessCatalogItem
                FROM dbo.EligibilityRequirements r
                JOIN @Seed s ON s.Type = 'EmployeeEvaluationCategory' AND s.EnumValue = r.RequiredEvaluationType
                JOIN dbo.BusinessCatalogItems b
                    ON b.IdOrganization = r.IdOrganization AND b.Type = s.Type AND b.Name = s.Name
                WHERE r.RequirementType = 'Evaluation' AND r.IdRequiredCatalogItem IS NULL;

                -- Si algo quedo sin emparejar, la restriccion de abajo fallaria con un mensaje que
                -- nombra una restriccion y no el problema. Mejor fallar aqui diciendo que pasa.
                IF EXISTS (
                    SELECT 1 FROM dbo.EligibilityRequirements
                    WHERE RequirementType IN ('Skill','Document','Evaluation') AND IdRequiredCatalogItem IS NULL)
                    THROW 50019, N'Quedaron reglas de elegibilidad sin entrada de catalogo; revisa RequiredDocumentType y RequiredEvaluationType antes de reintentar.', 1;
            ");

            migrationBuilder.AddCheckConstraint(
                name: "CK_EligibilityRequirements_RequirementByType",
                schema: "dbo",
                table: "EligibilityRequirements",
                sql: "(RequirementType IN ('Skill', 'Document', 'Evaluation') AND IdRequiredCatalogItem IS NOT NULL) OR (RequirementType = 'Restriction' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeDocuments_BusinessCatalogItems_IdDocumentCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeDocuments",
                column: "IdDocumentCategoryCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_EmployeeEvaluations_BusinessCatalogItems_IdEvaluationCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeEvaluations",
                column: "IdEvaluationCategoryCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeDocuments_BusinessCatalogItems_IdDocumentCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeDocuments");

            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeEvaluations_BusinessCatalogItems_IdEvaluationCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeEvaluations");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeEvaluations_IdEvaluationCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeEvaluations");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeDocuments_IdDocumentCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeDocuments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_EligibilityRequirements_RequirementByType",
                schema: "dbo",
                table: "EligibilityRequirements");

            migrationBuilder.DropColumn(
                name: "IdEvaluationCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeEvaluations");

            migrationBuilder.DropColumn(
                name: "IdDocumentCategoryCatalogItem",
                schema: "dbo",
                table: "EmployeeDocuments");

            migrationBuilder.DropColumn(
                name: "IsBlocking",
                schema: "dbo",
                table: "BusinessCatalogItems");

            // Ojo con este defaultValue, que EF genera y aqui SI cambia significado: al volver atras,
            // toda regla que estuviera heredando su severidad del catalogo pasa a decir «informativa»
            // de forma explicita. Es la unica traduccion posible hacia una columna que no admite
            // nulos, y se deja escrita para que quien haga la vuelta atras sepa lo que pierde.
            migrationBuilder.AlterColumn<bool>(
                name: "IsBlocking",
                schema: "dbo",
                table: "EligibilityRequirements",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldNullable: true);

            // La restriccion estricta que vuelve exige que las reglas de documento y evaluacion NO
            // tengan entrada de catalogo, asi que hay que soltarla antes de volver a ponerla. Y lo
            // sembrado se retira, que para eso es una vuelta atras.
            migrationBuilder.Sql(@"
                UPDATE dbo.EligibilityRequirements
                SET IdRequiredCatalogItem = NULL
                WHERE RequirementType IN ('Document','Evaluation');

                DELETE FROM dbo.BusinessCatalogItems
                WHERE Type IN ('EmployeeDocumentCategory','EmployeeEvaluationCategory','ContactPurpose')
                  AND CreatedByName = N'Catalog migration';
            ");

            migrationBuilder.AddCheckConstraint(
                name: "CK_EligibilityRequirements_RequirementByType",
                schema: "dbo",
                table: "EligibilityRequirements",
                sql: "(RequirementType = 'Skill' AND IdRequiredCatalogItem IS NOT NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NULL) OR (RequirementType = 'Document' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NOT NULL AND RequiredEvaluationType IS NULL) OR (RequirementType = 'Evaluation' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NOT NULL) OR (RequirementType = 'Restriction' AND IdRequiredCatalogItem IS NULL AND RequiredDocumentType IS NULL AND RequiredEvaluationType IS NULL)");
        }
    }
}
