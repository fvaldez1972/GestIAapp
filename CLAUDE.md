# CLAUDE.md — GestIA

Guía operativa del repositorio. Las versiones de esta página se leyeron de
`backend/global.json`, los `.csproj` y `frontend/package.json`, no de la documentación.

## Stack real (verificado en archivos de proyecto)

### Backend — `backend/GestIA.sln`

| Concepto | Valor | Fuente |
|---|---|---|
| SDK .NET | `10.0.302`, `rollForward: latestFeature`, sin prerelease | `backend/global.json` |
| TargetFramework | `net10.0` en los 4 proyectos y las 4 suites de prueba | `*.csproj` |
| EF Core | `Microsoft.EntityFrameworkCore.SqlServer` **10.0.10** | `GestIA.Infrastructure.csproj` |
| EF Design | `Microsoft.EntityFrameworkCore.Design` 10.0.10 (`PrivateAssets=all`) | `GestIA.Infrastructure.csproj` |
| Health checks | `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` 10.0.10 | `GestIA.Infrastructure.csproj` |
| OpenAPI | `Microsoft.AspNetCore.OpenApi` 10.0.10 + `Microsoft.OpenApi` 2.12.2 | `GestIA.Api.csproj` |
| DI en Application | `Microsoft.Extensions.DependencyInjection.Abstractions` 10.0.10 | `GestIA.Application.csproj` |
| Pruebas | xUnit 2.9.3, `Microsoft.NET.Test.Sdk` 17.14.1, `Mvc.Testing` 10.0.10, coverlet 6.0.4 | `tests/*/*.csproj` |
| Herramienta EF | `dotnet-ef` **10.0.10**, `rollForward: false` | `backend/.config/dotnet-tools.json` |

`backend/Directory.Build.props` aplica a todo el backend y **no es negociable**:
`TreatWarningsAsErrors=true`, `EnforceCodeStyleInBuild=true`, `Nullable=enable`,
`ImplicitUsings=enable`, `AnalysisLevel=latest-recommended`, `Deterministic=true`.
Un warning rompe el build.

### Frontend — `frontend/`

| Concepto | Valor | Fuente |
|---|---|---|
| Angular | `^22.1.0` (core, common, compiler, forms, platform-browser, router) | `package.json` |
| Angular build/CLI | `^22.1.5` | `package.json` |
| TypeScript | `~6.0.2` | `package.json` |
| RxJS | `~7.8.0` | `package.json` |
| Tailwind CSS | `^4.1.18` + `@tailwindcss/postcss` `^4.1.18` | `package.json` |
| PostCSS | `^8.5.26` + `postcss-normalize-charset` `^7.0.1` | `package.json` |
| Pruebas | Vitest `^4.0.8` sobre jsdom `^28.0.0`; builder `@angular/build:unit-test` | `package.json`, `angular.json`, `vitest.config.ts` |
| Gestor de paquetes | `npm@11.16.0` (campo `packageManager`) | `package.json` |

Nota de IDE: el backend apunta a `net10.0`; cargar la solución requiere Visual Studio 2026
o MSBuild 18+. `dotnet build` desde terminal funciona igual.

## Los 8 principios del README

1. La posición operativa existe con independencia de la persona asignada.
2. Una captura operativa se reutiliza en tablero, incidencias, reportes y módulos posteriores;
   no se recaptura.
3. Los registros operativos **no se eliminan**. Una corrección conserva valor anterior, valor
   nuevo, motivo, usuario y fecha.
4. Empresa, cliente, servicio, posición, persona, fecha y origen se conservan **por
   identificador**, no por nombre visible.
5. El frontend nunca contiene reglas de negocio que deban protegerse en el servidor.
6. Las dependencias apuntan hacia el dominio, nunca del dominio hacia infraestructura o interfaz.
7. Los nombres del bosquejo no son definitivos hasta validarse y desplegarse en una migración
   revisada.
8. El paquete comercial de INSPINIA no se almacena completo en Git; solo entran componentes
   adaptados y permitidos por su licencia.

## Reglas de arquitectura no negociables (ADR 0001, 0003, 0005)

### Dirección de dependencias

```text
Api             ->  Application + Infrastructure
Infrastructure  ->  Application + Domain
Application     ->  Domain
Domain          ->  (nada)
```

`backend/tests/GestIA.Architecture.Tests/LayerDependencyTests.cs` lee los `.csproj` y falla si
esa forma cambia. Si agregas una `ProjectReference`, esa prueba te lo dirá.

### Prohibiciones duras

- **Domain y Application no referencian EF Core** ni tipos propios de SQL Server. Domain no
  tiene ninguna `PackageReference`; Application solo tiene las abstracciones de DI.
- **La configuración física va con Fluent API en Infrastructure**, en
  `Persistence/Configurations/*.cs` (hoy 36 clases `IEntityTypeConfiguration<T>`). No se usan
  atributos de mapeo en las entidades de Domain.
- **Sin reglas de negocio protegibles en el frontend.** Ocultar una opción del menú no es
  autorización. Toda consulta multiempresa lleva el identificador de alcance autorizado desde
  el servidor: en la práctica, `OrganizationAccessGuard.ForbidIfUnauthorized(context, orgId)`
  al inicio de cada endpoint, más `.RequirePermission(...)`.
- **El aislamiento entre organizaciones es un filtro global, no una condición que cada consulta
  repita.** El guard fija la organización autorizada en `IOrganizationContext` y un filtro con
  nombre la aplica a las **29 entidades** que declaran `IOrganizationScopedEntity`. Falla
  cerrado: sin organización fijada, la consulta devuelve **cero filas**, no todas. Apagarlo exige
  `IgnoreQueryFilters(["Organization"])`, que sólo pueden usar los archivos de la lista blanca de
  `OrganizationFilterBypassTests`; `IgnoreQueryFilters()` sin argumentos rompe el build.
- **Las correcciones de registros operativos dejan rastro.** `SaveChanges` emite un
  `OperationalEvent` por cada cambio a las cinco entidades con historial, en la misma transacción
  que el cambio. Las bitácoras son de sólo agregar y sus fotos guardan metadatos con lista
  blanca: el texto libre no se copia, sólo si estaba lleno o vacío.
- **Los registros operativos no se eliminan.** Se usa borrado lógico (`Active`) vía
  `IActivatableEntity` y auditoría vía `IAuditableEntity`.
- **En producción la API no usa `sa` ni crea bases al iniciar.** No hay `EnsureCreated` ni
  migraciones automáticas en el arranque.

## Convenciones de nombres (`docs/database/DATABASE_STANDARDS.md`)

`GestIaDatabaseStandards.ApplyGestIaDatabaseStandards()` valida el modelo al construirlo y
asigna nombres deterministas. Una configuración no estándar rompe la construcción del modelo y
lo detectan las pruebas de `GestIA.IntegrationTests/DatabaseStandardsTests.cs`.

| Objeto | Regla | Ejemplo |
|---|---|---|
| Base de datos | `db-{proyecto}-{ambiente}`, minúsculas | `db-gestia-dev` |
| Esquema | minúsculas, singular | `dbo`, `audit`, `config`, `report`, `archive` |
| Tabla | PascalCase **plural** | `Services`, `BusinessDocuments` |
| Columna | PascalCase singular | `StartDate`, `MonthlyPrice` |
| Clave primaria | `Id{Entidad}` | `IdService`, `IdBusinessDocument` |
| Clave foránea | `Id{EntidadRelacionada}` | `IdClient`, `IdOrganization` |
| Restricciones | `PK_{Tabla}`, `AK_{Tabla}_{Cols}`, `FK_{Origen}_{Destino}_{Col}`, `CK_{Tabla}_{Desc}`, `DF_{Tabla}_{Col}` | `CK_Services_DateRange` |
| Índices | `IX_{Tabla}_{Cols}`, único `UX_{Tabla}_{Cols}` | `IX_Users_Email` |
| Vista / SP / función | `vw_`, `usp_{Acción}_{Entidad}`, `fn_`, `ft_` | `usp_Create_User` |

Semántica de columnas:

- **Booleanos** empiezan con `Is`, `Has` o `Can`; la única excepción es el campo transversal
  exacto `Active`.
- **Instantes** terminan en `At` y **son UTC por contrato**; no se agrega `Utc` al nombre.
  Tipo `datetime2(0)` salvo excepción documentada. `CreatedAt` usa `SYSUTCDATETIME()`.
- **Fechas de negocio** terminan en `Date` y usan `date`.
- **Códigos visibles** usan `Code{Entidad}` con longitud explícita; no sustituyen a la PK.
- **Auditoría**: `CreatedAt`/`CreatedBy`/`CreatedByName` obligatorios;
  `UpdatedAt`/`UpdatedBy`/`UpdatedByName` opcionales. Los campos transversales **no
  reemplazan** el historial funcional de valor anterior/nuevo/motivo/origen.
- **Tipos**: `uniqueidentifier` para identificadores, `nvarchar(n)` para texto humano,
  `varchar(n)` solo en códigos ASCII justificados, `decimal(19,4)` para importes,
  `decimal(9,4)` para horas, `rowversion` para concurrencia. Prohibidos `float`/`real` en
  importes, `ntext`/`text`/`image`, y fechas como texto.

## INSPINIA: qué entra y qué no a Git (`docs/integrations/inspinia-5.md`, ADR 0002)

**No entra:** el ZIP ni la carpeta comercial completa, rutas y pantallas demo del Admin,
autenticación simulada de la plantilla, customizer de skins, logos, fotografías, banderas y
activos de demostración, y dependencias de gráficas, mapas, calendarios o tablas sin uso actual.

**Entra:** patrones y piezas portadas selectivamente, adaptadas de Angular 21 a Angular 22 y a
la identidad GestIA. Ya se portaron el layout vertical (sidebar, topbar, contenido, footer),
navegación tipada, sidebar condensado y off-canvas móvil, persistencia de preferencia en
`sessionStorage` y Tailwind 4 vía PostCSS.

**Regla por componente:** cada pieza portada registra su archivo de origen, dependencias
nuevas, adaptación visual, prueba y módulo de negocio consumidor. No se copian carpetas
completas. Aún no se incorporan Preline, Simplebar, Flatpickr, ECharts ni Google Maps: se
agregan solo con un caso funcional que lo exija.

## Comandos

Backend:

```powershell
Set-Location backend
dotnet tool restore
dotnet restore GestIA.sln
dotnet build GestIA.sln
dotnet test GestIA.sln
```

Frontend:

```powershell
Set-Location frontend
npm ci
npm start          # ng serve
npm test           # ng test (Vitest sobre jsdom)
npm run build      # ng build -> frontend/dist/gestia-web
```

Contenedores (`compose.yaml`, ADR 0004):

```powershell
Copy-Item .env.example .env      # cambiar GESTIA_SQL_PASSWORD antes de iniciar
docker compose build
docker compose up -d
docker compose ps
docker compose logs --follow sqlserver database-init backend frontend
docker compose down              # los datos quedan en el volumen gestia_mssql-data
```

Puntos de verificación: web `http://localhost:4200`, API
`http://localhost:8080/api/v1/system/info`, liveness `/health/live`, readiness (incluye SQL
Server) `/health/ready`, SQL `localhost,1433`.

Migraciones, como paso controlado y nunca al arrancar la API:

```powershell
Set-Location backend
dotnet tool restore
$env:GESTIA_SQL_CONNECTION = "Server=localhost,1433;Database=db-gestia-dev;User Id=sa;Password=<la de .env>;Encrypt=True;TrustServerCertificate=True"
dotnet tool run dotnet-ef database update --project .\src\GestIA.Infrastructure --startup-project .\src\GestIA.Infrastructure
```

## Regla de migraciones desplegadas

**Una migración ya desplegada no se reescribe: se agrega una migración compensatoria.**
(ADR 0003, sección "Consecuencias"; reiterado en las restricciones heredadas del alcance
vigente.)

Esto no es teórico aquí. Hay **22 migraciones** en
`backend/src/GestIA.Infrastructure/Persistence/Migrations/`, y **no todas están aplicadas en
todas las bases**:

| Base | Migraciones aplicadas | Hasta |
|---|---|---|
| `db-gestia-dev` | 19 | `20260903214645_CoverageCatalogReference` |
| `db-gestia-demo` | 22 | `20260905120426_AddOrganizationToClientAndEmployeeDetails` |

Las 19 de `db-gestia-dev` están documentadas en `docs/V5-AVANCE-2026-09-03.md` y
`docs/CATALOGOS-CIERRE-2026-09-03.md`. Las tres siguientes —organización denormalizada, bitácora
funcional y organización en las entidades de detalle— se aplicaron sólo en `db-gestia-demo`, con
respaldo `COPY_ONLY` verificado y ensayo sobre copia antes de cada una.

**Consecuencia práctica: el código actual no arranca contra `db-gestia-dev`.** El modelo espera
columnas que esa base todavía no tiene. Ponerla al día es una decisión con respaldo y ensayo, no
un paso automático.

Editar el archivo de una migración ya aplicada deja el `__EFMigrationsHistory` de esa base
inconsistente con el código.

Reglas que acompañan a cada migración nueva:

1. Una migración es un cambio coherente y revisable, con nombre que describa la intención
   (`AddServiceRequests`, no `Update1`).
2. Se revisa el SQL generado antes de aplicarlo fuera de desarrollo.
3. Todo cambio destructivo lleva estrategia de migración, respaldo o compatibilidad.
4. Los scripts manuales son idempotentes cuando se pueda y quedan versionados.
5. Un cambio de nomenclatura se hace por migración, nunca editando producción.
6. Una excepción a los estándares requiere un ADR previo; no se resuelve desactivando la
   validación global.

## Estructura

```text
backend/src/GestIA.Domain          entidades, enums, invariantes; sin dependencias
backend/src/GestIA.Application     contratos, servicios de caso de uso, interfaces de repositorio
backend/src/GestIA.Infrastructure  DbContext, Fluent API, repositorios, migraciones, seeder
backend/src/GestIA.Api             endpoints mínimos, middleware JWT y de soporte, guards
backend/tests/                     Domain.UnitTests, Application.UnitTests, Architecture.Tests, IntegrationTests
frontend/src/app/core              auth (guard, interceptor, servicio), layout (shell, navegación)
frontend/src/app/features          15 features; cada una con data-access/ y pages/
frontend/src/app/shared            componentes de UI reutilizables
docs/                              adr/, architecture/, database/, deployment/, design/, integrations/
```
