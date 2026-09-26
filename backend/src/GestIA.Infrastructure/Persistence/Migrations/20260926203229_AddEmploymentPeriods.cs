using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1861 // EF Core genera arreglos locales para los indices compuestos.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// RQ-07 · El historial de ingresos, bajas y reingresos.
    ///
    /// <para><b>Por qué una tabla y no dos columnas.</b> Una persona puede entrar, salir y volver a
    /// entrar <i>n</i> veces. Con una fecha de baja y un motivo en <c>Employees</c>, el segundo ingreso
    /// borraría el primero, y la antigüedad —que se cuenta desde el último ingreso y no suma los
    /// anteriores— no tendría contra qué demostrarse.</para>
    ///
    /// <para><b>Tres reglas de negocio viven en la base, no en la pantalla.</b> El índice único
    /// filtrado impide más de un periodo abierto por persona, que es lo que hace imposible un
    /// reingreso sobre alguien que nunca causó baja. Un <c>CHECK</c> impide guardar una baja sin
    /// motivo. Otro impide que la baja sea anterior al ingreso. Esconder un botón no es una
    /// restricción.</para>
    ///
    /// <para><b>El relleno no inventa contrataciones.</b> Quien está en candidatura no recibe periodo:
    /// el periodo se abre al contratarla, y sembrar uno diría que ya lo fue. Son 247 periodos para 278
    /// expedientes, y los 31 que faltan son exactamente las candidaturas.</para>
    /// </summary>
    public partial class AddEmploymentPeriods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmploymentPeriods",
                schema: "dbo",
                columns: table => new
                {
                    IdEmploymentPeriod = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    TerminationReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_EmploymentPeriods_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_EmploymentPeriods_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmploymentPeriods", x => x.IdEmploymentPeriod);
                    table.CheckConstraint("CK_EmploymentPeriods_DateRange", "[EndDate] IS NULL OR [EndDate] >= [StartDate]");
                    table.CheckConstraint("CK_EmploymentPeriods_TerminationReason", "([EndDate] IS NULL AND [TerminationReason] IS NULL) OR ([EndDate] IS NOT NULL AND [TerminationReason] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_EmploymentPeriods_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmploymentPeriods_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmploymentPeriods_IdEmployee_StartDate",
                schema: "dbo",
                table: "EmploymentPeriods",
                columns: new[] { "IdEmployee", "StartDate" });

            migrationBuilder.CreateIndex(
                name: "IX_EmploymentPeriods_IdOrganization",
                schema: "dbo",
                table: "EmploymentPeriods",
                column: "IdOrganization");

            migrationBuilder.CreateIndex(
                name: "UX_EmploymentPeriods_IdEmployee",
                schema: "dbo",
                table: "EmploymentPeriods",
                column: "IdEmployee",
                unique: true,
                filter: "[EndDate] IS NULL");

            migrationBuilder.Sql(RellenoDelHistorial);
        }

        /// <summary>
        /// Un periodo por cada persona que ya fue contratada alguna vez, y las comprobaciones que
        /// detienen la migración completa si el relleno no cuadra.
        /// </summary>
        private const string RellenoDelHistorial = """
            SET NOCOUNT ON;

            DECLARE @Hoy date = CAST(SYSUTCDATETIME() AS date);
            DECLARE @MotivoHeredado nvarchar(500) = N'(registrado antes del historial; fecha aproximada)';

            -- Quien sigue en candidatura NO lleva periodo: el periodo se abre al contratarla.
            -- Quien esta dada de baja lleva su periodo cerrado; el resto --activos, en permiso e
            -- inactivos-- lo lleva abierto, porque ni un permiso ni el estado Inactive son una baja
            -- laboral.
            --
            -- La fecha de baja heredada es la de la ultima modificacion del expediente, que es la
            -- unica pista que hay: la columna de baja no existia. Se recorta por los dos lados --no
            -- anterior al ingreso, no posterior a hoy-- porque una baja anterior al ingreso violaria
            -- el CHECK, y una baja en el futuro seria un hecho que todavia no ha ocurrido.
            INSERT INTO dbo.EmploymentPeriods
                (IdEmploymentPeriod, IdOrganization, IdEmployee, StartDate, EndDate, TerminationReason,
                 Active, CreatedAt, CreatedBy, CreatedByName)
            SELECT
                NEWID(),
                e.IdOrganization,
                e.IdEmployee,
                e.HireDate,
                CASE WHEN e.Status = N'Terminated' THEN
                    CASE
                        WHEN CAST(ISNULL(e.UpdatedAt, e.CreatedAt) AS date) > @Hoy THEN @Hoy
                        WHEN CAST(ISNULL(e.UpdatedAt, e.CreatedAt) AS date) < e.HireDate THEN e.HireDate
                        ELSE CAST(ISNULL(e.UpdatedAt, e.CreatedAt) AS date)
                    END
                END,
                CASE WHEN e.Status = N'Terminated' THEN @MotivoHeredado END,
                1,
                SYSUTCDATETIME(),
                e.CreatedBy,
                N'Migracion RQ-07'
            FROM dbo.Employees AS e
            WHERE e.Status <> N'Candidate'
              AND NOT EXISTS (SELECT 1 FROM dbo.EmploymentPeriods AS p WHERE p.IdEmployee = e.IdEmployee);

            -- Comprobacion 1: un periodo por persona contratada, ni uno mas ni uno menos.
            IF EXISTS (
                SELECT 1
                FROM dbo.Employees AS e
                LEFT JOIN dbo.EmploymentPeriods AS p ON p.IdEmployee = e.IdEmployee
                GROUP BY e.IdEmployee, e.Status
                HAVING (e.Status = N'Candidate' AND COUNT(p.IdEmploymentPeriod) <> 0)
                    OR (e.Status <> N'Candidate' AND COUNT(p.IdEmploymentPeriod) <> 1))
            BEGIN
                THROW 50010, 'RQ-07: el relleno no dejo exactamente un periodo por persona contratada, o dejo alguno a una candidatura. La migracion se detuvo.', 1;
            END

            -- Comprobacion 2: la fecha de ingreso del periodo es la del expediente. Si no, el
            -- historial estaria contando una antiguedad que nadie capturo.
            IF EXISTS (
                SELECT 1 FROM dbo.EmploymentPeriods AS p
                JOIN dbo.Employees AS e ON e.IdEmployee = p.IdEmployee
                WHERE p.StartDate <> e.HireDate)
            BEGIN
                THROW 50011, 'RQ-07: al menos un periodo quedo con una fecha de ingreso distinta de la del expediente. La migracion se detuvo.', 1;
            END

            -- Comprobacion 3: nadie con dos periodos abiertos. El indice unico ya lo impide; esto lo
            -- dice con un mensaje que se entiende en vez de con una violacion de indice.
            IF EXISTS (
                SELECT IdEmployee FROM dbo.EmploymentPeriods
                WHERE EndDate IS NULL GROUP BY IdEmployee HAVING COUNT(*) > 1)
            BEGIN
                THROW 50012, 'RQ-07: alguna persona quedo con mas de un periodo abierto. La migracion se detuvo.', 1;
            END

            -- Comprobacion 4: el estado del expediente y la forma del periodo dicen lo mismo. Un
            -- expediente dado de baja con el periodo abierto no se podria reingresar.
            IF EXISTS (
                SELECT 1 FROM dbo.EmploymentPeriods AS p
                JOIN dbo.Employees AS e ON e.IdEmployee = p.IdEmployee
                WHERE (e.Status = N'Terminated' AND p.EndDate IS NULL)
                   OR (e.Status <> N'Terminated' AND p.EndDate IS NOT NULL))
            BEGIN
                THROW 50013, 'RQ-07: el estado de algun expediente no corresponde con la forma de su periodo. La migracion se detuvo.', 1;
            END
            """;

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmploymentPeriods",
                schema: "dbo");
        }
    }
}

#pragma warning restore CA1861
