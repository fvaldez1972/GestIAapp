using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Completa las plantillas de turno y enlaza las posiciones que las siguen (RF-PAT-005).
    ///
    /// <para><b>No cambia el esquema.</b> Son dos pasos de datos, en este orden: sin plantillas
    /// completas no hay contra qué comparar.</para>
    ///
    /// <para><b>1 · Declarar como descanso los días que faltaban.</b> Nueve de las diez plantillas
    /// activas declaraban unos días del ciclo y dejaban otros sin decir nada, y un día sin declarar
    /// <b>no es un descanso</b>: el sistema no lo supone, y por eso el selector de la posición sólo
    /// ofrecía una. Que esos días son de descanso sale de la fuente para el rol diurno —el proceso
    /// dice «L-S», lunes a sábado, así que el domingo descansa— y <b>se deduce</b> para el nocturno
    /// alterno, donde los días impares están declarados y los pares vacíos. Esa segunda es una
    /// deducción, no una cita, y conviene mirarla contra las posiciones que la usan.</para>
    ///
    /// <para><b>No hay paso de duplicados, y conviene decir por qué no lo hay.</b> Al mirar el
    /// catálogo aparecían dos plantillas llamadas «Rol diurno lunes a sábado» y dos «Rol nocturno
    /// 12x12», y parecían copias. No lo son: cada pareja es la misma plantilla en <b>dos
    /// organizaciones distintas</b>, que es lo normal aquí. Dentro de una organización no puede
    /// haber dos con el mismo nombre —lo impide el índice único— así que no hay nada que
    /// deduplicar.</para>
    ///
    /// <para><b>2 · Enlazar las posiciones.</b> Para cada posición con horario propio se compara su
    /// semana contra la de cada plantilla completa, día por día, y se enlaza <b>sólo si coincide
    /// exactamente y con una sola</b>. Lo que no se puede reconciliar no se inventa: queda sin
    /// plantilla y la pantalla lo marca para revisión, que es la decisión 4.1.</para>
    ///
    /// <para><b>Nada se borra.</b> Los patrones propios y sus segmentos se conservan tal cual, y
    /// una posición enlazada los conserva también: si el enlace resulta equivocado, el horario
    /// original sigue ahí para compararlo.</para>
    /// </summary>
    public partial class CompleteShiftPatternTemplatesAndLinkPositions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1 · Los días que faltaban, declarados como descanso ───────────────────────────
            migrationBuilder.Sql(@"
                DECLARE @Actor uniqueidentifier = '00000000-0000-0000-0000-000000000000';
                DECLARE @ActorName nvarchar(160) = N'Shift pattern migration';

                -- Los numeros de dia posibles, hasta el ciclo mas largo que haya declarado alguien.
                WITH Numeros AS (
                    SELECT TOP (SELECT ISNULL(MAX(CycleDays), 0) FROM dbo.ShiftPatternTemplates)
                        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
                    FROM sys.all_objects)
                INSERT dbo.ShiftPatternTemplateDays
                    (IdShiftPatternTemplateDay, IdOrganization, IdShiftPatternTemplate, CycleDayNumber,
                     StartTime, EndTime, IsRest, DurationMinutes, IsOvernight, Active,
                     CreatedAt, CreatedBy, CreatedByName)
                SELECT NEWID(), t.IdOrganization, t.IdShiftPatternTemplate, n.n,
                       NULL, NULL, 1, 0, 0, 1,
                       SYSUTCDATETIME(), @Actor, @ActorName
                FROM dbo.ShiftPatternTemplates t
                JOIN Numeros n ON n.n <= t.CycleDays
                WHERE t.Active = 1
                  AND NOT EXISTS (
                        SELECT 1 FROM dbo.ShiftPatternTemplateDays d
                        WHERE d.IdShiftPatternTemplate = t.IdShiftPatternTemplate
                          AND d.CycleDayNumber = n.n);
            ");

            // ── 2 · Las posiciones, enlazadas donde la semana coincide exactamente ────────────
            migrationBuilder.Sql(@"
                -- La semana de un patron propio y la de una plantilla de ciclo 7 se comparan dia a
                -- dia. El dia 1 es lunes en las dos: el patron propio declara por dia de la semana
                -- y la plantilla por numero de ciclo, y para un ciclo semanal significan lo mismo.
                WITH Dias AS (
                    SELECT n.n, CASE n.n
                        WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday'
                        WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday'
                        ELSE 'Sunday' END AS Nombre
                    FROM (VALUES (1),(2),(3),(4),(5),(6),(7)) n(n)),
                HuellaPosicion AS (
                    SELECT p.IdPosition, p.IdOrganization,
                           (SELECT STRING_AGG(CONVERT(varchar(40), CONCAT(di.n, ':',
                                CASE WHEN s.IdShiftSegment IS NULL THEN 'R'
                                     ELSE CONCAT(CONVERT(varchar(5), s.StartTime, 108), '-',
                                                 CONVERT(varchar(5), s.EndTime, 108)) END)), '|')
                                WITHIN GROUP (ORDER BY di.n)
                            FROM Dias di
                            LEFT JOIN dbo.ShiftSegments s
                                ON s.IdShiftPattern = sp.IdShiftPattern
                               AND s.Active = 1
                               AND s.DayOfWeek = di.Nombre) AS Huella
                    FROM dbo.Positions p
                    JOIN dbo.ShiftPatterns sp
                        ON sp.IdPosition = p.IdPosition AND sp.Active = 1
                    WHERE p.Active = 1 AND p.IdShiftPatternTemplate IS NULL),
                HuellaPlantilla AS (
                    SELECT t.IdShiftPatternTemplate, t.IdOrganization,
                           (SELECT STRING_AGG(CONVERT(varchar(40), CONCAT(d.CycleDayNumber, ':',
                                CASE WHEN d.IsRest = 1 THEN 'R'
                                     ELSE CONCAT(CONVERT(varchar(5), d.StartTime, 108), '-',
                                                 CONVERT(varchar(5), d.EndTime, 108)) END)), '|')
                                WITHIN GROUP (ORDER BY d.CycleDayNumber)
                            FROM dbo.ShiftPatternTemplateDays d
                            WHERE d.IdShiftPatternTemplate = t.IdShiftPatternTemplate
                              AND d.Active = 1) AS Huella
                    FROM dbo.ShiftPatternTemplates t
                    WHERE t.Active = 1 AND t.CycleDays = 7),
                Coincidencias AS (
                    SELECT hp.IdPosition,
                           MIN(ht.IdShiftPatternTemplate) AS IdShiftPatternTemplate,
                           COUNT(DISTINCT ht.IdShiftPatternTemplate) AS Cuantas
                    FROM HuellaPosicion hp
                    JOIN HuellaPlantilla ht
                        ON ht.IdOrganization = hp.IdOrganization
                       AND ht.Huella = hp.Huella
                    GROUP BY hp.IdPosition)
                UPDATE posicion
                SET IdShiftPatternTemplate = c.IdShiftPatternTemplate,
                    UpdatedAt = SYSUTCDATETIME(),
                    UpdatedBy = '00000000-0000-0000-0000-000000000000',
                    UpdatedByName = N'Shift pattern migration'
                FROM dbo.Positions posicion
                JOIN Coincidencias c ON c.IdPosition = posicion.IdPosition
                -- Con una sola. Si dos plantillas declaran la misma semana, elegir por la
                -- migracion seria inventar: la posicion queda marcada y alguien decide.
                WHERE c.Cuantas = 1;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Se deshace lo que esta migración hizo, reconocible por el actor que lo escribió, y en
            // el orden inverso. Lo que alguien haya cambiado después se queda: volver atrás el
            // código no es motivo para deshacer el trabajo de una persona.
            migrationBuilder.Sql(@"
                UPDATE dbo.Positions
                SET IdShiftPatternTemplate = NULL
                WHERE UpdatedByName = N'Shift pattern migration';

                DELETE FROM dbo.ShiftPatternTemplateDays
                WHERE CreatedByName = N'Shift pattern migration';
            ");
        }
    }
}
