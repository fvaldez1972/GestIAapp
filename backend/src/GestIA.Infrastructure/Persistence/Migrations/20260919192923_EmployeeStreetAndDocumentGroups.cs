using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EmployeeStreetAndDocumentGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Street",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StreetNumber",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            // ----------------------------------------------------------------------------------
            // Los datos. Dos cosas que no se parecen en nada salvo en que llegan juntas.
            // ----------------------------------------------------------------------------------
            migrationBuilder.Sql(@"
                -- 1. La calle sale del domicilio de una linea, SIN intentar partirlo.
                --
                -- Adivinar donde acaba el nombre de la vialidad y empieza el numero acierta en
                -- «Juarez 123» y falla en «Calzada de los 100 Metros 45». Un domicilio partido mal
                -- es peor que uno sin partir, porque parece correcto y nadie vuelve a revisarlo.
                -- El numero queda vacio a proposito: lo captura quien repase el expediente.
                UPDATE dbo.Employees
                SET Street = Address
                WHERE Street IS NULL AND Address IS NOT NULL AND LEN(LTRIM(RTRIM(Address))) > 0;

                -- 2. Las categorias de documento del personal, y a que grupo pertenece cada una.
                --
                -- Los grupos se siembran porque el documento de requerimientos los pide con
                -- ejemplos —Identidad, Fiscal— y porque un catalogo de dos niveles vacio en el
                -- nivel de arriba no se puede usar. Son un punto de partida editable: cualquier
                -- organizacion puede renombrarlos, desactivarlos o reagrupar sus tipos.
                DECLARE @Actor uniqueidentifier = '00000000-0000-0000-0000-000000000000';
                DECLARE @ActorName nvarchar(160) = N'Catalog migration';

                DECLARE @Grupos TABLE (Nombre nvarchar(160), DisplayOrder int);
                INSERT @Grupos (Nombre, DisplayOrder) VALUES
                    (N'Identidad', 1),
                    (N'Fiscal', 2),
                    (N'Seguridad social', 3),
                    (N'Domicilio', 4),
                    (N'Formacion', 5),
                    (N'Licencias y permisos', 6),
                    (N'Antecedentes', 7),
                    (N'Empleo', 8);

                INSERT dbo.BusinessCatalogItems
                    (IdBusinessCatalogItem, IdOrganization, Type, Name, Description, Active,
                     CreatedAt, CreatedBy, CreatedByName, DisplayOrder, IdParentCatalogItem, IsBlocking)
                SELECT NEWID(), o.IdOrganization, 'EmployeeDocumentGroup', g.Nombre, NULL, 1,
                       SYSUTCDATETIME(), @Actor, @ActorName, g.DisplayOrder, NULL, NULL
                FROM dbo.Organizations o
                CROSS JOIN @Grupos g
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.BusinessCatalogItems b
                    WHERE b.IdOrganization = o.IdOrganization
                      AND b.Type = 'EmployeeDocumentGroup'
                      AND b.Name = g.Nombre);

                DECLARE @Pertenencia TABLE (Tipo nvarchar(160), Grupo nvarchar(160));
                INSERT @Pertenencia (Tipo, Grupo) VALUES
                    (N'Acta de nacimiento', N'Identidad'),
                    (N'Acta de matrimonio', N'Identidad'),
                    (N'INE', N'Identidad'),
                    (N'CURP', N'Identidad'),
                    (N'RFC', N'Fiscal'),
                    (N'Constancia de situación fiscal', N'Fiscal'),
                    (N'NSS', N'Seguridad social'),
                    (N'Comprobante de domicilio', N'Domicilio'),
                    (N'Comprobante de estudios', N'Formacion'),
                    (N'Licencia de conducir', N'Licencias y permisos'),
                    (N'Cartilla militar', N'Licencias y permisos'),
                    (N'Constancia de antecedentes', N'Antecedentes'),
                    (N'Solicitud de empleo', N'Empleo'),
                    (N'Otro documento', N'Empleo');

                -- Solo los que todavia no tienen grupo: si alguien ya reagrupo a mano, se respeta.
                UPDATE tipo
                SET IdParentCatalogItem = grupo.IdBusinessCatalogItem
                FROM dbo.BusinessCatalogItems tipo
                JOIN @Pertenencia p ON p.Tipo = tipo.Name
                JOIN dbo.BusinessCatalogItems grupo
                    ON grupo.IdOrganization = tipo.IdOrganization
                   AND grupo.Type = 'EmployeeDocumentGroup'
                   AND grupo.Name = p.Grupo
                WHERE tipo.Type = 'EmployeeDocumentCategory'
                  AND tipo.IdParentCatalogItem IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Se suelta el grupo antes de retirarlo, o la llave foranea del propio catalogo lo
            // impediria. La calle no se borra: es dato capturado, y aqui nada se pierde por una
            // vuelta atras.
            migrationBuilder.Sql(@"
                UPDATE dbo.BusinessCatalogItems
                SET IdParentCatalogItem = NULL
                WHERE Type = 'EmployeeDocumentCategory' AND IdParentCatalogItem IS NOT NULL;

                DELETE FROM dbo.BusinessCatalogItems
                WHERE Type = 'EmployeeDocumentGroup' AND CreatedByName = N'Catalog migration';
            ");

            migrationBuilder.DropColumn(
                name: "Street",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "StreetNumber",
                schema: "dbo",
                table: "Employees");
        }
    }
}
