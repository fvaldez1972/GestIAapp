# GestIA - Resumen funcional por módulo

Última actualización: 2026-08-29

Este documento resume qué hace cada módulo de GestIA, qué lógica de negocio implica, qué información se tomó en cuenta para diseñarlo y cómo se conecta con backend, frontend y base de datos.

La intención es que sirva como mapa funcional para seguir desarrollando sin perder contexto: qué ya existe, por qué existe y qué debe cuidarse cuando el modelo de datos siga evolucionando.

## 1. Contexto general del sistema

GestIA es una plataforma operativa para empresas de seguridad privada. El objetivo principal es conectar en un solo flujo la información comercial del cliente, la configuración del servicio, el expediente del personal, la planeación de turnos y la operación diaria.

La aplicación se está construyendo como un sistema modular dentro del repositorio principal:

```text
GestIAapp/
├─ backend/
│  ├─ src/
│  │  ├─ GestIA.Api/
│  │  ├─ GestIA.Application/
│  │  ├─ GestIA.Domain/
│  │  └─ GestIA.Infrastructure/
│  └─ tests/
├─ frontend/
│  └─ src/app/
└─ docs/
```

### Decisiones técnicas base

- Backend en .NET 10.
- Frontend en Angular 22.
- SQL Server como motor de base de datos.
- JWT para autenticación MVP. No se integró Entra ID en esta etapa.
- Docker para levantar frontend, backend y SQL Server.
- Arquitectura por capas:
  - `Domain`: entidades, enumeraciones e invariantes del negocio.
  - `Application`: casos de uso, contratos, validaciones y orquestación.
  - `Infrastructure`: EF Core, SQL Server, repositorios, migraciones y seed.
  - `Api`: endpoints HTTP, autenticación, permisos, middleware y manejo de errores.
- Frontend organizado por módulos funcionales en `features`, con servicios `data-access` por módulo.
- Ruteo Angular normal basado en path: `/login`, `/clientes`, `/solicitudes`, etc. Actualmente no usa hash routing tipo `/#/clientes`.

### Información de negocio tomada en cuenta

Para bosquejar e implementar el modelo se consideró:

- Contrato de cliente: información fiscal/legal del cliente y datos base para relación contractual.
- Anexo 1 del contrato: configuración inicial del servicio.
- Carta compromiso: detalle operativo de la configuración del servicio, condiciones, parámetros y operación esperada.
- Ficha técnica de empleado: datos personales/laborales, documentos, evaluaciones y papelería requerida.
- Requisitos de nuevo cliente: se identificó como referencia de alta, pero no como núcleo del primer alcance operativo.
- Prototipo previo e Inspinia 5: se tomó como referencia visual/base de experiencia, adaptándolo a GestIA para no parecer plantilla genérica.
- Brand book de GestIA: colores, tono visual, uso de marca y enfoque de plataforma operativa.
- Estándares de nomenclatura de base de datos: nombres PascalCase, claves `IdEntidad`, códigos `CodeEntidad`, auditoría, borrado lógico y convenciones SQL Server.

## 2. Arquitectura funcional

El flujo central de GestIA queda así:

```text
Cliente
  └─ Sedes
      └─ Servicios
          ├─ Contratos
          ├─ Configuraciones operativas
          ├─ Puestos / posiciones
          ├─ Patrones de turno
          ├─ Versiones de planeación
          ├─ Turnos publicados
          └─ Operación diaria
              ├─ Asistencia
              ├─ Incidencias
              ├─ Coberturas
              ├─ Evidencias
              └─ Cierre diario
```

El personal se conecta al servicio mediante asignaciones y elegibilidad:

```text
Empleado
  ├─ Expediente
  ├─ Documentos
  ├─ Evaluaciones
  ├─ Habilidades
  └─ Asignaciones a servicios / puestos
```

Las solicitudes operativas funcionan como puerta controlada para convertir necesidades del negocio en datos reales:

```text
Solicitud
  ├─ Alta de cliente
  ├─ Nuevo servicio
  ├─ Cambio de configuración
  ├─ Cambio de personal
  └─ Solicitud de cobertura
```

## 3. Seguridad, sesión y permisos

### Ruta frontend

- `/login`
- Rutas protegidas dentro del `AppShell`.

### Backend

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- Administración:
  - `/api/v1/security/users`
  - `/api/v1/security/roles`
  - `/api/v1/security/permissions`

### Entidades principales

- `Users`
- `OrganizationMemberships`
- `Roles`
- `Permissions`
- `RolePermissions`
- `UserRoles`

### Qué hace el módulo

El módulo de seguridad permite iniciar sesión con usuario y contraseña, emitir token JWT y controlar el acceso por permisos. Cada ruta protegida del frontend tiene un permiso asociado cuando aplica, por ejemplo:

- `CLIENTS.READ`
- `REQUESTS.READ`
- `WORKFORCE.READ`
- `DOCUMENTS.READ`
- `CATALOGS.READ`
- `PLANNING.READ`
- `OPERATIONS.READ`
- `REPORTS.READ`
- `AUDIT.READ`
- `PLATFORM.ADMIN`

### Lógica implicada

- Normaliza el correo para buscar al usuario.
- Valida contraseña usando hash PBKDF2, no texto plano.
- Genera JWT con identidad, organización y permisos.
- El frontend guarda la sesión y usa guards para bloquear rutas no autorizadas.
- El layout filtra el menú según permisos del usuario.
- El backend aplica filtros de permisos en endpoints sensibles.

### Consideraciones de diseño

Se decidió JWT porque permite avanzar rápido en MVP, mantener el backend desacoplado y no depender todavía de Entra ID. Más adelante se puede migrar a un proveedor corporativo sin romper todos los módulos, siempre que se conserve la idea de permisos por código.

## 4. Inicio / dashboard operativo

### Ruta frontend

- `/`

### Qué hace el módulo

El inicio resume la operación para que el usuario no entre a ciegas al sistema. Muestra indicadores clave, servicios con riesgo y accesos rápidos hacia los módulos más usados.

### Información mostrada

- Clientes registrados.
- Servicios activos.
- Solicitudes abiertas.
- Personal activo.
- Servicios con riesgo.
- Incidencias abiertas.
- Autorizaciones pendientes.
- Días cerrados.
- Asistencias capturadas.
- Horas cubiertas.
- Servicios que requieren seguimiento.

### Lógica implicada

El dashboard cruza información de varios módulos:

- Clientes y servicios para saber el volumen operativo.
- Personal para disponibilidad.
- Operación para detectar asistencias, incidencias y coberturas.
- Autorizaciones para saber qué requiere supervisión.
- Reportes para consolidar métricas.

### Consideraciones UX/UI

Se buscó reducir espacio desperdiciado y hacerlo más accionable:

- Hero más compacto.
- Métricas agrupadas por prioridad.
- Tarjetas con señales visuales cuando hay riesgo.
- Accesos rápidos con hover claro para no parecer estados seleccionados.
- Textos más humanos y menos técnicos.
- Diseño responsivo para que las tarjetas colapsen correctamente en pantallas medianas o móviles.

## 5. Solicitudes operativas

### Ruta frontend

- `/solicitudes`

### Backend

- `GET /api/v1/requests`
- `POST /api/v1/requests`
- `PUT /api/v1/requests/{idOperationalRequest}`
- `POST /api/v1/requests/{idOperationalRequest}/execution-preview`
- `POST /api/v1/requests/{idOperationalRequest}/execute`

### Entidades principales

- `OperationalRequests`
- Además puede crear o modificar:
  - `Clients`
  - `ClientSites`
  - `ServiceContracts`
  - `Services`
  - `ServiceConfigurations`
  - `ServiceAssignments`
  - `CoverageRecords`

### Qué hace el módulo

Solicitudes es el punto de entrada para altas, cambios y necesidades operativas antes de que afecten datos reales. Evita que el usuario modifique clientes, servicios, asignaciones o coberturas sin un contexto de solicitud.

### Tipos de solicitud

- `NewClient`: alta de cliente.
- `NewService`: nuevo servicio para un cliente.
- `ServiceChange`: cambio en configuración operativa de un servicio.
- `CoverageSupport`: apoyo/cobertura para un turno.
- `StaffChange`: movimiento de personal.
- `Other`: caso no clasificado todavía.

### Estados de solicitud

- `Draft`: borrador.
- `Submitted`: enviada.
- `InReview`: en revisión.
- `Approved`: aprobada.
- `Rejected`: rechazada.
- `Cancelled`: cancelada.
- `Completed`: completada.

### Lógica implicada

El módulo tiene dos niveles:

1. Gestión de la solicitud.
   - Captura folio, tipo, prioridad, cliente, servicio, solicitante, fecha requerida y descripción.
   - Permite filtrar por organización, estado, tipo y búsqueda.
   - Ordena/segmenta solicitudes para que operación vea qué atender primero.

2. Ejecución de solicitud aprobada.
   - Antes de ejecutar, genera una vista previa de impacto.
   - Revisa campos obligatorios según el tipo.
   - Si faltan datos, no toca entidades reales.
   - Si está completa, ejecuta la acción:
     - alta de cliente;
     - alta de sede;
     - alta de contrato;
     - alta de servicio;
     - nueva configuración operativa;
     - asignación o cambio de personal;
     - cobertura real.
   - Al ejecutar correctamente, cambia la solicitud a completada.

### Campos relevantes

Una solicitud puede incluir:

- Datos de cliente: código, razón social, nombre comercial, RFC, nacionalidad, actividad fiscal, domicilio fiscal, datos constitutivos y representante legal.
- Datos de sede: código, nombre, calle, municipio, estado, código postal, país, instrucciones de acceso y zona horaria.
- Datos de contrato: código, estado, fechas, plazo de pago, aviso de terminación, moneda, referencia documental y notas.
- Datos de servicio: código, nombre, descripción, inicio, fin, sede y contrato.
- Configuración: vigencia, personal requerido, horas por día, días por semana, horas mensuales, días de preparación, horario/instrucciones, precio mensual, moneda e impuestos.
- Movimiento de personal: empleado, posición, tipo de asignación, fechas, primario y notas.
- Cobertura: turno, empleado reemplazo, horario, estado y notas.

### Consideraciones UX/UI

Se separó crear de consultar:

- Crear solicitud debe ser un flujo corto en drawer lateral.
- Consultar seguimiento debe abrir panel lateral de detalle.
- El listado principal debe mantenerse visible para no perder contexto.
- Las etapas funcionan como filtros operativos, no como botones viejos sueltos.
- Las tarjetas muestran folio, título, tipo, estado, prioridad, cliente y solicitante.
- El detalle concentra seguimiento, ejecución y notas sin mezclarlo con el listado.

## 6. Clientes

### Ruta frontend

- `/clientes`

### Backend

- `GET /api/v1/clients`
- `GET /api/v1/clients/{idClient}`
- `POST /api/v1/clients`
- `PUT /api/v1/clients/{idClient}`
- `DELETE /api/v1/clients/{idClient}`
- Sedes:
  - `/api/v1/clients/{idClient}/sites`
- Contactos:
  - `/api/v1/clients/{idClient}/contacts`
- Servicios:
  - `/api/v1/clients/{idClient}/services`
- Contratos:
  - `/api/v1/clients/{idClient}/contracts`

### Entidades principales

- `Clients`
- `ClientSites`
- `ClientContacts`
- `ServiceContracts`
- `Services`
- `ServiceConfigurations`
- `BusinessDocuments`

### Qué hace el módulo

Clientes administra el expediente comercial y operativo del cliente. No se limita a razón social; conecta la información fiscal/legal con sedes, contactos, contratos, servicios y documentación.

### Lógica implicada

- Controla unicidad por organización para código de cliente y RFC.
- Mantiene cliente comercial y razón social en el mismo expediente.
- Permite baja lógica mediante `Active`, evitando perder historial.
- Asocia sedes físicas donde se prestan servicios.
- Asocia contactos por propósito: administrativo, operativo, facturación, legal, emergencia, pagos, compras o seguridad interna.
- Permite que cada servicio quede ligado a una sede y opcionalmente a un contrato.

### Información tomada en cuenta

Del contrato se tomaron campos fiscales, datos de constitución, representante legal, RFC, razón social y domicilio fiscal. La intención es que el sistema pueda capturar lo suficiente para crear el expediente y después relacionarlo con contratos y servicios.

### Consideraciones UX/UI

El módulo debe permitir navegar desde cliente hacia sedes, servicios, contratos y documentos sin obligar al usuario a recordar IDs técnicos. Los textos visibles deben hablar de cliente, sede, contrato y servicio, no de entidades internas.

## 7. Contratos y servicios

### Rutas relacionadas

- Se gestionan dentro de `/clientes`.
- También se consultan desde solicitudes, planeación y operación.

### Backend

- `GET/POST/PUT/DELETE /api/v1/clients/{idClient}/services`
- `GET/POST/PUT/DELETE /api/v1/clients/{idClient}/services/{idService}/configurations`
- `GET/POST/PUT/DELETE /api/v1/clients/{idClient}/contracts`

### Entidades principales

- `ServiceContracts`
- `Services`
- `ServiceConfigurations`
- `ClientSites`

### Qué hace el módulo

Representa el servicio contratado: dónde opera, bajo qué contrato, desde cuándo, con qué configuración, cuántas personas requiere, horarios, preparación, precio y condiciones operativas.

### Lógica implicada

- Un cliente puede tener varios contratos.
- Un contrato puede respaldar uno o varios servicios.
- Un servicio se presta en una sede específica.
- La configuración se versiona por fechas de vigencia.
- No se debe sobreescribir la configuración histórica sin control; una nueva configuración debe reflejar desde cuándo aplica.
- La configuración alimenta planeación y operación:
  - personal requerido;
  - horas por día;
  - días por semana;
  - horas promedio mensuales;
  - días de preparación;
  - descripción de horario;
  - instrucciones específicas.

### Información tomada en cuenta

El Anexo 1 y la Carta Compromiso aportan la configuración operativa del servicio: personal requerido, horario, condiciones, preparación y datos que deben convertirse en parámetros administrables.

### Consideraciones de diseño

Se decidió separar `Service` de `ServiceConfiguration` para soportar cambios sin perder historia. Esto es clave porque en operación real un servicio puede cambiar de horario, cantidad de elementos o tarifa.

## 8. Personal

### Ruta frontend

- `/personal`

### Backend

- `GET /api/v1/employees`
- `GET /api/v1/employees/{idEmployee}`
- `POST /api/v1/employees`
- `PUT /api/v1/employees/{idEmployee}`
- `DELETE /api/v1/employees/{idEmployee}`
- Documentos:
  - `/api/v1/employees/{idEmployee}/documents`
- Evaluaciones:
  - `/api/v1/employees/{idEmployee}/evaluations`

### Entidades principales

- `Employees`
- `EmployeeDocuments`
- `EmployeeEvaluations`
- `EmployeeSkills`
- `ServiceAssignments`

### Qué hace el módulo

Personal administra el expediente laboral del empleado/guardia. Incluye datos generales, identificación, contacto, dirección, documentos, evaluaciones, habilidades y estatus.

### Estados del empleado

- `Candidate`: candidato.
- `Active`: activo.
- `OnLeave`: permiso/incapacidad.
- `Inactive`: inactivo.
- `Terminated`: baja.

### Lógica implicada

- Un empleado debe pertenecer a una organización.
- El código del empleado identifica al guardia dentro de la operación.
- El estatus controla si puede asignarse.
- Documentos y evaluaciones alimentan elegibilidad.
- Las asignaciones conectan empleados con servicio y posición.
- Se usa baja lógica para no perder el expediente histórico.

### Documentos de empleado considerados

La ficha técnica aportó papelería y controles como:

- Solicitud de empleo.
- Acta de nacimiento.
- INE.
- CURP.
- NSS.
- RFC.
- Constancia fiscal.
- Licencia.
- Comprobante de domicilio.
- Comprobante de estudios.
- Cartilla militar.
- Carta/no antecedentes.
- Otros.

### Evaluaciones consideradas

- Polígrafo.
- Estudio socioeconómico.
- Revisión de antecedentes.
- Antidoping.
- Otros.

### Consideraciones UX/UI

El usuario operativo no debería ver datos crudos ni enums técnicos. El front debe traducir estados, documentos y resultados a lenguaje de negocio. El expediente debe funcionar como ficha consultable, con señales de documentos vencidos o evaluaciones pendientes.

## 9. Documentos

### Ruta frontend

- `/documentos`

### Backend

- `GET /api/v1/documents`
- `GET /api/v1/documents/{idBusinessDocument}`
- `POST /api/v1/documents`
- `PUT /api/v1/documents/{idBusinessDocument}`
- `DELETE /api/v1/documents/{idBusinessDocument}`
- `POST /api/v1/documents/upload`
- `GET /api/v1/documents/{idBusinessDocument}/download`

### Entidades principales

- `BusinessDocuments`

### Qué hace el módulo

Documentos centraliza archivos y referencias documentales del negocio. A diferencia de los documentos propios del empleado, este módulo es transversal y puede ligar documentos a varios dueños.

### Dueños posibles

- Cliente.
- Contrato de servicio.
- Servicio.
- Empleado.
- Evaluación de empleado.
- Solicitud operativa.

### Estados documentales

- Pendiente de revisión.
- Validado.
- Rechazado.
- Vencido.
- Archivado.

### Lógica implicada

- Todo documento pertenece a una organización.
- Todo documento tiene tipo de dueño y `OwnerId`.
- Se valida que el dueño exista antes de crear el documento.
- Puede tener fecha de emisión y vencimiento.
- Calcula si está vencido.
- Marca si es sensible para aplicar reglas de privacidad.
- Guarda referencia de almacenamiento para descarga/consulta.

### Consideraciones UX/UI

El módulo debe evitar listas frías de archivos. El usuario necesita saber:

- de quién es el documento;
- qué categoría tiene;
- si está vigente;
- si requiere revisión;
- si es sensible;
- dónde descargarlo o consultarlo.

## 10. Catálogos y elegibilidad

### Ruta frontend

- `/catalogos`

### Backend

- `/api/v1/catalogs/items`
- `/api/v1/catalogs/eligibility-requirements`
- `/api/v1/catalogs/employees/{idEmployee}/skills`
- `/api/v1/catalogs/eligibility/check`

### Entidades principales

- `BusinessCatalogItems`
- `EligibilityRequirements`
- `EmployeeSkills`
- `EmployeeDocuments`
- `EmployeeEvaluations`
- `Employees`

### Qué hace el módulo

Catálogos administra conceptos configurables que no deben quedar quemados en el código. También concentra reglas para saber si un empleado puede asignarse a cierto cliente, servicio o posición.

### Catálogos actuales

- Habilidades.
- Puestos.
- Requisitos documentales.
- Requisitos de evaluación.
- Restricciones por cliente.
- Restricciones por servicio.
- Zonas.
- Motivos de incidencia.
- Motivos de cobertura.
- Motivos de cancelación.

### Lógica de elegibilidad

La elegibilidad evalúa si un empleado puede trabajar en un contexto específico. Considera:

- Estatus activo.
- Documentos vigentes.
- Documentos validados.
- Evaluaciones aprobadas.
- Habilidades requeridas.
- Reglas bloqueantes y no bloqueantes.
- Alcance de la regla:
  - organización;
  - cliente;
  - servicio;
  - posición.

El resultado no sólo dice sí/no; también devuelve razones para que operación entienda qué falta.

### Impacto en otros módulos

- Planeación: evita publicar turnos con personal no elegible.
- Asignaciones: evita asignar personal sin documentos, evaluaciones o habilidad requerida.
- Reportes: permite listar personal elegible/no elegible.
- Operación: ayuda a decidir coberturas.

### Consideraciones de diseño

La elegibilidad se modeló como motor configurable. Esto evita que cada cliente o servicio especial requiera cambiar código. Las reglas pueden crecer conforme Oscar/Joab definan condiciones reales.

## 11. Planeación

### Ruta frontend

- `/planeacion`

### Backend

Posiciones:

- `/api/v1/clients/{idClient}/services/{idService}/positions`

Patrones:

- `/api/v1/clients/{idClient}/services/{idService}/positions/{idPosition}/shift-patterns`

Segmentos:

- `/api/v1/clients/{idClient}/services/{idService}/positions/{idPosition}/shift-patterns/{idShiftPattern}/segments`

Versiones de planeación:

- `/api/v1/clients/{idClient}/services/{idService}/schedule-versions`
- `/publish`
- `/generate-from-patterns`

Turnos:

- `/api/v1/clients/{idClient}/services/{idService}/schedule-versions/{idScheduleVersion}/shifts`

### Entidades principales

- `Positions`
- `ShiftPatterns`
- `ShiftSegments`
- `ScheduleVersions`
- `ScheduledShifts`
- `ServiceAssignments`
- `EmployeeSkills`
- `EligibilityRequirements`

### Qué hace el módulo

Planeación define qué posiciones necesita un servicio, qué patrones de turnos aplican y qué turnos se publican para operación.

### Lógica implicada

1. Posiciones.
   - Cada servicio puede tener posiciones operativas.
   - Una posición define cantidad requerida y perfil/habilidad necesaria.

2. Patrones de turno.
   - Un patrón pertenece a una posición.
   - Define vigencia y estructura semanal.

3. Segmentos.
   - Cada segmento indica día, hora inicio, hora fin, si cruza medianoche y cantidad requerida.
   - Calcula duración en minutos.

4. Versiones de planeación.
   - Se crea una versión borrador por periodo.
   - Se generan turnos desde patrones.
   - Se publican versiones para operar.
   - Una versión publicada puede quedar reemplazada por una nueva (`Superseded`).

5. Turnos programados.
   - Cada turno liga versión, posición, empleado, fecha y horario.
   - Se validan fechas dentro del periodo.
   - Se detectan conflictos de empleado duplicado.
   - Se consideran huecos de cobertura antes de publicar.

### Estados de versión

- `Draft`: editable.
- `Published`: vigente para operación.
- `Superseded`: reemplazada por otra versión.

### Consideraciones UX/UI

Planeación necesita una vista visual más fuerte que una tabla simple. La base actual soporta:

- matriz por posición/día/empleado;
- vista semanal;
- comparación borrador vs publicado;
- señales visuales de conflicto;
- publicación con validación previa;
- generación automática desde patrones.

## 12. Asignaciones

### Ruta funcional

- Se usa desde clientes, servicios, personal y planeación.

### Backend

- `/api/v1/clients/{idClient}/services/{idService}/assignments`

### Entidades principales

- `ServiceAssignments`
- `Employees`
- `Services`
- `Positions`

### Qué hace el módulo

Conecta empleados con servicios y posiciones. Es la base para que planeación pueda generar turnos con personal real.

### Tipos de asignación

- Principal.
- Apoyo.
- Relevo.
- Reemplazo temporal.

### Lógica implicada

- Sólo permite empleados activos.
- Valida que el servicio pertenezca al cliente y organización.
- Valida posición cuando se especifica.
- Revisa elegibilidad antes de asignar.
- Evita solapes conflictivos de fechas.
- Permite marcar una asignación como principal.
- Usa baja lógica para conservar historial.

### Consideraciones de negocio

La asignación es distinta a asistencia. Una asignación dice “este empleado está planeado para este servicio”; asistencia dice “este empleado realmente asistió a este turno”.

## 13. Operación diaria

### Rutas frontend

- `/operacion/asistencia`
- `/operacion/incidencias`
- `/operacion/cobertura`

### Backend

Control general:

- `GET /api/v1/operations/approval-requests`
- `POST /api/v1/operations/approval-requests`
- `GET /api/v1/operations/day-closures`

Operación por servicio:

- `/api/v1/clients/{idClient}/services/{idService}/operations/attendance`
- `/api/v1/clients/{idClient}/services/{idService}/operations/incidents`
- `/api/v1/clients/{idClient}/services/{idService}/operations/coverages`
- `/api/v1/clients/{idClient}/services/{idService}/operations/evidences`
- `/api/v1/clients/{idClient}/services/{idService}/operations/day-closures`

Archivos operativos:

- `/api/v1/files/operation-evidence`
- `/api/v1/files/operation-evidence/download`

### Entidades principales

- `AttendanceRecords`
- `Incidents`
- `CoverageRecords`
- `OperationEvidences`
- `ApprovalRequests`
- `OperationDayClosures`
- `ScheduledShifts`
- `Employees`

### Qué hace el módulo

Operación registra lo que pasó en campo:

- asistencia real;
- retardos;
- faltas;
- incidencias;
- coberturas;
- evidencias;
- cierres diarios;
- autorizaciones para cambios sensibles.

### Asistencia

Estados:

- Esperada.
- Presente.
- Retardo.
- Falta.
- Justificada.

Lógica:

- La asistencia se liga a un turno programado.
- Puede guardar hora real de entrada y salida.
- Calcula o almacena minutos tarde.
- Permite notas.
- Una corrección puede requerir autorización.
- El registro conserva trazabilidad por usuario.

### Incidencias

Estados:

- Abierta.
- En revisión.
- Resuelta.
- Cancelada.

Severidad:

- Baja.
- Media.
- Alta.
- Crítica.

Lógica:

- Puede ligarse a turno y empleado, pero también puede ser de servicio.
- Incluye tipo/motivo, descripción y notas de resolución.
- Sirve para reportes y señales de riesgo.
- Su cierre puede pasar por autorización si es sensible.

### Cobertura

Estados:

- Solicitada.
- Confirmada.
- Completada.
- Cancelada.

Lógica:

- Liga turno original con empleado original y reemplazo.
- Registra horario cubierto, si cruza medianoche y duración.
- Puede venir de solicitud aprobada.
- Ayuda a calcular horas cubiertas.

### Evidencias

Tipos:

- Foto.
- Documento.
- Reporte.
- Firma.
- Otro.

Lógica:

- Puede ligarse a asistencia, incidencia o cobertura.
- Usa referencia de almacenamiento.
- Permite carga real y descarga.
- Sirve como soporte para autorizaciones y auditoría.

### Cierre diario

Lógica:

- Cierra la operación de un servicio en una fecha.
- Resume turnos esperados, asistencias, pendientes, incidencias abiertas y coberturas.
- Permite reabrir con razón.
- Ayuda a separar días operados de días aún abiertos.

### Consideraciones UX/UI

Este módulo debe sentirse como centro de control:

- pestañas claras de Asistencia, Incidencias y Cobertura;
- selección individual por submódulo, no todas activas a la vez;
- tablero diario con pendientes;
- acciones rápidas para confirmar asistencia;
- formularios compactos;
- señales claras cuando falta evidencia o autorización.

## 14. Autorizaciones

### Ruta funcional

- Dentro de operación y dashboard.

### Backend

- `/api/v1/operations/approval-requests`

### Entidades principales

- `ApprovalRequests`
- `OperationEvidences`

### Qué hace el módulo

Formaliza cambios sensibles. En lugar de permitir cambios directos con una nota informal, crea un flujo:

- solicitud de autorización;
- aprobador asignado;
- estado;
- comentarios;
- evidencia/documento ligado;
- aplicación del cambio sólo cuando corresponde.

### Tipos de autorización

- Corrección de asistencia.
- Cierre de incidencia.
- Corrección de cobertura.
- Cambio de configuración de servicio.
- Excepción documental.
- Otro.

### Estados

- Pendiente.
- Aprobada.
- Rechazada.
- Cancelada.

### Lógica implicada

- Se guarda entidad afectada (`EntityType`, `EntityId`).
- Se guarda motivo y resumen del cambio.
- Se puede asignar aprobador por nombre.
- Se liga evidencia si existe.
- Se registra quién decidió, cuándo y con qué notas.
- Debe usarse para proteger correcciones retroactivas o sensibles.

## 15. Reportes

### Ruta frontend

- `/reportes`

### Backend

- `GET /api/v1/reports/operations-summary`
- `GET /api/v1/reports/operations-by-service`
- `GET /api/v1/reports/workforce-eligibility`
- `GET /api/v1/reports/operations-export`
- `GET /api/v1/reports/operations-export.xlsx`
- `GET /api/v1/reports/operations-export.pdf`

### Qué hace el módulo

Reportes consolida información para operación y dirección.

### Reportes actuales

- Resumen de operación.
- Operación por servicio.
- Elegibilidad de personal.
- Exportación operativa.
- Exportación Excel.
- Exportación PDF.

### Métricas actuales

- Asistencias capturadas.
- Presentes.
- Retardos.
- Faltas.
- Justificadas.
- Incidencias.
- Incidencias abiertas.
- Incidencias críticas.
- Coberturas.
- Coberturas confirmadas.
- Coberturas completadas.
- Minutos cubiertos.
- Autorizaciones pendientes.
- Días cerrados.

### Lógica implicada

- Filtra por organización.
- Puede filtrar por cliente, servicio y periodo.
- Cruza datos de operación, planeación, servicio y personal.
- Exporta información para análisis externo.
- El reporte de elegibilidad ayuda a decidir si el personal puede asignarse o no.

### Consideraciones UX/UI

Reportes debe tener lenguaje ejecutivo y filtros claros:

- periodo;
- cliente;
- servicio;
- empleado;
- estado.

También debe evitar mostrar enums crudos; por ejemplo, mostrar “Crítica” y no `Critical`.

## 16. Auditoría

### Ruta frontend

- `/auditoria`

### Backend

- `GET /api/v1/audit/events`
- `GET /api/v1/audit/events/export`

### Qué hace el módulo

Auditoría permite consultar trazabilidad de altas, cambios y bajas. Es importante porque GestIA maneja operación crítica, documentos y cambios sensibles.

### Lógica implicada

- Busca eventos por entidad, usuario, periodo o texto.
- Expone historial consultable.
- Permite exportación.
- Se apoya en campos transversales:
  - `CreatedAt`
  - `CreatedBy`
  - `CreatedByName`
  - `UpdatedAt`
  - `UpdatedBy`
  - `UpdatedByName`
  - `Active`

### Consideraciones de negocio

La auditoría no debe verse como algo técnico. Para usuario final debe responder:

- quién cambió algo;
- cuándo lo cambió;
- qué entidad afectó;
- por qué se hizo;
- qué valor tenía antes y después, cuando aplique.

## 17. Organizaciones

### Backend

- `/api/v1/organizations`

### Entidad principal

- `Organizations`

### Qué hace el módulo

Organizaciones define el alcance multiempresa/multicliente interno. Aunque hoy se use una organización local, el modelo permite separar datos por organización.

### Lógica implicada

- Clientes, empleados, documentos, catálogos, solicitudes y seguridad se filtran por organización.
- El usuario puede tener membresías por organización.
- Los códigos visibles deben ser únicos dentro de su organización, no necesariamente globales.

## 18. Base de datos

### Nombre de base local

```text
db-gestia-dev
```

### Motor

SQL Server.

### Estándares aplicados

- Tablas en PascalCase plural.
- Columnas en PascalCase.
- PK con formato `IdEntidad`.
- FK con formato `IdEntidadRelacionada`.
- Códigos visibles con `CodeEntidad`.
- Booleanos con `Is`, `Has`, `Can` o `Active`.
- Fechas de negocio terminan en `Date`.
- Instantes UTC terminan en `At`.
- Textos humanos en `nvarchar`.
- Auditoría en entidades de negocio.
- Baja lógica mediante `Active` en entidades que lo requieren.
- Migraciones EF Core versionadas.

### Tablas principales actuales

- `Organizations`
- `Clients`
- `ClientSites`
- `ClientContacts`
- `ServiceContracts`
- `Services`
- `ServiceConfigurations`
- `Employees`
- `EmployeeDocuments`
- `EmployeeEvaluations`
- `ServiceAssignments`
- `Positions`
- `ShiftPatterns`
- `ShiftSegments`
- `ScheduleVersions`
- `ScheduledShifts`
- `AttendanceRecords`
- `Incidents`
- `CoverageRecords`
- `OperationEvidences`
- `ApprovalRequests`
- `OperationDayClosures`
- `OperationalRequests`
- `BusinessDocuments`
- `BusinessCatalogItems`
- `EligibilityRequirements`
- `EmployeeSkills`
- `Users`
- `OrganizationMemberships`
- `Roles`
- `Permissions`
- `RolePermissions`
- `UserRoles`
- `__EFMigrationsHistory`

### Migraciones relevantes

- `InitialBusinessModel`: modelo base de organización, clientes, servicios y personal.
- `JwtSecurityModel`: usuarios, roles, permisos y acceso JWT.
- `PlanningPositionsAndShifts`: posiciones, patrones y segmentos.
- `ServiceAssignmentsPosition`: asignaciones con posición.
- `ScheduleVersionsAndScheduledShifts`: versiones de planeación y turnos programados.
- `OperationsAttendanceIncidentsCoverages`: asistencia, incidencias y coberturas.
- `OperationalRequests`: solicitudes operativas.
- `OperationEvidences`: evidencias de operación.
- `BusinessDocuments`: documentos transversales.
- `BusinessCatalogsAndEligibility`: catálogos, habilidades y reglas de elegibilidad.
- `OperationControls`: controles operativos.
- `FormalApprovalWorkflow`: autorizaciones formales.

## 19. Frontend

### Módulos actuales

```text
frontend/src/app/features/
├─ auth
├─ overview
├─ clients
├─ requests
├─ workforce
├─ documents
├─ catalogs
├─ planning
├─ operations
├─ reports
├─ audit
└─ security
```

### Core/layout

El `AppShell` administra:

- sidebar;
- breadcrumb;
- título de página;
- usuario activo;
- salida de sesión;
- menú filtrado por permisos;
- layout responsivo.

### Diseño UX/UI aplicado

La línea visual busca:

- interfaz limpia, moderna y operativa;
- azul profundo como base institucional;
- cyan/acento para acciones principales;
- tarjetas claras con borde suave;
- sombras ligeras;
- microcopy de negocio;
- evitar textos técnicos visibles;
- botones con estados hover/focus;
- drawers laterales para edición o detalle;
- modales cortos sólo para capturas rápidas;
- formularios divididos por secciones cuando crecen.

## 20. Backend

### Capas

```text
GestIA.Domain
  Entidades, enums y reglas del dominio.

GestIA.Application
  Servicios de aplicación, contratos, validaciones y casos de uso.

GestIA.Infrastructure
  EF Core, SQL Server, repositorios, migraciones, seed y convenciones.

GestIA.Api
  Endpoints, JWT, permisos, errores, carga/descarga de archivos.
```

### Patrón usado

Cada módulo sigue una estructura similar:

- `Domain`: entidad del negocio.
- `Application`: contrato de request/response e interfaz de servicio.
- `Application`: servicio que valida y orquesta.
- `Infrastructure`: repositorio EF Core.
- `Api`: endpoint HTTP.
- `Frontend`: página y servicio API.

Esto evita que la UI hable directo con EF Core y permite cambiar reglas de negocio sin rehacer pantallas completas.

## 21. Pruebas

### Backend

Las pruebas del backend son con xUnit.

Carpetas:

- `backend/tests/GestIA.Domain.UnitTests`
- `backend/tests/GestIA.Application.UnitTests`
- `backend/tests/GestIA.IntegrationTests`

### Frontend

Las pruebas del frontend son con Vitest.

La expectativa para nuevos módulos es:

- pruebas unitarias de servicios y transformaciones;
- pruebas de guards/autenticación;
- pruebas de componentes críticos cuando tengan lógica;
- pruebas de aplicación para casos de negocio sensibles.

## 22. Qué debe cuidarse al seguir desarrollando

### No mostrar datos crudos

Los enums del backend no deben verse como texto técnico. El frontend debe traducir:

- `NewClient` -> “Alta de cliente”.
- `InReview` -> “En revisión”.
- `CoverageSupport` -> “Solicitud de cobertura”.
- `Critical` -> “Crítica”.
- `Superseded` -> “Reemplazada”.

### No romper trazabilidad

En módulos operativos no se debe borrar información histórica. Cuando algo ya participó en operación, se prefiere:

- baja lógica;
- reemplazo de versión;
- corrección autorizada;
- evidencia ligada;
- auditoría.

### No saltarse organización

Toda consulta o cambio de negocio debe filtrar por `IdOrganization`.

### No mezclar planeación con operación

Planeación define lo esperado. Operación registra lo ocurrido. Si se mezclan, se pierde control entre “lo programado” y “lo real”.

### No sobreescribir configuración histórica

Cambios de servicio deben crear nueva configuración con vigencia o pasar por solicitud/autorización.

### Validar elegibilidad antes de asignar

La asignación de personal debe revisar:

- estatus activo;
- documentos;
- evaluaciones;
- habilidades;
- restricciones;
- vigencias.

## 23. Pendientes funcionales recomendados

Aunque ya existe una base operativa amplia, todavía conviene reforzar:

1. Solicitudes.
   - Afinar campos obligatorios por tipo con Oscar/Joab.
   - Crear plantillas por tipo para que el usuario no llene campos irrelevantes.
   - Mostrar validación de impacto más clara antes de ejecutar.

2. Clientes y contratos.
   - Validación fiscal/RFC más formal.
   - Historial visible de cambios contractuales.
   - Mejor vista de relación razón social / cliente comercial / sedes.

3. Personal.
   - Alertas por vencimiento.
   - Privacidad más estricta para documentos sensibles.
   - Vista rápida de elegibilidad por servicio.

4. Planeación.
   - Drag/drop de turnos.
   - Calendario semanal más visual.
   - Comparación detallada entre versión publicada y borrador.
   - Validación visual antes de publicar.

5. Operación.
   - Centro de control diario más robusto.
   - Flujo más formal para correcciones autorizadas.
   - Descarga de evidencias desde UI en todos los casos.

6. Reportes.
   - Más gráficas ejecutivas.
   - Exportaciones con formato final de negocio.
   - Filtros persistentes por usuario.

7. UX/UI.
   - Pulir formularios largos por pasos.
   - Skeleton loaders.
   - Estados vacíos con llamada a la acción.
   - Mejor responsive en tablet/móvil.
   - Revisión módulo por módulo de textos, espaciados y botones.

## 24. Resumen ejecutivo

GestIA ya está estructurado como una plataforma modular para controlar clientes, servicios, personal, planeación y operación diaria. La base técnica está separada por capas, usa SQL Server, aplica estándares de nomenclatura, tiene JWT para el MVP y ya cuenta con módulos funcionales conectados a backend.

La lógica más importante del sistema es mantener trazabilidad:

- una solicitud justifica un alta o cambio;
- una configuración define cómo debe operar un servicio;
- una planeación define qué debería pasar;
- operación registra qué pasó realmente;
- documentos y evidencias respaldan decisiones;
- autorizaciones controlan correcciones sensibles;
- reportes consolidan la operación para seguimiento.

El siguiente crecimiento debe enfocarse en cerrar detalles de negocio real, mejorar validaciones por tipo de solicitud, robustecer la experiencia visual y evitar que el usuario vea estructuras técnicas internas.
