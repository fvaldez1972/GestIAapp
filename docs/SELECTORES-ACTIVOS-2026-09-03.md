# Selectores activos y catalogos geograficos

Estado historico de la primera entrega. Las limitaciones de validacion de contactos/coberturas, inicializacion y geografia se ampliaron en [CATALOGOS-CIERRE-2026-09-03.md](CATALOGOS-CIERRE-2026-09-03.md).

## Implementacion

- Catalogos editables por organizacion: Country, State, City y Nationality. El directorio contiene 14 catalogos editables y 24 referencias fijas.
- Country -> State -> City usa IdParentCatalogItem; el servidor comprueba tipo, organizacion y actividad de los padres. Los hijos de padres inactivos no aparecen como opciones.
- GET /api/v1/catalogs/options permite consultar opciones activas con permisos de lectura del modulo consumidor, sin conceder mantenimiento de catalogos. Conserva el aislamiento por organizacion.
- CatalogSelect comparte carga, errores, reintento y filtros dependientes. Los valores historicos que ya no estan disponibles se muestran deshabilitados, sin ofrecerlos para nuevas selecciones.
- Clientes: nacionalidad, ubicacion de sedes y puesto de contactos. Personal: puesto y pais/estado/municipio. Solicitudes: nacionalidad y ubicacion al ejecutar altas. Operacion: motivos de incidencia y cobertura.
- Las listas de clientes y empleados para seleccion recorren todas las paginas y excluyen inactivos. Personal solicita tambien Status=Active. Aplicado a Planeacion, Operacion, Solicitudes, Documentos, Catalogos y Reportes; Servicios ya recorria las paginas de personal y pagina su buscador de clientes.
- Los nombres de nuevos clientes y personas siguen siendo campos de texto. Clientes y Personal conservan sus entidades propias, no se duplican como valores de catalogo.
- El backend valida nacionalidad de clientes, ubicaciones de sedes/personal, puesto de personal y tipo de incidencia. Permite conservar valores historicos sin cambios. El puesto de contactos y motivo de cobertura tienen selector activo en UI; este ultimo sigue almacenado en notas, no en una FK de catalogo.

## Base de datos

- Migracion: 20260903211914_GeographicCatalogRelations.
- Nuevos campos: BusinessCatalogItems.IdParentCatalogItem y Employees.CountryCode nullable.
- Se reutilizan ubicaciones de sedes activas, nacionalidades de clientes y puestos de empleados activos. Se inicializan los motivos operativos anteriormente fijos.
- No se infiere el pais de empleados existentes ni se carga un padrón geografico mundial. Los valores adicionales se administran en Catalogos. Las organizaciones creadas despues de esta migracion deben configurar sus catalogos.
- No se eliminan datos existentes ni se reactivan registros inactivos.

## Verificacion

- Frontend: 83 pruebas, 17 archivos, todas correctas; compilacion production correcta.
- Backend: 26 Domain, 47 Application, 4 Architecture y 44 Integration correctas. Las 20 pruebas dependientes de SQL se ejecutaron por separado con SQL Server temporal: 20 correctas, ninguna omitida en esa ejecucion.
- Navegador con API simulada sobre la compilacion real: escritorio 1440 y movil 390; cascadas geograficas, payload de sede, exclusiones activas, seleccion de clientes posteriores al registro 100 y formulario de personal. No equivale a una auditoria autenticada completa de todos los modulos en dev.
- Capturas y reporte: Prototipo/qa-screenshots/active-selects.

## Despliegue de desarrollo

- Respaldo COPY_ONLY CHECKSUM verificado antes de migrar: /var/opt/mssql/data/db-gestia-dev-before-geographic-catalogs-20260903-2138.bak.
- Migracion aplicada a db-gestia-dev; 0 relaciones geograficas entre organizaciones distintas y 0 bases temporales remanentes.
- Totales: City 3, Country 3, CoverageReason 18, IncidentReason 15, JobPosition 4, Nationality 3, Skill 4, State 3.
- Reconstruidos backend/frontend y recreados solamente esos servicios del compose gestia. Ambos healthy. Sin cambios al stack gestia-pruebas ni al tunel.
- /health devuelve 200. localhost:4200 y https://dev.gestia-demo.com devuelven 200 y sirven main-L7WFKKOW.js.
