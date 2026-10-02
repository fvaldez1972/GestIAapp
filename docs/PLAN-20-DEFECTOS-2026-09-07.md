# Los 20 defectos del recorrido — diagnóstico y plan

**Diagnóstico, no ejecución.** Todo lo que sigue se comprobó leyendo el código; donde no pude
comprobarlo sin abrir el navegador, lo digo.

---

## Lo primero: no son 20 defectos, son 14

Seis de los veinte son la misma cosa vista desde otro sitio, y **cuatro comparten una raíz que ya
tiene nombre** en el documento de arquitectura (§9.6): *un dato o un enlace que existe de un lado y
no viaja al otro, sin que nada falle.*

### La raíz común: el enlace opcional que nadie ató

Cuatro defectos, tres capas distintas, un solo mecanismo. **Un parámetro o un enlace es opcional,
nadie lo ata, y por tener valor por defecto el compilador calla y nada falla en ejecución.**

| # | Dónde | Qué quedó sin atar | Qué se ve |
|---|---|---|---|
| **8** | `clients-page.html:113` | La salida `(add)` de `app-client-contacts` | «Agregar contacto» no hace nada |
| **14** | `clients-page.html:78` | La entrada `[organizationId]` de `app-client-form` | Estado y Municipio salen vacíos |
| **16** | `WorkforceService.Map(Employee)` | El argumento `IdJobPositionCatalogItem` | La columna USO dice «Nadie lo tiene» siempre |
| **3+4** | Servidor vs. frontend | La etiqueta se calcula por clave, la ruta la manda el servidor | El botón dice un destino y va a otro |

En el 16 el detalle es fino y conviene verlo: el contrato declara
`Guid? IdJobPositionCatalogItem = null`, con **valor por defecto**. `Map()` no lo pasa. Compila,
responde 200, y el campo llega `null` en **todos** los empleados de la lista y del detalle. La
opcionalidad es lo que esconde el error.

> **Esto no se arregla cuatro veces, se arregla cuatro veces y se previene una.** Propongo, además
> del arreglo, quitar el valor por defecto de `IdJobPositionCatalogItem` en el contrato: sin
> defecto, el compilador señala cada sitio que no lo pasa.

### Los que son un solo defecto contado dos veces

| Reportados | Realidad |
|---|---|
| **5** («no pasa nada») y **7** («aparece bloqueado») | **Un defecto.** El botón está deshabilitado; por eso no pasa nada al pulsarlo |
| **3** y **4** (textos de los indicadores) | **Un defecto.** La etiqueta y el destino se calculan en sitios distintos y dos de cuatro se separaron |
| **13** (hora de Auditoría) | **Un defecto del backend**, no de Auditoría, y afecta a toda la aplicación |

### Los que NO comparten raíz, aunque lo parecían

- **5 y 8 son distintos.** El 5 es una guarda que deshabilita; el 8 es una salida sin atar. Se
  parecen en el síntoma —«no pasa nada»— y no en la causa.
- **6 no es un defecto del botón.** Es el estado vacío de la tabla, que cambia su acción de «Nuevo
  servicio» a «Quitar filtros» a propósito cuando el vacío viene de un filtro. Lo discutimos abajo.
- **11 no le pasa a todos los desplegables.** Sólo al del alta al vuelo.

---

## El hallazgo grande: la hora está mal en toda la aplicación, no en Auditoría

**Tenías razón en que era el defecto de UTC, y te quedaste corto en el alcance.**

El servidor guarda los instantes en UTC, como dice el contrato. Pero **no hay ningún convertidor
que fije `DateTimeKind.Utc` al leer de la base**: EF materializa cada `DateTime` con
`Kind = Unspecified`, y `System.Text.Json` serializa eso **sin la `Z` final**.

La prueba, de respuestas reales capturadas ayer:

| Camino | Lo que viaja | ¿Lleva `Z`? |
|---|---|---|
| Respuesta a un **alta** (el objeto recién creado en memoria) | `"2026-09-07T16:07:39.8173524Z"` | **sí** |
| Respuesta a una **lectura** (leído de la base) | `"2026-09-07T16:07:40"` | **no** |

El navegador interpreta una cadena sin `Z` como **hora local**. En México eso desplaza cada
instante **seis horas**.

Y ahí está la razón de que nadie lo notara en dos semanas: **al crear algo, la hora sale bien.**
Sólo al recargar la pantalla y leerlo de la base se corre. Es el defecto que se esconde de quien lo
prueba.

**Alcance real:** todas las columnas `At` de todas las pantallas —`createdAt`, `updatedAt`,
`occurredAt`, `reviewedAt`, marcas de entrada y salida—. En el frontend pasa por
`formatOperationalInstant`, con **17 sitios de uso**, más el formateador propio de Auditoría.

**Dónde se arregla: en el backend, en un solo sitio.** Un `ValueConverter<DateTime, DateTime>`
aplicado a las propiedades de instante, que devuelva `DateTime.SpecifyKind(v, DateTimeKind.Utc)` al
leer. Con eso la `Z` viaja y las 17 pantallas se corrigen solas.

> **Respuesta directa a tu pregunta: no, arreglar la hora de Auditoría no obliga a rehacer
> Auditoría.** El arreglo no toca esa pantalla. Su `formatDateTime` propio queda correcto en cuanto
> la cadena traiga la `Z`. Rehacer Auditoría sigue siendo deseable por otras razones, pero **no es
> requisito de este arreglo**, y conviene no mezclarlas.

---

## Gravedad

### Impiden trabajar

| # | Defecto | Por qué bloquea |
|---|---|---|
| **13** | Todos los instantes seis horas corridos | Auditoría no sirve como prueba de nada, y es la pantalla cuyo único valor es ser fiable |
| **5+7** | No se puede crear un servicio | Sin servicio no hay posiciones, ni planeación, ni operación. Corta la cadena entera |
| **9** | El menú de acciones queda cortado | Es la única vía para editar y desactivar desde la tabla |
| **2** | «Datos inválidos» sin decir cuál | Quien no sabe qué campo falló no puede corregirlo. Se abandona el alta |
| **14** | Estado y Municipio vacíos al crear cliente | No se puede completar el domicilio |
| **8** | No se pueden agregar contactos | La pestaña existe y no funciona |
| **16** | La columna USO miente siempre | Se puede desactivar un puesto creyendo que nadie lo usa |

### Molestia grave: no bloquean, pero engañan o cuestan trabajo

| # | Defecto | Por qué importa |
|---|---|---|
| **1** | Cierra sesión sin preguntar | Un clic accidental tira el trabajo en curso |
| **17** | «NULL» en pantalla | Un valor sin resolver escrito tal cual. Erosiona la confianza en todo lo demás |
| **3+4** | El botón dice un destino y va a otro | Una etiqueta que miente hace dudar de las otras tres |
| **11** | El desplegable no se cierra | Obliga a elegir algo aunque uno se haya arrepentido |
| **15** | Sedes duplicadas sin control | Ensucia datos que después alimentan servicios |

### Molestia

| # | Defecto |
|---|---|
| **6** | La acción del estado vacío cambia con el filtro |
| **10** | El campo de archivo en inglés |
| **12** | El mismo ejemplo en los cuatro catálogos |
| **18** | El parpadeo al abrir un empleado |

---

## Diagnóstico defecto por defecto

### 1 · Cerrar sesión sin preguntar
`app-shell.html:77` — `(click)="logout()"` directo. `GiConfirmDialog` existe y tiene lo que hace
falta (`open`, `title`, `subject`, `consequence`, `confirmLabel`).

**Sobre el trabajo sin guardar: hoy no existe forma de saberlo.** Busqué `CanDeactivate`, señales
de «sucio», `beforeunload` — **no hay ninguno**. Cada pantalla guarda su formulario y nadie lleva
la cuenta. Decirlo en el diálogo obliga a construir ese registro primero.

Propongo separarlo: **ahora**, el diálogo de confirmación; **aparte**, el registro de trabajo sin
guardar, que es una pieza transversal y merece su propia decisión. Si lo prefieres junto, lo hago,
pero deja de ser un arreglo y pasa a ser una tanda.

### 2 · «La solicitud contiene datos inválidos»
**El servidor sí manda el detalle por campo.** `ProblemDetailsExceptionHandler` pone
`problem.Extensions["errors"] = validationException.Errors`. El detalle sale del servidor entero.

Lo que falla es el frontend, en dos formas:

1. **En `platform-page.ts` el código existe y está muerto.** Lee `error.error.detail` **antes** que
   `error.error.errors`, y `detail` siempre trae el genérico «La solicitud contiene datos
   inválidos.». La rama buena nunca se alcanza. Es un defecto de orden, no de ausencia.
2. **En el resto de las pantallas ni siquiera está la rama.** Cada una tiene su propio extractor
   que sólo mira `detail`.

**Arreglo en la capa que corresponde:** una función compartida que devuelva
`{ mensaje, errores }` desde un `HttpErrorResponse`, y que las pantallas aten los errores a sus
campos. No es un parche de texto: es quitar tres extractores duplicados y poner uno.

### 3 y 4 · Los textos de los indicadores
La etiqueta la calcula `metricPendingAction(key)` en el frontend. La ruta la manda **el servidor**.
Nadie los mantiene sincronizados, y dos de cuatro se separaron:

| Indicador | Ruta que manda el servidor | Etiqueta que pinta el frontend | |
|---|---|---|---|
| Turnos planeados | `/planeacion` | «Ir a Planeación» | ✅ |
| **Posiciones sin titular** | **`/servicios`** | **«Definir posiciones»** | ❌ no dice el destino |
| **Turnos sin cubrir** | **`/operacion/cobertura`** | **«Ir a Planeación»** | ❌ dice otro destino |
| Documentos vencidos | `/personal` | «Ir a Personal» | ✅ |

**El botón ya navega bien.** Pulsar «Ir a Planeación» en Turnos sin cubrir te lleva a Cobertura. Lo
que está mal es sólo el rótulo, y por eso es peligroso: no se nota hasta que confías en él.

**Y tienes razón en lo del estado.** Hoy la ruta es fija para los dos estados, así que en «sin
planeación de ayer» el botón manda a Cobertura, que es inútil sin plan. Faltan las dos cosas:

- Que **el servidor mande la ruta según el estado** (`Pending` → `/planeacion`; `Ready` →
  `/operacion/cobertura`).
- Que **la etiqueta se derive de la ruta**, no de la clave. Una sola fuente y no se pueden volver a
  separar.

### 5, 6 y 7 · El botón de nuevo servicio
**5 y 7 son el mismo defecto.** `services-page.html:11`:

```
[disabled]="!canWriteClients() || loading() || saving() || !hasActiveSite()"
```

`hasActiveSite()` mira `sites()`, y `sites()` **sólo se llena cuando hay un cliente seleccionado**.
Al entrar a Servicios sin cliente, está vacío: el botón nace deshabilitado y `openCreateService()`
también sale por la puerta de atrás (`if (!this.selectedClient() || ...) return;`).

La guarda no es incorrecta —un servicio necesita una sede— pero **pregunta lo que no toca y no dice
nada**. El arreglo: que el botón se pueda pulsar y que sea la pantalla la que explique qué falta
(elegir cliente, o que el cliente tenga sede activa), en lugar de un botón muerto sin motivo.

**6 es otra cosa y puede que no sea defecto.** Es el estado vacío de `gi-data-table`:

```
[emptyActionLabel]="tableState() === 'empty' ? 'Nuevo servicio' : 'Quitar filtros'"
```

Cuando el vacío viene de un filtro, ofrecer «Quitar filtros» es lo correcto. Lo que falta es que
**las dos acciones convivan**: quitar el filtro y, además, crear. Lo propongo así, pero es decisión
tuya.

### 8 · Agregar contacto
`client-contacts.ts` emite `(add)`. `clients-page.html:113` lo instancia con `[contacts]` y
`[canWrite]` y **no ata `(add)`**. El botón emite al vacío. Ver la raíz común.

### 9 · El menú de tres puntos
**No es el `z-index`, tenías razón.** `GiRowActions` está bien: `:host { position: relative }` y el
menú con `z-index: 30`.

El culpable es `gi-data-table`:

```
.gi-table-shell { overflow-x: auto; }
```

En CSS, `overflow-x: auto` con `overflow-y: visible` **fuerza el eje vertical a `auto` también**. El
menú no queda detrás: queda **recortado** por el contenedor de la tabla, que es lo que se ve como
«por debajo de la fila».

**No son siete pantallas, son cuatro usos**, y sólo tres están dentro del contenedor que recorta:

| Dónde | ¿Dentro de `gi-data-table`? |
|---|---|
| `clients/ui/client-table.ts` | sí — **afectado** |
| `workforce/ui/employee-table.ts` | sí — **afectado** |
| `services-page` | sí — **afectado** |
| `clients/ui/client-sites.ts` | no — hay que comprobarlo aparte |

Un arreglo en `gi-data-table` cubre los tres. Es `shared/ui`, así que pasa por `design-system.spec`.

### 10 · El campo de archivo
Tres `<input type="file">` nativos, en Documentos (dos) y en Operación (uno). El sistema cerrado
prohíbe controles nativos sin estilo, y además el texto («No file chosen») lo pone el navegador y
**no se puede traducir**: hay que sustituir el control, no traducirlo. Necesita una pieza nueva en
`shared/ui`.

### 11 · El desplegable que no se cierra
**Sólo el del alta al vuelo.** `gi-select` ya lo resuelve con un `focusout` en el host que cubre el
clic fuera y el salto con Tab. `gi-catalog-picker` —el que construí ayer— abre con `(focus)` y sólo
cierra al elegir o al crear: **no tiene `focusout`**. Copiar la solución que ya existe.

### 12 · El ejemplo repetido
`catalogs-page.html:412` — `placeholder="Ej. Guardia de acceso"` escrito a mano, y el editor es uno
solo para los ocho catálogos. Mío, de ayer. El ejemplo tiene que salir de la ficha del catálogo,
junto al título y al propósito, que ya viven ahí.

### 13 · La hora
Ver arriba. Es el más grande de los veinte.

### 14 · La cascada geográfica
`clients-page.html:78` instancia `<app-client-form>` **sin atar `[organizationId]`**. La entrada
vale `''`, y `catalog-select.load()` hace `if (!this.organizationId) { return; }`: no pide las
opciones. Por eso en Agregar sede sí funciona —ahí sí se le pasa— y al crear cliente no.

### 15 · Sedes duplicadas
El panel **sí se cierra**: `createSite` hace `addingSite.set(false)` al responder. Lo que no he
podido confirmar sin navegador es si el formulario hijo conserva sus valores al volver a abrirlo,
que es lo que explicaría lo que viste.

Lo que sí es cierto en el código: **no hay ninguna comprobación de duplicados**. El código de sede
se genera con `Date.now()`, así que nunca choca. Dos sedes con el mismo nombre y la misma dirección
entran sin protestar.

Propongo las dos: limpiar el formulario al cerrar, **y** una clave única por
`(IdClient, NormalizedName)` — el mismo patrón de nombre normalizado que ya usa el catálogo. Eso
último **es cambio de esquema y va en migración propia**.

### 16 · La columna USO
Ver la raíz común. `Map(Employee)` no pasa `IdJobPositionCatalogItem` y el contrato lo tiene con
valor por defecto.

### 17 · El «NULL» en pantalla
Distinto del 16, aunque parezcan hermanos. Aquí sí viaja el dato: el listado de búsqueda proyecta
`JobPositionName` con una subconsulta al catálogo. **Al desactivar el puesto, la subconsulta deja
de encontrarlo y devuelve `null`**, y ese null acaba interpolado en un texto en lugar de sustituido
por una frase.

Son dos arreglos, y el segundo importa más:

1. Que el nombre del puesto se resuelva **aunque el valor esté inactivo** — es historia, y la
   historia no desaparece porque el catálogo cambie.
2. Que **ningún null se interpole nunca** en un texto de pantalla. Un null en una plantilla de
   Angular se pinta vacío; un null metido en una plantilla de cadena se pinta «null». Voy a
   revisar los demás sitios donde se arma texto con interpolación de cadena.

### 18 · El parpadeo
`workforce-page.ts:388` limpia el detalle y pide el nuevo, y el panel recibe
`[loading]="detailLoading()"`. **El esqueleto está atado**, así que la causa no es la que
suponíamos.

**Es el único de los veinte que no he confirmado.** Necesito abrirlo en el navegador para ver si el
panel dibuja los campos vacíos antes de que `detailLoading` se ponga en verdadero, o si el esqueleto
sólo cubre una parte del panel. Lo diagnostico antes de tocarlo.

---

## Qué pasa por `design-system.spec`

La prueba cubre `shared/ui` y las pantallas ya rehechas: `overview`, `clients`, `workforce`,
`planning`, `operations/ui`, `attendance-page`, `incidents-page` y `catalogs`.

| Defecto | Pantalla | ¿Pasa por la prueba? |
|---|---|---|
| 9, 10, 11 | `shared/ui` | **sí** |
| 12 | catalogs | **sí** |
| 8, 14, 15 | clients | **sí** |
| 16, 17, 18 | workforce | **sí** |
| 3, 4 | overview | **sí** |
| **1** | `core/layout` | no — fuera de la lista |
| **5, 6, 7** | services | **no — pantalla vieja** |
| **2** | platform y clients | platform **no**; clients sí |
| **13** | backend + audit | audit **no — pantalla vieja** |

**Ninguno de los que caen en pantalla vieja obliga a rehacerla**, y el de Auditoría en particular no
la toca. Servicios sí conviene rehacerla algún día —tiene los mismos síntomas que tenía Catálogos—
pero eso es una tanda, no parte de esto.

---

## Orden propuesto

Por gravedad y por dependencia, no por número.

| | Bloque | Qué incluye |
|---|---|---|
| **1** | **La hora** | El convertidor UTC en el backend. Uno solo, arregla 17 sitios. Sin cambio de esquema |
| **2** | **Los enlaces sin atar** | 8, 14, 16, y quitar el valor por defecto del contrato para que no vuelva a pasar |
| **3** | **El menú recortado** | 9, en `gi-data-table` |
| **4** | **La validación** | 2, con el extractor compartido y el error en el campo |
| **5** | **Servicios** | 5+7, y la decisión sobre el 6 |
| **6** | **Los rótulos que mienten** | 3+4, con la ruta por estado desde el servidor |
| **7** | **Cerrar sesión** | 1, sólo el diálogo |
| **8** | **Los sueltos** | 11, 12, 17 |
| **9** | **Lo que falta diagnosticar** | 18 en el navegador; 15 y su migración de unicidad |
| **10** | **El campo de archivo** | 10, pieza nueva en `shared/ui` |

**Los bloques 1 a 4 son los que devuelven la capacidad de trabajar.** Si sólo hay tiempo para
algo, que sea eso.

**Sin cambio de esquema:** todo salvo la unicidad de sedes del bloque 9. Lo digo en voz alta como
quedamos: **19 de los 20 no necesitan migración.**
