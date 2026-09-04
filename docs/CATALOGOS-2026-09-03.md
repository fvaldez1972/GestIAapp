# Catalogos: directorio y gestion de valores

## Alcance implementado

- El modulo Catálogos abre un selector modal con busqueda y conteos por organizacion.
- El directorio viene de `GET /api/v1/catalogs/definitions`, no de valores ficticios.
- 10 catalogos administrables: habilidades, puestos, zonas, motivos de incidencia,
  cobertura y cancelacion, requisitos documentales y de evaluacion, restricciones
  de clientes y de servicios.
- 24 listas de solo lectura reflejan los enums del dominio: estados, tipos,
  prioridades, severidades, propositos de contacto y alcances. Sus valores no se
  pueden dar de alta como si fueran registros editables.
- El selector permite consultar los catalogos de elegibilidad sin quedar atrapado
  en la pestaña del editor de reglas.
- Alta y edicion persisten grupo, orden, sinonimos y estado. Incluye busqueda por
  sinonimos, filtro por grupo/estado y reactivacion.
- Los codigos y tipos existentes no se cambian para evitar romper referencias.
- El listado operativo conserva activos por defecto. La administracion solicita
  expresamente `includeInactive=true`.
- Permisos `CATALOGS.READ` y `CATALOGS.WRITE`, junto con el guard de organizacion,
  siguen aplicandose en servidor, no solo en el menu.

## Base de datos y despliegue

Migracion aplicada: `20260903205050_CatalogValueMetadata`.

Agrega `CatalogGroup`, `DisplayOrder` y `Synonyms` a `dbo.BusinessCatalogItems`.
Inicializa grupos por tipo, orden 1 y sinonimos vacios; conserva IDs, codigos y
relaciones existentes. Los cinco registros presentes antes de migrar se conservaron.

Respaldo COPY_ONLY con CHECKSUM y RESTORE VERIFYONLY exitosos:
`/var/opt/mssql/data/db-gestia-dev-before-catalog-metadata-20260903-c59d7c2a.bak`.

Imagenes recompiladas y contenedores principales backend/frontend saludables.
SQL Server, el stack `gestia-pruebas` y el tunel no fueron recreados.
Dominio dev y localhost sirven `main-PTLRGOWO.js`.

## Verificacion

- Suite frontend: 78 pruebas aprobadas.
- Suite backend general: 110 pruebas aprobadas, 18 SQL omitidas sin variable de conexion.
- 6 pruebas HTTP adicionales aprobadas: permisos, aislamiento y activos/inactivos.
- Las 18 pruebas SQL se ejecutaron aparte con conexion temporal: todas aprobadas,
  cero omitidas. Incluyen tres pruebas nuevas de catalogos y las 15 de concurrencia.
- Bases SQL de prueba aisladas por GUID y eliminadas al finalizar; conteo residual 0.
- Edge, UI compilada y API simulada: selector, listas fijas, edicion, reactivacion,
  recuperacion de errores y geometria en 1440, 768 y 390 px.
- Capturas y reporte de QA en `../Prototipo/qa-screenshots/catalogs`.

La revision visual utiliza sesiones y datos sinteticos, no demuestra un recorrido
autenticado de punta a punta contra datos reales del dominio dev. La persistencia
y autorizacion se verificaron mediante pruebas de SQL y HTTP respectivamente.

## Limites

Este cierre corresponde al modulo de catalogos. No declara terminado el resto
del plan de Admin. Las relaciones mostradas con otros modulos son orientativas;
no son un inventario exhaustivo de cada referencia operativa. Los tipos fijos
siguen definidos por el dominio y no admiten altas arbitrarias desde esta pantalla.
