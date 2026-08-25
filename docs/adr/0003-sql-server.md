# ADR-0003: SQL Server como motor de persistencia

- Estado: Aceptado
- Fecha: 2026-08-25

## Decisión

GestIA usará Microsoft SQL Server con Entity Framework Core 10 y el proveedor oficial `Microsoft.EntityFrameworkCore.SqlServer`.

- Desarrollo local: SQL Server 2025 Developer en contenedor Linux.
- Aplicación: acceso mediante `GestIaDbContext` dentro de Infrastructure.
- Producción: instancia y edición se definirán con infraestructura; no se presupone que será el contenedor de desarrollo.
- Migraciones: se almacenarán en Infrastructure y se aplicarán como paso controlado de despliegue.

## Límites de la decisión

Esta decisión confirma el motor, no el diseño físico definitivo. Los nombres actuales de base, esquemas, tablas, entidades y columnas son de trabajo hasta validar el glosario con los responsables del negocio.

No se generará una migración que materialice todo el modelo conceptual mientras falten definiciones. Primero se implementará cada corte vertical aceptado y entonces se creará su migración revisable.

## Reglas técnicas

- Domain y Application no referencian EF Core ni tipos propios de SQL Server.
- Las configuraciones físicas se escriben con Fluent API en Infrastructure.
- Las cadenas de conexión se inyectan por configuración o secretos.
- En producción la API no usa `sa` ni crea bases de datos al iniciar.
- Los reintentos transitorios se configuran en el proveedor; no sustituyen transacciones ni idempotencia.
- Liveness verifica el proceso; readiness verifica también la conexión con SQL Server.

## Consecuencias

- El equipo puede cambiar nombres y detalles físicos antes de la primera migración de cada módulo.
- Una migración ya desplegada nunca se reescribe: se agrega una migración compensatoria.
- El contenedor Developer y sus credenciales son exclusivamente locales.
- La edición, licenciamiento, respaldo, alta disponibilidad y monitoreo de producción quedan como decisiones de infraestructura posteriores.
