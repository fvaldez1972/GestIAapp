# Estándares de base de datos de GestIA

## Estado y alcance

Este documento es la norma obligatoria para todo objeto nuevo o modificado en las bases de datos de GestIA. Aplica a SQL Server, modelos de EF Core, migraciones, scripts, revisiones de código, datos de prueba y documentación técnica.

La nomenclatura define **cómo** se representan los conceptos. Los nombres funcionales concretos, sus relaciones y obligatoriedad seguirán evolucionando con el levantamiento del negocio.

Fuente aprobada: `estandares_nomenclaturas_bases_de_datos.md`, proporcionada por el equipo. Esta versión incorpora dos decisiones específicas de GestIA:

1. Los campos terminados en `At` se almacenan e interpretan en UTC. `CreatedAt` usa `SYSUTCDATETIME()`.
2. El texto humano se almacena como `nvarchar` para conservar correctamente nombres y contenido con acentos. Se puede usar `varchar` únicamente en códigos técnicos cuya naturaleza sea inequívocamente ASCII y esté documentada.

## Bases de datos y ambientes

Formato:

```text
db-{proyecto}-{ambiente}
```

| Ambiente | Nombre |
| --- | --- |
| Desarrollo local | `db-gestia-dev` |
| Pruebas automatizadas | `db-gestia-test` |
| Calidad | `db-gestia-qa` |
| Beta | `db-gestia-beta` |
| Preproducción | `db-gestia-staging` |
| Producción | `db-gestia` |

El nombre de la base es minúsculo, usa guiones y no contiene espacios, acentos ni caracteres especiales adicionales.

## Reglas de nomenclatura

| Objeto | Regla | Ejemplo |
| --- | --- | --- |
| Esquema | minúsculas, singular y descriptivo | `dbo`, `audit`, `config`, `report`, `archive` |
| Tabla | PascalCase, plural y descriptiva | `Users`, `ServiceRequests` |
| Columna | PascalCase y singular | `FirstName`, `StartDate` |
| Clave primaria | `Id{Entidad}` | `IdUser`, `IdServiceRequest` |
| Restricción PK | `PK_{Tabla}` | `PK_Users` |
| Clave alterna | `AK_{Tabla}_{Columnas}` | `AK_Users_ExternalCode` |
| Clave foránea | `Id{EntidadRelacionada}` | `IdRole`, `IdOrganization` |
| Restricción FK | `FK_{Origen}_{Destino}_{Columna}` | `FK_UserRoles_Users_IdUser` |
| Índice | `IX_{Tabla}_{Columnas}` | `IX_Users_Email` |
| Índice único | `UX_{Tabla}_{Columnas}` | `UX_Users_Email` |
| Restricción CHECK | `CK_{Tabla}_{Descripción}` | `CK_Assignments_DateRange` |
| Restricción DEFAULT | `DF_{Tabla}_{Columna}` | `DF_Users_Active` |
| Vista | `vw_{Nombre}` | `vw_ActiveUsers` |
| Procedimiento | `usp_{Acción}_{Entidad}` | `usp_Create_User` |
| Función escalar | `fn_{Nombre}` | `fn_NormalizeCode` |
| Función tabular | `ft_{Nombre}` | `ft_UserPermissions` |
| Trigger | `tr_{Tabla}_{Evento}` | `tr_Users_Update` |
| Secuencia | `seq_{Entidad}` | `seq_Invoice` |
| Tipo de usuario | `udt_{Nombre}` | `udt_Email` |
| Tipo tabla | `udtTbl_{Nombre}` | `udtTbl_UserIds` |

Los identificadores deben ser descriptivos, evitar abreviaturas ambiguas, palabras reservadas, espacios, acentos y prefijos técnicos innecesarios. Los objetos no pueden exceder los 128 caracteres permitidos por SQL Server.

## Columnas y significado

### Booleanos

Todo `bit` debe comenzar con `Is`, `Has` o `Can`, salvo el campo transversal exacto `Active`.

```text
IsPublished
HasEvidence
CanApprove
Active
```

### Fechas e instantes

- Un instante termina en `At`: `CreatedAt`, `PublishedAt`.
- Una fecha de negocio termina en `Date`: `StartDate`, `BirthDate`.
- No se agrega `Utc` al nombre físico. Todo instante `At` de GestIA es UTC por contrato.
- No se usa `datetime`; se usa `datetime2(0)` para instantes y `date` para fechas sin hora.

### Códigos

Los identificadores visibles del negocio usan `Code{Entidad}`, por ejemplo `CodeEmployee` o `CodeService`. Un código no sustituye a una clave primaria y debe tener longitud explícita.

### Auditoría

Las entidades auditables incluyen:

| Columna | Tipo | Nulo | Regla |
| --- | --- | --- | --- |
| `CreatedAt` | `datetime2(0)` | No | UTC, default `SYSUTCDATETIME()` |
| `CreatedBy` | `uniqueidentifier` | No | Identificador del actor |
| `CreatedByName` | `nvarchar(100)` | No | Nombre capturado para trazabilidad |
| `UpdatedAt` | `datetime2(0)` | Sí | UTC |
| `UpdatedBy` | `uniqueidentifier` | Sí | Identificador del último actor |
| `UpdatedByName` | `nvarchar(100)` | Sí | Nombre capturado para trazabilidad |

La auditoría funcional de cambios relevantes conserva además valor anterior, valor nuevo, motivo y origen. Los campos transversales no reemplazan ese historial.

### Borrado lógico

Las entidades que admitan desactivación usan:

```sql
[Active] bit NOT NULL
    CONSTRAINT [DF_Users_Active] DEFAULT (1)
```

EF Core aplica un filtro global a las entidades que implementan `IActivatableEntity`. Los registros operativos e históricos no se eliminan ni se desactivan automáticamente: su ciclo de vida debe definirse explícitamente.

## Tipos de datos

| Información | Tipo preferido |
| --- | --- |
| Identificador técnico | `uniqueidentifier` |
| Texto humano | `nvarchar(n)` con longitud explícita |
| Texto técnico ASCII | `varchar(n)` sólo con justificación |
| Texto amplio | `nvarchar(max)` sólo con justificación |
| Fecha de negocio | `date` |
| Instante UTC | `datetime2(0)` |
| Importe | `decimal(19,4)` salvo precisión aprobada por caso |
| Horas o duración | `decimal(9,4)` o intervalo modelado |
| Indicador lógico | `bit` |
| Concurrencia | `rowversion` |
| JSON | `nvarchar(max)` con validación y caso de uso documentado |

No se usan `float` o `real` para importes, `ntext`/`text`/`image`, fechas como texto ni longitudes máximas por comodidad. La precisión y la longitud deben reflejar el dominio.

## Nulos, relaciones e integridad

- Una columna es `NOT NULL` cuando el dato es requerido por el negocio.
- La nulabilidad no se usa para esconder estados incompletos; esos estados se modelan.
- Toda FK tiene índice cuando participa en búsquedas, uniones o validación de integridad.
- Las relaciones y reglas de eliminación se declaran explícitamente.
- No se usa eliminación en cascada sobre datos operativos o auditables sin una decisión revisada.
- Las restricciones `UNIQUE` y `CHECK` protegen invariantes que SQL Server puede garantizar.
- Los índices únicos consideran el alcance de negocio, por ejemplo organización más código.

## Esquemas

El esquema predeterminado es `dbo`. Sólo se crea un esquema adicional cuando agrupa una responsabilidad clara:

| Esquema | Responsabilidad |
| --- | --- |
| `dbo` | Datos transaccionales principales |
| `audit` | Auditoría y trazabilidad técnica |
| `config` | Configuración y catálogos administrables |
| `report` | Vistas y proyecciones reconstruibles |
| `archive` | Archivo sometido a una política de retención |

No se crea un esquema por cada carpeta o capa de código. Cualquier esquema nuevo requiere una decisión de arquitectura.

## EF Core y migraciones

Cada entidad física debe configurar al menos:

- `ToTable` con tabla plural PascalCase y esquema minúsculo.
- `HasKey` con propiedad `Id{Entidad}`.
- Longitud, precisión, nulabilidad y conversión de cada propiedad relevante.
- Relaciones y comportamiento de eliminación.
- Índices y unicidad derivados de casos de consulta e invariantes.

`GestIaDatabaseStandards.ApplyGestIaDatabaseStandards()` valida el modelo y asigna los nombres de PK, AK, FK, índices y restricciones default. Las interfaces `IAuditableEntity` e `IActivatableEntity` activan la configuración transversal correspondiente.

Las migraciones cumplen estas reglas:

1. Una migración representa un cambio coherente y revisable.
2. Su nombre describe la intención, por ejemplo `AddServiceRequests`.
3. Se revisa el SQL generado antes de aplicarlo fuera de desarrollo.
4. Todo cambio destructivo incluye estrategia de migración, respaldo o compatibilidad.
5. La aplicación no ejecuta migraciones productivas de forma improvisada al arrancar.
6. Los scripts manuales son idempotentes cuando sea posible y quedan versionados.
7. Un cambio de nomenclatura se hace mediante migración; nunca editando directamente producción.

## Seguridad y rendimiento

- La aplicación usa una cuenta sin privilegios de administración y con acceso mínimo necesario.
- Secretos y cadenas de conexión no se guardan en Git.
- Toda consulta multiempresa incluye el identificador de alcance autorizado desde el servidor.
- Se parametrizan consultas y comandos.
- Los datos sensibles se minimizan, clasifican y protegen según su riesgo.
- Cada índice responde a una consulta o invariante identificable; no se crean índices “por si acaso”.
- Se revisan planes, cardinalidad, filtros y columnas incluidas para consultas críticas.
- Las vistas y proyecciones de reporte no se convierten en fuente transaccional.

## Revisión antes de fusionar

### Modelo

- [ ] Tabla plural PascalCase y esquema minúsculo explícitos.
- [ ] PK `Id{Entidad}` y FK `Id{EntidadRelacionada}`.
- [ ] Booleanos con `Is`, `Has`, `Can` o `Active`.
- [ ] Instantes `At`, fechas de negocio `Date` y códigos `Code{Entidad}`.
- [ ] Tipos, longitudes, precisión y nulabilidad justificadas.
- [ ] Auditoría y ciclo de vida definidos.
- [ ] Integridad, unicidad y eliminación revisadas.

### Migración

- [ ] Nombre descriptivo y alcance único.
- [ ] SQL generado revisado para SQL Server.
- [ ] Nombres de PK, FK, IX/UX, CK y DF cumplen el estándar.
- [ ] Estrategia de reversión o compatibilidad documentada.
- [ ] Pruebas del modelo y del caso de uso actualizadas.
- [ ] Diccionario o documento de arquitectura actualizado.

## Excepciones

Una excepción debe quedar documentada en un ADR antes de incorporarse. Debe indicar la regla afectada, la razón técnica o funcional, el alcance y el plan para evitar que la excepción se propague sin control.
