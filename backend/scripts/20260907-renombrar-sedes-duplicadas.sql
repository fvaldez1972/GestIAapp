/*
    Resuelve las sedes duplicadas por cliente, para que la migración de unicidad pueda aplicarse.

    POR QUÉ EXISTE
    El formulario de alta de sede no se limpiaba al guardar: se creaba la sede, el formulario
    quedaba abierto con los mismos datos, y pulsar otra vez creaba una idéntica. En db-gestia-dev
    quedaron cuatro «Vicente Eguia» del mismo cliente, con la misma calle, creadas a las 22:28:04,
    :18, :19 y :20 del 7 de septiembre de 2026. Ninguna tiene servicios ligados.

    QUÉ HACE, Y QUÉ NO
    Conserva la primera de cada grupo —la más antigua— tal cual. A las demás:
      1. Les agrega su código al nombre, para que dejen de chocar. Renombrar y no borrar, porque
         aquí los registros no se borran y porque el rastro de que existieron es información.
      2. Las desactiva. Son basura de un defecto, no sedes que alguien quisiera tener; dejarlas
         activas ensuciaría el selector de sedes de ese cliente para siempre.

    Desactivar por sí solo NO habría bastado: el índice único cubre activas e inactivas, igual que
    en el catálogo. Por eso además se renombran.

    ES IDEMPOTENTE. Correrlo dos veces no cambia nada la segunda: sólo toca filas cuyo nombre
    normalizado todavía choca con otra del mismo cliente.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @actor uniqueidentifier = '00000000-0000-0000-0000-000000000000';
DECLARE @motivo nvarchar(200) = N'Duplicado del alta de sede que no limpiaba el formulario, 7 sep 2026';
DECLARE @ahora datetime2(0) = SYSUTCDATETIME();

-- Las que sobran: todas menos la más antigua de cada grupo que todavía choca.
WITH duplicadas AS (
    SELECT
        s.IdClientSite,
        s.CodeClientSite,
        ROW_NUMBER() OVER (
            PARTITION BY s.IdClient, UPPER(LTRIM(RTRIM(s.[Name])))
            ORDER BY s.CreatedAt, s.CodeClientSite) AS orden,
        COUNT(*) OVER (PARTITION BY s.IdClient, UPPER(LTRIM(RTRIM(s.[Name])))) AS enElGrupo
    FROM dbo.ClientSites s
)
UPDATE cs
SET cs.[Name] = LEFT(cs.[Name] + N' · ' + cs.CodeClientSite, 200),
    cs.Active = 0,
    cs.UpdatedAt = @ahora,
    cs.UpdatedBy = @actor,
    cs.UpdatedByName = @motivo
FROM dbo.ClientSites cs
INNER JOIN duplicadas d ON d.IdClientSite = cs.IdClientSite
WHERE d.enElGrupo > 1
  AND d.orden > 1;

DECLARE @tocadas int = @@ROWCOUNT;

-- Ninguna de las que se tocan puede tener servicios: si los tuviera, desactivarla dejaría un
-- servicio apuntando a una sede inactiva y eso es una decisión distinta, no una limpieza.
IF EXISTS (
    SELECT 1
    FROM dbo.Services v
    INNER JOIN dbo.ClientSites s ON s.IdClientSite = v.IdClientSite
    WHERE s.UpdatedByName = @motivo AND s.UpdatedAt = @ahora)
BEGIN
    ROLLBACK TRANSACTION;
    THROW 50000, 'Alguna de las sedes duplicadas tiene servicios ligados. Revisar a mano antes de continuar.', 1;
END

-- Y no puede quedar ningún choque, o la migración volvería a detenerse.
IF EXISTS (
    SELECT 1 FROM dbo.ClientSites
    GROUP BY IdClient, UPPER(LTRIM(RTRIM([Name])))
    HAVING COUNT(*) > 1)
BEGIN
    ROLLBACK TRANSACTION;
    THROW 50000, 'Todavia quedan sedes duplicadas por cliente. Revisar a mano.', 1;
END

COMMIT TRANSACTION;

SELECT CONCAT('Sedes renombradas y desactivadas: ', @tocadas) AS Resultado;
