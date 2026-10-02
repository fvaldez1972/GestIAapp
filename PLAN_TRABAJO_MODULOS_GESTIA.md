# Plan de trabajo para construir los modulos faltantes de GestIA

- Version: 1.0
- Fecha: 2026-08-27
- Estado: plan tactico de construccion
- Documento rector relacionado: `PLAN_MAESTRO_GESTIA.md`

## Actualizacion 2026-08-28: controles operativos formales y validacion integral

Quedo cerrado otro bloque de los puntos funcionales 2 al 9:

- Autorizaciones formales:
  - Nueva tabla `ApprovalRequests`.
  - Solicitudes de aprobacion por servicio y entidad operativa relacionada.
  - Flujo de decision: pendiente, aprobada, rechazada o cancelada.
  - Endpoints para listar, crear y resolver autorizaciones.
  - UI en Operacion para solicitar autorizacion y resolver pendientes.
- Cierre operativo diario:
  - Nueva tabla `OperationDayClosures`.
  - Cierre por servicio y fecha operativa.
  - Bloqueo si existen turnos sin asistencia o incidencias abiertas.
  - Reapertura con motivo obligatorio.
  - UI en tablero diario de Operacion.
- Planeacion:
  - La generacion desde patrones ahora bloquea patrones sin segmentos activos.
  - Las brechas de cobertura muestran patrones incompletos antes de publicar.
- Reportes:
  - Resumen operativo incluye autorizaciones pendientes y dias cerrados.
  - Exportacion CSV incluye los nuevos indicadores.
  - La exportacion CSV de reportes y auditoria se genera desde backend con permisos de API.
- Auditoria:
  - La consulta incluye documentos de negocio, catalogos, reglas de elegibilidad, habilidades, autorizaciones y cierres diarios.
  - El modulo de Auditoria cubre ahora las entidades principales de las etapas 1 a 7.
- UX/UI:
  - Operacion muestra etiquetas de negocio para autorizaciones en lugar de enums tecnicos.
  - Inicio y Reportes muestran autorizaciones pendientes y cierres diarios.
- Planeacion:
  - Comparativo detallado turno por turno contra la version publicada.
  - Deteccion visual de turnos agregados, eliminados, cambios de empleado y cambios de horario.
- Operacion:
  - Correcciones de asistencia pueden vincular una autorizacion aprobada del mismo registro.
  - Backend valida que la autorizacion corresponda al servicio, tipo y asistencia corregida.
- Validacion tecnica:
  - Migracion `OperationControls` creada y aplicada en SQL Server local.
  - Backend, frontend, pruebas unitarias/integracion y Docker validados.

Pendiente fino despues de este corte:

- Flujo multiusuario de autorizacion con bandeja por aprobador/grupo.
- Aplicar la decision aprobada como accion automatica para correcciones sensibles.
- Exportaciones Excel/PDF formales en backend, no solo CSV desde UI.
- Comparativo visual de planeacion turno por turno.
- Skeleton loaders y paginacion/ordenamiento estandarizados en todas las tablas.

## Actualizacion 2026-08-28: UX documental y relaciones reales

Quedo reforzado el modulo `/documentos` para operar como expediente documental más usable:

- Filtro por tipo de propietario y registro relacionado.
- Selectores reales para clientes, contratos, servicios, empleados, evaluaciones y solicitudes.
- Carga de contratos y servicios de todos los clientes visibles de la organizacion.
- Carga de evaluaciones desde el expediente de empleados.
- Metricas de documentos vencidos, por vencer en 30 dias, pendientes y sensibles.
- Estados visuales diferenciados para pendiente, validado, rechazado, vencido, archivado y sensible.
- Microcopy actualizado para evitar pedir IDs técnicos cuando ya existen registros relacionados.

## Actualizacion 2026-08-28: solicitudes, elegibilidad, planeacion y operacion avanzada

Quedo implementado un avance funcional para convertir solicitudes aprobadas en acciones reales del sistema:

- Alta de cliente desde solicitud mediante bloque `client`.
- Nuevo servicio desde solicitud mediante `service`, con soporte para crear sede, contrato y configuracion inicial.
- Cambio de configuracion de servicio mediante nueva configuracion versionada.
- Cambio de personal mediante creacion de asignacion real.
- Solicitud de cobertura convertida en cobertura operativa real.

Tambien se agrego la primera capa de elegibilidad de personal en asignaciones:

- Bloqueo de empleados no activos.
- Bloqueo si el empleado tiene documentos vencidos o rechazados.
- Bloqueo si el empleado tiene evaluaciones vencidas, no aprobadas o inconclusas.
- Validacion inicial contra perfil requerido de la posicion cuando existe un perfil capturado y el empleado tiene puesto registrado.

En planeacion quedo reforzado:

- Vista calendario de turnos por dia para la version seleccionada.
- Comparativo resumido entre borrador y version publicada.
- Bloqueo de publicacion cuando hay patrones de turno con posiciones/horarios incompletos.

En operacion quedo reforzado:

- Fecha operativa.
- Tablero diario con turnos, asistencia, incidencias y coberturas.
- Confirmacion masiva de asistencia pendiente del dia.
- Cierre formal de incidencias con nota de resolucion obligatoria.
- Carga real de archivos para evidencias operativas con storage persistente en Docker.

Pendiente para cerrar producto real:

- Catalogos formales de habilidades/restricciones por zona, cliente y servicio.
- Flujo multiusuario de autorizaciones para correcciones sensibles.
- Comparativo visual detallado turno por turno en planeacion.
- Exportaciones Excel/PDF formales.

## Actualizacion 2026-08-28: documentos reales, reemplazo de planeacion y controles operativos

Quedo implementado otro corte funcional para acercar GestIA a operacion real:

- Modulo documental completo MVP:
  - Nueva tabla `BusinessDocuments`.
  - Documentos por cliente, contrato, servicio, empleado, evaluacion y solicitud.
  - Categorias, estatus, vencimientos, indicador sensible, notas y referencia de archivo.
  - Carga real de archivos desde API.
  - Descarga de archivos desde API.
  - Pantalla `/documentos` con filtros, alta, edicion, desactivacion y descarga.
  - Permisos nuevos `DOCUMENTS.READ` y `DOCUMENTS.WRITE`.
- Planeacion avanzada:
  - Una planeacion nueva publicada puede reemplazar versiones publicadas traslapadas.
  - La version anterior queda marcada como `Superseded`, conservando historial.
  - El mensaje de UI ya comunica que publicar tambien puede reemplazar.
- Operacion avanzada:
  - Las correcciones de asistencia ya requieren nota de autorizacion.
  - La correccion conserva trazabilidad en notas operativas.
  - La UI permite seleccionar asistencia existente, corregirla y registrar la autorizacion.
- Reportes:
  - Nuevo reporte de elegibilidad de personal.
  - Filtros y exportacion CSV incluyen personal elegible/no elegible y motivos.
  - Reportes muestran razones de no elegibilidad por estatus, documentos y evaluaciones.

Queda como refinamiento de negocio:

- Catalogos finos de habilidades, restricciones por zona/cliente/servicio y requisitos por puesto.
- Exportaciones formales Excel/PDF.
- Autorizaciones con flujo multiusuario formal, no solo nota obligatoria.
- Comparativo visual detallado turno por turno entre borrador y publicado.
- UX fina transversal: formularios por pasos, skeleton loaders, ordenamiento/paginacion en todas las tablas.

## Actualizacion 2026-08-28: seguridad administrativa, catalogos y elegibilidad formal

Quedo implementado el corte funcional de los puntos 1, 2 y 3:

- Seguridad / administracion:
  - Edicion de usuario.
  - Reactivacion de usuario.
  - Baja logica de usuario.
  - Asignacion y remocion de accesos por organizacion/rol.
  - Edicion de roles personalizados.
  - Reactivacion y baja logica de roles personalizados.
  - Selector de organizacion activa en el shell cuando el usuario tiene mas de una organizacion.
- Catalogos de negocio:
  - Nuevo modulo `/catalogos`.
  - Nueva tabla `BusinessCatalogItems`.
  - Catalogos por organizacion para habilidades, puestos, requisitos documentales, requisitos de evaluacion, restricciones, zonas y motivos.
  - Permisos nuevos `CATALOGS.READ` y `CATALOGS.WRITE`.
- Elegibilidad formal:
  - Nueva tabla `EligibilityRequirements`.
  - Reglas por organizacion, cliente, servicio o posicion.
  - Tipos de regla: habilidad, documento, evaluacion y restriccion.
  - Reglas bloqueantes y no bloqueantes.
  - Nueva tabla `EmployeeSkills`.
  - Habilidades asignables al expediente del empleado desde Personal.
  - Endpoint de validacion `GET /api/v1/catalogs/eligibility/check`.
  - Asignaciones consumen la elegibilidad configurada antes de guardar.
  - Reporte de elegibilidad considera reglas configuradas a nivel organizacion.

Pendiente para convertir este corte en operacion fina:

- Reglas por zona con geografia real.
- Restricciones empleado-cliente/servicio individualizadas.
- Pantalla dedicada tipo matriz: empleado vs servicio/posicion.
- Pruebas de UI/e2e de administracion y elegibilidad.
- [x] Aplicar la migracion local cuando Docker/SQL Server vuelva a estar disponible.

## 1. Proposito

Este documento baja el plan maestro a un camino de trabajo implementable para construir los modulos faltantes de GestIA por partes. La intencion es que cada modulo avance como recorrido completo: modelo de dominio, persistencia SQL Server, endpoints, pantalla Angular, validaciones, pruebas y documentacion.

El alcance actual ya cuenta con:

- Backend .NET 10 separado en `Domain`, `Application`, `Infrastructure` y `Api`.
- Frontend Angular 22 con shell visual basado en INSPINIA.
- SQL Server local dockerizado.
- Primer modelo fisico con clientes, servicios, empleados y asignaciones base.
- Primer modulo funcional de organizaciones y clientes.
- Convenciones de base de datos documentadas en `docs/database/DATABASE_STANDARDS.md`.

## 2. Principios de construccion

1. Cada modulo debe cerrar una necesidad real de negocio, no solo una tabla.
2. El backend sera la autoridad de reglas, permisos, auditoria y aislamiento por organizacion.
3. El frontend consumira DTOs explicitos y no dependera de entidades internas de .NET.
4. Las migraciones se crearan solo cuando el modelo fisico del corte este razonablemente definido.
5. SQL Server seguira siendo el motor de desarrollo y produccion.
6. Todo cambio de modelo debe respetar los estandares de nombres, auditoria, borrado logico y llaves.
7. Los registros operativos se desactivan o corrigen con trazabilidad; no se eliminan fisicamente en flujo normal.
8. Las pantallas deben ser operativas, densas y claras, no tipo landing page.

## 3. Orden recomendado de entregas

| Entrega | Objetivo | Resultado esperado |
| --- | --- | --- |
| 0 | Cerrar plataforma base | Login, usuario real, roles, permisos y organizacion activa |
| 1 | Completar expediente de cliente | Clientes con sedes, contactos, configuracion inicial y documentos/requisitos |
| 2 | Contratos, servicios y configuracion | Servicio contratado con vigencia, anexo/configuracion y parametros operativos |
| 3 | Personal operativo | Empleados, documentos, evaluaciones, estatus y elegibilidad |
| 4 | Posiciones y turnos | Puestos/posiciones requeridas, patrones de horario y reglas de cobertura |
| 5 | Asignaciones y planeacion | Personal asignado, versiones de planeacion y publicacion |
| 6 | Asistencia, incidencias y coberturas | Confirmacion operativa, excepciones, sustituciones y evidencias |
| 7 | Reportes y control | Dashboard, auditoria consultable, exportaciones y lectura ejecutiva |
| 8 | Piloto y endurecimiento | Seguridad, datos iniciales, rendimiento, respaldos y preparacion productiva |

## 4. Entrega 0: plataforma base

### Objetivo

Reemplazar el actor local temporal por identidad real y asegurar que toda accion quede ligada a usuario, rol y organizacion.

### Backend

- [x] Definir proveedor de identidad: JWT local para MVP.
- [x] Crear usuarios, membresias, roles y permisos base.
- [x] Agregar contexto de usuario autenticado.
- [x] Proteger endpoints iniciales con autorizacion por permiso.
- [x] Login local y logout del lado frontend.
- [x] Sustituir `HttpActorContext` temporal por claims del JWT.
- [x] Manejo global de sesion expirada.
- [ ] Agregar refresh token o renovacion controlada de sesion.
- [x] Completar administracion de usuarios, roles y permisos desde UI.
- [ ] Aplicar alcance por organizacion en todos los modulos nuevos.

### Base de datos candidata

| Tabla | Proposito |
| --- | --- |
| `Users` | Identidad interna o vinculada a proveedor externo |
| `OrganizationMemberships` | Relacion usuario-organizacion |
| `Roles` | Roles administrables |
| `Permissions` | Permisos estables por modulo/accion |
| `RolePermissions` | Permisos asignados a roles |
| `UserRoles` | Roles por usuario/membresia |
| `AuditEvents` | Auditoria funcional consultable |

### Frontend

- [x] Login.
- [x] Guardas de ruta.
- [x] Token JWT en requests HTTP.
- [x] Logout.
- [x] Manejo global de sesion expirada.
- [x] Selector de organizacion si el usuario tiene mas de una.
- [x] Menus visibles segun permisos.

### Pruebas minimas

- Login correcto e incorrecto.
- Endpoint bloqueado sin token.
- Endpoint bloqueado sin permiso.
- Aislamiento por organizacion.
- Auditoria con usuario real.

## 5. Entrega 1: expediente de cliente

### Objetivo

Completar el alta y administracion de cliente con sedes, contactos, datos fiscales/operativos y requisitos iniciales.

### Backend

- [x] Completar casos de uso de sedes.
- [x] Completar casos de uso de contactos.
- [x] Agregar validaciones de domicilio, correo, telefono, RFC y datos fiscales.
- [x] Definir si razon social y cliente comercial son una sola entidad o entidades separadas.
- [x] Preparar estructura para documentos/requisitos del cliente mediante `BusinessDocuments`.
- [x] Ejecutar solicitudes aprobadas con validación de vínculos mínimos por tipo.

### Base de datos actual y extensiones

| Tabla | Estado | Accion |
| --- | --- | --- |
| `Clients` | Existe | Completar campos y reglas finales |
| `ClientSites` | Existe | Endpoints y pantalla implementados |
| `ClientContacts` | Existe | Endpoints y pantalla implementados |
| `ClientRequirements` | Diferido | Solo si el negocio confirma utilidad fuera del alcance actual |
| `BusinessDocuments` | Implementada | Documentos por cliente y otros propietarios de negocio |

### Frontend

- [x] Pantalla detalle de cliente con tabs: perfil, sedes, contactos, servicios.
- [x] Alta/edicion de sedes.
- [x] Alta/edicion de contactos.
- [x] Estado activo/inactivo visible.
- [x] Busqueda por nombre, RFC, codigo y sede.
- [x] Tablero de seguimiento de solicitudes por estado con acciones rápidas.
- [x] Ejecución controlada de solicitudes aprobadas desde la UI.

### Pruebas minimas

- [x] No permitir sede sin cliente.
- [x] No permitir contacto sin datos minimos.
- [x] No duplicar sede/codigo dentro del cliente si se define una clave.
- [x] Baja logica conserva historial.

## 6. Entrega 2: contratos, servicios y configuracion

### Objetivo

Modelar lo que el contrato y la carta compromiso describen: servicio contratado, vigencia, configuracion operativa y condiciones iniciales.

### Backend

- [x] Crear contratos de servicio por cliente.
- [x] Crear servicios vinculados a contrato y sede.
- [x] Crear configuraciones de servicio versionables.
- [x] Definir estados base: borrador, revision, firmado, vigente, vencido y terminado.
- [x] Validar vigencias base y pertenencia cliente/sede/contrato.
- [x] Preparar historial formal de cambios de configuracion mediante configuraciones versionables y nueva configuracion por cambio aprobado.

### Base de datos actual y extensiones

| Tabla | Estado | Accion |
| --- | --- | --- |
| `ServiceContracts` | Existe | Completar endpoints y reglas |
| `Services` | Existe | Completar endpoints y reglas |
| `ServiceConfigurations` | Existe | Configuraciones versionables implementadas |
| `ServiceConfigurationVersions` | No requerida MVP | El historico vive como registros versionados en `ServiceConfigurations` |
| `ServiceRequirementItems` | Candidata | Si se decide capturar requisitos configurables |

### Frontend

- [x] Tab/seccion de servicios dentro del cliente.
- [x] Alta/edicion/baja logica de contrato.
- [x] Alta/edicion/baja logica de servicio.
- [x] Formulario de configuracion operativa.
- [x] Indicador de vigencias y estados.

### Pruebas minimas

- [x] No permitir servicio sin cliente/sede valida.
- [x] No permitir vigencia final menor a inicio.
- [x] No permitir configuracion incompleta.
- [x] Mantener historico formal cuando cambie la configuracion critica.

## 7. Entrega 3: personal operativo

### Objetivo

Construir el expediente del empleado/persona operativa desde la ficha tecnica: datos basicos, documentos, evaluaciones, estatus y elegibilidad.

### Backend

- [x] Completar CRUD de empleados.
- [x] Agregar documentos del empleado.
- [x] Agregar evaluaciones y resultados.
- [x] Definir estatus operativos base: candidato, activo, suspendido/permiso, inactivo y baja.
- [x] Definir campos personales sensibles y politica de privacidad MVP mediante documentos sensibles.
- [x] Preparar reglas de elegibilidad para asignaciones.

### Base de datos actual y extensiones

| Tabla | Estado | Accion |
| --- | --- | --- |
| `Employees` | Existe | Completar campos, endpoints y pantalla |
| `EmployeeDocuments` | Existe | Implementar expediente documental |
| `EmployeeEvaluations` | Existe | Implementar evaluaciones |
| `EmployeeSkills` | Implementada | Habilidades por empleado |
| `EmployeeStatusHistory` | Candidata | Si se requiere trazabilidad formal de estatus |

### Frontend

- [x] Listado de empleados.
- [x] Detalle con perfil, documentos y evaluaciones.
- [x] Filtro por estatus y busqueda general.
- [x] Captura de documentos pendientes/recibidos/vencidos.
- [x] Vista de asignaciones cubierta desde Planeacion por servicio.
- [x] Filtros/reportes de elegibilidad cubiertos desde Reportes y Catalogos.

### Pruebas minimas

- [x] No permitir empleado duplicado por numero interno.
- [x] Validar fechas de documentos y evaluaciones.
- [x] No permitir asignar empleado inactivo o no elegible.
- [x] Proteger modulo por permiso `WORKFORCE.READ/WRITE`.

## 8. Entrega 4: posiciones y turnos

### Objetivo

Separar claramente el servicio contratado de las posiciones requeridas y los horarios que se deben cubrir.

### Backend

- [x] Definir posicion requerida por servicio.
- [x] Definir perfil requerido por posicion.
- [x] Definir patrones de turno y segmentos.
- [x] Validar horarios nocturnos y cruces de dia.
- [x] Definir capacidad/cantidad requerida.

### Base de datos candidata

| Tabla | Proposito |
| --- | --- |
| `Positions` | Implementada: puestos/posiciones autorizadas por servicio |
| `ShiftPatterns` | Implementada: patron reusable de horario |
| `ShiftSegments` | Implementada: segmentos de trabajo/descanso por patron |
| `PositionShiftPatterns` | No requerida en MVP; el patron cuelga directamente de la posicion |

### Frontend

- [x] Configurador de posiciones por servicio.
- [x] Configurador de patrones de turno.
- [x] Visualizacion semanal compacta.
- [x] Validaciones visibles de horarios incompletos o traslapados.

### Pruebas minimas

- [x] No permitir posicion sin servicio valido.
- [x] No permitir patrones sin segmentos antes de publicar/activar planeacion.
- [x] Validar hora inicio/fin y cruces de dia.
- [x] No permitir traslapes invalidos dentro de un patron.

## 9. Entrega 5: asignaciones y planeacion

### Objetivo

Asignar personal a posiciones, detectar conflictos y publicar planeaciones versionadas.

### Backend

- [x] Crear asignaciones con vigencia.
- [x] Vincular asignaciones a posiciones del servicio.
- [x] Validar que el empleado pertenezca a la organizacion y este activo.
- [x] Validar traslapes basicos por empleado.
- [x] Validar elegibilidad contra documentos/evaluaciones/perfil.
- [x] Crear versiones de planeacion por periodo.
- [x] Crear turnos programados por version, posicion y empleado.
- [x] Publicar version y bloquear cambios directos.
- [x] Reemplazar una planeacion publicada con nueva version.

### Base de datos actual y extensiones

| Tabla | Estado | Accion |
| --- | --- | --- |
| `ServiceAssignments` | Evolucionada | Agregado `IdPosition`, endpoints y reglas MVP de asignacion |
| `ScheduleVersions` | Implementada | Versiones de planeacion con estado borrador/publicado/reemplazado |
| `ScheduledShifts` | Implementada | Turnos programados por version, posicion y empleado |
| `AssignmentConflicts` | Candidata | Si se desea guardar conflictos calculados |

### Frontend

- [x] Contratos TypeScript y cliente HTTP para asignaciones.
- [x] Vista de asignaciones por servicio.
- [x] Contratos TypeScript y cliente HTTP para versiones/turnos programados.
- [x] Vista lista por periodo/version.
- [x] Indicadores de conflicto.
- [x] Publicacion de planeacion.
- [x] Comparacion de borrador vs publicado.

### Pruebas minimas

- [x] Smoke API: crear asignacion `SMOKE-EMP` -> `SMOKE-POS`.
- [x] Smoke API: crear version `SMOKE-SCHEDULE-ENTREGA-5`, turno y publicar.
- [x] No permitir traslapes por empleado.
- [x] No permitir publicar planeacion vacia.
- [x] La version publicada debe quedar inmutable.
- [x] Reemplazo de version conserva historial.

## 10. Entrega 6: asistencia, incidencias y coberturas

### Objetivo

Registrar lo que realmente ocurrio en operacion: asistencia, faltas, retardos, incidencias, sustituciones y evidencias.

### Backend

- [x] Registrar asistencia real por turno programado publicado.
- [x] Confirmar asistencia por excepcion mediante `AttendanceRecords`.
- [x] Registrar incidencias por servicio, turno y empleado opcional.
- [x] Registrar coberturas y sustitutos con intervalos.
- [x] Adjuntar evidencias o referencias de almacenamiento.
- [x] Autorizar correcciones sensibles.

### Base de datos candidata

| Tabla | Estado | Proposito |
| --- | --- | --- |
| `AttendanceRecords` | Implementada | Asistencia real por turno programado, empleado, fecha, estado, entrada/salida y minutos de retardo |
| `Incidents` | Implementada | Excepciones operativas por servicio, turno opcional, empleado opcional, severidad y estado |
| `CoverageRecords` | Implementada | Sustituciones e intervalos cubiertos por empleado original y reemplazo |
| `OperationEvidences` | Implementada | Evidencias o referencias de archivo ligadas a asistencia, incidencia o cobertura |
| `ApprovalRequests` | Implementada | Autorizaciones para cambios sensibles |

### Frontend

- [x] Consola de lectura operativa por organizacion, cliente y servicio.
- [x] Tablero resumen de asistencia, incidencias y coberturas capturadas.
- [x] Formulario MVP para guardar asistencia por turno publicado.
- [x] Formulario MVP para registrar incidencia de servicio o turno.
- [x] Formulario MVP para registrar cobertura con sustituto.
- [x] Confirmacion masiva por excepcion.
- [x] Estado de evidencia.
- [x] Estado de autorizacion.

### Pruebas minimas

- [x] Smoke API: crear/actualizar asistencia `SMOKE-ATTENDANCE-ENTREGA-6`.
- [x] Smoke API: crear incidencia `SMOKE-INCIDENT-ENTREGA-6`.
- [x] Smoke API: crear cobertura `SMOKE-COVERAGE-ENTREGA-6`.
- [x] No registrar asistencia fuera de turno sin regla aprobada.
- [x] No permitir cobertura sin sustituto valido.
- [x] No permitir intervalos de cobertura invalidos.
- [x] Auditar correcciones de asistencia e incidencias.

## 11. Entrega 7: reportes y control

### Objetivo

Dar visibilidad a operacion, cumplimiento y trazabilidad sin convertir reportes en fuente de verdad.

### Backend

- [x] Crear consulta de lectura para resumen operativo MVP.
- [x] Crear endpoint inicial `GET /api/v1/reports/operations-summary`.
- [x] Crear auditoria consultable.
- [x] Exportar clientes, servicios, empleados, asistencia e incidencias desde backend.
- [x] Exportar auditoria consultable MVP desde backend.
- [x] Preparar proyecciones reconstruibles como consultas calculadas desde datos transaccionales.

### Base de datos candidata

| Objeto | Estado | Proposito |
| --- | --- | --- |
| `GET /api/v1/reports/operations-summary` | Implementado MVP | Resumen calculado desde asistencia, incidencias y coberturas |
| `GET /api/v1/audit/events` | Implementado MVP | Trazabilidad funcional reconstruida desde entidades auditables |
| `OperationDayClosures` | Implementada | Indicadores de cierre por dia |
| `GET /api/v1/reports/operations-by-service` | Implementado MVP | Cobertura y señales operativas por servicio |
| `AttendanceRecords` + `CoverageRecords` | Implementado MVP | Quien cubrio realmente cada turno |

### Frontend

- [x] Dashboard operativo.
- [x] Filtros por organizacion, cliente, servicio, periodo y estado.
- [x] Exportaciones controladas MVP.
- [x] Vista de auditoria por entidad.

### Pruebas minimas

- [x] Smoke API: resumen operativo devuelve asistencia, incidencias, coberturas y minutos cubiertos.
- [x] Reportes respetan permisos y organizacion.
- [x] Conteos coinciden con datos transaccionales del smoke.
- [x] Exportaciones no exponen datos sin permiso.
- [x] Proyecciones pueden reconstruirse.

## 12. Entrega 8: piloto y endurecimiento

### Objetivo

Preparar GestIA para uso real controlado.

### Trabajo tecnico

- Datos semilla por ambiente.
- Migraciones revisadas contra SQL Server real.
- Estrategia de respaldos y restauracion.
- Secretos fuera del repositorio.
- Registro privado de imagenes.
- HTTPS y dominio.
- Logs estructurados, metricas y alertas.
- Revision de seguridad y dependencias.
- Pruebas e2e de recorridos criticos.
- Pruebas de rendimiento para planeacion y reportes.

## 13. Patron tecnico por modulo

Cada modulo nuevo debe seguir esta secuencia:

1. Confirmar nombres de negocio y reglas minimas.
2. Crear o ajustar entidades en `backend/src/GestIA.Domain`.
3. Crear contratos, servicios y repositorios en `backend/src/GestIA.Application`.
4. Implementar persistencia en `backend/src/GestIA.Infrastructure`.
5. Agregar endpoints en `backend/src/GestIA.Api/Endpoints`.
6. Agregar pantalla, servicio HTTP y modelos en `frontend/src/app/features`.
7. Agregar pruebas unitarias, integracion y frontend segun riesgo.
8. Actualizar documentacion y plan maestro.
9. Generar migracion si cambio el modelo fisico.
10. Validar con `dotnet test`, `dotnet format`, `npm run test`, `npm run build` y Docker Compose.

## 14. Prioridad inmediata

La Entrega 0 ya inicio con JWT local para MVP: login, usuario administrador bootstrap, permisos base, rutas protegidas y endpoints iniciales protegidos. Lo que queda de plataforma base es administracion completa de usuarios/roles, sesion expirada, selector de organizacion y permisos visibles en menu.

El siguiente paso recomendado es continuar con sedes y contactos del cliente, porque ya tenemos identidad y permisos iniciales para proteger el flujo. Lo siguiente depende de:

- quien hizo el cambio;
- para que organizacion trabaja;
- que permiso tiene;
- que datos puede consultar;
- como se audita la accion.

Despues de eso, el orden mas productivo es:

1. Sedes y contactos del cliente.
2. Contratos, servicios y configuracion.
3. Empleados, documentos y evaluaciones.
4. Posiciones y patrones de turno.
5. Asignaciones y planeacion.
6. Asistencia, incidencias, coberturas y reportes.

## 15. Decisiones pendientes antes de codificar mas negocio

- Elegir autenticacion local con JWT o proveedor externo.
- Confirmar si el termino rector sera organizacion, empresa o compania.
- Confirmar relacion entre cliente, razon social, sede y sucursal.
- Confirmar si empleado, guardia, elemento y persona operativa son sinonimos.
- Confirmar que datos de la ficha tecnica son obligatorios en primer alcance.
- Confirmar estados oficiales de cliente, servicio, empleado, asignacion e incidencia.
- Confirmar que reportes son indispensables para el primer piloto.
- Confirmar politica de almacenamiento de documentos y evidencias.

## 16. Definicion de terminado

Un modulo se considera listo cuando cumple:

- Reglas principales validadas.
- Modelo SQL Server creado o actualizado con migracion revisada.
- Endpoints protegidos y documentados.
- Pantalla funcional integrada al shell.
- Validaciones en servidor y frontend.
- Auditoria y aislamiento por organizacion.
- Pruebas automaticas verdes.
- Contenedores levantan sanos.
- Plan maestro actualizado.
