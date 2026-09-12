using System;
using Microsoft.EntityFrameworkCore.Migrations;

// Como en las demas migraciones del proyecto: el scaffolding genera arreglos en linea y el
// analizador los rechaza. Se silencia aqui, no se reescribe el codigo generado.
#pragma warning disable CA1861

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Retira la configuracion del servicio.
    ///
    /// <para><b>Destructiva y decidida en voz alta.</b> El precio, el personal requerido y el
    /// impuesto se mudaron al puesto en <c>AddPositionPricing</c>; el horario lo declara el patron
    /// de turnos, y las horas al mes eran calculables. Lo que queda de la configuracion no lo leia
    /// nadie para decidir nada.</para>
    ///
    /// <para>Se tomo respaldo <c>COPY_ONLY</c> con <c>CHECKSUM</c>, verificado con
    /// <c>RESTORE VERIFYONLY</c>, antes de aplicarla sobre una base viva.</para>
    ///
    /// <para><b>Primero se vacia y luego se tira.</b> La tabla guardaba dinero real: precios
    /// mensuales por servicio que nadie habia copiado a ningun otro lado. Soltar el
    /// <c>DROP TABLE</c> sin mas habria dejado todos los puestos en cero, que es perder el dato
    /// sin decirlo. El <c>Up</c> reparte el precio de la configuracion <b>vigente</b> de cada
    /// servicio entre sus puestos, en proporcion a los elementos que pide cada uno, y le da el
    /// residuo del redondeo al primero para que la suma de los puestos sea exactamente el precio
    /// que tenia el servicio.</para>
    ///
    /// <para><b>Los eventos de historial NO se tocan.</b> El tipo <c>ServiceConfiguration</c> sigue
    /// en el enum y su ruta de consulta sigue publicada: hay eventos ya guardados de ese tipo y las
    /// bitacoras son de solo agregar. Quitar el valor haria reventar la lectura de Auditoria.</para>
    /// </summary>
    public partial class RetireServiceConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Solo cuentan las configuraciones activas: una inactiva es un precio retirado, y
            // resucitarlo seria peor que dejar el puesto en cero.
            migrationBuilder.Sql(@"
WITH Vigente AS (
    SELECT
        c.IdService,
        c.MonthlyPrice,
        c.CurrencyCode,
        c.IsTaxIncluded,
        ROW_NUMBER() OVER (PARTITION BY c.IdService ORDER BY c.EffectiveFromDate DESC, c.CreatedAt DESC) AS Orden
    FROM dbo.ServiceConfigurations AS c
    WHERE c.Active = 1
),
Base AS (
    SELECT
        p.IdPosition,
        p.IdService,
        v.MonthlyPrice,
        v.CurrencyCode,
        v.IsTaxIncluded,
        CAST(p.RequiredWorkerCount AS decimal(19,4)) AS Elementos,
        SUM(CAST(p.RequiredWorkerCount AS decimal(19,4))) OVER (PARTITION BY p.IdService) AS TotalElementos,
        ROW_NUMBER() OVER (PARTITION BY p.IdService ORDER BY p.IdPosition) AS Orden
    FROM dbo.Positions AS p
    INNER JOIN Vigente AS v ON v.IdService = p.IdService AND v.Orden = 1
),
Reparto AS (
    SELECT
        b.*,
        CASE
            WHEN b.TotalElementos > 0 THEN CAST(ROUND(b.MonthlyPrice * b.Elementos / b.TotalElementos, 4) AS decimal(19,4))
            ELSE CAST(0 AS decimal(19,4))
        END AS Parte
    FROM Base AS b
),
ConResiduo AS (
    SELECT
        r.*,
        r.MonthlyPrice - SUM(r.Parte) OVER (PARTITION BY r.IdService) AS Residuo
    FROM Reparto AS r
)
UPDATE p
SET
    p.MonthlyPrice = c.Parte + CASE WHEN c.Orden = 1 THEN c.Residuo ELSE CAST(0 AS decimal(19,4)) END,
    p.CurrencyCode = c.CurrencyCode,
    p.IsTaxIncluded = c.IsTaxIncluded
FROM dbo.Positions AS p
INNER JOIN ConResiduo AS c ON c.IdPosition = p.IdPosition;
");

            migrationBuilder.DropTable(
                name: "ServiceConfigurations",
                schema: "dbo");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ServiceConfigurations",
                schema: "dbo",
                columns: table => new
                {
                    IdServiceConfiguration = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceConfigurations_Active"),
                    AverageMonthlyHours = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    AverageWeeklyHours = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceConfigurations_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CurrencyCode = table.Column<string>(type: "varchar(3)", unicode: false, maxLength: 3, nullable: false, defaultValue: "MXN")
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceConfigurations_CurrencyCode"),
                    DaysPerWeek = table.Column<byte>(type: "tinyint", nullable: false),
                    EffectiveFromDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveToDate = table.Column<DateOnly>(type: "date", nullable: true),
                    HoursPerDay = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsTaxIncluded = table.Column<bool>(type: "bit", nullable: false),
                    MonthlyPrice = table.Column<decimal>(type: "decimal(19,4)", precision: 19, scale: 4, nullable: false),
                    PreparationLeadDays = table.Column<short>(type: "smallint", nullable: false),
                    RequiredWorkerCount = table.Column<short>(type: "smallint", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    SpecificInstructions = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    WorkScheduleDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceConfigurations", x => x.IdServiceConfiguration);
                    table.CheckConstraint("CK_ServiceConfigurations_DaysPerWeek", "[DaysPerWeek] BETWEEN 1 AND 7");
                    table.CheckConstraint("CK_ServiceConfigurations_EffectiveDateRange", "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]");
                    table.CheckConstraint("CK_ServiceConfigurations_HoursPerDay", "[HoursPerDay] > 0 AND [HoursPerDay] <= 24");
                    table.CheckConstraint("CK_ServiceConfigurations_MonthlyPrice", "[MonthlyPrice] >= 0");
                    table.CheckConstraint("CK_ServiceConfigurations_RequiredWorkerCount", "[RequiredWorkerCount] > 0");
                    table.ForeignKey(
                        name: "FK_ServiceConfigurations_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServiceConfigurations_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceConfigurations_IdOrganization_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations",
                columns: new[] { "IdOrganization", "EffectiveFromDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceConfigurations_IdService_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations",
                columns: new[] { "IdService", "EffectiveFromDate" });

            // El Down devuelve la tabla vacia: las filas se fueron con el Up y el precio quedo en
            // los puestos. Reconstruir la configuracion desde ahi seria inventar horarios y
            // vigencias que ya no existen. Para recuperar los datos se restaura el respaldo.
        }
    }
}
#pragma warning restore CA1861
