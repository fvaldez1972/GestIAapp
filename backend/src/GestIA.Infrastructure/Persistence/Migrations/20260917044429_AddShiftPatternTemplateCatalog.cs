using System;
using Microsoft.EntityFrameworkCore.Migrations;

// Como en las demas migraciones del proyecto: el scaffolding genera arreglos en linea para las
// columnas de los indices y el analizador los rechaza. Se silencia aqui, no se reescribe el codigo
// generado.
#pragma warning disable CA1861

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// El catalogo de patrones de turno de la organizacion, y el patron que elige cada puesto.
    ///
    /// <para><b>Aditiva de principio a fin.</b> Dos tablas nuevas y una columna nulable en
    /// <c>Positions</c>. No renombra ni retira nada: los patrones por posicion y sus 257 segmentos
    /// siguen intactos, y el generador de turnos sigue leyendolos exactamente como hoy. La imagen
    /// publicada no lee estas columnas, asi que se puede aplicar sin publicar.</para>
    ///
    /// <para><b>Por que conviven los dos modelos.</b> El modelo viejo declara los dias por dia de la
    /// semana, asi que solo expresa ciclos semanales: un 24x48 es un ciclo de tres dias y no cabe.
    /// El nuevo declara la longitud del ciclo y qué es cada uno de sus dias —turno con horario, o
    /// descanso—, con lo que el descanso deja de ser la ausencia de un dato. Retirar el viejo exige
    /// reescribir el generador, y eso depende de dos respuestas de negocio que aun no estan: que
    /// pasa cuando el ciclo cae en festivo, y que pasa en el corte de semana. Mientras no esten, un
    /// nulo en <c>IdShiftPatternTemplate</c> significa «esta posicion todavia usa su patron propio».</para>
    ///
    /// <para><b>Lo que no se guarda:</b> las horas por semana y si el patron excede la jornada legal.
    /// Las primeras salen del ciclo; la segunda cambia con la ley, asi que un valor guardado hoy
    /// estaria equivocado el ano que entra sin que nadie hubiera tocado el patron.</para>
    /// </summary>
    public partial class AddShiftPatternTemplateCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdShiftPatternTemplate",
                schema: "dbo",
                table: "Positions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ShiftPatternTemplates",
                schema: "dbo",
                columns: table => new
                {
                    IdShiftPatternTemplate = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    NormalizedName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Daypart = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    CycleDays = table.Column<int>(type: "int", nullable: false),
                    EffectiveFromDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveToDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ShiftPatternTemplates_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ShiftPatternTemplates_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftPatternTemplates", x => x.IdShiftPatternTemplate);
                    table.CheckConstraint("CK_ShiftPatternTemplates_CycleDays", "[CycleDays] BETWEEN 1 AND 366");
                    table.CheckConstraint("CK_ShiftPatternTemplates_DateRange", "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]");
                    table.ForeignKey(
                        name: "FK_ShiftPatternTemplates_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShiftPatternTemplateDays",
                schema: "dbo",
                columns: table => new
                {
                    IdShiftPatternTemplateDay = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdShiftPatternTemplate = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CycleDayNumber = table.Column<int>(type: "int", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time(0)", nullable: true),
                    EndTime = table.Column<TimeOnly>(type: "time(0)", nullable: true),
                    IsRest = table.Column<bool>(type: "bit", nullable: false),
                    DurationMinutes = table.Column<int>(type: "int", nullable: false),
                    IsOvernight = table.Column<bool>(type: "bit", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ShiftPatternTemplateDays_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ShiftPatternTemplateDays_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftPatternTemplateDays", x => x.IdShiftPatternTemplateDay);
                    table.CheckConstraint("CK_ShiftPatternTemplateDays_CycleDayNumber", "[CycleDayNumber] >= 1");
                    table.CheckConstraint("CK_ShiftPatternTemplateDays_RestHasNoSchedule", "([IsRest] = CAST(1 AS bit) AND [StartTime] IS NULL AND [EndTime] IS NULL AND [DurationMinutes] = 0) OR ([IsRest] = CAST(0 AS bit) AND [StartTime] IS NOT NULL AND [EndTime] IS NOT NULL AND [DurationMinutes] > 0)");
                    table.ForeignKey(
                        name: "FK_ShiftPatternTemplateDays_ShiftPatternTemplates_IdShiftPatternTemplate",
                        column: x => x.IdShiftPatternTemplate,
                        principalSchema: "dbo",
                        principalTable: "ShiftPatternTemplates",
                        principalColumn: "IdShiftPatternTemplate",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "UX_ShiftPatternTemplateDays_IdShiftPatternTemplate_CycleDayNumber",
                schema: "dbo",
                table: "ShiftPatternTemplateDays",
                columns: new[] { "IdShiftPatternTemplate", "CycleDayNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ShiftPatternTemplates_IdOrganization_NormalizedName",
                schema: "dbo",
                table: "ShiftPatternTemplates",
                columns: new[] { "IdOrganization", "NormalizedName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShiftPatternTemplateDays",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ShiftPatternTemplates",
                schema: "dbo");

            migrationBuilder.DropColumn(
                name: "IdShiftPatternTemplate",
                schema: "dbo",
                table: "Positions");
        }
    }
}
