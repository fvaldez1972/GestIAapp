# Mapa del sistema GestIA

**Fecha del levantamiento: 6 de septiembre de 2026.** Estado del repositorio: rama
`s0/feature/gestIaProject/filtro-organizacion`, commit `6b27d4d`.

Este documento describe **lo que el código hace**, no lo que la documentación dice que hace. Cada
afirmación lleva el archivo donde vive. Donde el código y un documento del proyecto no coinciden,
gana el código y la discrepancia queda anotada en la sección 8.

Cómo se levantó: se recorrieron los 165 endpoints de `backend/src/GestIA.Api/Endpoints/`, los
servicios de `GestIA.Application`, las convenciones de `GestIA.Infrastructure/Persistence` y las
quince features del frontend. Los mensajes de error que aparecen entre comillas son los literales
del código, no paráfrasis.

**Advertencia de uso:** esto sirve para distinguir un defecto de una decisión mientras recorres el
portal. No sirve como especificación: describe un estado, y el estado cambia.

---

## Índice

1. [El recorrido de punta a punta](#1-el-recorrido-de-punta-a-punta)
2. [Las reglas de negocio que el sistema impone](#2-las-reglas-de-negocio-que-el-sistema-impone)
3. [Qué se deriva y qué se guarda](#3-qué-se-deriva-y-qué-se-guarda)
4. [Los permisos](#4-los-permisos)
5. [Qué hace cada rol](#5-qué-hace-cada-rol)
6. [El estado real de cada pantalla](#6-el-estado-real-de-cada-pantalla)
7. [Lo que el sistema no hace](#7-lo-que-el-sistema-no-hace)
8. [Lo que no cuadra](#8-lo-que-no-cuadra)

---

## 0. Cómo está montada la autorización

Tres capas, y conviene tenerlas claras porque los tres «no» se ven distintos.

**Primera: el permiso del endpoint.** `PermissionEndpointFilter` (`GestIA.Api/Security/`)
comprueba un permiso por endpoint. Sin sesión devuelve **401 «No autenticado» · «Inicia sesión para
continuar.»**; con sesión y sin el permiso, **403 «Sin permiso» · «Tu usuario no tiene permiso para
esta operación.»**. `PLATFORM.ADMIN` pasa por encima de cualquier permiso: es llave maestra.

**Segunda: el acceso a la organización.** `OrganizationAccessGuard.ForbidIfUnauthorized` corre al
inicio de casi todos los endpoints. Si el actor no tiene membresía en la organización pedida —y no
es super admin— devuelve **403 «Sin acceso a organización» · «Tu usuario no tiene acceso a la
organización solicitada.»**. Si pasa, **fija** la organización en `IOrganizationContext`.

**Tercera: el filtro global de consulta.** `OrganizationQueryFilter` aplica
`entity.IdOrganization == context.CurrentOrganizationId` a las **32 entidades** que declaran
`IOrganizationScopedEntity`. **Falla cerrado**: si el guard no corrió, `CurrentOrganizationId` es
`null`, la comparación no encuentra filas y la consulta devuelve **cero registros**, no todos.
Apagarlo exige `IgnoreQueryFilters(["Organization"])`, restringido por una prueba de arquitectura.

**En el frontend hay una cuarta, y no es seguridad.** `authGuard` (`core/auth/auth.guard.ts`) lee
`data.permission` de la ruta y, si falta, **redirige a `/` en silencio**. No hay mensaje: el usuario
teclea `/auditoria`, no tiene `AUDIT.READ`, y aparece en Inicio sin explicación. Eso es cosmética
—el servidor devolvería 403 igual—, pero explica un comportamiento que de otro modo parece un fallo.

**Los códigos de estado** los reparte `ProblemDetailsExceptionHandler`:

| Excepción | Estado | Título |
|---|---|---|
| `RequestValidationException`, `ArgumentException` | 400 | Solicitud inválida |
| `UnauthorizedAccessException` | 401 | No autenticado |
| `ResourceForbiddenException` | 403 | Acceso denegado |
| `ResourceNotFoundException` | 404 | Recurso no encontrado |
| `ConcurrencyConflictException` | 409 | **Conflicto de concurrencia** |
| `ResourceConflictException`, `DomainRuleException` | 409 | **Conflicto de datos** |
| `ConcurrencyTokenMissingException` | 428 | Falta el token de concurrencia |
| cualquier otra | 500 | Error interno |

Los dos 409 se distinguen **por el título**, no por el estado, y a propósito: uno se arregla
cambiando un dato, el otro recargando y comparando.

El frontend muestra el `detail` del problema **tal cual** cuando existe (por ejemplo
`planning-page.ts:729`, `setError`), así que los mensajes de este documento son los que se ven en
pantalla, no una traducción.

---

## 1. El recorrido de punta a punta

Los once pasos son los de `docs/design/fase-1/ALCANCE.md`. Lo que sigue es lo que el código hace en
cada uno.

---

### Paso 1 — Crear la organización y su usuario admin

| | |
|---|---|
| **Quién** | Super admin |
| **Pantalla** | Organizaciones (`/plataforma/organizaciones`) |
| **Endpoint** | `POST /api/v1/organizations/with-admin` · permiso `ORGANIZATIONS.WRITE` |
| **Escribe** | `Organizations`, `Users`, `OrganizationMemberships`, `UserRoles`, y **catálogos por omisión** |
| **Prerrequisito** | ninguno |
| **Habilita** | todo lo demás |

Es **una sola llamada atómica** (`OrganizationProvisioningService.CreateWithAdminAsync`). Crea la
organización, el usuario, su membresía y su rol `ORGANIZATION_ADMIN`, y siembra catálogos.

**Los catálogos que siembra**, y esto importa mucho para el paso 3
(`OrganizationCatalogDefaults.StageAsync`):

- País `MX` y nacionalidad `NAT-MX`
- **Todos los estados y municipios de México**, desde un recurso incrustado (`MexicoGeography.20260903`)
- **5 motivos de incidencia**: Retardo, Ausencia, Incumplimiento de uniforme, Incidente operativo, Otro autorizado
- **6 motivos de cobertura**: Incidencia del empleado, Falta del empleado, Retardo fuera de tolerancia, Solicitud del cliente, Refuerzo operativo, Otro motivo documentado

**Lo que NO siembra: puestos (`JobPosition`), habilidades (`Skill`) ni zonas (`Zone`).** Una
organización recién creada tiene geografía y motivos, y nada más.

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 400 | `La contraseña temporal debe tener al menos 12 caracteres.` | contraseña de 12+ |
| 400 | `Captura un correo válido.` | el correo debe contener `@` y `.` |
| 409 | `Ya existe una organización con el código 'XXX'.` | otro código. **El código sigue ocupado aunque la organización esté inactiva** |
| 409 | `Ya existe una organización con el RFC 'XXX'.` | otro RFC |
| 409 | `Ya existe un usuario con ese correo.` | el correo es único **en toda la plataforma**, no por organización |
| 409 | `El rol ORGANIZATION_ADMIN no está configurado.` | sólo si el seeder de seguridad no corrió |

---

### Paso 2 — Entrar como admin de la organización

| | |
|---|---|
| **Quién** | Admin de organización |
| **Endpoint** | `POST /api/v1/auth/login` (anónimo), luego `GET /api/v1/auth/me` |
| **Escribe** | nada |

El token lleva un claim `permission` por cada permiso del rol y un claim `organization` por cada
membresía. La organización activa **es una selección de la interfaz** que viaja en cada petición: el
servidor no tiene noción de «en qué organización está parado» nadie.

**No hay cambio de contraseña forzado.** No existe ninguna marca `MustChangePassword` en el modelo.
Tampoco hay envío de correo: la contraseña temporal la teclea el super admin y llega al admin de
organización por fuera del sistema.

---

### Paso 3 — Configurar catálogos mínimos

| | |
|---|---|
| **Pantalla** | Catálogos (`/catalogos`) · `CATALOGS.READ` para ver, `CATALOGS.WRITE` para escribir |
| **Endpoints** | `GET/POST/PUT/DELETE /api/v1/catalogs/items`, `GET /api/v1/catalogs/definitions`, `GET /api/v1/catalogs/options` |
| **Escribe** | `BusinessCatalogItems` |
| **Habilita** | Personal (puestos), elegibilidad (habilidades), y los motivos que piden Incidencias y Cobertura |

Hay **catorce tipos** de catálogo (`BusinessCatalogItemType`): `Skill`, `JobPosition`,
`DocumentRequirement`, `EvaluationRequirement`, `ClientRestriction`, `ServiceRestriction`, `Zone`,
`IncidentReason`, `CoverageReason`, `CancellationReason`, `Country`, `State`, `City`, `Nationality`.

Lo que **de verdad hace falta configurar aquí**, porque el paso 1 no lo sembró: **puestos**. Los
motivos de incidencia y de cobertura ya vienen. Zonas y habilidades no las exige nada.

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `Ya existe un catálogo con esa clave para el mismo tipo.` | otra clave. **Sigue ocupada aunque el valor esté inactivo** |
| 409 | `El tipo y codigo de un valor existente no pueden cambiarse.` | crear otro valor |
| 409 | `El nombre geografico esta vinculado a domicilios y no puede cambiarse.` | crear otro valor |
| 409 | `La relacion geografica existente no puede cambiarse; crea otro valor.` | crear otro |
| 409 | `Ya existe ese nombre en el pais o estado seleccionado.` | otro nombre |
| 409 | `El pais no esta activo.` / `Selecciona un pais activo.` / `Selecciona un estado activo del pais.` | reactivar el padre |

---

### Paso 4 — Cliente con sede y contacto

| | |
|---|---|
| **Pantalla** | Clientes (`/clientes`) · `CLIENTS.READ` / `CLIENTS.WRITE` |
| **Endpoints** | `/api/v1/clients`, `/api/v1/clients/{id}/sites`, `/api/v1/clients/{id}/contacts` |
| **Escribe** | `Clients`, `ClientSites`, `ClientContacts` |
| **Prerrequisito** | ninguno técnico (los catálogos de geografía ya están sembrados) |
| **Habilita** | **el servicio: sin sede no hay servicio** |

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `Ya existe un cliente con el código 'XXX'.` | otro código. **Ocupado aunque el cliente esté inactivo** |
| 409 | `Ya existe un cliente con el RFC 'XXX'.` | otro RFC, con la misma advertencia |
| 404 | `La organización seleccionada no existe o está inactiva.` | revisar la organización activa |
| 404 | `La sede seleccionada no pertenece al cliente.` | elegir una sede del mismo cliente |

---

### Paso 5 — Servicio con contrato y configuración

| | |
|---|---|
| **Pantalla** | Servicios (`/servicios`), pestañas *Datos* y *Configuración* · `CLIENTS.READ` / `CLIENTS.WRITE` |
| **Endpoints** | `/api/v1/clients/{id}/services`, `.../services/{id}/configurations`, `/api/v1/clients/{id}/contracts` |
| **Escribe** | `Services`, `ServiceConfigurations`, `ServiceContracts` |
| **Prerrequisito** | **un cliente con al menos una sede** (`EnsureSiteAsync`) |
| **Habilita** | posiciones |

**Ojo con el permiso**: Servicios se protege con `CLIENTS.*`, no con un permiso propio. Quien puede
ver clientes puede ver servicios, y quien puede escribir clientes puede escribir servicios.

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `Ya existe un servicio con el código 'XXX'.` | otro código |
| 409 | `Ya existe una configuración con la misma fecha de inicio.` | otra fecha de vigencia |
| 409 | `Ya existe un contrato con el código 'XXX'.` | otro código |
| 404 | `El contrato seleccionado no pertenece al cliente.` | elegir uno del mismo cliente |
| 400 | `Este cambio toca el precio, la moneda o el impuesto que se le factura al cliente: explica el motivo.` | escribir un motivo de **10 caracteres mínimo** |
| 400 | `Este cambio corrige una configuración cuya vigencia ya terminó: explica el motivo.` | igual |

---

### Paso 6 — Posiciones con turno y descanso

| | |
|---|---|
| **Pantalla** | Servicios, pestaña *Posiciones* · `PLANNING.READ` / `PLANNING.WRITE` |
| **Endpoints** | `.../services/{id}/positions`, `.../positions/{id}/shift-patterns`, `.../shift-patterns/{id}/segments` |
| **Escribe** | `Positions`, `ShiftPatterns`, `ShiftSegments` |
| **Prerrequisito** | un servicio |
| **Habilita** | asignaciones y la proyección de la semana |

Un **patrón** pertenece a la posición y tiene vigencia (`EffectiveFromDate`/`EffectiveToDate`). Un
**segmento** es un turno **en un día de la semana** (`DayOfWeek`), con hora de inicio, fin, si cruza
la medianoche y cuántos elementos pide (`RequiredWorkerCount`). No hay ciclo ni ancla: ver sección 7.

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `Ya existe una posición con el código 'XXX'.` | otro código |
| 409 | `Ya existe un patrón con el código 'XXX'.` | otro código |
| 409 | `El segmento se traslapa con otro segmento del mismo día.` | ajustar horas. **Este traslape bloquea siempre**, no advierte |

---

### Paso 7 — Empleados con expediente mínimo

| | |
|---|---|
| **Pantalla** | Personal (`/personal`) · `WORKFORCE.READ` / `WORKFORCE.WRITE` |
| **Endpoints** | `/api/v1/employees` y sus subrutas de documentos y evaluaciones |
| **Escribe** | `Employees`, `EmployeeDocuments`, `EmployeeEvaluations` |
| **Prerrequisito** | **ninguno técnico**: el puesto de catálogo es **opcional** (`EnsureJobPositionAsync`: «El puesto es opcional. Un nulo significa que no se declaró») |
| **Habilita** | asignaciones |

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `Ya existe un empleado con el número de seguridad social capturado.` | otro NSS. Único con filtro `IS NOT NULL`, así que se puede dejar vacío |
| 409 | `El catálogo seleccionado no es un puesto activo.` | crear el puesto en Catálogos |
| 409 | `Ya existe una evaluación del mismo tipo en la misma fecha.` | otra fecha |

**El código de empleado lo genera el navegador**, no el servidor:
`workforce-page.ts` usa `EMP-${Date.now().toString(36).toUpperCase().slice(-6)}` contra un índice
único `(IdOrganization, CodeEmployee)`. Dos altas en el mismo milisegundo chocarían; está anotado
como pendiente de mover al servidor.

---

### Paso 8 — Titulares y cubre-descansos

| | |
|---|---|
| **Pantalla** | Servicios, pestaña *Asignaciones* · `PLANNING.READ` / `PLANNING.WRITE` |
| **Endpoint** | `.../services/{id}/assignments` |
| **Escribe** | `ServiceAssignments` |
| **Prerrequisito** | posiciones **y** empleados |
| **Habilita** | la proyección de turnos: el generador reparte por asignación |

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `El empleado ya tiene una asignación activa que se traslapa con ese rango de fechas.` | ajustar fechas. **Bloquea, no advierte** |
| 409 | `Solo se pueden asignar empleados activos.` | reactivar al empleado |
| 400 | `Este cambio corrige una asignación cuyo periodo ya terminó: explica el motivo.` | motivo de 10+ caracteres |

---

### Paso 9 — Generar y publicar la planeación

| | |
|---|---|
| **Pantalla** | Planeación (`/planeacion`) · `PLANNING.READ` / `PLANNING.WRITE` |
| **Endpoints** | `.../schedule-versions` (crear), `.../generate-from-patterns`, `.../publish` |
| **Escribe** | `ScheduleVersions`, `ScheduledShifts` |
| **Prerrequisito** | patrones con segmentos **y** asignaciones vigentes |
| **Habilita** | **todo lo operativo**: sin versión publicada no hay asistencia ni cobertura |

«Preparar la semana» es **un solo botón** que crea la versión si no existe y proyecta los turnos
desde los patrones, con `skipExisting: true` para no pisar lo asignado a mano
(`planning-page.ts:529`).

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `No hay patrones de turno vigentes para generar la planeación.` | declarar patrones con vigencia que cubra la semana |
| 409 | `Ya existen turnos para el segmento. Activa la opcion de omitir existentes.` | la pantalla ya manda `skipExisting: true`; no debería verse |
| 409 | `No se puede publicar una planeación sin turnos programados.` | proyectar primero |
| 409 | **`No se puede publicar la planeación porque hay posiciones sin cubrir. 2026-09-08 · P-01: faltan 2 elemento(s) en 07:00-19:00.`** | asignar más gente, o bajar `RequiredWorkerCount`. **Ver hallazgo 8.1: la pantalla dice que esto no impide publicar, y sí impide** |
| 409 | `Patrón XXX: falta al menos un segmento activo.` | declarar segmentos |
| 409 | `El empleado ya tiene un turno programado que se traslapa.` | quitar uno de los dos |
| 409 | `Hay turnos fuera del periodo de la planeación.` | corregir fechas |
| 409 | `No se puede publicar: <nombre>. Falta documento vigente o validado: XXX.` | reponer el documento del empleado |
| 409 | `La nueva version debe cubrir todo el periodo publicado que reemplaza.` | ampliar el periodo |
| 409 | `No se puede reemplazar una planeacion con actividad operativa registrada.` | **sin salida por interfaz**: ya hay asistencia o cobertura contra esa versión |

---

### Paso 10 — Registrar la asistencia del día

| | |
|---|---|
| **Pantalla** | Asistencia (`/operacion/asistencia`) · `OPERATIONS.READ` / `OPERATIONS.WRITE` |
| **Endpoints** | `GET/POST /api/v1/operations/attendance`, `GET /api/v1/operations/day-closures` |
| **Escribe** | `AttendanceRecords`, `OperationDayClosures` |
| **Prerrequisito** | **versión publicada que cubra el día** |
| **Habilita** | incidencias, cobertura y el cierre |

Un mismo `POST /attendance` **crea o corrige**. La diferencia la decide el servidor por si ya existe
fila para ese turno, y de ahí salen las tres reglas distintas de abajo.

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `Solo se puede operar asistencia/cobertura sobre planeaciones publicadas.` | publicar la semana |
| 400 | `Para corregir una asistencia ya capturada necesitas seleccionar una autorización aprobada.` | crear la autorización en `POST /approval-requests` y que alguien la apruebe |
| 409 | `La autorización seleccionada todavía no está aprobada.` | esperar la decisión |
| 409 | `La autorización seleccionada no corresponde al registro que se intenta corregir.` | elegir la que apunta a **ese** registro |
| 400 | `Este cambio corrige un registro de un día ya cerrado: explica el motivo.` | motivo de 10+ caracteres |
| 400 | `El motivo debe tener al menos 10 caracteres.` | escribir más |
| **428** | `Para corregir una asistencia ya capturada hay que enviar el token de concurrencia que se leyó al abrirla. Vuelve a cargar el registro y reintenta.` | recargar |
| 409 | *Conflicto de concurrencia* (título) | recargar y comparar: alguien más corrigió |
| 400 | `Los minutos de retardo no pueden ser negativos.` | corregir |
| 409 | `No se puede cerrar un día sin turnos publicados.` | publicar |
| 409 | `El día operativo ya tiene un cierre registrado.` | reabrir en lugar de cerrar |
| 409 | `No se puede cerrar el día: 3 turno(s) sin asistencia y 1 incidencia(s) abierta(s).` | capturar lo que falta y resolver las incidencias |
| 400 | reabrir sin motivo → error de validación en `Reason` | escribir el motivo (obligatorio, sin mínimo propio: lo impone la pantalla en 10) |

**La autorización y el motivo son dos cosas distintas y el servidor las trata así.** La
autorización es un permiso previo (`ApprovalRequest` aprobada, que apunta al registro por
`EntityType`+`EntityId`); el motivo es qué se hizo y por qué, y va a la bitácora. Se exigen por
razones distintas: la autorización **cuando cambió un dato**, el motivo **cuando el día está
cerrado**. Son independientes: puedes necesitar una, la otra, las dos o ninguna.

---

### Paso 11 — Incidencia y cobertura

| | |
|---|---|
| **Pantalla** | Incidencias y Cobertura (`/operacion/incidencias` y `/operacion/cobertura`, **la misma pantalla**) |
| **Endpoints** | `/api/v1/operations/incidents`, `/api/v1/operations/coverages` |
| **Escribe** | `Incidents`, `CoverageRecords` |
| **Prerrequisito** | versión publicada; para cubrir, un turno con falta |

**Registrar una incidencia sobre un día cerrado está permitido y no pide motivo.** Es decisión de
negocio: la falta ocurrió, y si el sistema no la deja registrar se registra fuera del sistema. La
pantalla la marca **«Posterior al cierre»**. Corregirla sí pide motivo si el día está cerrado.

#### Dónde dice que no

| Estado | Mensaje literal | Cómo se sale |
|---|---|---|
| 409 | `Selecciona un tipo de incidencia activo del catalogo.` | reactivar el motivo o elegir otro |
| 409 | `Selecciona un motivo de cobertura activo de la organizacion.` | igual |
| 409 | `El sustituto no puede ser el empleado original.` | elegir a otro |
| 409 | `La cobertura debe crearse en estado solicitado.` | crear en `Requested` |
| 409 | **`El sustituto no es elegible. Falta documento vigente o validado: XXX.`** | reponer el documento |
| 409 | `La cobertura se traslapa con un turno o una cobertura existente.` | **este traslape bloquea**; ver sección 2 |
| 400/409 | corregir en día cerrado → motivo obligatorio | 10+ caracteres |

---

## 2. Las reglas de negocio que el sistema impone

Sólo las que están en el código y se ejecutan.

### 2.1 Cuándo se exige motivo

`GestIA.Application/Common/CorrectionReasonPolicy.cs`. La regla declarada: **no toda corrección pide
motivo**, sólo la que toca algo cerrado o vencido. Y **un motivo por guardado, no por campo**.

| Qué se corrige | Se exige cuando | Texto del error |
|---|---|---|
| Asistencia, incidencia, cobertura | el **día está cerrado** (`Closed`). Un día **reabierto no lo exige**, porque reabrirlo ya fue una decisión justificada | `Este cambio corrige un registro de un día ya cerrado: explica el motivo.` |
| Configuración de servicio | cambia **precio, moneda o impuesto**, esté vigente o no | `Este cambio toca el precio, la moneda o el impuesto que se le factura al cliente: explica el motivo.` |
| Configuración de servicio | su vigencia **ya terminó** | `Este cambio corrige una configuración cuya vigencia ya terminó: explica el motivo.` |
| Asignación | su periodo **ya terminó**. Una asignación sin fecha de fin sigue viva y editarla es operación normal | `Este cambio corrige una asignación cuyo periodo ya terminó: explica el motivo.` |

Mínimo **10 caracteres**, máximo 1200. El campo **nunca llega prellenado ni con sugerencia**: un
motivo puesto de antemano se acepta sin leerse y deja de ser información.

### 2.2 Cuándo se exige autorización previa

Sólo en un sitio: **corregir una asistencia ya capturada, y sólo si de verdad cambió un dato**
(`OperationsService.UpsertAttendanceAsync`, comparación `AttendanceChanged`). Guardar sin cambiar
nada no pide nada.

La autorización es una fila de `ApprovalRequests` en estado `Approved`, del tipo
`AttendanceCorrection`, que apunta al registro por `EntityType = "AttendanceRecord"` y `EntityId`.
Si no coincide alguna de esas cuatro cosas: `La autorización seleccionada no corresponde al registro
que se intenta corregir.`

### 2.3 Los cuatro traslapes: cuáles bloquean y cuál advierte

Es la pregunta que más se confunde, porque son cuatro comprobaciones distintas.

| # | Qué compara | Dónde | Qué hace |
|---|---|---|---|
| 1 | **Segmentos del mismo patrón, mismo día** | `PlanningService` | **Bloquea.** `El segmento se traslapa con otro segmento del mismo día.` |
| 2 | **Asignaciones del mismo empleado**, por rango de fechas | `AssignmentService.EnsureNoOverlapAsync` | **Bloquea.** `El empleado ya tiene una asignación activa que se traslapa con ese rango de fechas.` |
| 3 | **Turnos programados del mismo empleado** | `SchedulingService.EnsureNoShiftOverlapAsync` | **Bloquea**, tanto al crear el turno como al publicar |
| 4 | **Cobertura contra turnos y coberturas del sustituto** | `OperationsService.EnsureCoverageAllocationAsync` → `HasCoverageConflictAsync` | **Bloquea.** `La cobertura se traslapa con un turno o una cobertura existente.` |

**Los cuatro bloquean en el servidor.** Lo que «advierte y permite» es otra cosa: **el selector de
candidatos de la pantalla de Cobertura**. Ahí nadie queda fuera de la lista —quien ya tiene turno
ese día aparece marcado con la consecuencia, «P-04 queda con un elemento menos ese día: el hueco se
mueve, no desaparece»— porque el supervisor va a mover a alguien de todos modos y, si el sistema no
lo deja, lo hace fuera del sistema. Pero si el traslape es **de horario real**, el servidor lo
rechaza igual con el mensaje de arriba. La advertencia es sobre *dejar corta otra posición*, no
sobre poner a alguien en dos sitios a la vez.

### 2.4 Qué impide publicar una planeación

`SchedulingService.PublishScheduleVersionCoreAsync`, en este orden:

1. La versión debe estar en **borrador** (`EnsureDraft`).
2. Debe tener **al menos un turno**.
3. **No debe haber huecos de cobertura**: por cada día del periodo, cada segmento vigente de cada
   posición debe tener tantos turnos asignados como `RequiredWorkerCount`. Si falta uno, 409.
4. Cada turno: empleado **activo**, posición del servicio, **sin traslape**, **dentro del periodo**.
5. Cada turno: el empleado debe ser **elegible** ese día.
6. Si reemplaza versiones publicadas: la nueva debe **cubrir todo el periodo** de las anteriores, y
   ninguna de ellas debe tener **actividad operativa registrada**.

### 2.5 Qué hace que un empleado no sea elegible

`CatalogService.EvaluateEligibilityAsync`. Se evalúa contra una **fecha de referencia**.

- **Estatus distinto de `Active`** → bloqueante siempre: `El empleado tiene estatus Inactive.`
- **Reglas de `EligibilityRequirements`** activas cuyo alcance aplique (organización, cliente,
  servicio o posición). Cada regla dice si es bloqueante:
  - `Skill`: exige una habilidad del catálogo, activa y **no vencida** a la fecha. Falla con
    `Falta habilidad requerida: XXX.`
  - `Document`: exige un documento del tipo pedido, activo, en estado **`Validated` o `Received`** y
    **no vencido**. Falla con `Falta documento vigente o validado: XXX.`
  - `Evaluation`: exige una evaluación del tipo pedido, activa y vigente.
  - `Restriction`: **siempre falla**. Es una prohibición configurada.
- **Si no hay ninguna regla configurada**, se devuelve una razón informativa no bloqueante:
  `No hay reglas configuradas que bloqueen al empleado.` — es decir, **por omisión todo el mundo es
  elegible**.

La elegibilidad se comprueba en dos sitios: **al publicar** (cada turno, cada día) y **al crear o
corregir una cobertura** (cada día que toca la cobertura). No se comprueba al asignar.

### 2.6 Qué se conserva al desactivar, y qué no

**Los registros no se borran.** Todo lo que implementa `IActivatableEntity` lleva `Active` y un
filtro global llamado `Active`; `DELETE` en la API es **borrado lógico**.

**La consecuencia que muerde:** de los **26 índices únicos** del modelo, sólo **4** llevan filtro, y
los cuatro son `IS NOT NULL` (RFC, CURP y NSS de empleado; RFC de organización). **Ninguno filtra
por `Active`.** Traducción operativa: **desactivar no libera la clave**. El RFC de un cliente
inactivo sigue ocupado, el `CodeClient` también, el código de un valor de catálogo también.

Lo que **sí se conserva** al desactivar: la fila entera con su auditoría
(`CreatedAt`/`CreatedBy`/`CreatedByName`, `UpdatedAt`/`UpdatedBy`/`UpdatedByName`) y todo lo que
apunta a ella. Retirar un patrón de turno «deja de proyectar turnos; lo ya registrado contra ella se
conserva».

### 2.7 La bitácora funcional

`OperationalHistoryRecorder` + `OperationalSnapshots.IsTracked`. `SaveChanges` emite un
`OperationalEvent` **en la misma transacción** por cada cambio a **cinco entidades**, y sólo cinco:

`AttendanceRecord` · `ServiceConfiguration` · `Incident` · `CoverageRecord` · `ServiceAssignment`

Las bitácoras son **de sólo agregar**: `GestIaDbContext` rechaza modificar o borrar un
`OperationalEvent`. Y las fotos guardan metadatos con **lista blanca**: el texto libre **no se
copia**, sólo si estaba lleno o vacío. Copiarlo lo sacaría del control de permisos del registro.

### 2.8 El día operativo

Lo dice el servidor (`GET /api/v1/system/info` → `operationDate`, `timeZoneId`), nunca el navegador.
En UTC el día empieza entre seis y siete horas antes que en México: a las 19:00 hora de Ciudad de
México un `new Date()` ya dice «mañana». Una prueba del frontend
(`core/context-inheritance.spec.ts`) prohíbe `toISOString().slice(0, 10)` para obtener el día.

**Desde el 6 de septiembre de 2026 la fecha operativa ya no se muestra en la barra de contexto.**
Sigue usándose para todos los cálculos; sólo dejó de rotularse en el cromo. Se sigue viendo donde es
contenido: la barra de día de Asistencia, la de semana de Planeación y el subtítulo de Inicio.

---

## 3. Qué se deriva y qué se guarda

Ésta es la lista de las cosas que **parecen columna y son cálculo**. Buscar la columna es perder el
rato.

| Concepto | ¿Guardado? | Fórmula exacta | Dónde |
|---|---|---|---|
| **Vacancia de una posición** | **No** | `RequiredWorkerCount − (asignaciones con StartDate ≤ fecha y (EndDate nula o ≥ fecha))`. **Puede ser negativa** y se muestra negativa: sobra gente que nadie autorizó | `Planning/PositionVacancy.cs` |
| **Turno al descubierto** | **No** | turno cuya asistencia es `Absent` **y** que no tiene ninguna cobertura en estado `Confirmed` o `Completed`. Una cobertura **cancelada no cuenta**: cancelarla es justamente dejar el turno sin cubrir | `incidents-page.ts:174` (pantalla) y `OverviewRepository` (indicador) |
| **«Declarar sin cubrir»** | **No, y no existe como estado** | no hay botón ni marca. El turno queda al descubierto porque hubo falta y ninguna cobertura la resolvió, y eso se **lee de los registros** | — |
| **Día abierto** | **No** | **es la ausencia de fila** en `OperationDayClosures` para ese servicio y fecha. `dayState`: sin cierre → `open`; con cierre `Reopened` → `reopened`; si no → `closed` | `operations/data-access/attendance-day.ts:170` |
| **«Posterior al cierre»** | **No** | `incident.createdAt > closure.closedAt`, **y sólo si el cierre está en `Closed`**. Un día reabierto no marca nada: se reabrió justamente para poder registrar | `operations/data-access/incident-day.ts:94` |
| **¿La corrección pide motivo?** | **No** | `dayState(closure) === 'closed'`. Réplica de `CorrectionReasonPolicy` para poder decirlo antes de que el usuario escriba | `attendance-day.ts:197` |
| **Excepciones del día** | **No** | asistencias con estado `Absent` o `Late`. **Los pendientes de capturar no cuentan**: no capturar es trabajo pendiente, no excepción | `attendance-day.ts:148` |
| **Pendientes de capturar** | **No** | turnos publicados del día **sin** fila de asistencia | `attendance-day.ts:159` |
| **Estado de un servicio** | **No** | `!active` → inactivo; `endDate < operationDate` → **vigencia terminada**; si no → activo. **Sin día operativo no se afirma que algo venció** | `services/data-access/service.models.ts:45` |
| **Documento vencido** | **Parcial** | dos formas: que alguien lo marcara `Expired`, **o** que `ExpiresDate < operationDate`. La segunda no espera a que nadie revise | `OverviewRepository`, `documents-page.ts:1134` |
| **Posición sin patrón** | **No** | posición sin ningún `ShiftPattern` que tenga **al menos un `ShiftSegment`**. Un patrón sin segmentos no proyecta nada, así que no cuenta como patrón | `OverviewRepository` |
| **Hueco de cobertura al publicar** | **No** | por día y segmento: `turnos asignados < RequiredWorkerCount` | `SchedulingService.FindCoverageGapsAsync` |
| **Elegibilidad** | **No** | ver 2.5. Se recalcula en cada consulta y en cada publicación | `CatalogService` |
| **«Sin declarar» de la rejilla** | **No** | una posición **sin patrón activo no entra al mapa**; esa ausencia es lo que la rejilla lee como «nadie declaró nada» | `planning/data-access/active-segments.ts` |
| **Indicadores de Inicio** | **No** | los cuatro se calculan por consulta, y cada uno decide `Ready` o `Pending` según su prerrequisito | `Overview/OverviewService.cs` |

Lo que **sí se guarda** y podría parecer cálculo: la **foto del cierre**
(`OperationDayClosure` congela turnos, asistencias, pendientes, incidencias abiertas y coberturas
del día). Se guarda porque es lo que se concilia con el cliente: recalcularla después daría otro
número.

---

## 4. Los permisos

Son **23**, en `GestIA.Application/Security/SecurityPermissions.cs`.

| Permiso | Qué desbloquea |
|---|---|
| `PLATFORM.ADMIN` | Llave maestra: pasa por encima de cualquier `RequirePermission` y de cualquier comprobación de organización. Además: Organizaciones, Seguridad de plataforma, gobernanza |
| `ORGANIZATIONS.READ` | Listar y ver organizaciones (la lista se filtra a las del usuario) |
| `ORGANIZATIONS.WRITE` | Crear, editar, activar y desactivar organizaciones; crear organización **con** admin |
| `USERS.READ` | Ver usuarios, roles asignables y permisos **de la organización** |
| `USERS.WRITE` | Crear, editar, dar y quitar acceso, reponer contraseña, activar y desactivar usuarios de la organización |
| `CLIENTS.READ` | **Clientes y Servicios** (lectura): clientes, sedes, contactos, servicios, configuraciones, contratos |
| `CLIENTS.WRITE` | Lo mismo, escritura |
| `DOCUMENTS.READ` / `.WRITE` | Documentos de negocio y su archivo |
| `DOCUMENTS.SENSITIVE.READ` / `.WRITE` | Documentos marcados sensibles. Sin él: **403 «No tienes permiso para acceder a documentos sensibles.»** |
| `CATALOGS.READ` / `.WRITE` | Catálogos y reglas de elegibilidad |
| `WORKFORCE.READ` / `.WRITE` | Personal, sus documentos, evaluaciones, habilidades y el chequeo de elegibilidad |
| `PLANNING.READ` / `.WRITE` | Posiciones, patrones, segmentos, asignaciones, versiones y turnos |
| `OPERATIONS.READ` / `.WRITE` | Asistencia, incidencias, coberturas, evidencias, cierres y autorizaciones |
| `REPORTS.READ` | Reportes y sus exportaciones |
| `AUDIT.READ` | Bitácora y su exportación |
| `REQUESTS.READ` / `.WRITE` | Solicitudes operativas (fuera de fase 1 en el menú) |

Reparto por rol, tal como lo asigna `SecurityDataSeeder` (no como parecería razonable):

| Rol (`CodeRole`) | Nombre | Permisos |
|---|---|---|
| `ADMINISTRATOR` | Administrador | **Los 23**, incluido `PLATFORM.ADMIN` |
| `ORGANIZATION_ADMIN` | Admin de organización | Todos **menos** `PLATFORM.ADMIN` y `ORGANIZATIONS.WRITE` → **21** |
| `ORG_SUPERVISOR` | Supervisor operativo | 14: `CLIENTS.READ`, `DOCUMENTS.READ/WRITE`, `CATALOGS.READ`, `WORKFORCE.READ/WRITE`, `PLANNING.READ/WRITE`, `OPERATIONS.READ/WRITE`, `REQUESTS.READ/WRITE`, `REPORTS.READ`, `AUDIT.READ` |
| `ORG_OPERATOR` | Operador | 10: `CLIENTS.READ`, `DOCUMENTS.READ`, `CATALOGS.READ`, `WORKFORCE.READ`, `PLANNING.READ`, `OPERATIONS.READ/WRITE`, `REQUESTS.READ/WRITE`, `REPORTS.READ` |
| `ORG_VIEWER` | Consulta operativa | 8: los mismos sin `OPERATIONS.WRITE` ni `REQUESTS.WRITE` |

### El menú que sale de eso

`core/layout/navigation.ts` define **17 entradas** en **4 grupos**. Cuatro están marcadas `phase: 2`
y **no se dibujan**: Solicitudes, Monitor global, Reportes y Reglas documentales. Un grupo sin
entradas visibles **desaparece entero** — hoy le pasa a *Reportes y dashboards*.

| Entrada | Ruta | Permiso | Sólo para |
|---|---|---|---|
| Inicio | `/` | **ninguno** | — |
| Planeación | `/planeacion` | `PLANNING.READ` | con organización |
| Asistencia | `/operacion/asistencia` | `OPERATIONS.READ` | con organización |
| Incidencias | `/operacion/incidencias` | `OPERATIONS.READ` | con organización |
| Cobertura | `/operacion/cobertura` | `OPERATIONS.READ` | con organización |
| Organizaciones | `/plataforma/organizaciones` | `PLATFORM.ADMIN` | plataforma |
| Clientes | `/clientes` | `CLIENTS.READ` | con organización |
| Servicios | `/servicios` | `CLIENTS.READ` | con organización |
| Personal | `/personal` | `WORKFORCE.READ` | con organización |
| Catálogos | `/catalogos` | `CATALOGS.READ` | con organización |
| Auditoría | `/auditoria` | `AUDIT.READ` | con organización |
| Seguridad | `/seguridad` | `PLATFORM.ADMIN` | plataforma |
| Seguridad | `/usuarios` | `USERS.READ` | organización |

**Los tres estados del menú**, comprobados en `app-shell.spec.ts`:

- Super admin **fuera** de organización: **3** entradas — Inicio, Organizaciones, Seguridad.
- Super admin **dentro** de una organización: **12**.
- Admin de organización: **11** (las 12 menos Organizaciones, y con `/usuarios` en vez de `/seguridad`).

---

## 5. Qué hace cada rol

### 5.1 Super admin (`ADMINISTRATOR`, con `PLATFORM.ADMIN`)

**Antes de entrar a una organización** ve tres entradas: Inicio, Organizaciones y Seguridad.

- **Inicio** no muestra tablero: muestra un estado vacío de prerrequisito, *«Elige una organización
  para ver su inicio»*, con enlace a Organizaciones. No es un tablero en ceros; es que falta elegir.
- **Organizaciones**: lista, crea, edita, activa, desactiva, y crea organización **con** su admin.
  También ve la **gobernanza** (`GET /api/v1/organizations/governance`, `PLATFORM.ADMIN`).
- **Seguridad** (`/seguridad`, `PLATFORM.ADMIN`): usuarios, roles y permisos **de toda la
  plataforma**. Crea y edita roles, que no puede hacer nadie más.

**Cómo entra a una organización.** Con el selector de la barra de contexto. No hay «modo soporte» ni
suplantación: la organización activa es una selección de la interfaz que viaja como parámetro
`organizationId` en cada petición, y `OrganizationAccessGuard` la autoriza porque tiene
`PLATFORM.ADMIN`. Al salir, el botón **Salir** de la barra la limpia sin cerrar sesión — y ese botón
sólo existe para él (`canLeave = isPlatformAdmin && hayOrganizaciónActiva`).

**Qué puede hacer dentro que el admin de organización no:**

| | |
|---|---|
| Crear, editar, activar y desactivar **organizaciones** | `ORGANIZATIONS.WRITE`, que el admin de organización no tiene |
| Crear y editar **roles** y ver el catálogo de permisos de plataforma | `/api/v1/security/roles`, `PLATFORM.ADMIN` |
| Administrar usuarios **de cualquier organización**, y asignar **cualquier rol**, incluido `ORGANIZATION_ADMIN` | `/api/v1/security/users/*` no filtra roles asignables |
| Entrar a **cualquier** organización sin membresía | el guard lo autoriza por permiso, no por membresía |

**Qué NO puede hacer.** Nada, funcionalmente: `PLATFORM.ADMIN` es llave maestra en
`PermissionEndpointFilter` y en `OrganizationAccessGuard`. La única puerta que **no** lo reconoce por
llave maestra es `GET /api/v1/catalogs/options`, que comprueba seis permisos concretos a mano; hoy no
se nota porque el rol `ADMINISTRATOR` lleva los 23 (ver hallazgo 8.6).

**¿Queda rastro de a qué organizaciones entró? No. Dilo así de claro: no existe.** No hay entidad,
ni endpoint, ni columna que registre que un super admin seleccionó una organización. Los cambios que
haga sí quedan firmados con su identidad en la auditoría de cada fila y en la bitácora funcional;
**la simple lectura no deja huella**. Esto es la decisión pendiente #4 de `ALCANCE.md` para BKT, sin
resolver.

---

### 5.2 Admin de organización (`ORGANIZATION_ADMIN`)

**Qué ve al entrar por primera vez a una organización recién creada.** Inicio, con el mismo tablero
que verá siempre —desde el 6 de septiembre de 2026 no hay «camino de configuración»—, y sin
información:

```text
INICIO
<Nombre de la organización>
Semana del … al …. Fecha operativa: ….

TABLERO   Ninguno tiene información todavía. Cada uno dice qué falta para tenerla.

  TURNOS PLANEADOS · SEMANA           —   Sin planeación publicada     [Ir a Planeación]
  POSICIONES SIN TITULAR              —   Sin posiciones definidas     [Definir posiciones]
  TURNOS SIN CUBRIR · AYER            —   Sin planeación de ayer       [Ir a Planeación]
  EMPLEADOS CON DOCUMENTOS VENCIDOS   —   Sin empleados dados de alta  [Ir a Personal]

NECESITA ATENCIÓN HOY   Todavía sin nada que revisar

  Todavía no hay con qué saberlo. Esta lista se llena con lo que va dejando la operación
  —posiciones sin titular, faltas sin incidencia, documentos vencidos—, y mientras no haya
  servicios, posiciones ni personal no puede afirmar que no quede nada pendiente.
```

Y en el menú, las **11** entradas: Inicio, Planeación, Asistencia, Incidencias, Cobertura, Clientes,
Servicios, Personal, Catálogos, Auditoría, Seguridad.

**El recorrido completo que puede hacer solo**, sin depender del super admin: **del paso 3 al 11
entero**. Tiene `CATALOGS.WRITE`, `CLIENTS.WRITE`, `WORKFORCE.WRITE`, `PLANNING.WRITE`,
`OPERATIONS.WRITE`, `DOCUMENTS.WRITE` y los dos sensibles. No necesita a nadie.

**Qué le está negado**, y qué ve:

| Qué intenta | Qué ve |
|---|---|
| Entrar a `/plataforma/organizaciones` escribiendo la URL | **Redirección silenciosa a Inicio**. No hay mensaje |
| `POST /api/v1/organizations` por API | **403 «Sin permiso» · «Tu usuario no tiene permiso para esta operación.»** |
| Pedir datos de otra organización | **403 «Sin acceso a organización» · «Tu usuario no tiene acceso a la organización solicitada.»** |
| Crear o editar roles | 403: `/api/v1/security/*` exige `PLATFORM.ADMIN` |
| Asignar el rol `ORGANIZATION_ADMIN` a alguien | **el rol no aparece en la lista**. Ver abajo |

**¿Puede crear otros usuarios de su organización? Sí, pero no todos los roles.**
`OrganizationSecurityEndpoints.QueryAssignableRoleEntities` excluye explícitamente:

- `ADMINISTRATOR`
- **`ORGANIZATION_ADMIN`**
- cualquier rol que tenga `PLATFORM.ADMIN`

Le quedan **`ORG_SUPERVISOR`, `ORG_OPERATOR` y `ORG_VIEWER`**, más los roles propios de la
organización que existan. Puede crear usuarios (contraseña de **12 a 200 caracteres**, que él
teclea), darles y quitarles acceso, reponerles la contraseña, activarlos y desactivarlos.

**Un admin de organización no puede crear otro admin de organización.**

---

### 5.3 La frontera entre los dos

| Pregunta | Respuesta, con evidencia |
|---|---|
| **¿Quién crea la organización?** | El super admin. `POST /api/v1/organizations` o `/with-admin`, permiso `ORGANIZATIONS.WRITE`, que `ORGANIZATION_ADMIN` **no tiene** |
| **¿Quién crea su primer admin?** | El super admin, en la **misma llamada** `/with-admin`. Es atómico: organización, usuario, membresía, rol y catálogos por omisión en una transacción |
| **¿Quién pone la contraseña?** | **El super admin la teclea.** Mínimo 12 caracteres (`OrganizationProvisioningService`). No se genera sola |
| **¿Cómo llega al admin?** | **Por fuera del sistema.** No hay envío de correo en el código |
| **¿Se le obliga a cambiarla?** | **No.** No existe ninguna marca de contraseña temporal en el modelo. La contraseña que teclea el super admin es la definitiva hasta que alguien la cambie |
| **¿Puede un admin quedarse sin acceso a su organización?** | **Sí, y de tres maneras.** (1) Otro usuario con `USERS.WRITE` lo desactiva o le quita el acceso; **no hay ninguna protección contra hacérselo a uno mismo**. (2) Pierde la contraseña, y no hay recuperación por correo. (3) Es el único admin y se desactiva |
| **¿Cómo se recupera?** | **Sólo el super admin.** `PATCH /api/v1/security/users/{id}/password` para reponer la contraseña, `PATCH /users/{id}/activate` para reactivar, `PATCH /users/{id}/access` para devolver la membresía y el rol. **Ningún admin de organización puede hacerlo por otro admin**, porque no puede asignar `ORGANIZATION_ADMIN` |

---

### 5.4 Supervisor, operador y consultor

| | `ORG_SUPERVISOR` | `ORG_OPERATOR` | `ORG_VIEWER` |
|---|---|---|---|
| **Permisos** | 14 | 10 | 8 |
| **Entradas de menú** | **10** | **9** | **9** |
| Inicio · Planeación · Asistencia · Incidencias · Cobertura · Clientes · Servicios · Personal · Catálogos | sí | sí | sí |
| Auditoría (`AUDIT.READ`) | **sí** | no | no |
| Seguridad (`USERS.READ`) | no | no | no |
| **Puede publicar planeación** (`PLANNING.WRITE`) | **sí** | no | no |
| **Puede capturar asistencia y cubrir** (`OPERATIONS.WRITE`) | sí | **sí** | **no** |
| **Puede dar de alta personal** (`WORKFORCE.WRITE`) | **sí** | no | no |
| **Puede editar clientes o servicios** (`CLIENTS.WRITE`) | no | no | no |
| **Puede editar catálogos** (`CATALOGS.WRITE`) | no | no | no |

**Operador y consultor ven exactamente el mismo menú, y está bien.** La diferencia no es el acceso a
los módulos, es que uno puede guardar y el otro no; eso se resuelve **dentro** de la pantalla
deshabilitando acciones, no ocultando el módulo. Es la separación correcta, no un defecto.

**Cómo se ve «deshabilitado» dentro de la pantalla.** Las pantallas rehechas usan un `canWrite()`
que sale de `hasPermission`, y con él **no dibujan el botón** en lugar de dibujarlo gris: en
Asistencia no aparece «Capturar», en Incidencias no aparece «Registrar incidencia» ni «Cubrir el
turno», en Planeación no aparece «Publicar la semana». En las pantallas viejas el patrón es
irregular: algunas ocultan, otras dejan el control y fallan con 403 al guardar.

#### Cruce con `MENU-POR-ROL.md`

El documento sigue siendo **correcto en lo esencial**: los permisos por rol coinciden uno a uno con
`SecurityDataSeeder`, y la tabla de once entradas del admin de organización coincide con el código.

**Lo que cambió desde que se escribió:**

1. Dice que el super admin dentro de una organización «ve las 11». **Hoy ve 12**, y la prueba
   `app-shell.spec.ts` lo fija así. Además no son las mismas once: ve `/seguridad` (plataforma) y
   **no** `/usuarios` (organización).
2. Dice que falta «ocultar —no borrar— las entradas fuera de fase 1». **Ya está hecho**, con la
   marca `phase: 2` en `navigation.ts`.
3. Pedía una prueba de que «ninguna entrada sin `permission` salvo Inicio». **Se cumple hoy**, pero
   no encontré la prueba que lo fije.
4. No menciona los grupos del menú, que se agregaron después: hoy hay cuatro grupos declarados y un
   grupo sin entradas visibles desaparece entero.

---

### 5.5 Quién se atora, y en qué paso

La pregunta más útil de la sección. Respuesta corta: **el operador y el consultor se atoran antes de
empezar, y el supervisor se atora en el paso 3.**

| Rol | ¿Dónde se atora? | Por qué |
|---|---|---|
| **Super admin** | En ningún lado | Llave maestra |
| **Admin de organización** | En ningún lado | Del 3 al 11 completo |
| **`ORG_SUPERVISOR`** | **Paso 3, catálogos** | Tiene `CATALOGS.READ` pero **no `CATALOGS.WRITE`**: ve el módulo y no puede crear el puesto. También le falta `CLIENTS.WRITE`, así que **no puede hacer los pasos 4 ni 5**. Su recorrido real empieza en el **paso 6** (posiciones), y sólo si alguien más creó cliente y servicio |
| **`ORG_OPERATOR`** | **Paso 3, y de hecho hasta el 9** | No tiene ninguna escritura salvo `OPERATIONS.WRITE` y `REQUESTS.WRITE`. **Su recorrido real empieza en el paso 10** |
| **`ORG_VIEWER`** | **En todos** | Sin ninguna escritura. Sólo mira |

**El reparto es coherente con el alcance** —el paso 10 lo hace «Operación», y el operador lo puede
hacer—, pero conviene tenerlo presente al recorrer: si entras como supervisor esperando montar la
organización, te vas a topar con una pared en Catálogos que **no da mensaje**, porque la pantalla
simplemente no dibuja los botones de escritura.

Y un atasco que no es de permisos y le puede pasar a cualquiera, incluido el admin:
**una regla de elegibilidad de tipo `Skill` o `Evaluation` no se puede satisfacer desde la
interfaz.** Ver hallazgo 8.4.

---

## 6. El estado real de cada pantalla

Criterio: una pantalla está **rehecha** si está en la lista que vigila `shared/ui/design-system.spec.ts`
—sin colores a mano, sin tamaños fuera de escala, sin selectores nativos— y usa componentes hijos.

### Rehechas

| Pantalla | Ruta | Líneas de la página | Componentes hijos | Notas |
|---|---|---|---|---|
| **Inicio** | `/` | 216 | 3 | Sin camino de configuración desde el 6 sep 2026 |
| **Clientes** | `/clientes` | 602 | 6 | |
| **Personal** | `/personal` | 667 | 9 | |
| **Planeación** | `/planeacion` | 738 | 6 | Las cinco escrituras siguen en la página; extracción anotada como pendiente |
| **Asistencia** | `/operacion/asistencia` | 432 | 7 (compartidos con Incidencias) | |
| **Incidencias / Cobertura** | `/operacion/incidencias`, `/operacion/cobertura` | 582 | ídem | Una sola pantalla para las dos rutas |

En estas seis: **cero hex a mano, cero `<select>` nativos, cero fechas del navegador**.

### Con cuerpo viejo

Lo que vas a ver distinto, y **no es defecto**:

| Pantalla | Ruta | Líneas | `<select>` nativos | Colores a mano | Qué notarás |
|---|---|---|---|---|---|
| **Operación (vieja)** | `/operacion/:section` | **2256** | 15 | 130 | Sigue viva bajo las rutas nuevas; se alcanza con cualquier `:section` que no sea asistencia/incidencias/cobertura |
| **Servicios** | `/servicios` | **1803** | 6 | 29 | Cuatro pestañas en una sola página: Datos, Configuración, Posiciones, Asignaciones. Es donde ocurren los pasos 5, 6 y 8 |
| **Solicitudes** | `/solicitudes` | 1563 | 17 | 176 | **Fuera del menú** (fase 2) |
| **Documentos** | `/documentos` | 1216 | 10 | 112 | **Sin entrada de menú**: sólo por URL (hallazgo 8.3) |
| **Catálogos** | `/catalogos` | 1189 | 19 | 134 | Paso 3 |
| **Seguridad** | `/seguridad`, `/usuarios` | 982 | 6 | 97 | |
| **Reportes** | `/reportes` | 645 | 2 | 98 | **Fuera del menú** (fase 2) |
| **Auditoría** | `/auditoria` | 601 | 4 | 61 | Un `new Date().toISOString()` en la línea 282, para un nombre de archivo de exportación |
| **Plataforma** | `/plataforma/organizaciones` | 395 | 0 | 19 | Paso 1 |
| **Monitor** | `/monitor` | — | 1 | 0 | **Fuera del menú** (fase 2) |
| **Login** | `/login` | 50 | 0 | 27 | |

**Cómo distinguir cuerpo viejo de un defecto**, en tres señales:

1. **Un desplegable con la flecha del sistema operativo** en vez del selector propio de GestIA. Es
   `<select>` nativo: pantalla vieja.
2. **Un color que no pega con el resto** —un azul o un rojo ligeramente distintos—. Es un hex escrito
   a mano en vez de un token `--gestia-*`.
3. **Un campo de fecha que propone el día siguiente por la tarde.** Todas las pantallas piden el día
   al servidor hoy, así que esto **ya no debería verse**; si lo ves, es un defecto de verdad y vale
   la pena reportarlo.

---

## 7. Lo que el sistema no hace, y se podría creer que sí

| Qué falta | Estado real | Por qué |
|---|---|---|
| **Patrón cíclico con ancla** (4×2, 12×24) | **No existe.** Un `ShiftSegment` es un turno **en un día de la semana** (`DayOfWeek`). No hay fecha ancla ni longitud de ciclo | **Bloqueado por decisión de negocio.** Depende de tres preguntas para Óscar y Joab: cuántos días de descanso tiene una posición típica, qué pasa cuando el ciclo cae en festivo o en el corte de semana, y si el cubre-descansos es fijo o se asigna cada vez. `ALCANCE.md` lo tiene como lo primero que hay que construir |
| **Distinguir «descansa el jueves» de «nadie declaró el jueves»** | **No se puede afirmar con este modelo.** Un día de descanso es la **ausencia** de segmento, igual que un día sin declarar | **Bloqueado por el mismo modelo.** Está dicho en el propio código (`OverviewAttentionKey.PositionsWithoutPattern`): el bosquejo pedía «días del ciclo sin declarar» y se sustituyó por «posiciones sin patrón», que sí se puede afirmar. La rejilla de Planeación distingue **«Sin turno»** (declarado) de **«Sin declarar»** a nivel de posición, no de día |
| **Arrastrar y soltar turnos** en la rejilla | **No existe.** Los turnos se editan celda por celda | **Fuera de alcance por ahora, no descartado.** Anotado en el bosquejo de Planeación como pendiente de revisar con Óscar y Joab |
| **Comparar versión publicada contra borrador** | **No existe.** La pantalla dice qué versión hay publicada, pero no enseña el diff | **Misma anotación**: pendiente de revisión, no descartado |
| **Motivo al capturar por primera vez en un día cerrado** | **No lo pide.** `RequireCorrectionReasonAsync` vive en la rama de **corrección** de `UpsertAttendanceAsync`; una primera captura no pasa por ahí | **Deuda reconocida y anotada.** Debería pedirlo: el cierre congeló «N pendientes» en su foto, y esa foto es lo que se concilia con el cliente. Queda la asimetría de que corregir un dato pide motivo y agregar uno que no existía no, siendo el segundo el que cambia el conteo. El arreglo es de servidor |
| **Habilidades (`EmployeeSkill`) en la interfaz** | **No existe pantalla.** El API del backend está completo (`GET/POST/PUT/DELETE /api/v1/catalogs/employees/{id}/skills`) y el frontend tiene los cuatro métodos en `catalog-api.service.ts` — **con cero llamadas** | **Deuda.** Y con una consecuencia real: ver hallazgo 8.4 |
| **Evaluaciones (`EmployeeEvaluation`) en la interfaz** | **No existe pantalla de alta.** El API está completo y `workforce-api.service.ts` tiene los métodos, **con cero llamadas** desde una pantalla. Documentos sólo las usa como *tipo de propietario* de un documento | **Deuda**, con la misma consecuencia |
| **Registro de acceso del super admin a organizaciones** | **No existe** | **Decisión pendiente** (#4 de `ALCANCE.md`, para BKT) |
| **Cambio de contraseña forzado / recuperación por correo** | **No existe** ninguno de los dos | **Fuera de alcance.** No hay servicio de correo en el sistema |
| **Solicitudes, Reportes, Monitor, Reglas documentales** | Las pantallas **existen y funcionan**, pero están fuera del menú | **Fuera de fase 1, ocultas a propósito** con `phase: 2`. No borradas |
| **Un permiso propio de Servicios** | No existe: Servicios va con `CLIENTS.*` | **Deuda** de modelado de permisos. Quien ve clientes ve servicios |
| **Descomponer Servicios en componentes** | 1803 líneas en una página con cuatro pestañas | **Deuda**, con tanda propia ya anotada |
| **Usuario de base de datos con privilegio mínimo** | La API usa una cuenta con más privilegios de los necesarios | **Deuda**, con tanda propia ya anotada |

---

## 8. Lo que no cuadra

Esta sección vale más que el mapa. Son contradicciones, código muerto y validaciones que no se
pueden satisfacer, encontradas al levantar lo anterior. Ordenadas por lo que más estorba al recorrer.

---

### 8.1 La pantalla dice que los huecos no impiden publicar. El servidor los rechaza

**El más importante, y lo vas a encontrar en el paso 9.**

El frontend construye el conflicto de huecos con `blocking: false` y este texto literal
(`features/planning/data-access/planning.models.ts:232`):

> «Faltan 3 elementos en total. **No impide publicar**: una semana con huecos es una semana normal a
> la que le falta gente, y publicarla es lo que deja a Cobertura resolverlos.»

Como no es bloqueante, `publish-panel.ts` **deja el botón habilitado** y no da ninguna razón.

El servidor hace lo contrario (`SchedulingService.PublishScheduleVersionCoreAsync`, línea 95):

```csharp
var coverageGaps = await FindCoverageGapsAsync(idService, version, shifts, cancellationToken);
if (coverageGaps.Length > 0)
{
    throw new ResourceConflictException(
        $"No se puede publicar la planeación porque hay posiciones sin cubrir. {…}");
}
```

**Qué ves:** pulsas «Publicar la semana» en una semana a la que le falta gente, y sale un aviso rojo
con `No se puede publicar la planeación porque hay posiciones sin cubrir. 2026-09-08 · P-01: faltan
2 elemento(s) en 07:00-19:00.` — justo después de que la pantalla te dijo que eso no lo impedía.

**Cómo reproducirlo:** cualquier semana donde un segmento pida más elementos de los que hay
asignados. Es el estado normal de una organización a medio configurar, así que es fácil de encontrar.

**Cuál de las dos es la buena es una decisión de negocio, no un arreglo obvio.** El texto del
frontend argumenta que publicar con huecos es lo que deja a Cobertura resolverlos; el servidor
argumenta que una semana incompleta no es una semana. **No lo he tocado.**

---

### 8.2 `MENU-POR-ROL.md` dice 11 entradas para el super admin dentro de una organización; son 12

El documento (`docs/design/pendientes/MENU-POR-ROL.md`, última línea del cuerpo) afirma:

> «El super admin fuera de organización ve tres entradas —Inicio, Organizaciones y Seguridad—, y
> dentro de una organización ve **las 11**.»

El código y su prueba dicen **12** (`app-shell.spec.ts`: `expect(entradas(dentro.raiz)).toHaveLength(12)`).
Y no son «las 11» del admin de organización: el super admin conserva **Organizaciones** y ve
**Seguridad → `/seguridad`** (plataforma), mientras que el admin de organización ve
**Seguridad → `/usuarios`**. Son doce entradas y una de ellas apunta a otro sitio.

---

### 8.3 La pantalla de Documentos no tiene entrada de menú

`/documentos` está registrada en `app.routes.ts` con permiso `DOCUMENTS.READ` y carga una página de
**1216 líneas**. En `navigation.ts` **no hay ninguna entrada que apunte ahí**. La única entrada que
menciona documentos es *Reglas documentales* → `/configuracion/documentos`, que es otra ruta y
además está marcada `phase: 2`.

Resultado: `DOCUMENTS.READ` y `DOCUMENTS.WRITE` están repartidos a cuatro de los cinco roles, y la
pantalla que los usa **sólo se alcanza escribiendo la URL**.

O es una entrada de menú que falta, o es una pantalla que debería estar marcada fuera de fase 1 como
las otras cuatro. Hoy no es ninguna de las dos cosas.

---

### 8.4 Una regla de elegibilidad de habilidad o de evaluación **no se puede satisfacer desde la interfaz**

Ésta es la que más caro sale, porque **deja a un empleado bloqueado sin salida**.

La cadena:

1. En **Catálogos** se puede crear una `EligibilityRequirement` de tipo **`Skill`** o **`Evaluation`**,
   marcada como bloqueante. La pantalla lo permite: `catalog-api.service.ts` tiene el alta y
   `catalogs-page.ts` la usa.
2. `CatalogService.EvaluateEligibilityAsync` la evalúa: exige una `EmployeeSkill` activa y vigente
   —o una `EmployeeEvaluation`— con el código pedido.
3. **No hay ninguna pantalla para dar de alta una habilidad ni una evaluación.** El API del backend
   existe; los métodos del frontend existen; **nadie los llama**:

```text
listEmployeeSkills         llamadas desde una pantalla: 0
createEmployeeSkill        llamadas desde una pantalla: 0
updateEmployeeSkill        llamadas desde una pantalla: 0
deactivateEmployeeSkill    llamadas desde una pantalla: 0
createEmployeeEvaluation   llamadas desde una pantalla: 0
```

4. La regla falla siempre → el empleado no es elegible → **no se puede publicar ninguna semana que lo
   incluya** (`No se puede publicar: <nombre>. Falta habilidad requerida: XXX.`) **ni usarlo como
   sustituto** en una cobertura.

**La única salida por interfaz es volver a Catálogos y desactivar la regla.** No hay forma de
cumplirla. Es una validación satisfacible sólo por API.

Que hoy no muerda depende de que nadie haya creado una regla de ese tipo. Los **cuatro métodos
muertos** del `catalog-api.service.ts` son, además, código que aparenta una función que no existe.

---

### 8.5 El motivo obligatorio se puede esquivar sin querer, y el sistema no lo nota

Ya está anotado como deuda en la sección 7, pero conviene verlo junto: **capturar por primera vez
una asistencia sobre un día cerrado no pide motivo**, mientras que **corregir una que ya existía sí**.

La asimetría va al revés de lo que conviene: el cierre congeló «N turnos sin asistencia» en su foto,
y capturar uno de esos después **cambia lo que el cierre afirmó**, mientras que corregir un dato ya
capturado no cambia el conteo. **El caso que no pide motivo es el que más altera el reporte.**

---

### 8.6 `PLATFORM.ADMIN` no es llave maestra en un endpoint, y en los otros 164 sí

`GET /api/v1/catalogs/options` es el único endpoint que no usa `RequirePermission`. Comprueba a mano
seis permisos:

```csharp
var allowed = new[] { CatalogsRead, ClientsRead, WorkforceRead, RequestsRead, OperationsRead, PlanningRead };
if (!allowed.Any(permission => context.User.HasClaim("permission", permission)))
    return Results.StatusCode(StatusCodes.Status403Forbidden);
```

`PLATFORM.ADMIN` **no está en la lista**, mientras que `PermissionEndpointFilter` lo acepta siempre.
Hoy no se nota porque el rol `ADMINISTRATOR` lleva los 23 permisos; se notaría el día que alguien
cree un rol de plataforma con `PLATFORM.ADMIN` y poco más: pasaría por todas las puertas y se
estrellaría con un **403 sin cuerpo** —`Results.StatusCode`, sin `ProblemDetails`— justo en el
endpoint que alimenta los desplegables de casi todas las pantallas.

---

### 8.7 `/monitor`: la ruta y el menú piden permisos distintos

`app.routes.ts` protege `/monitor` con `{ permission: 'PLATFORM.ADMIN', platformOnly: true }`.
`navigation.ts` declara la entrada con `permission: 'REPORTS.READ', onlyFor: 'platform'`.

Hoy no se ve porque la entrada está marcada `phase: 2`, pero son dos fuentes de verdad que no
coinciden, y el día que se le quite la marca aparecerá para quien tenga `REPORTS.READ` y lo mandará
a una ruta que le va a redirigir a Inicio en silencio.

---

### 8.8 Nada impide que un usuario se quite a sí mismo el acceso

`OrganizationSecurityEndpoints` no comprueba en ningún punto que el usuario objetivo sea distinto del
actor. Un admin de organización con `USERS.WRITE` puede desactivarse a sí mismo o quitarse su propia
membresía, y **quedarse fuera de su organización sin nadie dentro que pueda devolvérsela** —porque
ningún otro admin de organización puede asignar el rol `ORGANIZATION_ADMIN`—.

La recuperación existe, pero es **siempre por el super admin**. Conviene saberlo antes de recorrer
la pantalla de Seguridad con el propio usuario.

---

### 8.9 La deriva que ya costó tres veces

Vale la pena nombrar el patrón, porque los hallazgos 8.1, 8.2 y 8.4 son la misma familia que ya
apareció tres veces en las dos jornadas: **un dato o una regla que existe de un lado y no viaja al
otro, sin que nada falle.** La transición T3 que filtraba con un nombre distinto del que el servidor
esperaba, el `correctionAuthorizationNotes` que el frontend mandaba y el servidor descartaba en
silencio, y el `CreatedAt` que no viajaba y hacía imposible la marca de «posterior al cierre».

No hay hoy ninguna prueba que compare las reglas del frontend con las del servidor. Las pruebas de
arquitectura cubren la forma de los contratos —que el token de concurrencia viaje, que las capas no
se crucen—, pero no que **la regla que la pantalla anuncia sea la que el servidor aplica**. Los tres
hallazgos de arriba son exactamente ese hueco.
