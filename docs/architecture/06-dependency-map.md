# Mapa de dependencias técnicas

## Backend: configuración base

| Capacidad | Dependencia | Estado |
| --- | --- | --- |
| API/OpenAPI | ASP.NET Core 10 + `Microsoft.AspNetCore.OpenApi` | Aprobado |
| Persistencia | EF Core 10 | Aprobado |
| SQL Server | `Microsoft.EntityFrameworkCore.SqlServer` | Aprobado |
| Herramientas de migración | `Microsoft.EntityFrameworkCore.Design` | Aprobado, sólo diseño |
| Readiness de datos | `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` | Aprobado |
| Validación | FluentValidation o validadores propios | Evaluar por incremento |
| Observabilidad | OpenTelemetry | Antes del primer entorno compartido |
| Pruebas reales de persistencia | SQL Server/Testcontainers | Pendiente de automatizar sobre `InitialBusinessModel` |
| Arquitectura | Pruebas de referencias y namespaces | Configurado |
| Runtime contenedor | `mcr.microsoft.com/dotnet/aspnet:10.0-alpine-extra` | Aprobado; ICU requerido por SqlClient |

Se evita agregar librerías de mapeo, mediator, jobs, caché o mensajería hasta demostrar su necesidad.

## Frontend: configuración base

| Capacidad | Dependencia | Decisión |
| --- | --- | --- |
| Framework | Angular 22 | Aprobado |
| Lenguaje | TypeScript 6 | Aprobado |
| Pruebas | Vitest | Aprobado por plantilla Angular |
| Estilos | SCSS + Tailwind 4.1 | Integración base aprobada |
| Iconos | Iconify/Tabler sólidos | Incorporar con shell |
| Tablas | CDK/Table o alternativa Angular mantenida | Seleccionar con reportes |
| Calendario | FullCalendar Angular | Sólo si planeación lo requiere |
| Gráficas | ECharts | Sólo con dashboard validado |
| Estado | Signals + RxJS | Aprobado |
| API client | Generado desde OpenAPI | Aprobado |
| Build contenedor | Node 24.19 Alpine | Aprobado |
| Servidor estático | Nginx no privilegiado 1.31.3 Alpine | Aprobado |

## Dependencias del prototipo actual

El prototipo React no se incorpora como dependencia. Sus responsabilidades se mapean así:

| Prototipo | Destino nuevo |
| --- | --- |
| `model.ts` | Agregados y contratos de Domain/Application |
| `store.ts` | Casos de uso y persistencia en API |
| `Catalogs.tsx` | Features Angular Customers/Workforce/Services |
| `Planning.tsx` | Feature Scheduling |
| `AttendanceIncidents.tsx` | Features Attendance/Incidents/Coverage |
| `Dashboard.tsx` | Read models de Reporting + dashboard Angular |
| `ReportsFlow.tsx` | Reporting y exportaciones servidor/cliente |

## Riesgos de dependencias INSPINIA

- El paquete local usa Angular 21.1; GestIA usa Angular 22.1.
- Varias dependencias del Admin arrastran jQuery, DataTables y librerías duplicadas.
- El StarterKit también contiene numerosas pantallas demo.
- Cada componente portado debe probarse en Angular 22 y justificar sus paquetes.
- El código comercial completo no debe publicarse en un repositorio abierto.

El primer corte del shell ya está integrado sin Preline, Simplebar ni dependencias de demostración. Su trazabilidad está en `docs/integrations/inspinia-5.md`.
