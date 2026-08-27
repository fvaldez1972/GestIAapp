# GestIA

Repositorio principal de GestIA. Contiene una API en .NET 10 y una aplicación web Angular independientes, gobernadas por un mismo modelo funcional y documentación de arquitectura.

## Estado

GestIA se encuentra en preparación inicial. La plataforma técnica, SQL Server, los contenedores y el shell web están configurados; los módulos de negocio se desarrollarán por entregas verticales conforme se valide la información. El prototipo React anterior es una fuente de aprendizaje y validación, no código productivo que deba copiarse sin revisión.

El documento rector del proyecto es [`PLAN_MAESTRO_GESTIA.md`](PLAN_MAESTRO_GESTIA.md). Ahí se concentran el alcance, orden de desarrollo, modelo evolutivo de SQL Server y pendientes.

## Stack aprobado

- Backend: .NET 10 LTS, ASP.NET Core 10, C# 14.
- Frontend: Angular 22, TypeScript 6, SCSS y componentes visuales adaptados de INSPINIA 5.
- API: REST/JSON documentada con OpenAPI.
- Persistencia: Microsoft SQL Server mediante EF Core 10 y el proveedor oficial de Microsoft.
- Pruebas: xUnit en backend y Vitest en frontend.
- Contenedores: SQL Server, API y frontend coordinados localmente con Docker Compose.

## Estructura

```text
GestIAapp/
|- backend/
|  |- src/
|  |  |- GestIA.Domain/
|  |  |- GestIA.Application/
|  |  |- GestIA.Infrastructure/
|  |  `- GestIA.Api/
|  `- tests/
|- frontend/
|- docs/
|  |- architecture/
|  |- database/
|  `- adr/
|- PLAN_MAESTRO_GESTIA.md
|- compose.yaml
`- GestIA.slnx
```

## Principios

1. La posición operativa existe independientemente de la persona asignada.
2. Una captura operativa debe reutilizarse en tablero, incidencias, reportes y módulos posteriores.
3. Los registros operativos no se eliminan; una corrección conserva valor anterior, valor nuevo, motivo, usuario y fecha.
4. Empresa, cliente, servicio, posición, persona, fecha y origen se conservan por identificador cuando corresponda.
5. El frontend nunca contiene reglas de negocio que deban protegerse en el servidor.
6. Las dependencias apuntan hacia el dominio, nunca desde el dominio hacia infraestructura o interfaz.
7. Los nombres del bosquejo no se consideran definitivos hasta ser validados y desplegados mediante una migración revisada.
8. El paquete comercial de INSPINIA no se almacena completo en Git; sólo se incorporan componentes adaptados y permitidos por su licencia.

## Documentación

- `PLAN_MAESTRO_GESTIA.md`
- `docs/architecture/01-system-context.md`
- `docs/architecture/02-domain-map.md`
- `docs/architecture/03-data-model.md`
- `docs/architecture/04-repository-structure.md`
- `docs/architecture/05-migration-plan.md`
- `docs/architecture/06-dependency-map.md`
- `docs/architecture/07-model-evolution.md`
- `docs/architecture/08-source-model-analysis.md`
- `docs/database/DATABASE_STANDARDS.md`
- `docs/adr/0005-database-standards.md`
- `docs/adr/0003-sql-server.md`
- `docs/integrations/inspinia-5.md`
- `docs/deployment/containers.md`

## Comandos

```powershell
dotnet restore GestIA.slnx
dotnet tool restore
dotnet build GestIA.slnx
dotnet test GestIA.slnx

Set-Location frontend
npm ci
npm start
npm test
npm run build
```

Contenedores:

```powershell
Copy-Item .env.example .env
# Cambiar GESTIA_SQL_PASSWORD en .env antes de iniciar.
docker compose build
docker compose up -d
docker compose ps
```

No se debe publicar ni conectar información real hasta completar autenticación, aislamiento por organización, auditoría y revisión de seguridad.
