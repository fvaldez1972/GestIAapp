using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Los tres pasos que no esperan a nadie, en una sola migración y en este orden.
    ///
    /// <para><b>1. Los cinco catálogos de perfil, sembrados.</b> Sexo, rango de edad, escolaridad,
    /// equipo requerido y motivos de incidencia administrativa se construyeron entre el 18 y el 19
    /// de septiembre de 2026 y quedaron <b>vacíos en las ocho organizaciones</b>: existían el tipo,
    /// la pantalla y los endpoints, y no había un solo valor que elegir. Va primero porque sin
    /// valores sembrados los dos pasos siguientes no se pueden ni capturar.</para>
    ///
    /// <para><b>2. La vigencia de la posición.</b> La tabla no tenía ninguna fecha de negocio: la
    /// única vigencia era la del servicio, que es otra cosa. Un servicio que corre todo el año
    /// puede tener un puesto de refuerzo de octubre a diciembre, y eso no se podía expresar.</para>
    ///
    /// <para><b>3. La escolaridad de la persona.</b> La posición ya declaraba la que pide; el
    /// expediente no tenía dónde guardar la que se tiene, así que no había nada que comparar.</para>
    ///
    /// <para><b>Sobre el <c>defaultValue</c> en columnas obligatorias.</b> La migración generada
    /// traía <c>StartDate</c> con <c>defaultValue: new DateOnly(1, 1, 1)</c>, que habría puesto el
    /// año 1 en las 69 posiciones existentes. Es la <b>sexta</b> vez que aparece en este proyecto.
    /// Se resuelve como las anteriores: la columna nace nulable, se rellena con un dato real —la
    /// vigencia del servicio al que pertenece el puesto, que es la que tenía implícitamente— y sólo
    /// entonces pasa a obligatoria. La restricción de coherencia se agrega <b>después</b> del
    /// relleno, porque sobre filas a medio llenar fallaría.</para>
    /// </summary>
    public partial class ProfileCatalogsPositionValidityAndEducation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Paso 1 · Los cinco catálogos vacíos ────────────────────────────────────────────
            //
            // Va primero, y no es orden estético: la vigencia y la escolaridad se capturan desde
            // pantallas que eligen de estos catálogos. Sembrarlos al final dejaria una ventana en
            // la que las columnas existen y no hay con que llenarlas.
            migrationBuilder.Sql(@"
                DECLARE @Actor uniqueidentifier = '00000000-0000-0000-0000-000000000000';
                DECLARE @ActorName nvarchar(160) = N'Catalog migration';

                DECLARE @Perfil TABLE (
                    Tipo nvarchar(80),
                    Nombre nvarchar(160),
                    DisplayOrder int,
                    IsBlocking bit);

                INSERT @Perfil (Tipo, Nombre, DisplayOrder, IsBlocking) VALUES
                    -- Sexo. Lleva «Indistinto» porque describe lo que el cliente contrato y no a
                    -- una persona: un puesto que admite a cualquiera tiene que poder decirlo.
                    (N'Sex', N'Masculino', 1, NULL),
                    (N'Sex', N'Femenino', 2, NULL),
                    (N'Sex', N'Indistinto', 3, NULL),

                    -- Rangos de edad, con los tramos del documento de requerimientos. Son nombres y
                    -- no numeros: el catalogo no guarda minimo ni maximo, asi que hoy sirven para
                    -- declarar lo que el cliente pide y no para compararlo contra la edad de nadie.
                    (N'AgeRange', N'18 a 30 años', 1, NULL),
                    (N'AgeRange', N'31 a 50 años', 2, NULL),
                    (N'AgeRange', N'51 a 60 años', 3, NULL),
                    (N'AgeRange', N'Indistinto', 4, NULL),

                    -- Escolaridad, en el orden del sistema educativo mexicano. El orden importa mas
                    -- que en otros catalogos: cuando se decida si la comparacion es «igual a» o
                    -- «igual o superior a», es esta columna la que dice que significa «superior».
                    (N'EducationLevel', N'Sin estudios', 1, NULL),
                    (N'EducationLevel', N'Primaria', 2, NULL),
                    (N'EducationLevel', N'Secundaria', 3, NULL),
                    (N'EducationLevel', N'Bachillerato', 4, NULL),
                    (N'EducationLevel', N'Carrera técnica', 5, NULL),
                    (N'EducationLevel', N'Licenciatura', 6, NULL),
                    (N'EducationLevel', N'Posgrado', 7, NULL),

                    -- Equipo requerido por la posicion: lo que el puesto exige, no lo que la
                    -- empresa entrega. De donde sale que la persona lo tiene sigue sin definirse.
                    (N'RequiredEquipment', N'Radio de comunicación', 1, NULL),
                    (N'RequiredEquipment', N'Teléfono celular', 2, NULL),
                    (N'RequiredEquipment', N'Uniforme completo', 3, NULL),
                    (N'RequiredEquipment', N'Calzado de seguridad', 4, NULL),
                    (N'RequiredEquipment', N'Lámpara de mano', 5, NULL),
                    (N'RequiredEquipment', N'Chaleco reflejante', 6, NULL),
                    (N'RequiredEquipment', N'Fornitura', 7, NULL),
                    (N'RequiredEquipment', N'Vehículo propio', 8, NULL),
                    (N'RequiredEquipment', N'Licencia de conducir vigente', 9, NULL),

                    -- Incidencias administrativas: los unicos de los cinco que llevan marca de
                    -- bloqueo. Solo dos nacen bloqueando, porque abandonar el puesto y estar
                    -- suspendido impiden volver a asignar hasta que alguien los retire. Los demas
                    -- dejan constancia sin detener la operacion, y quien responda por ella puede
                    -- cambiar cualquiera de las dos marcas.
                    (N'AdministrativeIncidentType', N'Abandono de puesto', 1, 1),
                    (N'AdministrativeIncidentType', N'Suspensión vigente', 2, 1),
                    (N'AdministrativeIncidentType', N'Falta injustificada', 3, 0),
                    (N'AdministrativeIncidentType', N'Retardo', 4, 0),
                    (N'AdministrativeIncidentType', N'Incumplimiento del reglamento', 5, 0),
                    (N'AdministrativeIncidentType', N'Queja del cliente', 6, 0),
                    (N'AdministrativeIncidentType', N'Extravío de equipo', 7, 0),
                    (N'AdministrativeIncidentType', N'Acta administrativa', 8, 0);

                -- El NOT EXISTS compara por nombre plegado y no por texto exacto, que es como lo
                -- compara el indice unico del catalogo. Sin plegar, sembrar «Retardo» junto a un
                -- «retardo» capturado a mano chocaria contra UX_BusinessCatalogItems_...Normalized,
                -- que es exactamente el choque que aparecio al ensayar la migracion del 19 de
                -- septiembre por la mañana.
                INSERT dbo.BusinessCatalogItems
                    (IdBusinessCatalogItem, IdOrganization, Type, Name, Description, Active,
                     CreatedAt, CreatedBy, CreatedByName, DisplayOrder, IdParentCatalogItem, IsBlocking)
                SELECT NEWID(), o.IdOrganization, p.Tipo, p.Nombre, NULL, 1,
                       SYSUTCDATETIME(), @Actor, @ActorName, p.DisplayOrder, NULL, p.IsBlocking
                FROM dbo.Organizations o
                CROSS JOIN @Perfil p
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.BusinessCatalogItems b
                    WHERE b.IdOrganization = o.IdOrganization
                      AND b.Type = p.Tipo
                      AND b.Name COLLATE Latin1_General_CI_AI = p.Nombre COLLATE Latin1_General_CI_AI);
            ");

            // ── Paso 2 · La vigencia de la posición ────────────────────────────────────────────
            //
            // Nulable primero. Ver la nota de la cabecera sobre el defaultValue.
            migrationBuilder.AddColumn<DateOnly>(
                name: "StartDate",
                schema: "dbo",
                table: "Positions",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "EndDate",
                schema: "dbo",
                table: "Positions",
                type: "date",
                nullable: true);

            migrationBuilder.Sql(@"
                -- La vigencia que las 69 posiciones tenian implicitamente: la de su servicio. No se
                -- inventa una fecha ni se pone la de hoy, que dejaria fuera de vigencia a los
                -- puestos de servicios que empezaron antes.
                UPDATE posicion
                SET StartDate = servicio.StartDate,
                    EndDate = servicio.EndDate
                FROM dbo.Positions posicion
                JOIN dbo.Services servicio ON servicio.IdService = posicion.IdService
                WHERE posicion.StartDate IS NULL;
            ");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "StartDate",
                schema: "dbo",
                table: "Positions",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);

            // Despues del relleno: sobre filas a medio llenar, una restriccion de coherencia falla.
            migrationBuilder.AddCheckConstraint(
                name: "CK_Positions_DateRange",
                schema: "dbo",
                table: "Positions",
                sql: "[EndDate] IS NULL OR [EndDate] >= [StartDate]");

            // ── Paso 3 · La escolaridad de la persona ──────────────────────────────────────────
            //
            // Nulable, y el nulo significa «no se sabe», no «no cumple». Ninguno de los 271
            // expedientes la tenia, porque la columna no existia; bloquear por un nulo dejaria
            // fuera a toda la plantilla el dia del despliegue.
            migrationBuilder.AddColumn<Guid>(
                name: "IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Employees",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Employees",
                column: "IdEducationLevelCatalogItem");

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_BusinessCatalogItems_IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Employees",
                column: "IdEducationLevelCatalogItem",
                principalSchema: "dbo",
                principalTable: "BusinessCatalogItems",
                principalColumn: "IdBusinessCatalogItem",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Employees_BusinessCatalogItems_IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Positions_DateRange",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_Employees_IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "EndDate",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "StartDate",
                schema: "dbo",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "IdEducationLevelCatalogItem",
                schema: "dbo",
                table: "Employees");

            // Los valores sembrados se retiran sólo si nadie los usa todavía. Un motivo de
            // incidencia ya referido por un acta no se puede borrar —la llave foránea lo impide, y
            // el principio 3 también—, así que la vuelta atrás desactiva en lugar de borrar.
            migrationBuilder.Sql(@"
                UPDATE dbo.BusinessCatalogItems
                SET Active = 0
                WHERE CreatedByName = N'Catalog migration'
                  AND Type IN ('Sex', 'AgeRange', 'EducationLevel', 'RequiredEquipment',
                               'AdministrativeIncidentType');

                DELETE FROM dbo.BusinessCatalogItems
                WHERE CreatedByName = N'Catalog migration'
                  AND Type IN ('Sex', 'AgeRange', 'EducationLevel', 'RequiredEquipment',
                               'AdministrativeIncidentType')
                  AND NOT EXISTS (
                        SELECT 1 FROM dbo.AdministrativeIncidents a
                        WHERE a.IdIncidentTypeCatalogItem = IdBusinessCatalogItem)
                  AND NOT EXISTS (
                        SELECT 1 FROM dbo.PositionRequiredEquipments e
                        WHERE e.IdEquipmentCatalogItem = IdBusinessCatalogItem);
            ");
        }
    }
}
