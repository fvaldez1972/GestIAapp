# GestIA — estado actual

**Corte del 16 de septiembre de 2026.** Sólo lectura: no se modificó código, esquema ni
contenedores. Todo lo que sigue se leyó del árbol de trabajo, de la base viva y de una corrida
real de las dos suites de prueba. Donde no pude comprobar algo, lo digo.

Referencia del corte: rama `s0/feature/gestIaProject/filtro-organizacion`, punta `fcd4ed9`.

---

## 1. Qué cambió desde `GESTIA-ARQUITECTURA-MODULOS-Y-ROLES.md`

Ese documento es del **7 de septiembre a las 10:28** (commit `b5781af`). Desde entonces entraron
**43 commits** en cinco jornadas: los veinte defectos del recorrido (7 sep), la tanda de Clientes,
Personal, Seguridad y Auditoría (8 sep), dieciocho arreglos del recorrido del portal (10 sep), la
pantalla de Organizaciones (11 sep) y el retiro de la configuración del servicio (12 sep).

### Lo que ya no es cierto

| Sección | Lo que dice | Lo que es hoy | Por qué cambió |
|---|---|---|---|
| Encabezado | `db-gestia-dev` con **27 migraciones**, la última `RetireUnreadCatalogsAndGroupSynonyms` | **31 migraciones**, la última `20260912071302_RetireServiceConfiguration` | Cuatro migraciones nuevas: nombre normalizado de sedes (8 sep), dos configuraciones el mismo día (10 sep), precio en el puesto y retiro de la configuración (12 sep) |
| Encabezado | **373** pruebas de backend, **626** de frontend | **386** de backend, **720** de frontend | Cada tanda trajo sus pruebas |
| §3.5 Stack | «Docker Compose, **un solo stack**» | **Dos stacks**: `gestia` (4200 / 8080 / 1433, sirve el dominio) y `gestia-local` (4400 / 8081 / 1434, con `db-gestia-local`) | El stack local se creó el 7 de septiembre a las 21:37, once horas después de escribirse el documento |
| §5.3 Servicios | «vigencia, **precio**, posiciones, patrones de turno y sus segmentos» | El precio **ya no está en el servicio**: vive en cada puesto (`Position.MonthlyPrice`, con moneda e IVA incluido). La entidad `ServiceConfiguration` se retiró | Migración `RetireServiceConfiguration` del 12 sep: en seguridad privada se cotiza por puesto, no por servicio |
| §6.2 Filas de catálogo | Puestos 14 · Habilidades 11 · Incidencia 25 · Cobertura 30 · Nacionalidades 5 · Geografía 5 + 162 + 12 392 | Puestos **29** · Habilidades **20** · Incidencia **28** · Cobertura **32** · Nacionalidades **9** · Geografía **8 + 258 + 19 826** | Ocho organizaciones ahora, cada una con su copia de la geografía |
| §8 Lo que no hace | «Cada organización carga su propia copia de las mismas **12 559** filas de geografía» | **20 092** filas | El problema no se movió: creció |
| §9.5 Entidades con alcance | «El `CLAUDE.md` dice 29; son **32**» | Son **28**, y lo afirma una prueba que pasa: `OrganizationFilterModelTests` línea 109, `Assert.Equal(28, …)` | El 32 del documento también estaba mal. `ServiceConfiguration` bajó una el 12 sep. **Y quedan dos comentarios en el código que siguen diciendo 29**, en `OrganizationIsolationTests` |

### Lo que sigue siendo cierto, comprobado

| Sección | Estado |
|---|---|
| §2 Los ocho principios y sus consecuencias | vigente |
| §3.2 Aislamiento por filtro global que falla cerrado | vigente |
| §3.3 Bitácora funcional | vigente |
| §4.1 y §4.2 Los **23 permisos** y los cinco roles | vigente: 23 constantes en `SecurityPermissions.cs` |
| §6.1 Lo que cambió en catálogos el 7 de septiembre | vigente |
| §6.3 Los cuatro tipos de regla de elegibilidad | vigente: `Skill`, `Document`, `Evaluation`, `Restriction` |
| §9.1 La trampa de las habilidades | vigente, y con matices nuevos — ver la sección 6 de este corte |
| §9.3 Incidencia guarda el motivo por texto y cobertura por identificador | vigente |
| §9.4 Tres pantallas con ruta y sin entrada de menú | vigente: `/documentos`, `/operacion/:section` y `/plataforma/clientes-gestia` siguen sin enlace |
| §10 Las seis reglas de operación | vigentes |

---

## 2. Los números de hoy

### Esquema

| Base | Migraciones aplicadas | Hasta |
|---|---|---|
| `db-gestia-dev` (sirve `dev.gestia-demo.com`) | **31** | `20260912071302_RetireServiceConfiguration` |
| `db-gestia-local` (stack de pruebas) | **31** | la misma |

En el repositorio hay 31 archivos de migración, así que **código y las dos bases están
alineados**. Consultado directo contra `__EFMigrationsHistory`, no deducido.

### Pruebas, corridas hoy

| Suite | Total | Pasan | Se saltan | Fallan |
|---|---|---|---|---|
| `GestIA.Domain.UnitTests` | 53 | 53 | 0 | 0 |
| `GestIA.Application.UnitTests` | 78 | 78 | 0 | 0 |
| `GestIA.Architecture.Tests` | 52 | 52 | 0 | 0 |
| `GestIA.IntegrationTests` | 203 | 86 | **117** | 0 |
| **Backend** | **386** | **269** | **117** | **0** |
| **Frontend** (Vitest, 75 archivos) | **720** | **720** | 0 | **0** |

Compilación con **cero advertencias**, que en este repositorio es obligatorio porque una
advertencia rompe el build.

**Las 117 saltadas no son un defecto, pero importan:** llevan `[OperationalSqlFact]` y necesitan un
SQL Server con permiso de `CREATE DATABASE`. Sin la variable `GESTIA_OPERATIONAL_TEST_SQLSERVER` se
saltan en silencio, y ahí está el aislamiento entre organizaciones, los tokens de concurrencia, el
sembrador y las tres búsquedas. Para correrlas: `backend/pruebas-integracion.sh`, que levanta un SQL
efímero en el puerto 1435 y lo desecha.

### Rama y último commit

| | |
|---|---|
| Rama | `s0/feature/gestIaProject/filtro-organizacion` |
| Último commit | `fcd4ed9` · 2026-09-12 06:57:18 -0600 · «Configuracion en modulosws» |
| Contra su remoto | al día, 0 adelante / 0 atrás |
| Contra `origin/…/v0`, que es `origin/HEAD` | **67 commits por delante**, 2 por detrás |

Lo segundo conviene no perderlo de vista: `v0` recibió su último merge de esta rama el **6 de
septiembre** (PR #6). Los nueve días siguientes de trabajo —y lo que sirve el dominio— viven sólo en
la rama de feature.

### Datos vivos en `db-gestia-dev`

| Tabla | Filas |
|---|---|
| Organizaciones | 8 |
| Clientes | 43 |
| Servicios | 64 |
| Posiciones | 64 |
| Empleados | 268 |
| Patrones de turno | 54 |
| Segmentos de turno | 257 |
| Habilidades de empleado | 478 |
| Reglas de elegibilidad | 15 |
| Eventos operativos | 3 |

---

## 3. Pantallas rehechas y pantallas con cuerpo viejo

El criterio no es una opinión: una pantalla está **rehecha** si entra en la lista que vigila
`frontend/src/app/shared/ui/design-system.spec.ts`, que prohíbe hex a mano, tamaños fuera de la
escala de siete y `<select>` nativos. Esa lista crece con cada pantalla que se rehace.

### Rehechas — siete

| Pantalla | Ruta | Líneas TS | `<select>` | Hex a mano |
|---|---|---|---|---|
| Inicio | `/` | 216 | 0 | 0 |
| Clientes | `/clientes` | 1 069 | 0 | 0 |
| Personal | `/personal` | 788 | 0 | 0 |
| Planeación | `/planeacion` | 886 | 0 | 0 |
| Asistencia | `/operacion/asistencia` | 457 | 0 | 0 |
| Incidencias / Cobertura | `/operacion/incidencias`, `/operacion/cobertura` | 749 | 0 | 0 |
| **Catálogos** | `/catalogos` | 1 054 | 0 | 0 |

**Catálogos es la que se sumó** desde el mapa del 6 de septiembre: entonces tenía 19 `<select>`
nativos y 134 colores a mano; hoy tiene cero de los dos.

### Con cuerpo viejo — nueve

No son defectos. Es lo que se ve distinto y todavía no se ha convertido.

| Pantalla | Ruta | Líneas TS | `<select>` | Hex a mano |
|---|---|---|---|---|
| **Operación (vieja)** | `/operacion/:section` | **2 257** | 15 | 130 |
| **Servicios** | `/servicios` | **1 796** | 6 | 29 |
| **Solicitudes** | `/solicitudes` | 1 574 | 17 | 178 |
| **Documentos** | `/documentos` | 1 216 | 8 | 112 |
| **Seguridad** | `/seguridad`, `/usuarios` | 1 024 | 6 | 97 |
| Reportes | `/reportes` | 670 | 2 | 93 |
| Auditoría | `/auditoria` | 620 | 4 | 61 |
| Plataforma | `/plataforma/organizaciones` | 496 | 0 | 23 |
| Login | `/login` | 50 | 0 | 27 |

Dos notas:

- **Servicios es la más grande de las que se van a tocar pronto**, y sigue con cuerpo viejo: cuatro
  pestañas en una sola página de 1 796 líneas. Es donde vive el alta de posición.
- **Plataforma tiene cero `<select>` nativos** desde la tanda del 11 de septiembre, pero conserva 23
  colores a mano, así que todavía no entra a la lista vigilada.

### Fuera del menú

Siete rutas existen y no se alcanzan desde la navegación: `/documentos`, `/operacion/:section` y
`/plataforma/clientes-gestia` **no tienen entrada**; Solicitudes, Monitor, Reportes y Reglas
documentales la tienen marcada `phase: 2` y por eso no se dibuja.

---

## 4. Los 20 defectos del recorrido

**Los veinte están cerrados.** Verificado en el código, uno por uno, no por el mensaje del commit.

Primero la aritmética del propio plan, que conviene recordar: los **20 reportados** eran **18
numerados** —el 3 y el 4 son un defecto contado dos veces, igual que el 5 y el 7— con **14 causas
distintas**.

| # | Defecto | Cerrado con | Comprobación de hoy |
|---|---|---|---|
| 1 | Cerraba sesión sin preguntar | `5f91d2e` | `askLogout()` abre `gi-confirm-dialog`; sólo `confirm` cierra la sesión |
| 2 | «Datos inválidos» sin decir cuál | `d819443` | extractor compartido en `shared/util/server-problem.ts` |
| 3 + 4 | El indicador decía un destino y llevaba a otro | `700fd32` | la ruta la manda el servidor |
| 5 + 7 | El botón de nuevo servicio nacía muerto | `22991c9` | la guarda `hasActiveSite()` se quitó y la pantalla explica qué falta |
| 6 | La acción del estado vacío cambiaba con el filtro | `22991c9` | **conviven las dos**, como se propuso: «Nuevo servicio» de primaria y «Quitar filtros» de secundaria cuando el vacío viene de un filtro |
| 8 | «Agregar contacto» no hacía nada | `328526a`, `c8380a5` | `app-client-contacts` con `(create)`, `(edit)`, `(closeAdd)` y `[openAdd]` atados |
| 9 | El menú de acciones quedaba recortado | `34f095e` | `gi-row-actions` con `position: fixed`, y el motivo escrito en el código |
| 10 | El campo de archivo en inglés | `08a207c` | pieza propia `shared/ui/gi-file-input` |
| 11 | El desplegable del alta al vuelo no cerraba | `0acb7d9` | `gi-catalog-picker` ya tiene `(focusout)`, como `gi-select` |
| 12 | El mismo ejemplo en los cuatro catálogos | `0acb7d9` | el ejemplo sale de la ficha: `[placeholder]="openCatalog()?.example ?? ''"` |
| 13 | La hora seis horas corrida en toda la aplicación | `16cae67` | `UtcInstantConverter` en Infrastructure, con `UtcInstantTests` detrás |
| 14 | Estado y Municipio vacíos al crear cliente | `c8380a5` | `[organizationId]` atado en los cuatro sitios |
| 15 | Sedes duplicadas sin control | `d1a8b70`, `5c18b13`, `d7b2d8a` | migración `AddClientSiteNormalizedName` con índice único, y las cuatro duplicadas ya resueltas |
| 16 | La columna USO mentía siempre | `c8380a5` | `Map()` pasa `employee.IdJobPositionCatalogItem`, y el contrato de respuesta **ya no tiene valor por defecto**, que era la prevención propuesta |
| 17 | «NULL» escrito en pantalla | `0acb7d9` | no queda ningún literal `NULL` en el código |
| 18 | El parpadeo al abrir un empleado | `12718c1`, `6a5addf` | cubierto también al reabrir a alguien ya cargado, que era la mitad que faltaba |

### Lo que pasó después, y no estaba en el plan

- **El mismo 7 de septiembre a las 20:55**, `6a5addf` cerró **cuatro defectos introducidos al
  arreglar los veinte** —el puesto del contacto validado contra catálogo, el error real que no
  llegaba, un error de guardado que borraba la lista entera, y Servicios afirmando que el cliente no
  tenía sedes cuando simplemente no se habían cargado— más los dos arreglos a medias.
- **El 8 de septiembre** se validaron trece defectos de cuatro documentos: los trece confirmados
  corregidos, y **cuatro más encontrados al validar**, tres de ellos invisibles leyendo el código.
- **El 10 de septiembre**, dieciocho arreglos del recorrido del portal.
- Los **dos hallazgos que ese recorrido dejó abiertos ya están cerrados**: el resumen de Auditoría
  ahora rotula «en esta página, no en toda la consulta», y el botón que decía «Registrar incidencia»
  y abría la corrección ahora dice «Corregir la asistencia».

Sin cerrar del recorrido del 10 de septiembre quedan **tres verificaciones**, no tres defectos:
guardar una incidencia de punta a punta, Cobertura, y publicar una semana en Planeación.

---

## 5. Qué hay sin commitear

Dos archivos, ninguno de código:

```text
?? docs/manual-rapido-admin-organizacion.pdf               128 KB   12 sep 07:00
?? docs/manual-rapido-admin-organizacion-con-capturas.pdf   1.2 MB  12 sep 07:52
```

Son los manuales generados después del último commit, que fue a las 06:57 del mismo día. El resto
del árbol está limpio: **cero archivos modificados**, cero en el índice.

A este corte se suma este propio documento, `docs/ESTADO-ACTUAL.md`, también sin commitear.

---

## 6. Los pendientes de la lista acordada

La lista es `docs/design/pendientes/ORDEN-DE-LO-QUE-SIGUE.md`, fijada el 7 de septiembre.
**Ninguno de los cuatro se hizo.** Los cuatro siguen vivos, y en el mismo orden.

### 1. La pestaña de habilidades en el expediente — sigue abierta

Los cuatro métodos del cliente Angular existen en
`features/catalogs/data-access/catalog-api.service.ts` —`listEmployeeSkills`,
`createEmployeeSkill`, `updateEmployeeSkill`, `deactivateEmployeeSkill`— y **no hay una sola llamada
a ninguno** desde ninguna pantalla. El API del backend está completo.

Dos datos nuevos que cambian cómo leerla, y los dos salen de la base viva:

- **Hay 478 habilidades de empleado registradas**, pero ninguna se capturó desde el portal: las puso
  el sembrador demo. Dos organizaciones concentran 472 de las 478.
- **Hoy no hay ni una regla de habilidad obligatoria activa** en las ocho organizaciones. O sea: **la
  trampa está armada y nadie la ha pisado todavía.** El día que alguien cree una regla obligatoria de
  habilidad, se bloquea la publicación sin forma de desbloquearla, y hay tres organizaciones con
  empleados y cero habilidades donde eso pasaría de inmediato.

Sigue siendo el punto 1 de la lista, y sigue sin necesitar cambio de esquema.

### 2. La geografía — sigue abierta

No existe `GeoPlace` en el código: **ni la entidad, ni la tabla, ni la migración.** La geografía
sigue siendo `BusinessCatalogItem` por organización, y el costo creció: de las 12 559 filas que
citaba el documento de arquitectura a **20 092** hoy (8 países, 258 estados, 19 826 ciudades), porque
cada organización nueva carga su copia.

Las tres decisiones siguen tomadas y sin ejecutar: tabla compartida sin organización, colonias como
recurso incrustado, y el índice único por clave del INEGI y no por nombre.

### 3. `Incident.IncidentType` por identificador — sigue abierta

`Incident.IncidentType` sigue siendo `string` y se guarda con `Trim()`. La cobertura sigue guardando
`IdCoverageReason`. Las dos hacen lo mismo y no se parecen: renombrar un motivo de incidencia no
cambia las incidencias ya registradas, y nada avisa.

### 4. Los nueve códigos de negocio — sigue abierta

Los nueve están intactos: `CodeClient`, `CodeClientSite`, `CodeEmployee`, `CodeOperationalRequest`,
`CodeOrganization`, `CodePosition`, `CodeService`, `CodeServiceContract` y `CodeShiftPattern`. Hay
once `Code*` en el dominio; `CodePermission` y `CodeRole` son de seguridad y no entran en la
discusión.

El décimo, `BusinessCatalogItem.Code`, es el que sí se retiró, y fue el 7 de septiembre.

### Lo que sí se hizo en su lugar

Entre el 8 y el 12 de septiembre el trabajo fue a otro sitio, y vale decirlo para que no parezca
tiempo perdido: dos tandas completas de defectos con verificación en el navegador, la pantalla de
Organizaciones rehecha, y el **retiro de la configuración del servicio** con el precio mudado al
puesto. Esa última no estaba en la lista de pendientes.

---

## 7. Lo que no pude comprobar en este corte

- **No abrí el navegador.** Las cifras de pantallas salen de medir los archivos; el estado funcional
  de cada una sale de los documentos de recorrido del 8 y del 10 de septiembre.
- **Las tres verificaciones que el recorrido del 10 dejó pendientes** siguen pendientes: guardar una
  incidencia de punta a punta, Cobertura, y publicar una semana.
- **No corrí las 117 pruebas que necesitan SQL.** Habría que lanzar
  `backend/pruebas-integracion.sh`, que levanta su propio motor efímero. Las 269 restantes pasan.
