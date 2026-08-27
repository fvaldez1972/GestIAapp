# Plan de trabajo para construir los modulos faltantes de GestIA

- Version: 1.0
- Fecha: 2026-08-27
- Estado: plan tactico de construccion
- Documento rector relacionado: `PLAN_MAESTRO_GESTIA.md`

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
- [ ] Agregar refresh token o renovacion controlada de sesion.
- [ ] Completar administracion de usuarios, roles y permisos desde UI.
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
- [ ] Manejo global de sesion expirada.
- [ ] Selector de organizacion si el usuario tiene mas de una.
- [ ] Menus visibles segun permisos.

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

- Completar casos de uso de sedes.
- Completar casos de uso de contactos.
- Agregar validaciones de domicilio, correo, telefono, RFC y datos fiscales.
- Definir si razon social y cliente comercial son una sola entidad o entidades separadas.
- Preparar estructura para documentos/requisitos del cliente, aunque el primer alcance no los use completo.

### Base de datos actual y extensiones

| Tabla | Estado | Accion |
| --- | --- | --- |
| `Clients` | Existe | Completar campos y reglas finales |
| `ClientSites` | Existe | Crear endpoints y pantalla |
| `ClientContacts` | Existe | Crear endpoints y pantalla |
| `ClientRequirements` | Candidata | Solo si el negocio confirma utilidad en primer alcance |
| `ClientDocuments` | Candidata | Definir antes de almacenar archivos |

### Frontend

- Pantalla detalle de cliente con tabs: perfil, sedes, contactos, servicios.
- Alta/edicion de sedes.
- Alta/edicion de contactos.
- Estado activo/inactivo visible.
- Busqueda por nombre, RFC, codigo y sede.

### Pruebas minimas

- No permitir sede sin cliente.
- No permitir contacto sin datos minimos.
- No duplicar sede/codigo dentro del cliente si se define una clave.
- Baja logica conserva historial.

## 6. Entrega 2: contratos, servicios y configuracion

### Objetivo

Modelar lo que el contrato y la carta compromiso describen: servicio contratado, vigencia, configuracion operativa y condiciones iniciales.

### Backend

- Crear contratos de servicio por cliente.
- Crear servicios vinculados a contrato y sede.
- Crear configuraciones de servicio versionables.
- Definir estados: borrador, activo, suspendido, terminado, cancelado.
- Validar vigencias y traslapes.
- Preparar historial de cambios de configuracion.

### Base de datos actual y extensiones

| Tabla | Estado | Accion |
| --- | --- | --- |
| `ServiceContracts` | Existe | Completar endpoints y reglas |
| `Services` | Existe | Completar endpoints y reglas |
| `ServiceConfigurations` | Existe | Definir versionado/configuracion |
| `ServiceConfigurationVersions` | Candidata | Si se requiere historico formal |
| `ServiceRequirementItems` | Candidata | Si se decide capturar requisitos configurables |

### Frontend

- Tab de servicios dentro del cliente.
- Alta de contrato.
- Alta de servicio.
- Formulario de configuracion operativa.
- Indicador de vigencias y estados.

### Pruebas minimas

- No permitir servicio sin cliente/sede valida.
- No permitir vigencia final menor a inicio.
- No permitir activar servicio incompleto.
- Mantener historico cuando cambie la configuracion critica.

## 7. Entrega 3: personal operativo

### Objetivo

Construir el expediente del empleado/persona operativa desde la ficha tecnica: datos basicos, documentos, evaluaciones, estatus y elegibilidad.

### Backend

- Completar CRUD de empleados.
- Agregar documentos del empleado.
- Agregar evaluaciones y resultados.
- Definir estatus operativos: candidato, activo, suspendido, baja, no elegible.
- Definir campos personales sensibles y politica de privacidad.
- Preparar reglas de elegibilidad para asignaciones.

### Base de datos actual y extensiones

| Tabla | Estado | Accion |
| --- | --- | --- |
| `Employees` | Existe | Completar campos, endpoints y pantalla |
| `EmployeeDocuments` | Existe | Implementar expediente documental |
| `EmployeeEvaluations` | Existe | Implementar evaluaciones |
| `WorkerProfiles` | Candidata | Definir perfiles/habilidades |
| `EmployeeStatusHistory` | Candidata | Si se requiere trazabilidad formal de estatus |

### Frontend

- Listado de empleados.
- Detalle con tabs: perfil, documentos, evaluaciones, asignaciones.
- Filtros por estatus, zona y elegibilidad.
- Captura de documentos pendientes/recibidos/vencidos.

### Pruebas minimas

- No permitir empleado duplicado por numero interno.
- Validar fechas de documentos y evaluaciones.
- No permitir asignar empleado inactivo o no elegible.
- Proteger datos sensibles por permiso.

## 8. Entrega 4: posiciones y turnos

### Objetivo

Separar claramente el servicio contratado de las posiciones requeridas y los horarios que se deben cubrir.

### Backend

- Definir posicion requerida por servicio.
- Definir perfil requerido por posicion.
- Definir patrones de turno y segmentos.
- Validar horarios nocturnos y cruces de dia.
- Definir capacidad/cantidad requerida.

### Base de datos candidata

| Tabla | Proposito |
| --- | --- |
| `Positions` | Puestos/posiciones autorizadas por servicio |
| `ShiftPatterns` | Patron reusable de horario |
| `ShiftSegments` | Segmentos de trabajo/descanso por patron |
| `PositionShiftPatterns` | Relacion posicion-patron si se requiere flexibilidad |

### Frontend

- Configurador de posiciones por servicio.
- Configurador de patrones de turno.
- Visualizacion semanal compacta.
- Validaciones visibles de horarios incompletos o traslapados.

### Pruebas minimas

- No permitir posicion sin servicio activo.
- No permitir patrones sin segmentos.
- Validar hora inicio/fin y cruces de dia.
- No permitir traslapes invalidos dentro de un patron.

## 9. Entrega 5: asignaciones y planeacion

### Objetivo

Asignar personal a posiciones, detectar conflictos y publicar planeaciones versionadas.

### Backend

- Crear asignaciones con vigencia.
- Validar traslapes por empleado.
- Validar elegibilidad contra documentos/evaluaciones/perfil.
- Crear versiones de planeacion por periodo.
- Publicar version y bloquear cambios directos.
- Reemplazar una planeacion publicada con nueva version.

### Base de datos actual y extensiones

| Tabla | Estado | Accion |
| --- | --- | --- |
| `ServiceAssignments` | Existe | Evolucionar a reglas completas |
| `ScheduleVersions` | Candidata | Versiones de planeacion |
| `ScheduledShifts` | Candidata | Turnos generados/publicados |
| `AssignmentConflicts` | Candidata | Si se desea guardar conflictos calculados |

### Frontend

- Vista de asignaciones por servicio.
- Vista calendario/lista por periodo.
- Indicadores de conflicto.
- Publicacion de planeacion.
- Comparacion de borrador vs publicado.

### Pruebas minimas

- No permitir traslapes por empleado.
- No permitir publicar con conflictos criticos.
- La version publicada debe quedar inmutable.
- Reemplazo de version conserva historial.

## 10. Entrega 6: asistencia, incidencias y coberturas

### Objetivo

Registrar lo que realmente ocurrio en operacion: asistencia, faltas, retardos, incidencias, sustituciones y evidencias.

### Backend

- Generar asistencia esperada desde planeacion publicada.
- Confirmar asistencia por excepcion.
- Registrar incidencias por turno.
- Registrar coberturas y sustitutos.
- Adjuntar evidencias o referencias de almacenamiento.
- Autorizar correcciones sensibles.

### Base de datos candidata

| Tabla | Proposito |
| --- | --- |
| `AttendanceRecords` | Asistencia esperada y real |
| `Incidents` | Excepciones operativas |
| `CoverageRecords` | Sustituciones e intervalos cubiertos |
| `EvidenceItems` | Evidencias o referencias de archivo |
| `ApprovalRequests` | Autorizaciones para cambios sensibles |

### Frontend

- Tablero diario de operacion.
- Confirmacion masiva por excepcion.
- Formulario de incidencia.
- Formulario de cobertura.
- Estado de evidencia/autorizacion.

### Pruebas minimas

- No registrar asistencia fuera de turno sin regla aprobada.
- No permitir cobertura sin sustituto valido.
- No permitir intervalos de cobertura invalidos.
- Auditar correcciones de asistencia e incidencias.

## 11. Entrega 7: reportes y control

### Objetivo

Dar visibilidad a operacion, cumplimiento y trazabilidad sin convertir reportes en fuente de verdad.

### Backend

- Crear consultas de lectura optimizadas.
- Crear dashboard inicial.
- Crear auditoria consultable.
- Exportar clientes, servicios, empleados, asistencia e incidencias.
- Preparar proyecciones reconstruibles.

### Base de datos candidata

| Objeto | Proposito |
| --- | --- |
| `AuditEvents` | Trazabilidad funcional |
| `DailyOperationSummary` | Indicadores por dia |
| `ServiceCoverageSummary` | Cobertura por servicio |
| `EffectivePersonnel` | Quien cubrio realmente cada turno |

### Frontend

- Dashboard operativo.
- Filtros por organizacion, cliente, servicio, periodo y estado.
- Exportaciones controladas.
- Vista de auditoria por entidad.

### Pruebas minimas

- Reportes respetan permisos y organizacion.
- Conteos coinciden con datos transaccionales.
- Exportaciones no exponen datos sin permiso.
- Proyecciones pueden reconstruirse.

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
