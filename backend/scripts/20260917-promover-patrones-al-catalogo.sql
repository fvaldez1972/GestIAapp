/*
    Promueve los patrones de turno capturados dentro de cada posición al catálogo de patrones.

    POR QUÉ EXISTE
    Hasta el 17 de septiembre de 2026 el patrón se capturaba dentro de la posición y sus días se
    declaraban por día de la semana. Eso tenía dos consecuencias: un ciclo que no es semanal —un
    24x48 son tres días— no se podía expresar, y el mismo horario se volvía a teclear en cada
    puesto. En `db-gestia-local` había 47 patrones activos que son 13 horarios distintos: el
    «Rol diurno lunes a sábado» estaba capturado 19 veces y el «Rol nocturno 12x12» 8 veces.

    QUÉ HACE
      1. Agrupa los patrones activos por su horario —los días de la semana con segmento y las horas
         de cada uno—, dentro de cada organización. Un grupo es un patrón del catálogo.
      2. Crea una plantilla por grupo, con ciclo de 7 días, y declara los días que tenían segmento.
      3. Liga `Positions.IdShiftPatternTemplate` **sólo** cuando la plantilla quedó completa.

    QUÉ NO HACE, Y ES LO IMPORTANTE
    **No inventa los descansos.** En el modelo viejo un día sin segmento no distinguía «descansa»
    de «nadie lo capturó»: no había forma de declarar un descanso. Convertir esos días en descansos
    afirmaría algo que nadie dijo, y en un 12x12 —que alterna cada semana— además sería falso la
    mitad de las semanas. Así que el día sin segmento **se queda sin declarar**: la plantilla nace
    incompleta, la pantalla lo dice con «Días sin declarar», y el desplegable de la posición no la
    ofrece hasta que una persona declare el resto del ciclo en el constructor. Es justo la
    diferencia que el modelo nuevo existe para poder guardar.

    Por eso tampoco se liga la posición cuando la plantilla quedó incompleta: el servidor rechaza
    asignar una plantilla con días sin declarar, y dejar la fila ligada por SQL crearía un dato que
    la propia API no habría aceptado. Esas posiciones conservan su patrón propio, que sigue intacto:
    **aquí no se borra ni se desactiva ningún patrón viejo.**

    LA JORNADA SE DEDUCE DE LAS HORAS, Y SÓLO HASTA DONDE SE PUEDE
    `Daypart` es obligatorio. Se pone `Night` cuando todos los segmentos cruzan la medianoche o
    entran a las 18:00 o después, `Day` cuando todos caben entre las 06:00 y las 20:00, y `Mixed`
    en cualquier otro caso. `Rotating` no se deduce nunca: que una posición alterne día y noche
    dentro del ciclo no está en los datos viejos, y adivinarlo sería inventarlo.

    EL NOMBRE NORMALIZADO
    Se calcula aquí con la misma forma que `CatalogName.Normalize` —recortar, colapsar espacios,
    mayúsculas—, que es lo que sostiene el índice único. Los acentos los pliega la comparación de la
    base; ninguno de los nombres promovidos los lleva.

    ES IDEMPOTENTE. La segunda corrida no crea nada: cada grupo se salta si ya existe una plantilla
    con su nombre normalizado en la organización.

    CÓMO SE CORRE
        sqlcmd -S localhost,1434 -U sa -P <clave> -C -N -d db-gestia-local \
               -i backend/scripts/20260917-promover-patrones-al-catalogo.sql
    Antes, respaldo COPY_ONLY con CHECKSUM verificado, como toda operación sobre una base que ya
    existe.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @actor uniqueidentifier = '00000000-0000-0000-0000-000000000000';
DECLARE @actorNombre nvarchar(150) = N'Promoción de patrones al catálogo';
DECLARE @ahora datetime2(0) = SYSUTCDATETIME();
DECLARE @vigencia date = CONVERT(date, @ahora);

BEGIN TRANSACTION;

-- ── 1 · La firma de cada patrón vivo ─────────────────────────────────────────────────────────
-- Dos patrones son el mismo horario si tienen los mismos días con las mismas horas. El orden por
-- número de día vuelve la firma comparable entre patrones capturados en distinto orden.
DROP TABLE IF EXISTS #firmas;

WITH dias AS (
    SELECT
        s.IdShiftPattern,
        CASE s.DayOfWeek
            WHEN 'Monday' THEN 1
            WHEN 'Tuesday' THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday' THEN 4
            WHEN 'Friday' THEN 5
            WHEN 'Saturday' THEN 6
            WHEN 'Sunday' THEN 7
        END AS CycleDayNumber,
        s.StartTime,
        s.EndTime,
        s.DurationMinutes,
        s.IsOvernight
    FROM dbo.ShiftSegments s
    WHERE s.Active = 1
)
SELECT
    p.IdShiftPattern,
    p.IdOrganization,
    p.[Name],
    p.CreatedAt,
    CONVERT(varchar(900), (
        SELECT STRING_AGG(
                   CONCAT(d.CycleDayNumber, ':', CONVERT(varchar(5), d.StartTime, 108), '-',
                          CONVERT(varchar(5), d.EndTime, 108)), ' ')
               WITHIN GROUP (ORDER BY d.CycleDayNumber, d.StartTime)
        FROM dias d
        WHERE d.IdShiftPattern = p.IdShiftPattern)) AS Firma
INTO #firmas
FROM dbo.ShiftPatterns p
WHERE p.Active = 1
  AND EXISTS (SELECT 1 FROM dias d WHERE d.IdShiftPattern = p.IdShiftPattern);

-- ── 2 · Un grupo por firma, con el patrón más antiguo como representante ─────────────────────
-- El nombre del grupo sale del patrón más antiguo de la firma: es el que se capturó primero y del
-- que los demás son copia. Los otros nombres quedan anotados en la descripción, para que no se
-- pierda con qué se unió cada cual.
DROP TABLE IF EXISTS #grupos;

SELECT
    f.IdOrganization,
    f.Firma,
    COUNT(*) AS Patrones
INTO #grupos
FROM #firmas f
GROUP BY f.IdOrganization, f.Firma;

ALTER TABLE #grupos ADD
    IdShiftPatternTemplate uniqueidentifier NULL,
    IdShiftPatternRepresentante uniqueidentifier NULL,
    [Name] nvarchar(150) NULL;

WITH representante AS (
    SELECT
        f.IdOrganization,
        f.Firma,
        f.IdShiftPattern,
        f.[Name],
        ROW_NUMBER() OVER (
            PARTITION BY f.IdOrganization, f.Firma
            ORDER BY f.CreatedAt, f.[Name], f.IdShiftPattern) AS orden
    FROM #firmas f
)
UPDATE g
SET g.IdShiftPatternTemplate = NEWID(),
    g.IdShiftPatternRepresentante = r.IdShiftPattern,
    g.[Name] = LEFT(r.[Name], 150)
FROM #grupos g
JOIN representante r
  ON r.IdOrganization = g.IdOrganization AND r.Firma = g.Firma AND r.orden = 1;

-- Un grupo que ya está en el catálogo no se vuelve a crear: es lo que hace idempotente al guion.
DELETE g
FROM #grupos g
WHERE EXISTS (
    SELECT 1
    FROM dbo.ShiftPatternTemplates t
    WHERE t.IdOrganization = g.IdOrganization
      AND t.NormalizedName = UPPER(LTRIM(RTRIM(g.[Name]))));

-- ── 3 · Las plantillas ───────────────────────────────────────────────────────────────────────
INSERT INTO dbo.ShiftPatternTemplates (
    IdShiftPatternTemplate, IdOrganization, [Name], NormalizedName, [Description], Daypart,
    CycleDays, EffectiveFromDate, EffectiveToDate, Active, CreatedAt, CreatedBy, CreatedByName)
SELECT
    g.IdShiftPatternTemplate,
    g.IdOrganization,
    g.[Name],
    UPPER(LTRIM(RTRIM(g.[Name]))),
    CONCAT(
        N'Promovido del patrón capturado dentro de la posición el ',
        CONVERT(varchar(10), @vigencia, 103),
        CASE WHEN g.Patrones > 1
             THEN CONCAT(N'. Une ', g.Patrones, N' patrones con el mismo horario.')
             ELSE N'.' END,
        N' Los días sin segmento quedaron sin declarar: en el modelo viejo no había forma de decir',
        N' que un día es de descanso, así que hay que declararlos en el constructor.'),
    -- La jornada, hasta donde las horas la dicen. Ver el encabezado.
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM dbo.ShiftSegments s
            WHERE s.IdShiftPattern = g.IdShiftPatternRepresentante AND s.Active = 1
              AND s.IsOvernight = 0 AND s.StartTime < '18:00:00')
        THEN 'Night'
        WHEN NOT EXISTS (
            SELECT 1 FROM dbo.ShiftSegments s
            WHERE s.IdShiftPattern = g.IdShiftPatternRepresentante AND s.Active = 1
              AND (s.IsOvernight = 1 OR s.StartTime < '06:00:00' OR s.EndTime > '20:00:00'))
        THEN 'Day'
        ELSE 'Mixed'
    END,
    7,
    @vigencia,
    NULL,
    1,
    @ahora,
    @actor,
    @actorNombre
FROM #grupos g;

-- ── 4 · Los días declarados ──────────────────────────────────────────────────────────────────
-- Sólo los días que tenían segmento. Si un mismo día tenía dos segmentos —un turno partido—, se
-- toma el primero y el resto se reporta abajo: el modelo nuevo declara un turno por día del ciclo,
-- y partir un día es una decisión que le toca a una persona, no a este guion.
INSERT INTO dbo.ShiftPatternTemplateDays (
    IdShiftPatternTemplateDay, IdOrganization, IdShiftPatternTemplate, CycleDayNumber,
    StartTime, EndTime, IsRest, IsOvernight, DurationMinutes, Active,
    CreatedAt, CreatedBy, CreatedByName)
SELECT
    NEWID(),
    g.IdOrganization,
    g.IdShiftPatternTemplate,
    d.CycleDayNumber,
    d.StartTime,
    d.EndTime,
    0,
    d.IsOvernight,
    d.DurationMinutes,
    1,
    @ahora,
    @actor,
    @actorNombre
FROM #grupos g
CROSS APPLY (
    SELECT
        CASE s.DayOfWeek
            WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
            WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
            WHEN 'Sunday' THEN 7 END AS CycleDayNumber,
        s.StartTime,
        s.EndTime,
        s.IsOvernight,
        s.DurationMinutes,
        ROW_NUMBER() OVER (
            PARTITION BY s.DayOfWeek
            ORDER BY s.StartTime) AS orden
    FROM dbo.ShiftSegments s
    WHERE s.Active = 1
      AND s.IdShiftPattern = g.IdShiftPatternRepresentante
) d
WHERE d.orden = 1;

-- ── 5 · El enlace de la posición, sólo si la plantilla quedó completa ────────────────────────
UPDATE p
SET p.IdShiftPatternTemplate = g.IdShiftPatternTemplate,
    p.UpdatedAt = @ahora,
    p.UpdatedBy = @actor,
    p.UpdatedByName = @actorNombre
FROM dbo.Positions p
JOIN dbo.ShiftPatterns sp ON sp.IdPosition = p.IdPosition AND sp.Active = 1
JOIN #firmas f ON f.IdShiftPattern = sp.IdShiftPattern
JOIN #grupos g ON g.Firma = f.Firma AND g.IdOrganization = f.IdOrganization
WHERE p.IdShiftPatternTemplate IS NULL
  AND (SELECT COUNT(*) FROM dbo.ShiftPatternTemplateDays td
       WHERE td.IdShiftPatternTemplate = g.IdShiftPatternTemplate AND td.Active = 1) = 7;

COMMIT TRANSACTION;

-- ── El reporte ───────────────────────────────────────────────────────────────────────────────
PRINT '--- Plantillas del catálogo, después de promover ---';

SELECT
    t.[Name] AS Plantilla,
    t.Daypart AS Jornada,
    t.CycleDays AS Ciclo,
    (SELECT COUNT(*) FROM dbo.ShiftPatternTemplateDays d
     WHERE d.IdShiftPatternTemplate = t.IdShiftPatternTemplate AND d.Active = 1) AS DiasDeclarados,
    CASE WHEN (SELECT COUNT(*) FROM dbo.ShiftPatternTemplateDays d
               WHERE d.IdShiftPatternTemplate = t.IdShiftPatternTemplate AND d.Active = 1) = t.CycleDays
         THEN 'Completa, ya se ofrece'
         ELSE 'Faltan días por declarar, no se ofrece' END AS Estado,
    (SELECT COUNT(*) FROM dbo.Positions p
     WHERE p.IdShiftPatternTemplate = t.IdShiftPatternTemplate) AS PosicionesLigadas
FROM dbo.ShiftPatternTemplates t
WHERE t.Active = 1
ORDER BY t.[Name];

PRINT '--- Días con más de un segmento, que este guion no partió ---';

-- Por patrón y no por nombre: hay diecinueve patrones distintos llamados «Rol diurno lunes a
-- sábado», y agrupar por el nombre los sumaba como si un mismo día tuviera diecinueve turnos.
SELECT
    p.[Name] AS Patron,
    p.IdShiftPattern,
    s.DayOfWeek AS Dia,
    COUNT(*) AS Segmentos
FROM dbo.ShiftPatterns p
JOIN dbo.ShiftSegments s ON s.IdShiftPattern = p.IdShiftPattern AND s.Active = 1
WHERE p.Active = 1
GROUP BY p.[Name], p.IdShiftPattern, s.DayOfWeek
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
