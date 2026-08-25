# Mapa de dominios

GestIA se implementará como monolito modular. Comparte proceso y despliegue, pero cada módulo conserva sus reglas, casos de uso y límites de datos.

> Los nombres de módulos y agregados son lenguaje de trabajo. Se confirmarán con el glosario antes de convertirlos en contratos o tablas definitivas.

## Módulos

### Plataforma

- `Tenancy`: empresas u organizaciones, zonas, configuración y aislamiento de datos.
- `IdentityAccess`: usuarios, roles, permisos y membresías.
- `Audit`: eventos inmutables, cambios, actor, origen y correlación.

### Comercial

- `Customers`: clientes, sedes, contactos y reglas generales.
- `ServiceRequests`: solicitudes de servicio y conversión controlada.
- `Services`: servicios activos y condiciones operativas.

### Personal

- `Workforce`: personas operativas, perfiles, disponibilidad, estatus y elegibilidad.
- `Qualifications`: requisitos y vigencias; se activa después del núcleo.

### Operación

- `Positions`: posiciones permanentes, capacidad y perfil requerido.
- `Shifts`: patrones, ciclos, segmentos horarios y descansos.
- `Assignments`: titular, apoyo, cubre-descanso, sustitución e histórico.
- `Scheduling`: periodo, versiones, publicación y turnos programados.

### Ejecución

- `Attendance`: persona esperada, resultado real, fuente y confirmación.
- `Incidents`: excepción, motivo, impacto, evidencia y seguimiento.
- `Coverage`: hueco, sustituto, intervalo cubierto y resolución.

### Control e información

- `Approvals`: autorizaciones configurables; posterior al núcleo inicial.
- `Payroll`: periodos y conceptos; posterior.
- `Compliance`: documentos y paquetes; posterior.
- `Reporting`: proyecciones de lectura, dashboard y exportaciones.

## Dependencias permitidas

```text
Tenancy --------> todos los módulos
IdentityAccess -> autorización y auditoría

Customers -> ServiceRequests -> Services -> Positions
Workforce -------------------------------> Assignments
Positions + Shifts + Assignments --------> Scheduling
Scheduling ------------------------------> Attendance
Attendance ------------------------------> Incidents
Incidents + Workforce + Scheduling ------> Coverage

Eventos de todos los módulos ------------> Audit
Eventos confirmados ---------------------> Reporting
Incidents/Coverage ----------------------> Approvals/Payroll (futuro)
```

Reporting no modifica módulos transaccionales. Los módulos futuros consumen datos confirmados, nunca reconstrucciones basadas en nombres.

## Agregados candidatos

| Concepto de trabajo | Raíz propuesta | Invariantes por validar |
| --- | --- | --- |
| Empresa/organización | `Company` | Identificador, zona horaria y estado |
| Cliente | `Client` | Pertenece a organización; razón social y nombre normalizados |
| Servicio | `Service` | Pertenece a cliente; vigencia y ubicación válidas |
| Posición | `Position` | Pertenece a servicio; capacidad positiva y perfil requerido |
| Persona operativa | `Employee` | Número único por organización; estatus controla elegibilidad |
| Asignación | `Assignment` | No traslapa incompatibles; conserva vigencia y origen |
| Planeación versionada | `ScheduleVersion` | Una versión publicada es inmutable |
| Asistencia | `Attendance` | Una confirmación principal por turno |
| Incidencia | `Incident` | Conserva contexto, tipo, fuente y seguimiento |
| Cobertura | `Coverage` | Cubierta exige sustituto e intervalo |

## Reglas que deben vivir en Domain/Application

- Traslape real de intervalos y vigencias.
- Capacidad autorizada y sobrecupo.
- Elegibilidad por perfil, estatus y disponibilidad.
- Publicación y versionado de planeación.
- Confirmación masiva de asistencia.
- Consistencia entre cobertura, sustituto e intervalo.
- Correcciones auditables.
- Aislamiento por organización.

Angular sólo presenta resultados y validaciones tempranas; la API vuelve a validar cada regla.
