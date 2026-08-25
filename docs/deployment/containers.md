# Ejecución con contenedores

## Componentes

| Servicio | Imagen/runtime | Puerto interno | Puerto local predeterminado |
| --- | --- | --- | --- |
| SQL Server | SQL Server 2025 Developer Linux | 1433 | 1433 |
| Inicialización | SQL Server tools; ejecución única | No expuesto | No expuesto |
| Backend | ASP.NET Core 10 Alpine Extra con ICU | 8080 | 8080 |
| Frontend | Nginx no privilegiado 1.31.3 Alpine | 8080 | 4200 |

El frontend usa la misma procedencia para interfaz y API: cualquier solicitud a `/api/*` se envía a `backend:8080` dentro de la red de Compose.

## Preparación local

```powershell
Copy-Item .env.example .env
```

Cambiar `GESTIA_SQL_PASSWORD` en `.env`. El archivo está ignorado por Git. `GESTIA_SQL_DATABASE=GestIA_Dev` es un nombre local provisional y puede cambiarse sin afectar el código.

## Inicio

```powershell
docker compose build
docker compose up -d
docker compose ps
```

- Web: `http://localhost:4200`
- API: `http://localhost:8080/api/v1/system/info`
- Liveness backend: `http://localhost:8080/health/live`
- Readiness backend + SQL Server: `http://localhost:8080/health/ready`
- SQL Server local: `localhost,1433`

La secuencia es:

```text
SQL Server saludable
        -> creación idempotente de la base local vacía
        -> backend listo y conectado
        -> frontend listo
```

No se generan tablas con `EnsureCreated` ni se aplican migraciones automáticamente al arrancar la API.

## Diagnóstico

```powershell
docker compose logs --follow sqlserver database-init backend frontend
docker compose ps
```

## Detener

```powershell
docker compose down
```

Los datos permanecen en el volumen `gestia_mssql-data`. Para eliminarlos se requiere una acción explícita con `docker compose down --volumes`; no forma parte del flujo normal.

## Seguridad por ambiente

- `sa`, Developer edition y certificado confiado se usan sólo en la computadora de desarrollo.
- Producción utilizará un login de mínimos privilegios, secreto administrado y cifrado validado.
- No copiar `.env`, respaldos, archivos MDF/LDF ni datos reales a Git o a las imágenes.
- No publicar el puerto 1433 en ambientes donde sólo la API necesite acceso interno.
- Respaldos, retención, alta disponibilidad y edición/licencia se definirán antes del primer ambiente productivo.
