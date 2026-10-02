# Personal, documentos y reglas — verificación y plan

**19 de septiembre de 2026 · rama `s0/feature/gestIaProject/filtro-organizacion`**

El consolidado pedía hacer primero los pasos 1 y 2 —verificación, no construcción— porque podían
cambiar el tamaño de lo que falta. Los cambiaron, en las dos direcciones.

---

## Parte 1 · Lo que la verificación encontró

### 1.1 · El motor no mira las incidencias administrativas. Confirmado

**RF-ELG-003. Es el hallazgo que importa, y es el peor caso de los dos posibles.**

`CatalogService`, que es donde vive `EvaluateEligibilityAsync`, **ni siquiera menciona**
`AdministrativeIncident`. El motor consulta tres listas —experiencias, documentos y evaluaciones— y
recorre las reglas de `EligibilityRequirement`. Las incidencias no entran por ningún lado.

La consecuencia es exactamente la que el documento temía: **una incidencia marcada bloqueante hoy no
bloquea nada.** El administrador la registra, la pantalla le dice «Impide asignar», y el servidor
asigna igual. Es una protección que no protege, y eso es peor que no tenerla.

### 1.2 · La publicación de planeación SÍ valida por persona

**RF-PLN-001. El consolidado dice que no, y se equivoca.**

`SchedulingService` ya llama a `CheckEligibilityAsync` **por cada turno**, con su persona, su
posición, su cliente y su fecha. Si alguien no cumple, detiene la publicación y el mensaje nombra a
la persona y lista sus motivos bloqueantes:

```csharp
var reasons = eligibility.Reasons.Where(r => r.IsBlocking && !r.Passed).Select(r => r.Message);
throw new ResourceConflictException($"No se puede publicar: {eligibility.EmployeeName}. {...}");
```

Y lo hace **llamando al mismo motor**, no reimplementando las reglas: eso cumple ya la exigencia del
§22 del documento de que Planeación no tenga una segunda versión de la misma lógica.

Lo mismo en las asignaciones: `AssignmentService` ya bloquea y lista los motivos.

**Lo que sí falta, y es mucho menos de lo que el documento supone:**

1. Se detiene en **la primera persona** que falla. El ejemplo del documento enseña una persona, pero
   QA-PLN-003 pide ver todas las causas, y con una planeación de veinte personas hay que
   republicar veinte veces para descubrir las veinte.
2. El mensaje es una línea, no el bloque estructurado del ejemplo.
3. Revalida **por turno**, no por persona: alguien con treinta turnos cuesta treinta comprobaciones
   idénticas.

### 1.3 · La retroactividad funciona sola. La bitácora, a medias

**RF-CAT-003.**

Funciona, y por diseño: `Severity()` resuelve
`requirement.IsBlocking ?? requirement.RequiredCatalogItem?.IsBlocking ?? false` **en cada
consulta**, y no hay ninguna capa de caché en Application ni en Infrastructure —se buscó—. Cambiar
el catálogo cambia el resultado de la validación siguiente, sin tocar un solo expediente. Los tres
primeros criterios de aceptación se cumplen.

**El cuarto no del todo.** `BusinessCatalogItem` **no está** en `OperationalSnapshot.IsTracked`, que
es la lista de entidades con historial funcional. Lo que queda al cambiar la naturaleza de una
entrada es el rastro transversal —`UpdatedBy`, `UpdatedAt`, visibles en la pantalla de Auditoría—:
**quién y cuándo, pero no de qué a qué ni por qué.** Para un campo que decide si alguien puede
trabajar, eso se queda corto.

### 1.4 · El catálogo ya admite dos niveles

**RF-DOC-002, y abarata la pieza.**

`BusinessCatalogItem` tiene `IdParentCatalogItem`, y se usa hoy: los estados cuelgan del país y los
municipios del estado. La pantalla ya sabe dibujar el selector de padre —`needsParent()`— y la
columna «Pertenece a».

Así que **Categoría → Tipo de documento no necesita tabla nueva ni catálogo nuevo**: la categoría es
una entrada padre del mismo catálogo. Es configuración de una lista y un rótulo, no modelo.

### 1.5 · Lo que ya estaba y sigue estando

- **RF-DOC-003**, indicador de vencidos y por vencer con los 30 días: existe, y el umbral está
  escrito en la pantalla.
- **RF-PER-001** está a medias: la colonia y el código postal como texto se hicieron hoy. Falta
  separar **calle y número**, con el número alfanumérico.

---

## Parte 2 · El tamaño real de lo que falta

| # | Qué | Tamaño real |
|---|---|---|
| 1 | **El motor lee incidencias administrativas** | Mediano. Es la pieza que de verdad falta |
| 2 | **Historial funcional del catálogo** | Pequeño: entrar a `IsTracked` y su foto |
| 3 | **Publicar: todas las personas, no la primera** | Pequeño-mediano. Ya valida; falta acumular en vez de detenerse |
| 4 | **Calle y número separados** | Pequeño, con migración |
| 5 | **Categoría del documento** | Pequeño: entrada padre del catálogo que ya existe |
| 6 | **Reporte de incumplimiento** | Mediano. Se apoya en 1 y 3 |
| 7 | Evidencia obligatoria en incidencias | **No entra**: espera PD-PER-004 |

Lo que el consolidado contaba como dos piezas críticas —el motor y la publicación— resultó ser una
pieza crítica y un ajuste.

---

## Parte 3 · El plan

### Paso 1 · El motor lee las incidencias administrativas

El motor recorre hoy las reglas de `EligibilityRequirement` y pregunta, por cada una, si la persona
la cumple. Las incidencias **no son un requisito que se cumpla**: son un hecho en contra. Así que no
entran como un quinto tipo de regla, entran como una comprobación propia.

- `CatalogService` carga las incidencias activas de la persona, con su tipo del catálogo.
- Cada incidencia activa cuyo tipo esté marcado **bloqueante** produce un motivo no cumplido;
  una informativa produce un motivo cumplido que deja constancia, que es lo que pide RN-PER-003.
- El mensaje nombra el tipo y la fecha de ocurrencia, no sólo «tiene una incidencia».

Como la asignación y la publicación ya consumen este motor, **las dos heredan el cambio sin
tocarlas**.

### Paso 2 · El cambio de naturaleza queda en la bitácora

`BusinessCatalogItem` entra a `OperationalSnapshot`, con su foto. La foto guarda el nombre, el tipo y
la marca de bloqueo; **no guarda la descripción**, que es texto libre, según la regla del proyecto de
que las bitácoras no copian texto libre.

### Paso 3 · Publicar dice todas las personas

Se deja de lanzar dentro del bucle y se acumulan los incumplimientos de todas las personas; al
final, si hay alguno, se lanza uno solo con el bloque completo. Y se comprueba **una vez por persona
y posición**, no una por turno.

### Paso 4 · Calle y número

Migración: `Street` y `StreetNumber` en `Employees`, el número como texto para que acepte
`45-A int. 3`. `Address` se conserva y se rellena `Street` con lo que tenga, porque los registros no
se pierden. La pantalla pasa a dos campos.

### Paso 5 · La categoría del documento

La categoría es una entrada padre del catálogo `EmployeeDocumentCategory`. Se amplía `needsParent()`
y se siembran las categorías de los ejemplos —Identidad, Fiscal—, colgando de ellas los catorce
tipos que ya existen.

> **Al construirlo se hizo distinto, y la razón está en la Parte 7:** la categoría quedó como un
> catálogo aparte, `EmployeeDocumentGroup`, en vez de como entrada padre del mismo catálogo.

### Paso 6 · El reporte de incumplimiento

Una pantalla que lista, para la organización, quién incumple qué: persona, tipo, requisito, estado,
impacto y ámbito. Se apoya en el motor, así que sale después de los pasos 1 y 3.

**Y se llama «Incumplimientos», no «Non-Compliance Report».** Toda la interfaz está en español; que
el documento use el término en inglés no es razón para meterlo en la pantalla.

---

## Parte 4 · Lo que no entra, y por qué

- **La evidencia obligatoria en incidencias** (RF-INC-ADM-003) espera **PD-PER-004**: no está
  decidido si aplica a todas, sólo a las bloqueantes, o según el motivo. Construirla suponiendo una
  de las tres deja dos tercios de probabilidad de rehacerla.
- **Las vigencias de experiencias y evaluaciones** (PD-PER-001, PD-PER-002) no cambian nada hoy: las
  dos ya admiten vencimiento opcional y el motor ya lo respeta. Cuando negocio decida cuáles son
  obligatorias, es una validación, no un cambio de modelo.

## Parte 5 · Lo que doy por supuesto, y digo en voz alta

- **PD-PER-003** — una incidencia bloquea **mientras esté activa**, y se deja de bloquear
  retirándola, que es lo que la pestaña ya hace. Es lo coherente con el principio de que nada se
  borra. Si negocio quiere que deje de bloquear sola por fecha, o mediante autorización, es una
  columna más y un cambio en el motor.
- **PD-PER-006** — nada se borra. Ya resuelto por el principio 3 del proyecto.
- **PD-PER-007** — administrativa y operativa son entidades separadas. Ya resuelto de hecho: se
  construyeron separadas, y la pestaña lo dice en su propio texto.

---

## Parte 6 · La única que puede detener

**PD-PER-005 — ¿una incidencia bloqueante bloquea en todas partes, o sólo para ciertos clientes,
servicios o posiciones?**

Hoy `AdministrativeIncident` se construyó **sin alcance**: es de la persona y punto. Si la respuesta
es «en todas partes», el paso 1 se hace como está descrito y no hay nada más.

Si la respuesta es «depende», la entidad necesita alcance como lo tiene `EligibilityRequirement`, y
eso es una columna nulable más una migración compensatoria; no es una reescritura, pero sí cambia el
motor y la pantalla.

**Recomiendo empezar por «en todas partes».** Es lo que dicen las dos fuentes —el `LOGS1.txt` habla
de «inhabilitado para servicios de forma inmediata», sin matices— y es lo que un acta administrativa
significa en la práctica: si alguien abandonó el puesto, no abandonó el puesto sólo para un cliente.
Acotarlo después es agregar; desacotarlo después sería quitar una protección que ya estaba puesta.


---

# Parte 7 · Lo que quedó construido

Los seis pasos, con PD-PER-005 resuelta en «bloquea en todas partes».

| Paso | Estado |
|---|---|
| 1 · El motor lee las incidencias | **Hecho.** Y el reporte de elegibilidad también, que duplicaba la lógica |
| 2 · Historial funcional del catálogo | **Hecho.** `BusinessCatalogItem` entró a la bitácora |
| 3 · Publicar dice todas las personas | **Hecho.** Acumula, y comprueba por persona y posición |
| 4 · Calle y número separados | **Hecho**, con migración |
| 5 · Categoría del documento | **Hecho**, como catálogo aparte de dos niveles |
| 6 · Incumplimientos | **Hecho** sobre el reporte que ya existía |

## Lo que apareció por el camino

**El reporte de elegibilidad estaba roto desde la conversión de ayer.** Comparaba documentos y
evaluaciones **sólo por el enum heredado**, y una regla creada después de la conversión puede no
llevarlo: el reporte daba por incumplido lo que el motor daba por cubierto. Dos pantallas del mismo
sistema contradiciéndose, que es el defecto que este proyecto ya persiguió en el listado de
personal. Ahora compara por identificador del catálogo, con el enum de respaldo.

**La publicación revalidaba por turno.** Alguien con treinta turnos en la quincena costaba treinta
comprobaciones idénticas, cada una con sus cuatro consultas al expediente. Ahora se comprueba una
vez por persona y posición, con la **primera** fecha en que esa persona cubre esa posición: es la
más exigente de las suyas, porque un documento que vence a mitad del periodo ya estaba vigente al
principio y el turno del principio es el que sí se va a trabajar.

## Las decisiones de forma que se tomaron al construir

- **El grupo del documento es un catálogo aparte**, `EmployeeDocumentGroup`, y no una entrada padre
  dentro del mismo catálogo. Si compartieran tipo, un selector de «tipo de documento» tendría que
  distinguirlos por si llevan padre o no, y una lista recién creada —donde nada tiene padre
  todavía— sería ambigua.
- **El grupo es opcional.** La geografía exige padre porque un estado sin país no significa nada;
  agrupar documentos es una comodidad, y obligar a crear «Identidad» antes de registrar «INE»
  invertiría el orden en que se trabaja.
- **La calle se rellenó con el domicilio de una línea, sin partirlo.** Adivinar dónde acaba la
  vialidad y empieza el número acierta en «Juárez 123» y falla en «Calzada de los 100 Metros 45».
  Un domicilio partido mal es peor que uno sin partir, porque parece correcto y nadie vuelve a
  revisarlo. El número queda vacío hasta que alguien repase el expediente.
- **La foto del catálogo en la bitácora no lleva el nombre.** Es el principio 4: se conserva por
  identificador. Si mañana alguien corrige «Poligrafo» a «Polígrafo», no quedan copias del nombre
  viejo diciendo que cambió algo que no cambió.

## Pruebas

428 de backend —cinco nuevas, que son las que faltaban— y 815 de frontend.

Las cinco nuevas están en `AdministrativeIncidentEligibilityTests` y cubren QA-INC-001, QA-INC-002 y
la retroactividad de RF-CAT-003 donde de verdad importa: se cambia la marca en el catálogo, **no se
toca el expediente**, y la persona pasa de elegible a no elegible. La primera de las cinco es el
control: sin incidencias, elegible.

## Lo que falta antes de que esto sirva

**La migración `EmployeeStreetAndDocumentGroups` no está aplicada a `db-gestia-dev`**, y por tanto
tampoco desplegada. Falta el procedimiento de siempre: respaldo `COPY_ONLY` verificado, ensayo sobre
copia restaurada, aplicación, y después publicar con retaguardia etiquetada.
