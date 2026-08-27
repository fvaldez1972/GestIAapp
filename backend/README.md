# Backend

API de GestIA construida con .NET 10 como monolito modular y persistencia SQL Server mediante EF Core 10.

## Dependencias permitidas

```text
Api -> Application + Infrastructure
Infrastructure -> Application + Domain
Application -> Domain
Domain -> ninguna otra capa de GestIA
```

EF Core, `DbContext`, configuraciones físicas y migraciones permanecen en Infrastructure. Los módulos de negocio se agregan verticalmente dentro de las capas existentes; no se crea un proyecto por tabla ni se colocan reglas de negocio en endpoints.

## Ejecución directa

La cadena no se almacena en Git. Antes de iniciar la API:

```powershell
$env:ConnectionStrings__GestIa = 'Server=localhost,1433;Database=db-gestia-dev;User Id=sa;Password=<local>;Encrypt=True;TrustServerCertificate=True'
dotnet run --project .\src\GestIA.Api
```

Para crear migraciones, `GestIaDbContextFactory` exige una variable separada:

```powershell
$env:GESTIA_SQL_CONNECTION = $env:ConnectionStrings__GestIa
dotnet tool restore
dotnet tool run dotnet-ef migrations add <Nombre> `
  --project .\src\GestIA.Infrastructure `
  --startup-project .\src\GestIA.Infrastructure `
  --output-dir Persistence\Migrations
```

Para aplicar migraciones en la base local:

```powershell
$env:GESTIA_SQL_CONNECTION = $env:ConnectionStrings__GestIa
dotnet tool restore
dotnet tool run dotnet-ef database update `
  --project .\src\GestIA.Infrastructure `
  --startup-project .\src\GestIA.Infrastructure
```

La migración `InitialBusinessModel` contiene el primer corte aprobado. Las migraciones no se aplican automáticamente al iniciar la API.

## Endpoints iniciales

- `GET /health`: liveness compatible.
- `GET /health/live`: proceso activo.
- `GET /health/ready`: proceso y SQL Server disponibles.
- `GET /api/v1/system/info`: información básica del servicio.
