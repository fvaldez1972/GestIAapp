# Cierre de mejoras de catalogos - 2026-09-03

## Alcance implementado

1. Contactos: el backend exige puestos activos de la organizacion al introducir un valor nuevo. Un puesto historico sin cambios se conserva aunque este inactivo.
2. Coberturas: IdCoverageReason es una FK a BusinessCatalogItems. Se exige un motivo activo de la misma organizacion al crear la cobertura o cambiar su motivo. El mismo requisito aplica a coberturas creadas desde Solicitudes. Las notas quedan separadas.
3. Historicos: la migracion relaciona notas antiguas solo cuando contienen un unico motivo y existe una coincidencia inequivoca en su organizacion. No modifica las notas. Un motivo desconocido conserva FK nula; los cierres/cancelaciones historicos siguen permitidos sin reasignarlo.
4. Nuevas organizaciones: alta simple, alta con admin inicial y bootstrap inicial incluyen sus catalogos en la misma unidad de guardado. No se inventan puestos ni reglas de elegibilidad: esos valores se configuran segun la operacion de la organizacion.
5. Geografia: recurso versionado con 32 estados y 2,478 municipios mexicanos descargados del Servicio Web del Catalogo Unico de Claves Geoestadisticas de INEGI el 2026-09-03. No requiere conexiones a INEGI durante el uso de formularios. Incluye Mexico, nacionalidad Mexicana y motivos operativos iniciales.
6. Formularios: selectores por ID para motivos de cobertura, orden Pais -> Estado -> Municipio en sedes, zona horaria como selector IANA y nombre de estados/municipios existentes de solo lectura para proteger referencias historicas. No se convierten nombres nuevos, codigos de alta, direcciones ni justificaciones en catalogos.
7. Seguridad Admin: corregida una consulta EF que devolvia 500 en /api/v1/organization-security/permissions. El filtrado de roles asignables ahora se hace sobre entidades antes de proyectar las respuestas. Prueba SQL de regresion incluida.

## Fuente geografica y limites

- Fuente: https://www.inegi.org.mx/servicios/catalogounico.html
- Consultas: https://gaia.inegi.org.mx/wscatgeo/v2/mgee y https://gaia.inegi.org.mx/wscatgeo/v2/mgem/{claveEstado}.
- Recurso: backend/src/GestIA.Application/Catalogs/mexico-geography.json. Conservar este snapshot de 2026-09-03 porque una migracion historica lo utiliza; futuras actualizaciones deben agregar otro recurso y migracion.
- City representa el municipio en esta carga, no todas las localidades urbanas/rurales del pais. Otros paises/localidades siguen pudiendo administrarse manualmente con la jerarquia del catalogo.
- La importacion respeta codigos, nombres historicos e inactividad. Conserva registros locales no equivalentes a INEGI, por lo que una organizacion existente puede tener mas de 32 estados o 2,478 registros municipales. No se reemplazan ni borran datos locales.

## Verificacion

- Frontend: 85 pruebas correctas en 17 archivos y build production correcto.
- Backend base: 26 Domain, 47 Application, 4 Architecture, 44 Integration correctas. Adicionalmente: 26 pruebas SQL reales correctas, sin omisiones en esa ejecucion.
- SQL: validacion por organizacion, valores inactivos, conservacion historica, creacion con/sin admin, jerarquia, importacion repetible, concurrencia operativa, migracion de notas y consulta de permisos.
- Navegador: API real, autenticacion real de Super Admin y Admin, y base SQL temporal. Se probaron restricciones de plataforma, aislamiento entre organizaciones, soporte con alcance limitado, rechazo HTTP de puesto inactivo y selectores geograficos en 1440 y 390 px.
- Recorrido de rutas de ambos roles con 32 capturas, sin excepciones JavaScript ni respuestas 5xx. Se visitaron Inicio, Clientes, Servicios, Personal, Catalogos, Planeacion, Asistencia, Incidencias, Cobertura, Solicitudes, Reportes, Auditoria, Reglas documentales y Seguridad; tambien Monitor y Organizaciones para Super Admin.
- El recorrido de rutas no equivale a probar todas las combinaciones de negocio de cada modulo. Las altas/ediciones y concurrencia de esta etapa tienen pruebas especificas de servicio/SQL; no se hicieron escrituras de QA sobre los clientes reales de desarrollo.
- Evidencias: Prototipo/qa-screenshots/catalogs-real/report.json y capturas de la misma carpeta. Base temporal y proceso de API de QA eliminados al terminar.

## Publicacion

- Respaldo COPY_ONLY CHECKSUM verificado: /var/opt/mssql/data/db-gestia-dev-before-coverage-geography-20260903-2204.bak.
- Migracion aplicada: 20260903214645_CoverageCatalogReference.
- Totales en desarrollo: 98 State y 7,436 City entre tres organizaciones, incluidos valores locales preservados; 0 padres cruzados entre organizaciones.
- Backend y frontend reconstruidos y recreados en compose gestia. Sin cambios a gestia-pruebas ni al tunel de Cloudflare.
- /health/ready: 200. localhost:4200 y https://dev.gestia-demo.com: 200, main-4W4THZ72.js.
- Bases temporales remanentes: 0.
