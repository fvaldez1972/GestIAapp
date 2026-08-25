# Estructura del repositorio

## Backend

```text
backend/
|- Dockerfile
|- src/
|  |- GestIA.Domain/
|  |  |- Common/
|  |  `- Modules/<Module>/{Entities,ValueObjects,Events,Rules}/
|  |- GestIA.Application/
|  |  |- Abstractions/
|  |  |- Behaviors/
|  |  `- Modules/<Module>/{Commands,Queries,DTOs,Validators}/
|  |- GestIA.Infrastructure/
|  |  |- Persistence/
|  |  |  |- Configurations/
|  |  |  |- Migrations/
|  |  |  `- Repositories/
|  |  |- Identity/
|  |  |- Audit/
|  |  `- Integrations/
|  `- GestIA.Api/
|     |- Endpoints/<Module>/
|     |- Middleware/
|     |- OpenApi/
|     `- Program.cs
`- tests/
   |- GestIA.Domain.UnitTests/
   |- GestIA.Application.UnitTests/
   |- GestIA.Architecture.Tests/
   `- GestIA.IntegrationTests/
```

### Reglas de referencia

```text
Domain          -> ninguna capa
Application     -> Domain
Infrastructure  -> Application + Domain
Api             -> Application + Infrastructure
```

SQL Server y EF Core sólo aparecen en Infrastructure y en la composición de Api. Las entidades de dominio no heredan de tipos de EF Core. Cada entidad persistida tendrá configuración Fluent API explícita; las migraciones se generan sólo al aprobar su corte vertical.

No se agregará MediatR, AutoMapper ni un framework de repositorios por defecto. Se prefieren handlers explícitos, mapeo explícito y abstracciones pequeñas hasta que exista una necesidad demostrada.

## Frontend

```text
frontend/src/app/
|- core/
|  |- auth/
|  |- config/
|  |- http/
|  |- layout/
|  `- observability/
|- shared/
|  |- ui/
|  |- forms/
|  |- directives/
|  |- pipes/
|  `- utils/
|- api/
|  `- generated/
`- features/
   |- dashboard/
   |- customers/
   |- workforce/
   |- services/
   |- scheduling/
   |- attendance/
   |- incidents/
   `- reporting/
```

El frontend incluye `frontend/Dockerfile` y `frontend/nginx.conf`. La raíz contiene `compose.yaml` y `.dockerignore`; el contexto de build siempre es la raíz para compartir configuración sin copiar artefactos locales.

Cada feature puede contener:

```text
feature-name/
|- pages/
|- ui/
|- data-access/
|- models/
|- feature.routes.ts
`- public-api.ts
```

Se usarán componentes standalone, carga diferida, formularios tipados, signals para estado local y RxJS para flujos asíncronos. El estado de servidor no se duplicará en stores globales sin necesidad.

## Integración de INSPINIA

- Fuente principal: `INSPINIA_v5.0/Tailwind CSS/Angular/StarterKit`.
- Angular 21 de la plantilla no se copia como proyecto raíz; GestIA permanece en Angular 22.
- Se portan layout, patrones y componentes uno a uno.
- Se sustituyen logo, tokens, tipografía, iconos y textos.
- No se importan pantallas demo, autenticación falsa o dependencias no usadas.
- El ZIP y la referencia completa permanecen fuera de Git.

## Contrato frontend/backend

La API publica OpenAPI versionado. El cliente TypeScript se genera desde ese contrato y no se escribe manualmente para cada endpoint. Los DTO de transporte no se reutilizan como entidades de dominio.
