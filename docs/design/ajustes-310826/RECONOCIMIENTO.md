# Reconocimiento previo a los ajustes 31-08-26

Fecha del reconocimiento: 2026-09-04.
Rama: `s0/feature/gestIaProject/v0`. Último commit: `5deb74f "Configuracion del proyecto"`.
Alcance analizado: `docs/design/ajustes-310826/AJUSTES-310826-ALCANCE.md`.

Este documento describe el **estado de hecho del código**, no el estado documentado. Está
escrito para leerse sin acceso al repositorio: cada archivo o componente que se menciona lleva
una explicación breve de qué hace.

---

## 0. Advertencia de encuadre: el alcance ya fue implementado en gran parte

Antes de entrar en detalle, el hallazgo central del reconocimiento:

**El documento de alcance describe un punto de partida que ya no existe.** Los paquetes A, B, C
y buena parte de D fueron implementados en los commits del 2 y 4 de septiembre, que se llaman
literalmente *"Configuracion para cambios pedidos el dia 31 de agosto"*. La verificación es
directa: el commit `4bf43e9` contiene el diff que elimina el grupo de menú `Gestión` y crea el
grupo `Configuración`, que es exactamente el Paquete A.

Consecuencia práctica: si alguien toma el alcance tal cual y lo implementa, va a rehacer trabajo
ya hecho y a romper decisiones posteriores. Lo que queda por hacer es un subconjunto pequeño y
específico, listado paquete por paquete más abajo.

Nota de nomenclatura: el alcance dice que su ubicación sugerida es
`docs/design/ajustes-310826/ALCANCE.md`. Ese archivo **no existe**; el archivo real se llama
`AJUSTES-310826-ALCANCE.md` en esa misma carpeta.

---

## 1. Estado de hecho del proyecto

### 1.1 Tamaño real

| Elemento | Cantidad |
|---|---|
| Proyectos backend | 4 (`Domain`, `Application`, `Infrastructure`, `Api`) |
| Suites de prueba backend | 4 (`Domain.UnitTests`, `Application.UnitTests`, `Architecture.Tests`, `IntegrationTests`) |
| Archivos de endpoints (`GestIA.Api/Endpoints`) | 20 |
| Configuraciones Fluent API (`Infrastructure/Persistence/Configurations`) | 35 |
| Migraciones de EF Core | 19 |
| Tablas materializadas en el modelo | 35 |
| Features del frontend Angular (`frontend/src/app/features`) | 15 |

El README describe el proyecto como *"en preparación inicial"* con *"los módulos de negocio se
desarrollarán por entregas verticales"*. **Eso está desactualizado.** El sistema tiene módulos
de negocio completos con persistencia, autorización y pruebas.

### 1.2 Verificación de compilación (Paso 3)

Ambas compilaciones pasan limpias. No hay errores que reportar.

**Backend** — `dotnet build backend/GestIA.sln`:

```text
Build succeeded.
    0 Warning(s)
    0 Error(s)
Time Elapsed 00:00:22.03
```

Es un resultado significativo porque `backend/Directory.Build.props` fija
`TreatWarningsAsErrors=true` y `EnforceCodeStyleInBuild=true`: cualquier advertencia habría
roto el build.

**Frontend** — `npm ci` seguido de `npm run build`:

```text
added 386 packages, and audited 387 packages in 25s
1 moderate severity vulnerability
...
Application bundle generation complete. [17.040 seconds]
Output location: frontend\dist\gestia-web
```

Salida inicial 338.51 kB (88.99 kB transferidos). Observaciones registradas tal cual, sin
corregirlas:

- `npm ci` reporta **1 vulnerabilidad de severidad moderada**. No se ejecutó `npm audit fix`.
- `npm ci` advierte que 4 paquetes tienen scripts de instalación no aprobados:
  `@parcel/watcher@2.6.0`, `esbuild@0.28.2`, `lmdb@3.5.6`, `msgpackr-extract@3.0.4`.

### 1.3 Navegación y rutas en Angular (pregunta explícita del Paso 2)

**Dónde está declarado el menú.** En un solo archivo:
`frontend/src/app/core/layout/navigation.ts`. Exporta la constante `GESTIA_NAVIGATION`, una
lista tipada de grupos, donde cada elemento tiene etiqueta, icono, ruta, permiso requerido y
tres banderas de visibilidad (`platformOnly`, `hideForPlatformAdmin`, `availableInSupport`).

**Cuántos archivos referencian "Gestión": ninguno como sección de navegación.** El grupo
`Gestión` **ya no existe**. Las cuatro apariciones de la palabra en el frontend son cosméticas y
no tienen relación con la navegación:

| Archivo | Línea | Texto |
|---|---|---|
| `core/layout/app-shell/app-shell.html` | 126 | pie de página `"GestIA · Gestión inteligente"` |
| `features/documents/pages/documents-page/documents-page.ts` | 90 | rótulo `"Gestión contextual"` |
| `features/monitor/pages/monitor-page.html` | 15 | botón `"Gestionar organizaciones"` |
| `features/platform/pages/platform-page/platform-page.html` | 220 | botón `"Gestionar accesos"` |

**Estructura actual del menú** (`GESTIA_NAVIGATION`), con el permiso que cada entrada exige:

| Grupo | Entrada | Ruta | Permiso |
|---|---|---|---|
| Principal | Inicio | `/` | — |
| Operación | Monitor global | `/monitor` | `REPORTS.READ`, solo plataforma |
| Operación | Planeación | `/planeacion` | `PLANNING.READ` |
| Operación | Asistencia | `/operacion/asistencia` | `OPERATIONS.READ` |
| Operación | Incidencias | `/operacion/incidencias` | `OPERATIONS.READ` |
| Operación | Cobertura | `/operacion/cobertura` | `OPERATIONS.READ` |
| Control | Solicitudes | `/solicitudes` | `REQUESTS.READ` |
| Control | Reportes | `/reportes` | `REPORTS.READ` |
| Control | Auditoría | `/auditoria` | `AUDIT.READ` |
| Control | Seguridad | `/seguridad` | `PLATFORM.ADMIN`, solo plataforma |
| Control | Seguridad | `/usuarios` | `USERS.READ`, oculta al super admin |
| Configuración | Organizaciones | `/plataforma/organizaciones` | `PLATFORM.ADMIN`, solo plataforma |
| Configuración | Clientes | `/clientes` | `CLIENTS.READ` |
| Configuración | Servicios | `/servicios` | `CLIENTS.READ` |
| Configuración | Personal | `/personal` | `WORKFORCE.READ` |
| Configuración | Catálogos | `/catalogos` | `CATALOGS.READ` |
| Configuración | Reglas documentales | `/configuracion/documentos` | `CATALOGS.READ` |

**Rutas.** `frontend/src/app/app.routes.ts` define 19 rutas. Todas las de negocio cuelgan de una
ruta padre vacía que monta `AppShell` (el marco visual con sidebar y topbar) y aplica
`authGuard` y `authChildGuard`. Cada hija declara `data: { permission: '...' }` y carga su
componente de forma diferida (`loadComponent`), lo que produce un *chunk* JavaScript por
pantalla.

Hay dos redirecciones de compatibilidad ya existentes:
`plataforma/clientes-gestia -> plataforma/organizaciones` y `operacion -> operacion/asistencia`,
más un comodín `** -> ''`.

**Ruta huérfana detectada:** `/documentos` (el módulo global de Documentos, componente
`DocumentsPage`, 1 212 líneas) sigue existiendo y funcionando, pero **no aparece en el menú**.
Solo se llega a ella por enlaces incrustados desde la pantalla de inicio
(`overview-page.ts:367`), Solicitudes (`requests-page.html:603`) y Servicios
(`services-page.html:194`). El menú ofrece en su lugar "Reglas documentales", que apunta a
`/configuracion/documentos` y en realidad carga `CatalogsPage` con la pestaña de elegibilidad.
Esto es una decisión deliberada registrada en `docs/V5-PUNTOS-1-A-5-2026-09-03.md`:
*"Configuración / Reglas documentales abre los requisitos y reglas, no un repositorio global de
archivos."*

**Breadcrumbs.** Se calculan en `app-shell.ts`, método `resolveBreadcrumbs`, con una cadena de
`if (url.startsWith(...))` — 17 casos codificados a mano. Ya emiten `Configuración`, nunca
`Gestión`.

### 1.4 Módulo de Clientes

`ClientsPage` (`features/clients/pages/clients-page/clients-page.ts`, 1 019 líneas de
TypeScript y 703 de plantilla) es la pantalla del expediente de cliente. Trabaja con un selector
de organización, una lista paginada de clientes y un panel de detalle con **seis pestañas**
declaradas en el tipo `ClientTab`:

| Pestaña | Qué contiene hoy | ¿El alcance dice que salga? |
|---|---|---|
| `summary` | Resumen fiscal y comercial | No, se queda |
| `sites` | Sedes del cliente (`ClientSite`) | No, se queda |
| `services` | **Lista de solo lectura** con enlaces a `/servicios` | Ya salió |
| `contracts` | Contratos (`ServiceContract`) + sus documentos | No, se queda |
| `contacts` | Contactos (`ClientContact`) | No, se queda |
| `documents` | Documentos del cliente vía componente compartido | No, se queda |

**La pestaña de Servicios ya está reducida a expediente.** En
`clients-page.html:471-495`, la sección solo enumera nombre, código, sede, contrato y vigencia
de cada servicio; no hay formularios ni edición. Su encabezado tiene un botón *"Ir a servicios"*
que navega a `/servicios` con `queryParams` de cliente y organización, y cada tarjeta tiene un
enlace *"Abrir servicio"* que además pasa `serviceId`.

**Servicios de datos y endpoints que forman Clientes hoy:**

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Frontend | `features/clients/data-access/client-api.service.ts` (785 líneas) | Cliente HTTP; cubre clientes, sedes, contactos, contratos **y servicios**, porque los endpoints de servicio cuelgan de la ruta de cliente |
| Frontend | `features/clients/data-access/client.models.ts` (721 líneas) | Tipos TypeScript de todo lo anterior |
| API | `Endpoints/ClientEndpoints.cs` | `GET/POST/PUT/DELETE /api/v1/clients` |
| API | `Endpoints/ClientSiteEndpoints.cs` | Sedes |
| API | `Endpoints/ClientContactEndpoints.cs` | Contactos |
| API | `Endpoints/ServiceManagementEndpoints.cs` | Servicios, configuraciones **y contratos** |
| Application | `Clients/ClientService.cs`, `ClientSiteService.cs`, `ClientContactService.cs` | Casos de uso y validación |
| Infrastructure | `Repositories/ClientRepository.cs`, `ClientSiteRepository.cs`, `ClientContactRepository.cs` | Consultas EF Core |

**Responsabilidades que el alcance quiere fuera de Clientes: ya no están.** No hay en
`ClientsPage` configuración profunda de servicio, ni posiciones, ni patrones de turno, ni
asignación de personal, ni planeación versionada. Todo eso vive en `ServicesPage` y
`PlanningPage`.

### 1.5 Servicios: sí existe, y bastante completo

La respuesta directa a la pregunta del Paso 2 es: **Servicios existe como entidad, como tabla,
como endpoints y como componente.** El alcance lo describe como "módulo nuevo"; no lo es.

**Entidades de dominio** (`backend/src/GestIA.Domain/Services/`):

- `Service.cs` — el servicio contratado. Campos: `IdService`, `IdClient`, `IdClientSite`,
  `IdServiceContract` (opcional), `CodeService`, `Name`, `Description`, `InvoiceDescription`,
  `StartDate`, `EndDate`. Valida que la fecha final no sea anterior a la inicial.
- `ServiceConfiguration.cs` — la configuración **versionada por vigencia**. Campos:
  `EffectiveFromDate`, `EffectiveToDate`, `RequiredWorkerCount`, `HoursPerDay`, `DaysPerWeek`,
  `AverageWeeklyHours` (calculada), `AverageMonthlyHours`, `PreparationLeadDays`,
  `WorkScheduleDescription`, `SpecificInstructions`, `MonthlyPrice`, `CurrencyCode`,
  `IsTaxIncluded`.
- `ServiceContract.cs` — el contrato comercial, con `Status` (`ServiceContractStatus`),
  `SignedDate`, vigencia, `PaymentTermDays`, `TerminationNoticeDays`, moneda y notas.

**Tablas.** `Services`, `ServiceConfigurations` y `ServiceContracts` se crearon en la **primera
migración**, `20260827025234_InitialBusinessModel`, junto con `Organizations`, `Clients`,
`ClientSites`, `ClientContacts`, `Employees`, `EmployeeDocuments`, `EmployeeEvaluations` y
`ServiceAssignments`.

**Endpoints** (`Endpoints/ServiceManagementEndpoints.cs`): están **anidados bajo cliente**.

```text
GET|POST         /api/v1/clients/{idClient}/services
PUT|DELETE       /api/v1/clients/{idClient}/services/{idService}
GET|POST         /api/v1/clients/{idClient}/services/{idService}/configurations
PUT|DELETE       /api/v1/clients/{idClient}/services/{idService}/configurations/{id}
GET|POST         /api/v1/clients/{idClient}/contracts
PUT|DELETE       /api/v1/clients/{idClient}/contracts/{idServiceContract}
```

Todos exigen `CLIENTS.READ` o `CLIENTS.WRITE`. **No existen permisos `SERVICES.*`.**

**Frontend.** `features/services/` contiene `ServicesPage` (1 529 líneas TS + 1 190 de
plantilla), un `ServiceDialog` (formulario modal de alta y edición), `service-validators.ts` y
un `ServiceContextApi` mínimo. La pantalla tiene cuatro pestañas: *Configuraciones*,
*Posiciones y turnos*, *Asignaciones* y *Documentos*.

**Limitación central de Servicios hoy:** la pantalla es **jerárquica y obligatoriamente
descendente**. El usuario elige organización, luego busca y elige un cliente, y solo entonces ve
los servicios de ese cliente. En el repositorio,
`ServiceManagementRepository.ListServicesAsync(idClient, ...)` filtra únicamente por
`IdClient`, sin paginación ni filtros. **No existe un listado de servicios a nivel de
organización.**

### 1.6 Autenticación y autorización

**Autenticación.** JWT propio, sin librería externa de identidad.

- `Api/Security/JwtAuthenticationMiddleware.cs` valida el token en cada petición.
- `Api/Security/JwtAccessTokenService.cs` lo emite; `JwtOptions.cs` lee la configuración.
  `Program.cs` **falla al arrancar** si `Jwt:Secret` tiene menos de 32 caracteres.
- `Infrastructure/Security/Pbkdf2PasswordHashService.cs` deriva contraseñas con PBKDF2
  (hash, sal e iteraciones almacenados por usuario).
- El token porta claims `permission` (uno por permiso) y `organization` (uno por organización a
  la que el usuario pertenece).

**Modelo de seguridad en base de datos.** Seis tablas: `Users`, `Roles`, `Permissions`,
`RolePermissions`, `OrganizationMemberships`, `UserRoles`. Un `UserRole` liga usuario, rol y
**membresía de organización**, de modo que un mismo usuario puede tener roles distintos en
organizaciones distintas.

**Roles que existen en código** (creados por `Infrastructure/Persistence/SecurityDataSeeder.cs`,
un sembrador que se ejecuta al arrancar la API si `SecuritySeed:Enabled` no está en `false`):

| `CodeRole` | Nombre | Permisos que recibe |
|---|---|---|
| `ADMINISTRATOR` | Administrador | **Todos**, incluido `PLATFORM.ADMIN` |
| `ORGANIZATION_ADMIN` | Admin de organización | Todos **menos** `PLATFORM.ADMIN` y `ORGANIZATIONS.WRITE` |
| `ORG_SUPERVISOR` | Supervisor operativo | 14 permisos de lectura/escritura operativa y documental |
| `ORG_OPERATOR` | Operador | 10 permisos; escribe operación y solicitudes, lee lo demás |
| `ORG_VIEWER` | Consulta operativa | 8 permisos, todos de lectura |

Los tres roles operativos (`ORG_SUPERVISOR`, `ORG_OPERATOR`, `ORG_VIEWER`) corresponden al
"Usuario operativo" del alcance, con granularidad mayor a la que el documento describe.

**Catálogo de permisos** (`Application/Security/SecurityPermissions.cs`), 23 constantes:
`PLATFORM.ADMIN`, `ORGANIZATIONS.READ/WRITE`, `USERS.READ/WRITE`, `CLIENTS.READ/WRITE`,
`DOCUMENTS.READ/WRITE`, `DOCUMENTS.SENSITIVE.READ/WRITE`, `CATALOGS.READ/WRITE`,
`WORKFORCE.READ/WRITE`, `PLANNING.READ/WRITE`, `OPERATIONS.READ/WRITE`, `REPORTS.READ`,
`AUDIT.READ`, `REQUESTS.READ/WRITE`.

**Aislamiento por organización: se valida en el servidor, no solo en la UI.** El mecanismo es
`Api/Security/OrganizationAccessGuard.cs`:

```csharp
public static bool CanAccess(HttpContext context, Guid organizationId)
{
    if (!IsPlatformAdmin(context))
    {
        return UserOrganizationIds(context).Contains(organizationId);
    }
    return SupportSessionContext.Current(context)?.IdOrganization == organizationId;
}
```

Se lee así: un usuario normal solo accede a organizaciones que trae en sus claims; **un super
admin no accede a ninguna organización salvo que tenga una sesión de soporte activa para
exactamente esa organización.** Es más restrictivo que lo que pide el alcance.

Cada endpoint de negocio abre con `OrganizationAccessGuard.ForbidIfUnauthorized(...)`, que
devuelve `403 Problem Details`, y se encadena con
`.RequirePermission(SecurityPermissions.X)` (filtro en
`Api/Security/PermissionEndpointFilter.cs`). Hay cobertura de prueba en
`tests/GestIA.IntegrationTests/OrganizationAccessGuardTests.cs`.

**Modo soporte/auditoría del super admin: ya está implementado.** El alcance lo declara
"mencionado sin especificar". En código:

- Entidad `Domain/Support/SupportSession.cs`: `IdOrganization`, `Reason` obligatorio, `StartsAt`,
  `ExpiresAt`, `EndedAt`/`EndedBy`/`EndedByName`. `IsValidFor(actorId, occurredAt)` exige que la
  sesión esté activa, no terminada, **creada por el mismo actor** y dentro de la ventana.
- `Api/Security/SupportSessionMiddleware.cs` lee la cabecera `X-GestIA-Support-Session` y
  rechaza con 403 si no valida.
- Tabla `SupportSessions` (migración `20260903180122_SupportSessions`, con precisión corregida
  en `20260903190240_SupportTimestampPrecision`).
- En la UI, `app-shell.ts` expone el diálogo de inicio de soporte, exige un motivo de al menos
  10 caracteres y una duración, muestra la organización y la hora de expiración en la topbar, y
  la señal `requiresSupport` bloquea 11 rutas operativas al super admin sin soporte.

**Vistas separadas por rol.** No es la misma pantalla con elementos ocultos:

- `platform-page.ts` (`/plataforma/organizaciones`) es exclusiva del super admin.
- `monitor-page.ts` (`/monitor`) es el monitor global, exclusivo del super admin.
- `security-page.ts` se monta en dos rutas con permisos distintos: `/seguridad`
  (`PLATFORM.ADMIN`) y `/usuarios` (`USERS.READ`).
- `overview-page.ts` bifurca título, métricas, accesos y directorio según `isPlatformAdmin()`.

### 1.7 Módulo de Documentos y el bug del Paquete E

**Cómo se relaciona hoy un archivo con su entidad propietaria.** La entidad
`Domain/Documents/BusinessDocument.cs` tiene **un solo propietario**, expresado de dos formas
redundantes:

1. El par polimórfico `OwnerType` (enum `BusinessDocumentOwnerType`) + `OwnerId` (Guid).
2. Seis claves foráneas nulables desnormalizadas: `IdClient`, `IdServiceContract`, `IdService`,
   `IdEmployee`, `IdEmployeeEvaluation`, `IdOperationalRequest`.

El método privado `ApplyProfile` rellena **exactamente una** de esas seis y pone las otras cinco
en `null`:

```csharp
IdClient          = profile.OwnerType == BusinessDocumentOwnerType.Client          ? profile.OwnerId : null;
IdServiceContract = profile.OwnerType == BusinessDocumentOwnerType.ServiceContract ? profile.OwnerId : null;
IdService         = profile.OwnerType == BusinessDocumentOwnerType.Service         ? profile.OwnerId : null;
// ... etc.
```

**Aquí está el bug del Paquete E.** El alcance pide: *"Documento de contrato: se asocia al
contrato **y al cliente**, sin duplicar archivo"*. Con el modelo actual eso es imposible: un
documento con `OwnerType = ServiceContract` deja `IdClient` en `null`. Y la búsqueda en
`Infrastructure/Persistence/Repositories/BusinessDocumentRepository.cs` filtra por igualdad
exacta:

```csharp
if (criteria.OwnerType is not null) query = query.Where(d => d.OwnerType == criteria.OwnerType);
if (criteria.OwnerId   is not null) query = query.Where(d => d.OwnerId   == criteria.OwnerId);
```

Por lo tanto, **un documento de contrato nunca aparece al consultar los documentos del cliente
dueño de ese contrato.** Esto se observa en la UI: `clients-page.html:498-503` monta dos
instancias separadas del componente de documentos, una para la pestaña de cliente y otra para la
de contratos, precisamente porque no se pueden ver juntas.

**Riesgo de duplicar el archivo físico: sí existe, pero no donde el documento lo sugiere.**

- El **archivo** se guarda una sola vez por carga. `BusinessDocumentEndpoints.StoreFileAsync`
  escribe en `storage/business-documents/{organizationId}/{año}/{mes}/{guid}{extensión}` con
  nombre aleatorio. **No hay deduplicación por hash de contenido:** subir dos veces el mismo PDF
  produce dos archivos físicos. Pero como el mismo endpoint `POST /api/v1/documents/upload` se
  usa desde Clientes, Contratos, Servicios, Personal y Solicitudes, cargar una vez y registrarlo
  en un módulo no lo duplica en disco.
- El **registro** sí está duplicado estructuralmente. Existen **dos almacenes documentales
  paralelos**:

| Almacén | Tabla | Se ve desde | Descarga |
|---|---|---|---|
| Módulo Documentos | `BusinessDocuments` (+ `BusinessDocumentEvents` para historial) | Componente compartido `EntityDocuments` en Clientes, Contratos, Servicios, Personal, Solicitudes | `GET /api/v1/documents/{id}/download` |
| Personal, heredado | `EmployeeDocuments` y la columna `StorageReference` de `EmployeeEvaluations` | Solo la pestaña Documentos de Personal | `GET /api/v1/employees/{id}/documents/{id}/download` |

El código nombra al segundo explícitamente como heredado: el método privado
`IsLegacyStorageReferenceAsync` y el helper `DownloadLegacyFile`. La pestaña Documentos de
Personal (`workforce-page.html:378-439`) **muestra las dos listas una debajo de otra**: primero
los `EmployeeDocuments` y luego el componente `app-entity-documents`. Un mismo expediente vive
en dos tablas, con dos formularios y dos rutas de descarga. Sin embargo, desde el commit
`5deb74f` la carga de un archivo de `EmployeeDocument` ya pasa por
`DocumentApiService.uploadDocumentFile`, es decir, por el endpoint del módulo Documentos: el
archivo aterriza en la carpeta `business-documents/` pero el registro queda en
`EmployeeDocuments` y por eso resulta invisible para el módulo Documentos.

**Vencimientos.** El backend calcula `isExpired` comparando `ExpiresDate` contra la fecha UTC de
hoy y lo devuelve en cada respuesta. La pantalla de Documentos lo usa para un contador de
vencidos y un aviso de "por vencer"; el componente compartido pinta una insignia roja. **Lo que
falta es el indicador en el listado de Clientes:** el campo `clientDocumentsFilter` de
`clients-page.ts:67` está declarado, tiene su método `updateClientDocumentsFilter` y se activa
desde el filtro guardado `pendingDocuments`, pero **nunca se usa en el `computed`
`visibleClients`** que decide qué clientes se pintan. Es código muerto: seleccionar ese filtro
no cambia nada en pantalla.

**Privacidad.** Sí funciona de forma transversal. `IsSensitive` marca el documento; los permisos
`DOCUMENTS.SENSITIVE.READ` y `DOCUMENTS.SENSITIVE.WRITE` se verifican en el servidor; la
consulta excluye los sensibles cuando el actor no los tiene, y además excluye documentos cuya
referencia de almacenamiento coincida con la de un documento sensible o con la de un registro
heredado. `BusinessDocument.UpdateProfile` prohíbe desclasificar un documento sensible y prohíbe
cambiar de propietario.

### 1.8 Migraciones y entidades materializadas

19 migraciones, todas en `backend/src/GestIA.Infrastructure/Persistence/Migrations/`:

| # | Migración | Qué materializa |
|---|---|---|
| 1 | `20260827025234_InitialBusinessModel` | 11 tablas: `Organizations`, `Clients`, `ClientSites`, `ClientContacts`, `ServiceContracts`, `Services`, `ServiceConfigurations`, `Employees`, `EmployeeDocuments`, `EmployeeEvaluations`, `ServiceAssignments` |
| 2 | `20260827042858_JwtSecurityModel` | 6 tablas de seguridad |
| 3 | `20260827192155_PlanningPositionsAndShifts` | `Positions`, `ShiftPatterns`, `ShiftSegments` |
| 4 | `20260827201231_ServiceAssignmentsPosition` | Liga asignación con posición |
| 5 | `20260828004652_ScheduleVersionsAndScheduledShifts` | `ScheduleVersions`, `ScheduledShifts` |
| 6 | `20260828010150_OperationsAttendanceIncidentsCoverages` | `AttendanceRecords`, `Incidents`, `CoverageRecords` |
| 7 | `20260828024238_OperationalRequests` | `OperationalRequests` |
| 8 | `20260828035146_OperationEvidences` | `OperationEvidences` |
| 9 | `20260828044631_BusinessDocuments` | `BusinessDocuments` |
| 10 | `20260828185255_BusinessCatalogsAndEligibility` | `BusinessCatalogItems`, `EligibilityRequirements`, `EmployeeSkills` |
| 11 | `20260828200905_OperationControls` | `ApprovalRequests`, `OperationDayClosures` |
| 12 | `20260829025312_FormalApprovalWorkflow` | Columnas de flujo de aprobación |
| 13 | `20260903180122_SupportSessions` | `SupportSessions` |
| 14 | `20260903183655_DocumentReviewHistory` | `BusinessDocumentEvents` y columnas de revisión |
| 15 | `20260903190240_SupportTimestampPrecision` | Corrige precisión de instantes de soporte |
| 16 | `20260903194105_DocumentAuditSnapshots` | `BeforeSnapshot`/`AfterSnapshot` en eventos |
| 17 | `20260903205050_CatalogValueMetadata` | Metadatos de catálogo |
| 18 | `20260903211914_GeographicCatalogRelations` | Jerarquía país/estado/municipio |
| 19 | `20260903214645_CoverageCatalogReference` | `IdCoverageReason` como FK a catálogo |

**Estado de despliegue.** Según `docs/V5-AVANCE-2026-09-03.md` y
`docs/CATALOGOS-CIERRE-2026-09-03.md`, estas migraciones están **aplicadas en `db-gestia-dev`**,
la última confirmada es `20260903214645_CoverageCatalogReference`, se tomaron respaldos
verificados antes de cada cambio de esquema, y existe un ambiente publicado en
`dev.gestia-demo.com`. Es decir: **la regla de "una migración desplegada no se reescribe, se
compensa" aplica de verdad a todas estas 19.**

35 tablas materializadas en total. Las que faltan respecto a lo que el alcance imagina se
detallan en los mapeos por paquete.

---

## 2. Mapeo paquete por paquete

Escala usada: **chico** = horas, un archivo o dos. **Mediano** = uno o varios días, toca varias
capas. **Grande** = semanas, toca datos, backend, frontend y requiere migración.

---

### Paquete A — Navegación e información

**Tipo declarado:** UX, sin dependencias, "hacer primero".

#### Lo que ya existe y sirve tal cual

**Prácticamente todo el paquete.** Fue implementado en el commit `4bf43e9`, cuyo diff sobre
`navigation.ts` elimina el bloque `label: 'Gestión'` y crea `label: 'Configuración'`.

| Requisito del alcance | Estado |
|---|---|
| Renombrar `Gestión` a `Configuración` en el menú | Hecho. El grupo `Gestión` no existe |
| Lo mismo en rutas | No aplica: nunca hubo una ruta `/gestion`; las rutas siempre fueron planas (`/clientes`, `/personal`) |
| Lo mismo en breadcrumbs | Hecho. `resolveBreadcrumbs` emite `Configuración` en 6 casos |
| Lo mismo en títulos | Hecho. Cada ruta declara `title: 'GestIA | X'` y `services-page.html:5` muestra el rótulo `Configuración` |
| Elevar `Operación`, con asistencia, incidencias y cobertura como accesos principales | Hecho. Es el segundo grupo del menú, con las tres entradas al mismo nivel |
| La pantalla principal orienta operación diaria | Hecho. `overview-page.ts` distingue por rol; para un admin de organización el botón principal va a `/operacion/asistencia` |

#### Lo que existe pero habría que modificar

Nada obligatorio. Los cuatro textos con "Gestión"/"Gestionar" de la tabla en 1.3 son etiquetas de
botones y del pie de página, no navegación; cambiarlos sería cosmético y opcional.

#### Lo que no existe

**Las redirecciones desde rutas viejas que el propio alcance identifica como riesgo.** El
documento dice: *"Riesgo: rutas viejas rompen enlaces guardados. Definir si se redirige o se
corta."* En el código no hay ninguna redirección nueva asociada a este cambio. Sí existen dos
redirecciones previas (`plataforma/clientes-gestia` y `operacion`), y el comodín
`{ path: '**', redirectTo: '' }` manda cualquier ruta desconocida al inicio en silencio.

Ahora bien: **como las rutas nunca cambiaron** (solo cambió la agrupación visual del menú), no
hay enlaces guardados que se hayan roto. El riesgo declarado en el alcance **no se materializó**.

#### Qué se ve afectado si se toca

Modificar `navigation.ts` afecta a `app-shell.ts` (que filtra y pinta el menú) y a los
breadcrumbs codificados a mano en el mismo archivo. Ambos están en `core/layout` y no tienen
otros consumidores.

#### Tamaño

**Chico**, y en la práctica **cero**: el paquete está entregado. Si se decide además cambiar los
cuatro textos cosméticos, siguen siendo minutos.

#### Definición de negocio que falta

Ninguna para cerrar A. Queda una pregunta abierta menor: si `/documentos` debe volver al menú
(ver Paquete E) o quedarse accesible solo por contexto.

---

### Paquete B — Roles y separación de vistas

**Tipo declarado:** frontend + backend. Depende de A.

#### Lo que ya existe y sirve tal cual

| Requisito del alcance | Estado en código |
|---|---|
| Rol super admin sobre toda la plataforma | `ADMINISTRATOR` con `PLATFORM.ADMIN` |
| Rol admin de organización, limitado a la suya | `ORGANIZATION_ADMIN`, todos los permisos menos `PLATFORM.ADMIN` y `ORGANIZATIONS.WRITE` |
| Rol usuario operativo | Tres roles: `ORG_SUPERVISOR`, `ORG_OPERATOR`, `ORG_VIEWER` |
| El super admin no opera datos diarios como si fuera de una organización | Implementado y **más estricto de lo pedido**: `OrganizationAccessGuard` le niega toda organización sin sesión de soporte activa para esa organización |
| Vistas distintas, no la misma pantalla con elementos ocultos | `PlatformPage` y `MonitorPage` son exclusivas del super admin; `SecurityPage` se monta en `/seguridad` y `/usuarios` con permisos distintos; `OverviewPage` bifurca por rol |
| Crear la organización y su usuario administrador en el mismo flujo | `OrganizationProvisioningService.CreateWithAdminAsync` lo hace en **una sola unidad de trabajo**: valida código, RFC y correo únicos, exige contraseña de 12+ caracteres, crea `Organization`, `User`, `OrganizationMembership`, `UserRole` con `ORGANIZATION_ADMIN` y siembra los catálogos por defecto, todo antes de un único `SaveChangesAsync` |
| **Criterio de aceptación: el aislamiento se valida en el servidor** | **Cumplido.** Cada endpoint llama a `ForbidIfUnauthorized` antes de tocar datos, y hay pruebas en `OrganizationAccessGuardTests.cs` |
| Modo soporte/auditoría: cómo se activa, qué registra, cómo se distingue visualmente | **Ya definido en código**, aunque el alcance lo dé por pendiente. Se activa desde un diálogo en la topbar con motivo obligatorio (mínimo 10 caracteres) y duración; se registra en la tabla `SupportSessions` con actor, motivo, inicio, expiración y cierre; se distingue visualmente con la organización y la hora de expiración en la topbar |

#### Lo que existe pero habría que modificar

- **La matriz de permisos por rol no está validada con negocio.** `SecurityDataSeeder` define
  qué permisos toca cada rol mediante cuatro predicados (`IsOrganizationAdminPermission`,
  `IsSupervisorPermission`, `IsOperatorPermission`, `IsViewerPermission`). Esos repartos son una
  propuesta técnica, no una decisión firmada. `docs/V5-AVANCE-2026-09-03.md` lo declara
  pendiente: *"completar la matriz de permisos por módulo"*.
- **El super admin no puede operar ni siquiera en modo soporte para ciertas rutas.** La señal
  `requiresSupport` de `app-shell.ts` bloquea 11 rutas; algunas entradas de menú tienen
  `availableInSupport: true` y otras no. Conviene revisar si esa lista es la deseada.

#### Lo que no existe

- **Una pantalla de administración de roles y permisos hecha para negocio.** Existe
  `SecurityAdministrationEndpoints.cs` (crear/editar roles y usuarios, con protección de roles
  del sistema) y `SecurityPage`, pero no una vista que muestre la matriz rol × permiso como
  documento revisable.
- **Registro de auditoría de lo que el super admin hace dentro de una sesión de soporte.** La
  sesión queda registrada; las acciones individuales realizadas durante ella quedan en la
  auditoría general (`AuditEndpoints.cs`) sin marca que las distinga como "hechas bajo soporte".
  El alcance pide "qué registra"; lo que registra hoy es la sesión, no la traza etiquetada.

#### Qué se ve afectado si se toca

Cambiar los predicados de permisos de `SecurityDataSeeder` afecta a **todos los usuarios
existentes de `db-gestia-dev` y del ambiente publicado**: el sembrador solo agrega
`RolePermissions` faltantes, nunca quita, así que ampliar un rol es acumulativo e irreversible
por esa vía. Quitar un permiso exige una acción explícita de datos, no una edición del
sembrador.

Cambiar `OrganizationAccessGuard` afecta a los 20 archivos de endpoints a la vez.

#### Tamaño

**Chico a mediano.** El grueso está hecho. Lo que resta es validación de negocio (matriz de
permisos) y, si se quiere, etiquetado de auditoría bajo soporte, que sería **mediano** porque
toca la escritura de auditoría en varios servicios.

#### Definición de negocio que falta

1. La matriz definitiva rol × permiso, firmada por Oscar o Joab.
2. Si `ORG_SUPERVISOR`, `ORG_OPERATOR` y `ORG_VIEWER` son los tres roles operativos correctos o
   si el negocio quiere otra segmentación.
3. Si las acciones ejecutadas bajo sesión de soporte deben marcarse en la auditoría de forma
   distinguible.
4. Qué hace exactamente el super admin en el "modo auditoría" que el alcance menciona junto al
   de soporte: hoy solo existe soporte con escritura, no un modo de solo lectura.

---

### Paquete C — Clientes: reducir a expediente

**Tipo declarado:** frontend + rutas. Depende de D.

#### Lo que ya existe y sirve tal cual

**La reducción ya ocurrió.** La tabla del alcance, contrastada con el código:

| "Sale de Clientes" | Destino pedido | Estado real |
|---|---|---|
| Configuración profunda del servicio | Servicios | **Fuera de Clientes.** Está en la pestaña *Configuraciones* de `ServicesPage` |
| Posiciones y patrones de turno | Servicios | **Fuera de Clientes.** Pestaña *Posiciones y turnos* de `ServicesPage` |
| Asignación de personal | Servicios | **Fuera de Clientes.** Pestaña *Asignaciones* de `ServicesPage` |
| Planeación versionada y turnos | Servicios / Planeación | **Fuera de Clientes.** En `PlanningPage`, ruta `/planeacion` |
| Resumen operativo del servicio | Reportes u Operación | **Fuera de Clientes.** En `ReportsPage` y `OperationsPage` |

Y "se queda" también se cumple: ficha fiscal y comercial (`summary`), sedes (`sites`), contratos
(`contracts`), contactos (`contacts`) y documentos relacionados (`documents`).

El criterio de producto del alcance — *"en Clientes el usuario entiende quién es el cliente,
dónde opera, con qué contrato y documentos cuenta y quiénes son sus contactos"* — se cumple. La
pestaña de servicios que permanece es de solo lectura con enlaces contextuales a `/servicios`,
que es justamente la puerta que el criterio pide.

La ficha fiscal es completa: `Client` tiene `CodeClient`, `LegalName`, `TradeName`, `Rfc`,
`Nationality`, `TaxActivity`, `TaxAddress`, `PublicRegistryDate`, `CommercialRegistryFolio`,
`EmployerRegistrationNumber`, `IncorporationDate`, `IncorporationDeedNumber` y
`LegalRepresentativeInstrumentNumber`.

#### Lo que existe pero habría que modificar

- **Los contratos siguen viviendo en el endpoint de Servicios.**
  `ServiceManagementEndpoints.cs` expone `/api/v1/clients/{idClient}/contracts` junto con los
  servicios, y en el frontend `ClientApiService` (785 líneas) cubre clientes, sedes, contactos,
  contratos **y servicios** en un solo servicio HTTP. El alcance deja los contratos en Clientes,
  así que la separación de código no coincide con la separación funcional. No rompe nada; es
  deuda de organización.
- **Filtros del listado de clientes que no funcionan.** En el `computed` `visibleClients`
  (`clients-page.ts:88-124`), los filtros de sede, contrato y responsable solo evalúan
  correctamente al **cliente actualmente seleccionado**, porque usan `this.sites()`,
  `this.contracts()` y `this.contacts()`, que únicamente se cargan para ese cliente. Para todos
  los demás, `hasActiveContract` es siempre falso y `matchesResponsible` siempre falla. Además
  el filtro se aplica **después** de la paginación del servidor, así que puede vaciar una página
  entera. El filtro de documentos, como se explicó, ni siquiera está conectado.

#### Lo que no existe

Nada del alcance de C. La dependencia declarada — *"Riesgo: no ejecutar C antes que D, o el
usuario se queda sin dónde configurar"* — **ya está resuelta**: el destino existe.

#### Qué se ve afectado si se toca

`ClientApiService` y `client.models.ts` son consumidos por `ClientsPage`, `ServicesPage`
(inyecta `ClientApiService` directamente) y `ServiceContextApi`. Partir ese servicio para separar
contratos de servicios obliga a tocar las tres.

#### Tamaño

**Chico.** El paquete está entregado. Arreglar los filtros del listado sería **chico a mediano**,
y estrictamente hablando es corrección de defectos, no alcance de C.

#### Definición de negocio que falta

Si el filtrado del listado de clientes debe hacerse en el servidor (correcto, y requiere
extender `ClientListQuery` y `ClientRepository`) o si se acepta que sea aproximado en el cliente.
Hoy es aproximado y en parte inoperante.

---

### Paquete D — Servicios

**Tipo declarado:** módulo completo nuevo, frontend + backend + datos. "El más grande del lote."

**Corrección de premisa:** no es un módulo nuevo. Existen las entidades, las tablas (desde la
primera migración), los endpoints, la pantalla y las pruebas. Lo que falta es **un corte
transversal** (el listado a nivel de organización de D1) y **decisiones de negocio** sobre reglas
que el código ya resolvió de una manera concreta sin que nadie la haya confirmado.

---

#### D1 — Listado y ficha

*Pedido: listado filtrable por organización, cliente, sede, estado y contrato. Ficha con
descripción, vigencia, contrato asociado e instrucciones.*

**Ya existe y sirve:** la **ficha** completa. `ServiceDialog` (`features/services/ui/`) permite
alta y edición con nombre, código, descripción, descripción de facturación, sede, contrato
opcional, fecha de inicio y fecha de término, con validación en `service-validators.ts`. En
dominio, `Service.ApplyProfile` valida que `EndDate >= StartDate` y la base lo refuerza con la
restricción `CK_Services_DateRange`. Las "instrucciones" existen pero en
`ServiceConfiguration.SpecificInstructions`, es decir, por vigencia, no en la ficha del servicio.

**Existe pero hay que modificar:**

| Archivo | Cambio necesario |
|---|---|
| `Application/Services/IServiceManagementRepository.cs` y `ServiceManagementRepository.cs` | `ListServicesAsync` recibe solo `idClient` y no pagina. Necesita una consulta por `IdOrganization` con filtros y paginación |
| `Application/Services/IServiceManagementService.cs`, `ServiceManagementService.cs`, `ServiceContracts.cs` | Un caso de uso y un contrato de consulta nuevos (`ServiceListQuery` con organización, cliente, sede, estado, contrato, búsqueda, página) |
| `Api/Endpoints/ServiceManagementEndpoints.cs` | Un `GET /api/v1/services?organizationId=...` fuera del prefijo de cliente |
| `features/services/pages/services-page/services-page.ts` y `.html` | Hoy exige elegir cliente antes de ver nada. Habría que permitir entrar por organización, con el cliente como filtro y no como paso previo |
| `features/services/data-access/service-context-api.ts` | Solo tiene `getClient`; necesitaría el método de listado |

**Lo que no existe y hay que crear desde cero:**

1. **El endpoint y la consulta de servicios a nivel de organización.** Es la pieza central que
   falta de todo el Paquete D.
2. **Un campo de estado del servicio.** `Service` solo tiene el `Active` transversal de borrado
   lógico y las fechas de vigencia. No hay un enum de estado como el que sí tiene
   `ServiceContract` (`ServiceContractStatus`). Si "estado" en el filtro significa
   activo/inactivo, se resuelve con `Active`; si significa algo como borrador / vigente /
   suspendido / terminado, **hace falta una columna nueva y una migración**.
3. **Permisos propios de Servicios.** Hoy Servicios se autoriza con `CLIENTS.READ` y
   `CLIENTS.WRITE`. Si Servicios debe ser un módulo con vida propia, necesita `SERVICES.READ` y
   `SERVICES.WRITE`, lo que implica agregarlos a `SecurityPermissions.cs`, sembrarlos en
   `SecurityDataSeeder` y repartirlos entre los cinco roles.

**Qué se rompe o se ve afectado:**

- **Un servicio no tiene `IdOrganization`.** Llega a su organización por
  `Service -> Client -> IdOrganization`. Cualquier consulta por organización implica un `join`
  contra `Clients`. Añadir la columna denormalizada sería más rápido en consulta, pero exige
  migración con relleno de datos existentes y crea un riesgo de inconsistencia si un cliente
  cambiara de organización.
- **`CodeService` es único por cliente, no por organización.** El índice es
  `HasIndex(new { IdClient, CodeService }).IsUnique()`. Si el listado de organización va a
  mostrar códigos, dos clientes distintos pueden tener el mismo código y se verá como duplicado.
  Cambiar la unicidad a nivel de organización requiere migración y podría fallar contra datos ya
  existentes en `db-gestia-dev`.
- Agregar permisos `SERVICES.*` afecta a las sesiones activas: los tokens ya emitidos no los
  traen, así que hay que renovar sesiones tras sembrar (es lo que `docs/V5-PUNTOS-1-A-5` llama
  "ejecutar seed de permisos y renovar sesiones de usuarios").

**Tamaño: mediano.** No es grande porque el dominio, las tablas y la ficha ya están. Es mediano
porque cruza las cuatro capas, invierte la jerarquía de navegación de la pantalla más grande del
frontend (1 529 líneas) y probablemente necesita una migración por el campo de estado.

**Definiciones de negocio que faltan:**

1. **Qué significa "estado" en el filtro.** Es la que bloquea: determina si hay migración o no.
2. Si el listado de organización debe mostrar servicios de clientes inactivos.
3. Si `CodeService` debe ser único por organización o basta con que lo sea por cliente.
4. Si Servicios necesita permisos propios o sigue heredando los de Clientes.

---

#### D2 — Configuraciones históricas

*Pedido: versionadas por fecha, con elementos requeridos, horas, precio, días por semana e
instrucciones.*

**Ya existe y sirve:** casi todo. `ServiceConfiguration` cubre cada elemento pedido:
`RequiredWorkerCount` (elementos requeridos), `HoursPerDay` y `AverageWeeklyHours` /
`AverageMonthlyHours` (horas), `MonthlyPrice` con `CurrencyCode` e `IsTaxIncluded` (precio),
`DaysPerWeek` (días por semana), `WorkScheduleDescription` y `SpecificInstructions`
(instrucciones), más `PreparationLeadDays`. El versionado por fecha existe con
`EffectiveFromDate` / `EffectiveToDate`, y el servicio rechaza dos configuraciones con la misma
fecha de inicio (`IsConfigurationDateInUseAsync`). Hay CRUD completo en API y una pestaña
dedicada en `ServicesPage`.

**Existe pero hay que modificar — y aquí hay una contradicción con el alcance:**

El alcance plantea como pregunta abierta: *"Configuración histórica: ¿se corrige una versión
pasada o solo se agrega una nueva vigencia?"*

**El código ya respondió: se corrige.** `ServiceManagementService.UpdateConfigurationAsync`
permite editar cualquier configuración, incluidas las de vigencias ya cerradas, sin ninguna
comprobación de que la vigencia esté en el pasado. No hay bloqueo ni registro de valor anterior
específico más allá de la auditoría transversal `UpdatedAt`/`UpdatedBy`.

Esto choca con el **principio 3** del README y con las restricciones heredadas del propio
alcance: *"Los registros operativos no se eliminan. Una corrección conserva valor anterior, valor
nuevo, motivo, usuario y fecha."* Una configuración histórica con precio y horas es, a efectos
de facturación, un registro que debería conservar su valor anterior. Hoy no lo conserva.

**Lo que no existe:** el historial funcional de correcciones de configuración (valor anterior,
valor nuevo, motivo). El patrón sí existe en el proyecto: `BusinessDocumentEvents` guarda
`BeforeSnapshot`/`AfterSnapshot`. Habría que replicarlo, lo que implica **tabla nueva y
migración**.

**Qué se ve afectado:** `ServiceConfiguration` alimenta el cálculo de personal requerido en
Planeación y los reportes de horas. Congelar vigencias pasadas puede invalidar datos ya
capturados por usuarios que hoy corrigen libremente en `db-gestia-dev`.

**Tamaño:** **chico** si la respuesta de negocio es "se sigue corrigiendo" (no se toca nada).
**Mediano** si es "solo se agrega vigencia" (bloqueo en dominio y ajuste de UI). **Grande** si
además se exige historial con motivo (tabla nueva, migración, endpoints, UI).

**Definición de negocio que falta:** exactamente la pregunta del alcance, con la salvedad de que
hoy ya hay un comportamiento en producción de desarrollo y cambiarlo es un cambio de conducta,
no una decisión sobre papel en blanco.

---

#### D3 — Posiciones

*Pedido: posiciones requeridas con perfil, cantidad y notas.*

**Ya existe y sirve, completo.** Entidad `Domain/Planning/Position.cs`, tabla `Positions`
(migración 3), endpoints CRUD en `PlanningEndpoints.cs` bajo
`/api/v1/clients/{idClient}/services/{idService}/positions` con permisos `PLANNING.READ` y
`PLANNING.WRITE`, y UI en la pestaña *Posiciones y turnos* de `ServicesPage`. La posición tiene
`RequiredSkillProfile`, que `AssignmentService` usa para validar la elegibilidad del empleado.

**Existe pero hay que modificar:** nada identificado.

**Lo que no existe:** nada del alcance de D3.

**Qué se ve afectado si se toca:** `Position` es referenciada por `ServiceAssignment` (desde la
migración 4), por `ShiftPattern` y por las reglas de elegibilidad de `CatalogService`. Cualquier
cambio estructural se propaga a asignaciones y planeación.

**Tamaño: chico** (verificación funcional, no construcción).

**Definición de negocio que falta:** confirmar que `RequiredSkillProfile` como texto libre
cotejado por coincidencia parcial contra `Employee.JobTitle` es el criterio de perfil que el
negocio quiere. Hoy la validación es literalmente
`employee.JobTitle.Contains(position.RequiredSkillProfile)`, sin distinguir mayúsculas. Es frágil
y contradice el principio 4 ("se conservan por identificador"): existe un catálogo de
habilidades (`EmployeeSkills`, `BusinessCatalogItems`) que sería el mecanismo correcto.

---

#### D4 — Patrones de turno

*Pedido: patrones y segmentos semanales.*

**Ya existe y sirve, completo.** Entidades `ShiftPattern` y `ShiftSegment`, más el objeto de
valor `ShiftInterval` que encapsula el cálculo de intervalos (con pruebas en
`Domain.UnitTests/ShiftIntervalTests.cs`). Tablas creadas en la migración 3. Endpoints anidados
bajo posición: `.../positions/{idPosition}/shift-patterns` y `.../shift-patterns/{id}/segments`.
UI en la misma pestaña que D3.

**Existe pero hay que modificar:** nada identificado.

**Lo que no existe:** nada del alcance de D4.

**Qué se ve afectado si se toca:** los patrones alimentan
`POST .../schedule-versions/{id}/generate-from-patterns`, que genera turnos programados
automáticamente. Cambiar la forma de un segmento afecta a esa generación y a los turnos ya
generados en la base.

**Tamaño: chico** (verificación funcional).

**Definición de negocio que falta:** ninguna para D4 en sí.

---

#### D5 — Asignación de personal

*Pedido: con validación documental, evaluaciones, estatus y detección de traslapes.*

**Ya existe y sirve, completo — incluyendo lo que el alcance da por indefinido.**
`Application/Assignments/AssignmentService.cs` valida, en este orden, antes de permitir una
asignación:

1. **Estatus:** `EnsureActiveEmployeeAsync` rechaza si `employee.Status != EmployeeStatus.Active`.
2. **Documental:** rechaza si el empleado tiene documentos en estado `Rejected` o `Expired`, o
   con `ExpiresDate` anterior a la fecha efectiva, nombrando los tipos afectados en el mensaje.
3. **Evaluaciones:** rechaza si hay evaluaciones `NotApproved` o `Inconclusive`, o vencidas.
4. **Perfil:** compara `Position.RequiredSkillProfile` contra `Employee.JobTitle`.
5. **Elegibilidad configurada:** consulta `CatalogService.CheckEligibilityAsync` contra las
   reglas de `EligibilityRequirements` de la organización, y rechaza citando los motivos
   bloqueantes.
6. **Traslapes:** `EnsureNoOverlapAsync` consulta
   `HasEmployeeAssignmentOverlapAsync(idEmployee, startDate, endDate, excludedAssignmentId)` y
   lanza `ResourceConflictException`.

**Contradicción con el alcance.** El documento pregunta: *"Traslapes en D5: ¿bloquean la
asignación o solo advierten?"*. **El código ya decidió: bloquean.** La excepción se traduce a
**HTTP 409** en `ProblemDetailsExceptionHandler.cs`, con el mensaje *"El empleado ya tiene una
asignación activa que se traslapa con ese rango de fechas."* No hay ningún camino que permita
advertir y continuar.

**Existe pero hay que modificar:** solo si negocio decide que los traslapes deben advertir. Eso
implicaría un contrato de respuesta con advertencias no bloqueantes, un parámetro de
confirmación explícita y cambios de UI. **Y chocaría con la regla del alcance de no eliminar ni
degradar controles operativos**, además de abrir la puerta a doble asignación real.

**Lo que no existe:** nada del alcance de D5.

**Qué se ve afectado si se toca:** relajar la validación de traslapes afecta a Planeación
(los turnos se generan sobre asignaciones), a Cobertura y a los reportes de personal efectivo.

**Tamaño: chico** si se confirma el comportamiento actual. **Mediano** si hay que convertir el
bloqueo en advertencia con confirmación.

**Definición de negocio que falta:**

1. Confirmar que los traslapes bloquean (recomendable, porque es lo que ya está en uso).
2. Si el perfil requerido debe migrar del texto libre al catálogo de habilidades (ver D3).

---

#### D6 — Planeación y turnos

*Pedido: planeación versionada, programación y publicación controlada.*

**Ya existe y sirve:**

- **Versionado:** `Domain/Planning/ScheduleVersion.cs` con estados
  `Draft` / `Published` / `Superseded`, periodo (`PeriodStartDate`, `PeriodEndDate`) y notas.
  Tabla `ScheduleVersions` desde la migración 5.
- **Programación:** `ScheduledShift` y el generador
  `POST .../schedule-versions/{id}/generate-from-patterns`, que crea turnos a partir de los
  patrones de D4.
- **Publicación controlada:** `ScheduleVersion.Publish(actorId, actorName, occurredAt)` exige
  que la versión esté en borrador (`EnsureDraft`) y deja rastro con `PublishedAt`, `PublishedBy`
  y `PublishedByName`. El endpoint `POST .../publish` exige `PLANNING.WRITE`. Según
  `docs/V5-PUNTOS-1-A-5-2026-09-03.md`, la publicación corre en **transacción serializable** y
  *"rechaza sustituciones parciales o versiones con actividad operativa protegida"*.
- **UI:** `PlanningPage` compara la versión seleccionada contra la publicada (diferencia de
  turnos y de horas), muestra una lista de preparación previa a publicar (`publishPreparation`)
  y una señal `canPublishSelectedVersion` que habilita o bloquea el botón.

**Contradicción parcial con el alcance.** El documento pregunta: *"Publicación controlada en D6:
¿quién publica, qué pasa con una planeación publicada que se modifica?"*. El código responde la
segunda mitad: **una versión publicada no se modifica**; `UpdateProfile` llama a `EnsureDraft` y
falla si no está en borrador. Para cambiar algo se crea otra versión, se publica y la anterior
pasa a `Superseded` vía `MarkSuperseded`. La primera mitad ("quién publica") está respondida solo
técnicamente: **cualquiera con `PLANNING.WRITE`**, que hoy incluye a `ORG_SUPERVISOR`. No hay un
permiso `PLANNING.PUBLISH` separado.

**Lo que no existe:**

- Un permiso específico de publicación, si el negocio quiere que publicar sea más restrictivo
  que editar.
- Un flujo de aprobación previo a publicar. Existe `ApprovalRequests` (migración 11) para
  operación, pero no está conectado a la publicación de planeación.

**Qué se ve afectado si se toca:** la publicación es el origen de la operación diaria — de una
versión publicada se derivan asistencia, incidencias y coberturas. Introducir un permiso nuevo
obliga a sembrarlo y a renovar sesiones. Introducir aprobación previa toca `SchedulingService`,
que ya opera con transacciones serializables, y hay que evitar deadlocks.

**Tamaño: chico** si se confirma el comportamiento actual. **Mediano** si se agrega
`PLANNING.PUBLISH`. **Grande** si se pide flujo de aprobación previo.

**Definición de negocio que falta:**

1. **Quién publica**: ¿basta `PLANNING.WRITE` o hace falta un permiso aparte?
2. ¿Publicar debe requerir aprobación de un segundo actor?
3. Confirmar que "una versión publicada no se edita, se sustituye" es la regla correcta.

---

### Paquete E — Documentos: corrección de relación

**Tipo declarado:** bug, sin dependencias, puede ir en paralelo con A.

#### Lo que ya existe y sirve tal cual

- **Un componente documental único y compartido.**
  `features/documents/components/entity-documents/entity-documents.ts` (377 líneas) se monta
  igual en Clientes, Contratos, Servicios, Personal y Solicitudes, y siempre habla con
  `/api/v1/documents`. No hay cinco implementaciones distintas.
- **Un solo endpoint de carga:** `POST /api/v1/documents/upload` para todos los módulos, con
  ruta de almacenamiento determinista por organización y mes.
- **Privacidad transversal:** `IsSensitive` más los permisos `DOCUMENTS.SENSITIVE.READ/WRITE`
  verificados en el servidor; documentos sensibles filtrados también en Auditoría y en las
  exportaciones. Prohibido desclasificar y prohibido cambiar de propietario.
- **Historial completo:** `BusinessDocumentEvents` con `BeforeSnapshot` y `AfterSnapshot`, y EF
  configurado para rechazar modificación y borrado de esos eventos.
- **Vencimientos calculados en el servidor:** `isExpired` viene en cada respuesta.
- **Descargas protegidas por ruta:** `DocumentStorageReference.IsSafeRelativePath` y
  `ResolveStoragePath` impiden salir de la raíz de almacenamiento; el endpoint de evidencias
  operativas rechaza explícitamente referencias que pertenezcan al módulo de documentos, para que
  no se esquiven sus comprobaciones.

Los cuatro casos de la tabla del alcance, evaluados uno por uno:

| Caso del alcance | Estado real |
|---|---|
| Documento subido para cliente aparece en Documentos con propietario Cliente y en el expediente del cliente | **Cumplido**, si se entiende "Documentos" como el módulo `/documentos` |
| Documento de contrato se asocia al contrato **y al cliente**, sin duplicar archivo | **No cumplido.** El modelo admite un solo propietario |
| Documento sensible respeta permisos desde cualquier módulo | **Cumplido** |
| Vencimiento genera indicador visible en Clientes **y** en Documentos | **Parcial.** En Documentos sí; en el listado de Clientes no |

#### Lo que existe pero hay que modificar

| Archivo | Problema |
|---|---|
| `Domain/Documents/BusinessDocument.cs` | `ApplyProfile` fuerza un solo propietario y anula las otras cinco FK. Para que un documento de contrato sea visible desde el cliente hay que poblar `IdClient` **además** de `IdServiceContract` |
| `Infrastructure/Persistence/Repositories/BusinessDocumentRepository.cs` | La búsqueda compara `OwnerType`/`OwnerId` por igualdad. Necesitaría un modo "cliente y todo lo que cuelga de él" |
| `Application/Documents/DocumentContracts.cs` | `BusinessDocumentQuery` y `BusinessDocumentSearchCriteria` solo aceptan un par propietario/id |
| `features/clients/pages/clients-page/clients-page.html:498-503` | Monta dos componentes de documentos separados (cliente y contrato) porque no se pueden unificar |
| `features/clients/pages/clients-page/clients-page.ts:67` | `clientDocumentsFilter` existe pero **no se usa** en `visibleClients`. Filtro muerto |
| `features/workforce/pages/workforce-page/workforce-page.html:378-439` | Muestra dos listas documentales del mismo empleado, una por almacén |

#### Lo que no existe y hay que crear desde cero

1. **La relación cliente↔documento-de-contrato.** Dos caminos posibles, ambos con costo:
   - Poblar `IdClient` en documentos cuyo `OwnerType` sea `ServiceContract` o `Service`. Requiere
     **migración de datos** para los documentos ya cargados en `db-gestia-dev`, más un cambio en
     `ApplyProfile`.
   - Resolver la relación en la consulta con `join` a `ServiceContracts` y `Services`. No requiere
     migración pero encarece cada búsqueda y complica el filtro de sensibles, que ya es la parte
     más costosa de la consulta.
2. **El indicador de vencimiento en el listado de Clientes.** El backend no expone hoy un
   agregado de documentos por cliente. Hay dos opciones: un campo calculado en
   `ClientResponse` (requiere subconsulta en `ClientRepository`) o un endpoint aparte de resumen
   documental por cliente. Sin eso, el frontend tendría que pedir los documentos de cada cliente
   de la página, lo que multiplica las peticiones.
3. **La consolidación de `EmployeeDocuments` en `BusinessDocuments`**, si de verdad se quiere
   *"una sola fuente documental"*. **El alcance no menciona este almacén paralelo**, pero es la
   duplicación documental más real del sistema.

#### Qué se rompe o se ve afectado si se toca

- **La consulta de documentos sensibles es delicada.** Ya contiene tres subconsultas con
  `IgnoreQueryFilters()`, normalización de separadores y `Collate` explícito, para evitar que un
  archivo sensible se filtre a través de un registro no sensible que apunte al mismo archivo.
  Cualquier cambio en `SearchAsync` debe preservar ese comportamiento; hay pruebas que lo cubren
  en `LegacyDocumentAuthorizationTests.cs`, `DocumentEndpointSecurityTests.cs` y
  `AuditDocumentAuthorizationTests.cs`.
- **Migrar `EmployeeDocuments` a `BusinessDocuments` es una migración de datos con pérdida de
  forma.** `EmployeeDocument` tiene `DocumentType` (enum), `DocumentNumber` y `ReceivedDate`;
  `BusinessDocument` tiene `Category` (texto libre) y no tiene equivalentes de los otros dos.
  Además `EmployeeDocuments` es consultada por `AssignmentService` para validar elegibilidad
  (D5): cambiar su origen afecta directamente a la asignación de personal.
- **Poblar `IdClient` en documentos de contrato existentes es un `UPDATE` sobre datos ya
  desplegados.** Requiere migración compensatoria con respaldo previo, como se hizo en
  `20260903211914_GeographicCatalogRelations` y `20260903214645_CoverageCatalogReference`, que
  incluyen sentencias `Sql()` de relleno.

#### Tamaño

**Mediano** para lo que el alcance pide explícitamente: relación contrato↔cliente en la consulta
más el indicador de vencimiento en Clientes.

**Grande** si se incluye la consolidación del almacén heredado de Personal, que es lo que de
verdad hace falta para cumplir *"una sola fuente documental"*.

#### Definición de negocio que falta

1. **Qué significa exactamente "sin duplicar archivo".** Hoy el archivo físico ya se guarda una
   vez por carga. Lo que está duplicado es la *ficha*, no el binario. ¿El problema que se
   reportó es que el mismo PDF se sube dos veces, o que un documento de contrato no aparece en el
   expediente del cliente? Son dos arreglos distintos.
2. **Si `EmployeeDocuments` debe desaparecer** y consolidarse en `BusinessDocuments`, o convivir.
   Es la decisión más cara del paquete.
3. **Si `/documentos` vuelve al menú.** El alcance dice *"Documentos administra reglas, archivo,
   vencimientos, privacidad y descarga"*, lo que describe un módulo global; el equipo decidió lo
   contrario en `docs/V5-PUNTOS-1-A-5-2026-09-03.md`. Hay que resolver esa discrepancia antes de
   trabajar en E.
4. **Qué documentos de un cliente debe ver el expediente del cliente:** ¿solo los suyos, o
   también los de sus contratos, sus servicios y sus solicitudes? Eso define el alcance del
   `join`.
5. **Cuánta anticipación tiene "por vencer"** para el indicador en Clientes. En la pantalla de
   Documentos hay una ventana calculada en `isDueSoon`, pero no está declarada como regla de
   negocio.

---

## 3. Riesgos y contradicciones entre el alcance y el código

### 3.1 Contradicciones de premisa: el alcance describe un sistema anterior

| Afirmación del alcance | Realidad en el código |
|---|---|
| "Renombrar la sección `Gestión` a `Configuración`" | El grupo `Gestión` ya no existe; fue eliminado en el commit `4bf43e9`, cuyo mensaje es *"cambios pedidos el dia 31 de agosto"* |
| "Paquete D — Servicios: módulo nuevo" | Servicios existe: 3 entidades, 3 tablas desde la primera migración, endpoints CRUD completos, 1 529 líneas de UI y pruebas de navegador |
| "El más grande del lote" | Es el más pequeño de los que quedan. Lo que falta es una consulta a nivel de organización |
| "Paquete C depende de D (lo que sale de Clientes necesita destino)" | El destino ya existe; C está entregado |
| "Riesgo: no ejecutar C antes que D, o el usuario se queda sin dónde configurar" | No se materializó: ambos están hechos |
| "El modo soporte/auditoría del super admin requiere definición" | Está implementado: entidad, tabla, migración, middleware, UI, expiración y motivo obligatorio |
| "Riesgo: rutas viejas rompen enlaces guardados" | No se materializó: las rutas nunca cambiaron, solo la agrupación del menú |

### 3.2 Preguntas que el alcance deja abiertas pero el código ya respondió

Éste es el riesgo más serio, porque implementar "lo pedido" significaría **cambiar conducta ya
desplegada**, no construir sobre papel en blanco.

| Pregunta del alcance | Respuesta que ya está en el código | Qué implica cambiarla |
|---|---|---|
| D2: ¿se corrige una versión pasada o solo se agrega vigencia? | **Se corrige.** `UpdateConfigurationAsync` no valida que la vigencia esté cerrada | Bloquear rompe un flujo que los usuarios de `db-gestia-dev` ya usan |
| D5: ¿los traslapes bloquean o advierten? | **Bloquean.** `ResourceConflictException` → HTTP 409 | Convertirlo en advertencia permite doble asignación real y contradice el espíritu de las restricciones heredadas |
| D6: ¿qué pasa con una planeación publicada que se modifica? | **No se modifica.** `EnsureDraft` lo impide; se crea otra versión y la anterior pasa a `Superseded` | Permitir edición post-publicación rompe la trazabilidad de la operación diaria derivada |
| D6: ¿quién publica? | Cualquiera con `PLANNING.WRITE`, hoy incluido `ORG_SUPERVISOR` | Restringir requiere permiso nuevo, siembra y renovación de sesiones |

### 3.3 Suposiciones del documento que el código no soporta

1. **"Cada servicio se liga a una organización, un cliente operativo, una sede y opcionalmente un
   contrato."** El código liga el servicio a **cliente, sede y contrato opcional**, pero **no
   directamente a una organización**: no hay columna `IdOrganization` en `Services`. La relación
   con la organización es indirecta, vía `Client`. El listado de D1 debe hacer `join` o hay que
   crear la columna con una migración de relleno.

2. **"Listado filtrable por … estado".** `Service` no tiene un campo de estado de negocio; solo
   el `Active` transversal y las fechas de vigencia. `ServiceContract` sí tiene
   `ServiceContractStatus`, lo que sugiere que el autor del documento pensaba en los estados del
   contrato. Filtrar servicios por "estado" tal como se pide **requiere una columna nueva y una
   migración**.

3. **"Documento de contrato: se asocia al contrato y al cliente."** El agregado `BusinessDocument`
   está diseñado con **un solo propietario**, y `UpdateProfile` prohíbe explícitamente cambiarlo.
   La doble asociación **no se puede hacer como está descrita** sin cambiar el invariante del
   agregado o resolverla en la capa de consulta.

4. **"Documentos administra reglas, archivo, vencimientos, privacidad y descarga."** Describe un
   repositorio documental global. El equipo tomó la decisión contraria y la registró: *"Reglas
   documentales abre los requisitos y reglas, no un repositorio global de archivos"*. La ruta
   `/documentos` sigue existiendo pero está fuera del menú. **Implementar E tal como está escrito
   revierte una decisión de diseño deliberada.**

5. **"Configuración > Personal: aparece en la estructura funcional pero no se desarrolla."** El
   alcance lo deja fuera. Pero E toca inevitablemente Personal, porque el almacén documental
   heredado (`EmployeeDocuments`) vive ahí y es la duplicación documental real. **No se puede
   cumplir "una sola fuente documental" sin tocar Personal**, que el documento dice no tocar.

### 3.4 Cosas del alcance que no se pueden hacer como están descritas

Enumeradas sin proponer alternativas, según lo pedido:

1. **"Documento de contrato: se asocia al contrato **y al cliente**"** — no es posible con el
   agregado actual, que impone propietario único e inmutable.
2. **"El archivo se almacena una sola vez, sin importar desde qué módulo se cargó"** — ya se
   cumple para el binario. Si lo que se quiere es que la *ficha* sea única, no se puede sin
   resolver antes qué pasa con `EmployeeDocuments`, un almacén que el documento no menciona.
3. **"Listado filtrable por … estado"** (D1) — no es posible sin definir qué es "estado" y, casi
   con seguridad, sin una migración.
4. **"Servicios: módulo nuevo"** (D) — no se puede construir como módulo nuevo: existe, con
   migraciones ya desplegadas. Solo cabe extenderlo.
5. **"Vistas distintas para super admin y admin de organización, no la misma pantalla con
   elementos ocultos"** (B) — se cumple en las pantallas de gobierno, pero **no** en Clientes,
   Servicios, Personal y Catálogos, que sí son la misma pantalla para ambos roles, con el acceso
   del super admin condicionado a sesión de soporte y con textos que cambian según el rol
   (`pageHeadingTitle` en `clients-page.ts:77`). Cumplir la frase al pie de la letra exigiría
   duplicar cuatro pantallas grandes, lo que el propio alcance desaconseja al prohibir refactors
   de conveniencia.

### 3.5 Riesgos sobre datos y migraciones ya desplegadas

Las 19 migraciones están aplicadas en `db-gestia-dev` y hay un ambiente publicado. Los cambios de
esquema que el alcance implicaría, con su riesgo:

| Cambio | Riesgo |
|---|---|
| Agregar estado a `Services` (D1) | Migración con valor por defecto; hay que decidir qué estado reciben los servicios existentes |
| Agregar `IdOrganization` a `Services` (D1) | Migración con relleno desde `Clients`; riesgo de inconsistencia futura si un cliente cambiara de organización |
| Cambiar la unicidad de `CodeService` a nivel de organización (D1) | **Puede fallar al aplicarse** si ya existen códigos repetidos entre clientes de la misma organización |
| Poblar `IdClient` en documentos de contrato (E) | `UPDATE` sobre datos desplegados; exige respaldo previo y migración compensatoria |
| Historial de configuraciones (D2) | Tabla nueva; los registros anteriores no tendrían historial y **no deben fabricarse eventos retroactivos**, criterio ya aplicado en `DocumentReviewHistory` |
| Consolidar `EmployeeDocuments` (E) | El más riesgoso: pérdida de forma (`DocumentType`, `DocumentNumber`, `ReceivedDate` no tienen equivalente) y afecta a la validación de elegibilidad de D5 |
| Agregar permisos `SERVICES.*` o `PLANNING.PUBLISH` (D1, D6) | Los tokens JWT ya emitidos no los traen; hay que sembrar y renovar sesiones |

En todos los casos aplica la regla: **no se reescribe la migración existente, se agrega una
compensatoria**, con respaldo verificado previo, como se hizo el 3 de septiembre.

### 3.6 Riesgo de secuencia

El orden que propone el alcance (A y E en paralelo → B → D1 → C → D2-D6) **ya no aplica**: A, B y
C están hechos. El orden real de lo que queda es:

1. Resolver las **definiciones de negocio** de la sección 4, en particular las cuatro preguntas
   que el código ya respondió de facto.
2. **D1**, el listado a nivel de organización, que es la única pieza estructural que falta.
3. **E**, que necesita antes la decisión sobre `EmployeeDocuments` y sobre si `/documentos`
   vuelve al menú.

---

## 4. Definiciones de negocio que faltan, consolidadas

Ordenadas por lo que bloquea más trabajo:

| # | Pregunta | Bloquea |
|---|---|---|
| 1 | ¿Qué significa "estado" al filtrar servicios: activo/inactivo, o un ciclo de vida propio? | D1, y define si hay migración |
| 2 | ¿El documento de contrato debe aparecer en el expediente del cliente por consulta o por dato duplicado? | E, y define si hay migración de datos |
| 3 | ¿`EmployeeDocuments` se consolida en `BusinessDocuments` o convive? | E, y es la decisión más cara del lote |
| 4 | ¿Se puede corregir una configuración de servicio con vigencia pasada? | D2 |
| 5 | ¿Los traslapes de asignación bloquean (comportamiento actual) o advierten? | D5 |
| 6 | ¿Quién publica una planeación: cualquiera con `PLANNING.WRITE` o un permiso aparte? | D6 |
| 7 | ¿Servicios necesita permisos `SERVICES.*` propios o hereda los de Clientes? | D1, B |
| 8 | ¿`/documentos` vuelve al menú como repositorio global? | E, A |
| 9 | ¿Cuál es la matriz definitiva rol × permiso? | B |
| 10 | ¿Las acciones bajo sesión de soporte deben marcarse en la auditoría? | B |
| 11 | ¿Con cuánta anticipación un documento "está por vencer"? | E |
| 12 | ¿El perfil requerido de una posición debe salir del catálogo de habilidades en lugar de texto libre? | D3, D5 |
| 13 | ¿`Configuración > Personal` entra en este corte? El alcance lo deja indefinido y E lo toca de todos modos | E |

---

## 5. Observaciones fuera de alcance

Detectadas durante el reconocimiento, **no ejecutadas**, registradas para decidir después.

1. **Filtro de documentos muerto en Clientes.** `clientDocumentsFilter` (`clients-page.ts:67`) se
   declara, tiene su método de actualización y se activa desde el filtro guardado
   `pendingDocuments`, pero nunca se lee en el `computed` `visibleClients`. Seleccionarlo no
   cambia nada. Se solapa con E pero es un defecto independiente.

2. **Filtros del listado de clientes que solo funcionan para el cliente seleccionado.** En
   `visibleClients` (`clients-page.ts:88-124`), los filtros de sede, contrato activo y
   responsable usan `this.sites()`, `this.contracts()` y `this.contacts()`, que únicamente se
   cargan para el cliente abierto. Para el resto, "con contrato activo" siempre da falso.
   Además el filtrado ocurre **después** de la paginación del servidor, así que puede vaciar una
   página completa mientras el contador sigue mostrando el total sin filtrar.

3. **Perfil de posición cotejado por texto libre.** `AssignmentService` valida elegibilidad con
   `employee.JobTitle.Contains(position.RequiredSkillProfile, OrdinalIgnoreCase)`. Contradice el
   principio 4 del README ("se conservan por identificador") habiendo ya un catálogo de
   habilidades (`EmployeeSkills`, `BusinessCatalogItems`). Un cambio de puesto sin relación real
   puede habilitar o bloquear asignaciones por coincidencia accidental de texto.

4. **README desactualizado.** Describe el proyecto como *"en preparación inicial"* con
   *"los módulos de negocio se desarrollarán por entregas verticales conforme se valide la
   información"*. Hay 19 migraciones aplicadas, 20 archivos de endpoints y 15 features. También
   lista `docs/` con tres subcarpetas cuando hay seis. Quien lea solo el README se formará una
   idea equivocada del estado.

5. **Sin deduplicación por contenido en la carga de archivos.**
   `BusinessDocumentEndpoints.StoreFileAsync` nombra cada archivo con un GUID nuevo. Subir el
   mismo PDF dos veces produce dos archivos en disco. No es el bug de E (que es de relación) pero
   es la lectura literal de *"el archivo se almacena una sola vez"*.

6. **Límites de tamaño de archivo inconsistentes.** El backend acepta hasta 30 MB
   (`MaximumFileSizeBytes` en `BusinessDocumentEndpoints.cs`); el frontend rechaza a los 20 MB en
   Personal (`workforce-page.ts:610`) y el mensaje del endpoint de evidencias operativas también
   dice 20 MB, aunque use el mismo límite de 30 MB del backend. El usuario recibe mensajes que no
   corresponden al límite real.

7. **Breadcrumbs codificados a mano.** `resolveBreadcrumbs` en `app-shell.ts` tiene 17
   condiciones `startsWith` mantenidas manualmente y desacopladas de `app.routes.ts` y de
   `navigation.ts`. Una ruta nueva sin su `if` correspondiente cae en el genérico `['GestIA']`.

8. **Dos entradas de menú con la misma etiqueta "Seguridad"**, apuntando a `/seguridad` y
   `/usuarios`, diferenciadas solo por permisos y banderas. Nunca se ven a la vez, pero la
   duplicación de etiqueta invita a confusión al mantener el archivo.

9. **La ruta `/documentos` no está en el menú** pero sigue enlazada desde Inicio
   (`overview-page.ts:367`), Solicitudes (`requests-page.html:603`) y Servicios
   (`services-page.html:194`). Es una inconsistencia de navegación: el usuario puede llegar a una
   pantalla a la que no puede volver por el menú.

10. **`npm ci` reporta 1 vulnerabilidad moderada** y 4 paquetes con scripts de instalación no
    aprobados (`@parcel/watcher`, `esbuild`, `lmdb`, `msgpackr-extract`). No se ejecutó
    `npm audit fix` ni `npm approve-scripts`.

11. **El sembrador de seguridad corre en cada arranque de la API.** `Program.cs` ejecuta
    `SeedSecurityDataAsync` salvo que `SecuritySeed:Enabled` sea `false`, y crea un administrador
    con contraseña por defecto `GestIA.Local.2026!` si no hay configuración. El propio código
    emite una advertencia al hacerlo. Es adecuado para desarrollo local, pero conviene confirmar
    que en el ambiente publicado `SecuritySeed:Enabled` está en `false` o que
    `BootstrapAdmin:Password` está configurada.

12. **Duplicación de listas documentales visible al usuario en Personal.** La pestaña Documentos
    de `workforce-page.html` muestra la lista heredada (`EmployeeDocuments`) y, debajo, el
    componente compartido de `BusinessDocuments`. Un usuario ve dos listas del mismo expediente
    con dos formularios de carga distintos. Es el síntoma más visible del problema estructural
    descrito en E.
