# ADR-0004: Contenedores separados para SQL Server, API y frontend

- Estado: Aceptado
- Fecha: 2026-08-25

## Decisión

GestIA se construirá y desplegará inicialmente con imágenes OCI separadas:

- SQL Server: imagen oficial SQL Server 2025 Developer para desarrollo local.
- Backend: ASP.NET Core 10 sobre la imagen oficial .NET 10 Alpine Extra, que incluye ICU requerido por `Microsoft.Data.SqlClient`.
- Frontend: compilación Angular con Node 24 y publicación estática mediante Nginx no privilegiado.

Docker Compose coordina los tres componentes para desarrollo integrado y validación. Nginx expone la interfaz y enruta `/api/*` al servicio backend mediante la red interna.

## Motivo

- Builds reproducibles y aislados.
- SQL Server local consistente entre integrantes del equipo.
- Despliegue independiente de interfaz y API.
- Health checks y dependencias de arranque explícitas.
- Persistencia local mediante volumen nombrado.

## Consecuencias

- Cada cambio debe mantener válidos ambos Dockerfiles y el archivo Compose.
- Las imágenes de aplicación usan builds multietapa y no contienen SDK ni dependencias de desarrollo en runtime.
- Los secretos y datos persistentes se inyectan en ejecución; nunca se copian a las imágenes.
- El servicio de inicialización crea únicamente la base local vacía; no inventa tablas de negocio.
- La API espera a que SQL Server esté saludable y la base local exista.
- SQL Server Developer, `sa` y `TrustServerCertificate=True` son exclusivamente para desarrollo local.
- Producción usará una instancia, credencial de aplicación y proceso de migración administrados.
