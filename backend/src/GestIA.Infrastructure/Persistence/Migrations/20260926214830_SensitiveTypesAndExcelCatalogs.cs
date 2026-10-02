using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1861 // EF Core genera arreglos locales.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SensitiveTypesAndExcelCatalogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSensitive",
                schema: "dbo",
                table: "BusinessCatalogItems",
                type: "bit",
                nullable: true);

            migrationBuilder.Sql(DatosDelBloque);
        }

        /// <summary>
        /// Tres cargas de datos, todas por nombre y todas idempotentes.
        ///
        /// <para><b>La sensibilidad inicial</b> sale de la columna «Sensible (DOCUMENTOS)» del Excel de
        /// CPPS. El Excel nombra ademas las areas que pueden ver cada papel —Capital Humano,
        /// Administracion, Nominas—, que es mas fino que un si o un no; aqui entra como booleano,
        /// porque es lo que el modelo tiene.</para>
        ///
        /// <para><b>Los catalogos del Excel</b> se insertan solo donde faltan, para cada organizacion
        /// viva. Nada se renombra ni se desactiva: lo que la organizacion ya tenia se queda.</para>
        ///
        /// <para><b>Los tipos permanentes</b> dejan de manejar vigencia, por decision del 26 de
        /// septiembre de 2026: acta de nacimiento, CURP, RFC, NSS y cartilla militar. INE y licencia si
        /// la manejan.</para>
        /// </summary>
        private const string DatosDelBloque = """
            SET NOCOUNT ON;

            -- 1. Sensibilidad por tipo de documento, desde el Excel.
            UPDATE dbo.BusinessCatalogItems
            SET IsSensitive = 0
            WHERE Type IN (N'EmployeeDocumentCategory', N'ClientDocumentCategory')
              AND IsSensitive IS NULL;

            UPDATE dbo.BusinessCatalogItems
            SET IsSensitive = 1
            WHERE Type = N'EmployeeDocumentCategory'
              AND Name IN (N'Acta de nacimiento', N'INE', N'CURP', N'Constancia de situación fiscal',
                           N'NSS', N'RFC', N'Alta de IMSS', N'Acta de matrimonio');

            -- Los documentos ya guardados heredan la marca de su tipo.
            UPDATE documento
            SET IsSensitive = tipo.IsSensitive
            FROM dbo.EmployeeDocuments AS documento
            INNER JOIN dbo.BusinessCatalogItems AS tipo
                ON tipo.IdBusinessCatalogItem = documento.IdDocumentCategoryCatalogItem
            WHERE tipo.IsSensitive IS NOT NULL
              AND documento.IsSensitive <> tipo.IsSensitive;

            -- 2. Los tipos permanentes dejan de manejar vigencia.
            UPDATE dbo.BusinessCatalogItems
            SET HasOwnExpiry = 0
            WHERE Type = N'EmployeeDocumentCategory'
              AND Name IN (N'Acta de nacimiento', N'CURP', N'RFC', N'NSS', N'Cartilla militar');

            UPDATE dbo.BusinessCatalogItems
            SET HasOwnExpiry = 1
            WHERE Type = N'EmployeeDocumentCategory'
              AND Name IN (N'INE', N'Licencia de conducir');

            -- 3. Los catalogos del Excel, en cada organizacion que no los tenga.
            DECLARE @Nuevos TABLE (Tipo nvarchar(60), Nombre nvarchar(200), Orden int, Obligatorio bit);

            INSERT INTO @Nuevos (Tipo, Nombre, Orden, Obligatorio) VALUES
                (N'JobPosition', N'Gerencia de operaciones', 20, NULL),
                (N'JobPosition', N'Coordinación de operaciones', 21, NULL),
                (N'JobPosition', N'Supervisor', 22, NULL),
                (N'JobPosition', N'Patrullero', 23, NULL),
                (N'JobPosition', N'Trasladista', 24, NULL),
                (N'JobPosition', N'Jefe de servicio', 25, NULL),
                (N'JobPosition', N'Jefe de turno', 26, NULL),
                (N'Skill', N'Llevar controles de entradas y salidas de mercancía', 20, 0),
                (N'Skill', N'Control de entradas y salidas de personas y vehículos', 21, 0),
                (N'Skill', N'Uso y manejo de teléfonos, radios y reportes escritos', 22, 0),
                (N'Skill', N'Manejo de circuito cerrado de televisión', 23, 0),
                (N'Skill', N'Elaboración de reportes y bitácoras de control', 24, 0),
                (N'Skill', N'Detección de condiciones y acciones inseguras', 25, 0),
                (N'Skill', N'Detección de situaciones de riesgo externas', 26, 0),
                (N'Skill', N'Disciplina', 27, 0),
                (N'Skill', N'Honestidad', 28, 0),
                (N'Skill', N'Responsabilidad', 29, 0),
                (N'Skill', N'Pulcritud', 30, 0),
                (N'Skill', N'Seguimiento de instrucciones', 31, 0),
                (N'Skill', N'Puntualidad', 32, 0),
                (N'Skill', N'Comunicación asertiva', 33, 0),
                (N'EmployeeEvaluationCategory', N'Antidoping', 20, 1),
                (N'EmployeeEvaluationCategory', N'Prueba poligráfica a petición del cliente', 21, 0),
                (N'EmployeeEvaluationCategory', N'Antecedentes laborales', 22, 0),
                (N'EmployeeEvaluationCategory', N'Antecedentes penales a petición del cliente', 23, 0),
                (N'IncidentReason', N'Ausentismo', 20, NULL),
                (N'IncidentReason', N'Retardo', 21, NULL),
                (N'IncidentReason', N'Permiso', 22, NULL),
                (N'IncidentReason', N'Incapacidad', 23, NULL),
                (N'IncidentReason', N'Paternidad', 24, NULL),
                (N'IncidentReason', N'Maternidad', 25, NULL),
                (N'IncidentReason', N'Vacaciones', 26, NULL),
                (N'EmployeeDocumentCategory', N'Cartas de recomendación de empleos anteriores', 20, 0),
                (N'EmployeeDocumentCategory', N'Alta de IMSS', 21, 0),
                (N'EmployeeDocumentCategory', N'Currículum', 22, 0),
                (N'ClientDocumentCategory', N'Constancia de situación fiscal', 20, NULL),
                (N'ClientDocumentCategory', N'Acta constitutiva', 21, NULL),
                (N'ClientDocumentCategory', N'Comprobante de domicilio', 22, NULL);

            INSERT INTO dbo.BusinessCatalogItems
                (IdBusinessCatalogItem, IdOrganization, Type, Name, DisplayOrder, IsRequired,
                 IsExpiredOnTermination, HasOwnExpiry, IsSensitive,
                 Active, CreatedAt, CreatedBy, CreatedByName)
            SELECT
                NEWID(),
                o.IdOrganization,
                n.Tipo,
                n.Nombre,
                n.Orden,
                n.Obligatorio,
                CASE WHEN n.Tipo IN (N'EmployeeDocumentCategory', N'EmployeeEvaluationCategory')
                     THEN CASE WHEN n.Nombre = N'Antidoping' THEN 1 ELSE 0 END END,
                CASE WHEN n.Tipo IN (N'EmployeeDocumentCategory', N'EmployeeEvaluationCategory')
                     THEN 1 END,
                CASE WHEN n.Tipo IN (N'EmployeeDocumentCategory', N'ClientDocumentCategory')
                     THEN CASE WHEN n.Nombre = N'Alta de IMSS' THEN 1 ELSE 0 END END,
                1,
                SYSUTCDATETIME(),
                CONVERT(uniqueidentifier, '00000000-0000-0000-0000-000000000000'),
                N'Catalogos del Excel CPPS'
            FROM dbo.Organizations AS o
            CROSS JOIN @Nuevos AS n
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.BusinessCatalogItems AS existente
                WHERE existente.IdOrganization = o.IdOrganization
                  AND existente.Type = n.Tipo
                  AND existente.Name = n.Nombre);
            """;


        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSensitive",
                schema: "dbo",
                table: "BusinessCatalogItems");
        }
    }
}

#pragma warning restore CA1861
