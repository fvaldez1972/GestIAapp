# Retiro del camino de configuración de Inicio — 6 de septiembre de 2026

**Estado: EJECUTADO.** La comprobación previa —secciones 1 y 2— se hizo antes de tocar nada y
encontró justamente el escenario que había que avisar. Con eso a la vista se decidió retirar el
camino de todas formas y corregir la consecuencia; la sección 3 recoge lo que se decidió y lo que
quedó en su lugar.

El criterio, en las palabras con que se dio:

> Inicio es el tablero del admin de la organización. Si todavía no hay información, que se vea sin
> información — no que se convierta en otra pantalla mientras tanto. Una pantalla que cambia de
> propósito según cuántos datos haya son dos pantallas con un nombre.

---

## 1. Qué ve una organización recién creada si el camino se va

Sin clientes, sin servicios, sin empleados y sin catálogos, el servidor sigue devolviendo los
cuatro indicadores. Los devuelve **siempre** que el actor tenga permiso de lectura del módulo;
lo único que cambia con los datos es su `state`, y con una organización vacía los cuatro salen
en `Pending` (`OverviewService.BuildMetrics`):

| Indicador | Por qué queda pendiente | Lo que se pinta |
|---|---|---|
| `TURNOS PLANEADOS · SEMANA` | `WeekHasPublishedPlan == false` | `—` · «Sin planeación publicada» · botón *Ir a Planeación* |
| `POSICIONES SIN TITULAR` | `Positions == 0` | `—` · «Sin posiciones definidas» · botón *Definir posiciones* |
| `TURNOS SIN CUBRIR · AYER` | `PreviousDayHasPublishedPlan == false` | `—` · «Sin planeación de ayer» · botón *Ir a Planeación* |
| `EMPLEADOS CON DOCUMENTOS VENCIDOS` | `ActiveEmployees == 0` | `—` · «Sin empleados dados de alta» · botón *Ir a Personal* |

Encima de las cuatro tarjetas, `OverviewMetrics.note()` escribe, palabra por palabra:

> **Ninguno tiene información todavía. Cada uno dice qué falta para tenerla.**

Y debajo, la lista de atención. Sus cinco filas se agregan sólo con `count > 0`
(`BuildAttention`), así que en una organización vacía la lista llega vacía y `AttentionList`
pintaba su texto de «todo en orden»:

> **Nada pendiente hoy.** Cuando algo deje un turno al descubierto, aparecerá aquí con su conteo
> y con el módulo donde se resuelve.

### La respuesta corta

**Sí: queda exactamente el tablero de cuatro indicadores en «sin datos aún».** Es lo que evitaba
`OverviewPage.showsDashboard()`, que con `setupDensity(…) === 'full'` —o sea, con dos pasos hechos
o menos— no dibujaba el tablero ni la lista. Retirar el camino sin retirar ese gate lo dejaba sin
sentido; retirar los dos dejaba la pantalla en cuatro guiones.

Y un agravante que no estaba en la pregunta: la lista de atención no quedaba neutra, quedaba
**falsamente tranquilizadora**. «Nada pendiente hoy» es cierto como lectura del dato —no hay nada
que atender porque no hay nada— y falso como mensaje: en una organización recién creada está todo
pendiente. Esa frase no se veía nunca en ese momento, precisamente porque la lista no se dibujaba.

---

## 2. Qué se perdió

### 2.1 Los siete pasos, con sus dependencias

Estaban definidos en `OverviewService.BuildSetup`. El orden era el de la enumeración
`OverviewSetupStepKey`; «hecho» es la condición exacta con la que el servidor lo cerraba.

| # | Paso | Título en pantalla | Se daba por hecho cuando | Dependía de |
|---|---|---|---|---|
| 1 | `Catalogs` | Catálogos mínimos | los **cinco** a la vez: puestos, habilidades, zonas, motivos de incidencia y motivos de cobertura, todos con al menos uno | **nada** — el único paso sin prerrequisito |
| 2 | `Clients` | Primer cliente con sede y contacto | `ClientSites > 0` | nada |
| 3 | `Services` | Servicio con su configuración | `ServicesWithConfiguration > 0` | `Clients` |
| 4 | `Positions` | Posiciones con turno y descanso | `PositionsWithPattern > 0` | `Services` |
| 5 | `Employees` | Empleados con expediente mínimo | `EmployeesWithFile > 0` | `Catalogs` |
| 6 | `Assignments` | Titulares y cubre-descansos asignados | `PrimaryAssignments > 0` | `Positions` **y** `Employees` |
| 7 | `Planning` | Planeación de la semana publicada | `WeekHasPublishedPlan` | `Assignments` |

Dos cosas de esa tabla no son evidentes y se fueron con ella:

- **`Employees` no dependía de `Services`.** Se puede dar de alta personal en cuanto existan los
  puestos del paso 1, sin esperar a que haya un cliente. El camino lo decía con todas sus letras
  cuando `counts.jobPositions > 0`: *«El catálogo de puestos ya está listo, así que puedes
  empezar cuando quieras.»* Sin el camino, el orden numérico sugiere lo contrario.
- **`Assignments` era el único paso con dos bloqueos.** `setupStepBlockedBy` los redactaba juntos:
  *«Antes hace falta «Posiciones con turno y descanso» y «Empleados con expediente mínimo».»*

También se perdió el paso 1 como **único lector de los conteos de catálogos** (`jobPositions`,
`skills`, `zones`, `incidentReasons`, `coverageReasons`). Eso toca la tanda de catálogos aprobada;
la enmienda quedó escrita en `docs/design/pendientes/CATALOGOS-TANDA-PENDIENTE.md`.

### 2.2 Las transiciones a cada módulo

Cada paso llevaba una ruta, que el servidor ponía en `null` si el actor no tenía el permiso
(`Allowed(permission) ? route : null`). La etiqueta la escribía `setupStepAction`: un paso hecho
decía **Revisar**; uno pendiente decía el destino.

| # | Paso | Ruta | Permiso que la habilitaba | Etiqueta pendiente |
|---|---|---|---|---|
| 1 | `Catalogs` | `/catalogos` | `CatalogsRead` | Ir a Catálogos |
| 2 | `Clients` | `/clientes` | `ClientsRead` | Ir a Clientes |
| 3 | `Services` | `/servicios` | `ClientsRead` | Ir a Servicios |
| 4 | `Positions` | `/servicios` | `PlanningRead` | Ir a Servicios |
| 5 | `Employees` | `/personal` | `WorkforceRead` | Ir a Personal |
| 6 | `Assignments` | `/servicios` | `PlanningRead` | Ir a Servicios |
| 7 | `Planning` | `/planeacion` | `PlanningRead` | Ir a Planeación |

Tres de los siete apuntaban a `/servicios` con propósitos distintos —crear el servicio, definir
sus posiciones, asignar titulares—, y el texto del paso era lo único que distinguía a cuál de las
tres cosas se iba. Sin el camino, `/servicios` queda como una sola puerta sin indicación de qué
hacer al entrar.

### 2.3 Lo demás que se fue con el bloque

- **Las tres proporciones**, que eran una estructura y no tres pantallas: `full` (0-2 pasos, el
  camino ocupaba el cuerpo y no había tablero), `compact` (3-6, camino arriba y tablero debajo) y
  `line` (7, una línea «Configuración completa» que se podía volver a abrir). El camino
  **se cerraba, no se borraba**: si alguien desactivaba su único servicio, un paso dejaba de estar
  hecho y el camino volvía a crecer solo.
- **Los cuatro estados de un paso** (`done`, `current`, `available`, `blocked`) y la evidencia que
  enseñaba un paso hecho en lugar de una palomita: «3 clientes · 4 sedes · 3 contactos»,
  «12 posiciones con patrón, de 15», «2 versiones publicadas».
- **El aviso de dependencia dicho antes de entrar.** Era el propósito declarado de
  `setupStepBlockedBy`: enterarse de que falta el paso anterior después de abrir un formulario y
  no poder guardarlo es la pared que esa línea evitaba.
- **Los señalamientos por nombre** (`highlightName`): «Aceros del Norte todavía no tiene
  contacto», «3 servicios configurados, entre ellos Planta Apodaca».
- **La preferencia por organización en `sessionStorage`** que recordaba si el usuario había abierto
  a mano la línea cerrada.
- **El título y el subtítulo dependientes del avance**: decían «Configuración inicial de X» y
  «Siete pasos, en este orden. Puedes salir y volver: el avance se conserva.» / «Faltan 3 pasos.
  El avance se conserva.»

### 2.4 Archivos y pruebas

| Archivo | Qué pasó |
|---|---|
| `features/overview/ui/setup-path.ts` | borrado (223 líneas) |
| `features/overview/ui/setup-path.spec.ts` | borrado, **10 pruebas** |
| `features/overview/ui/setup-step.ts` | borrado (165 líneas) |
| `features/overview/ui/setup-step.spec.ts` | borrado, **7 pruebas** |
| `features/overview/data-access/overview.models.ts` | 422 → 229 líneas |
| `features/overview/pages/overview-page/overview-page.ts` | sin `SetupPath` ni `showsDashboard()`; `title()` y `subtitle()` sin ramas de configuración |
| `features/overview/pages/overview-page/overview-page.spec.ts` | 6 → 7 pruebas |
| `features/overview/ui/overview-fixtures.ts` | sin los `setup`; estrena `organizacionVacia()` |

---

## 3. Lo que se decidió, y qué quedó en su lugar

### 3.1 El tablero y la lista se dibujan siempre

Se fue el camino, se fueron las tres proporciones y se fue el gate `showsDashboard()`. Inicio es
una sola pantalla desde el primer día: los cuatro indicadores y la lista de atención, con datos o
sin ellos. Lo que cambia con los datos no es qué pantalla es, sino qué puede afirmar.

### 3.2 La lista de atención dejó de felicitarse

Es la corrección que exigía el hallazgo de la sección 1. `AttentionList` recibe un `hasData` que la
pantalla calcula de los propios indicadores —`metrics.some(m => m.state === 'Ready')`, o sea el
servidor diciendo «esto sí lo pude calcular»— y con él distingue tres situaciones en lugar de dos:

| Situación | Encabezado | Cuerpo |
|---|---|---|
| Hay asuntos | «2 tipos, 1 de ellos dejando turnos al descubierto» | las filas |
| Sin asuntos, con datos | «Sin asuntos abiertos» | «Nada pendiente hoy. Cuando algo deje un turno al descubierto, aparecerá aquí…» |
| Sin asuntos, sin datos | «Todavía sin nada que revisar» | «Todavía no hay con qué saberlo. Esta lista se llena con lo que va dejando la operación…» |

La razón quedó escrita en el propio componente: «Nada pendiente hoy» es una **afirmación**, y en una
organización recién creada es falsa. Decirla igual en los dos casos convierte la ausencia de
configuración en una felicitación, que es la misma trampa que los indicadores llevan evitando desde
que distinguen el cero real del «sin datos aún».

### 3.3 El título dejó de cambiar con el avance

`title()` nombra la organización y nada más. El subtítulo nombra siempre la semana operativa y la
fecha operativa, también cuando no hay nada configurado.

### 3.4 `BuildSetup` se retiró del servidor

No se dejó un cálculo que nadie lee. Se fueron del contrato `OverviewSetupStepKey`,
`OverviewSetupCounts`, `OverviewSetupStepResponse` y `OverviewSetupResponse`, y con ellos el campo
`Setup` de `OverviewResponse`. De los diecinueve conteos de configuración **sobrevivieron dos**, y
cada uno por una razón concreta que quedó escrita en `OverviewFacts`:

- `Positions` — sin posiciones no hay universo contra el que medir la vacante, así que decide si el
  indicador «posiciones sin titular» está listo o pendiente.
- `PrimaryAssignmentsInForce` — sin ningún titular vigente no tiene sentido reclamar que la semana
  siguiente siga en borrador.

En el repositorio eso borró `CountCatalogsAsync` entera y catorce conteos más: clientes, sedes,
contactos, clientes sin contacto y su nombre, servicios, servicios configurados, servicios sin
posiciones, el nombre del primer servicio, posiciones con patrón, empleados con expediente,
cubre-descansos y versiones publicadas. **Inicio es la pantalla que abre cada sesión**, y estaba
pagando todas esas consultas para que nadie las leyera.

---

## 4. La pantalla de una organización vacía, literal

Volcado del árbol renderizado —no de la lectura del código— con los cuatro indicadores en `Pending`
y sin asuntos:

```text
INICIO
Seguridad Vanguardia
Semana del 07 sep 2026 al 13 sep 2026. Fecha operativa: 09 sep 2026.

TABLERO   Ninguno tiene información todavía. Cada uno dice qué falta para tenerla.

  TURNOS PLANEADOS · SEMANA           —   Sin planeación publicada     [Ir a Planeación]
  POSICIONES SIN TITULAR              —   Sin posiciones definidas     [Definir posiciones]
  TURNOS SIN CUBRIR · AYER            —   Sin planeación de ayer       [Ir a Planeación]
  EMPLEADOS CON DOCUMENTOS VENCIDOS   —   Sin empleados dados de alta  [Ir a Personal]

NECESITA ATENCIÓN HOY   Todavía sin nada que revisar

  Todavía no hay con qué saberlo. Esta lista se llena con lo que va dejando la operación
  —posiciones sin titular, faltas sin incidencia, documentos vencidos—, y mientras no haya
  servicios, posiciones ni personal no puede afirmar que no quede nada pendiente.
```

Ni un cero en toda la pantalla: cada indicador enseña un guion, dice qué le falta y ofrece la puerta
a donde se consigue. Los cuatro destinos —Planeación, Servicios, Planeación, Personal— son los
mismos que ofrecían los pasos 7, 4, 7 y 5 del camino.

---

## 5. Lo que se ejecutó

| Frente | Cambio |
|---|---|
| Frontend | borrados `setup-path.ts`, `setup-step.ts` y sus dos pruebas; `overview.models.ts` 422 → 229; `overview-page.ts` sin `SetupPath` ni `showsDashboard()`; `attention-list.ts` con `hasData`; fixtures con `organizacionVacia()` |
| Backend | `OverviewContracts.cs` y `OverviewService.cs` sin el camino; `OverviewRepository.cs` 310 → 213 líneas |
| Pruebas | frontend **599 → 585** (17 borradas, 3 nuevas); backend **359 → 356** (4 borradas, 1 nueva) |
| Documentación | este archivo y la enmienda al punto 4 de `docs/design/pendientes/CATALOGOS-TANDA-PENDIENTE.md` |

Sin migración: **este trabajo no cambia el esquema**. Lo que se retiró son consultas de lectura y
campos de contrato, no tablas ni columnas.
