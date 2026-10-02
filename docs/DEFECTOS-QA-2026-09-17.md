# Defectos del reporte de QA · 17 de septiembre de 2026

Revisión del documento «Errores de Dev.Gestia» (12 puntos, 6 módulos), contra el código y contra
los datos y los registros de `db-gestia-dev`. No se ha modificado nada todavía.

## Lo primero: el que el reporte no vio

**Editar un patrón de turno y guardarlo falla con 409.** Aparece once veces en los registros del
backend de dev, y es la franja roja «Los datos cambiaron mientras editabas» que sale en dos de las
capturas del propio reporte, debajo de la previa de horas. QA lo fotografió sin señalarlo.

No hay ninguna otra persona editando. La causa es un error mío de persistencia:

```
UPDATE [dbo].[ShiftPatternTemplateDays] SET [Active] = @p4, [CreatedAt] = @p5, ...
WHERE [IdShiftPatternTemplateDay] = @p19;      <-- fila que no existe
```

Cuando el ciclo gana un día, `DeclareDay` mete el día nuevo en la colección del agregado que ya
está rastreado. El día nace con su identificador puesto (`Guid.NewGuid()`), y EF, al ver una
entidad nueva con la clave ya asignada dentro de una colección rastreada, la marca **Modified** en
vez de **Added**: emite un UPDATE contra una fila que nunca se insertó, el UPDATE afecta cero
filas, y eso es exactamente lo que EF reporta como conflicto de concurrencia.

El resto del proyecto no cae en esto porque **agrega el hijo por el repositorio**, no por la
colección: `PlanningService` hace `repository.AddShiftSegmentAsync(segment, ...)` y
`PlanningRepository` hace `dbContext.ShiftSegments.AddAsync(...)`. Mi servicio del catálogo es el
único que se salta ese idioma. Es un defecto de una línea de arquitectura, no de cálculo.

**Consecuencia:** hoy en dev se puede crear un patrón, pero no se puede editar uno que gane días.
Los diez patrones promovidos están todos incompletos, así que completarlos —que es justo lo que hay
que hacer en la junta— es lo que falla.

Junto con ese, un segundo hueco del mismo módulo que tampoco estaba en el reporte: **al bajar «Días
del ciclo» los días que sobran se quitan de la pantalla pero se quedan en la base.** Un patrón que
pasa de 7 a 6 días conserva su día 7, que ya no pertenece al ciclo.

## Los 12 del reporte, uno por uno

### Personal

**1 · Al cambiar de categoría, el Título no se actualiza. REAL, es mío.**
El código sólo propone el título si está vacío:
`if (tipo && !this.form.controls.title.value.trim())`. La intención era no pisar lo que el usuario
escribió, y el efecto es que la segunda categoría deja el título de la primera, que es peor: el
documento se guarda con el nombre equivocado.
Arreglo: reemplazar el título mientras siga siendo igual a la etiqueta del tipo anterior —o sea,
mientras nadie lo haya tecleado— y respetarlo en cuanto la persona lo cambie.

### Catálogos · constructor de patrones

**2 y 3 · El desplegable de la hora no se cierra y tiene espacios en blanco. REAL, pero no es
nuestro código.** Es el selector nativo de `<input type="time">` de Chrome: los huecos de las
columnas de hora y minuto son su propio render, y no se puede cerrar ni estilizar desde la
aplicación. Tapa las filas de abajo porque es una capa del navegador.
Arreglo de fondo: sustituirlo por un control propio, que además es lo que el sistema de diseño ya
exige en Catálogos —ahí los selectores tienen que ser `gi-select`, y este se colo porque un
`input type="time"` no es un `<select>` y la prueba no lo atrapa—. **Es la única decisión de las
doce que no puedo tomar solo**: son dos desplegables (hora y minuto) o uno con pasos de quince
minutos.

**4 · «Las horas no se están contando bien». NO es un error de cálculo; es un rótulo que induce al
error.** En la captura hay 4 días de 12 h en un ciclo de 6 días: 48 horas de trabajo en el ciclo, y
`48 x 7 / 6 = 56` horas por semana. Los dos números son correctos, pero la pantalla sólo enseña el
56 y quien cuenta a mano obtiene 48, así que parece que miente.
Arreglo: decir los dos. «48 h de turno en el ciclo de 6 días · equivalen a 56 h por semana».

### Servicios

**5 · «No hay personal activo que ofrecer» con personal activo. REAL.**
La organización «pRIEMRA PRUEBA DE TODO» tiene **5 empleados activos** en la base. La pantalla
tiene dos listas del mismo dato: `activeEmployees()`, que sí trae gente —tan cierto que de ahí
salió el empleado que se asignó solo—, y `candidateRows()`, que quedó vacía. Y el mensaje afirma un
hecho que la pantalla no comprobó: que no hay personal activo. Debería distinguir «no hay personal»
de «no pude traer la lista», que son dos cosas distintas con salidas distintas.

**6 · Guardar asignación asigna al primer empleado activo. REAL Y GRAVE, y la causa es exacta:**

```ts
this.assignmentForm.reset({
  idEmployee: this.activeEmployees()[0]?.idEmployee ?? '',
```

El formulario nace con una persona ya elegida. Nadie la eligió: la puso el formulario. Es la misma
clase de error que la regla del campo de motivo —un dato que compromete a alguien no se prellena—,
y aquí es peor porque lo que se prellena es la identidad de la persona que queda asignada a un
servicio.
Arreglo: arrancar vacío y no dejar guardar sin elección explícita.

**7 · El patrón de turno no queda seleccionado al reabrir. REAL, es mío, pero sí se guarda.**
Lo verifiqué en la base: hay una posición con `IdShiftPatternTemplate` distinto de nulo, y la
promoción no ligó ninguna, así que ésa la guardó la pantalla. El dato está bien; lo que falla es
que al reabrir el modal no se ve.
Causa: puse `[value]` sobre el `<select>` y las opciones llegan después por HTTP. Un `<select>`
ignora un `value` que no corresponde a ninguna opción existente, y Angular no vuelve a aplicarlo
cuando las opciones aparecen.
Arreglo: `formControlName`, que es lo que sí se resincroniza cuando cambian las opciones. Sale
además más simple que lo que escribí.

**8 · «¿Dónde se debe mostrar la información de la posición?» PREGUNTA DE DISEÑO, no defecto.**
Necesita tu respuesta, no un arreglo.

### Clientes

**9 · Nacionalidad: exige un valor del catálogo y no ofrece la lista. REAL.**
El servidor responde 409 «Selecciona un valor activo del catálogo correspondiente» —sale diez veces
en los registros—, y la pantalla no enseña de dónde elegir. Falta ver si el control no está o si
está y llega vacío.

**10 · «¿Dónde se van a mostrar estos datos, y esos campos sólo deben aparecer al editar?»
PREGUNTA DE DISEÑO.**

**11 · En Documentos de cliente no aparece el contador. Por confirmar en pantalla.**

**12 · «¿Cómo se revisa el documento de un cliente?» CARENCIA REAL, no defecto.**
Hoy no hay pantalla para validar o rechazar un documento de cliente. En Personal el estado del
documento sí existe y se usa; en Clientes se sube y nadie lo revisa.

### Auditoría

**13 · No aparece el nombre del módulo. PARCIAL.**
Hay una columna «Entidad» que a veces dice el módulo —«Documentos», «Servicios», «Catálogos»— y a
veces la tabla —«Segmentos»—. No es que falte el dato: es que la columna mezcla dos niveles.

**14 · «Ver objeto actual» y «Copiar referencia» no hacen nada. REAL Y CONFIRMADO EN EL CÓDIGO.**
El primero no tiene manejador; es un botón sin `(click)`:

```html
<button class="gi-button gi-button--primary" type="button">Ver objeto actual</button>
```

El segundo sí copia al portapapeles, pero sin ningún aviso, así que desde fuera no se distingue de
uno muerto.

## Cuenta

| | |
|---|---|
| Defectos reales confirmados | 8 (1, 4, 5, 6, 7, 9, 14, más los dos del catálogo que el reporte no vio) |
| Del navegador, no del código | 2 (puntos 2 y 3) |
| Preguntas de diseño, esperan tu respuesta | 3 (puntos 8, 10, 12) |
| Por confirmar en pantalla | 1 (punto 11) |
| Míos, de lo publicado anoche | 4 (el 409, los días huérfanos, el 1 y el 7) |

## Estado: los siete primeros, corregidos y publicados

| | Qué se hizo | Prueba que lo cubre |
|---|---|---|
| El 409 al editar un patrón | El día que nace en la edición se da de alta por el repositorio, como los segmentos de turno. `DeclareDay` devuelve el día nuevo o nulo | `ADayBornWhileEditingIsHandedToTheRepository` |
| Días huérfanos al acortar el ciclo | Se desactivan, no se borran, y volver a alargar el ciclo reactiva la misma fila en lugar de chocar con su clave única | `ShorteningTheCycleRetiresTheDaysLeftOutsideIt` |
| El empleado prellenado | El alta arranca sin persona, y si falta lo dice con el campo y dónde se elige | `el alta de asignacion no prellena a la persona, y lo dice si falta` |
| La lista de candidatos vacía | **Era `pageSize: 200` contra un máximo de 100**: el servidor contestaba 400 y la pantalla lo leía como «no hay personal». Dos sitios lo pedían así. Y el recuadro ya distingue «no hay personal» de «no pude traerla» | — |
| El combo del patrón | `formControlName` en lugar de `[value]`, que es lo que se resincroniza cuando llegan las opciones | cubierto por el build de plantillas |
| El título que no seguía a la categoría | Sigue al tipo mientras siga siendo la propuesta, y respeta lo que alguien teclee | dos pruebas nuevas en `entity-documents.spec.ts` |
| El rótulo de las horas | Dice las dos cifras: las del ciclo y las de la semana | `la previa dice las horas del ciclo y las de la semana` |
| Auditoría | «Ver objeto actual» lleva a la pantalla del módulo y **no se ofrece** cuando la entidad no tiene pantalla; «Copiar referencia» avisa que copió, y avisa si el navegador no dejó | — |

**Ninguno de los siete necesitó migración.** El esquema no cambió.

Backend 423 pruebas, 0 saltadas. Frontend 808. Publicado en los dos entornos.

## Segunda vuelta: los cuatro que faltaban, también corregidos

| | Qué se hizo |
|---|---|
| Control de hora (puntos 2 y 3) | `gi-select` propio con pasos de quince minutos y horas en formato de 24 h. Se va el desplegable del navegador, que no se podía cerrar ni estilizar y tapaba las filas. Ya no queda ningún `input type="time"` en el bundle publicado |
| Nacionalidad del cliente (9) | Selector del catálogo en lugar de texto libre. Viajan los **nombres** y no los identificadores, porque el nombre es lo que el servidor compara. Si el catálogo no trae la nacionalidad que ya tenía el cliente, se conserva y se dice por qué: el servidor no revalida un valor que no cambió, y borrarla sí perdería el dato |
| Contador de documentos del cliente (11) | La pestaña era la única de las cuatro sin contador. El componente ya lo publicaba con `totalChange` —«para quien dibuje un contador fuera de este componente», dice su propio código— y la pantalla no lo escuchaba |
| Columna de módulo en Auditoría (13) | «Módulo» en su propia columna, y «Entidad» sigue diciendo qué se tocó. Una entidad sin clasificar sale como «Sin módulo» y no se le inventa uno: es la señal de que hay una tabla nueva que nadie clasificó |

Una prueba existente atrapó una regresión al vuelo: `gi-select` usa su etiqueta como `aria-label` y
no la dibuja, así que la nacionalidad se había quedado sin rótulo visible mientras los once campos
de al lado sí lo tienen. Repuesto.

**Tampoco necesitó migración.** Frontend 809 pruebas. Publicado en los dos entornos.

### Sobre `storage/`

En la primera vuelta apunté que la carpeta de documentos subidos debería ignorarse. **Estaba
equivocado:** `storage/` está versionada a propósito, lo dice el propio `.gitignore` —«el stack que
sirve el dominio guarda los suyos en `storage/`, que sí está versionado»— y ya hay cinco archivos
commiteados ahí. No se tocó. Si algún día entran documentos de un cliente real, esa decisión hay
que revisarla, pero es una decisión tomada y no un descuido.

## Lo único que queda

**Tres preguntas de diseño, que no son defectos y no me tocan contestar:** los puntos 8 («¿dónde se
debe mostrar la información de la posición?»), 10 («¿dónde se van a mostrar estos datos, y esos
campos sólo deben aparecer al editar?») y 12 («¿cómo se revisa el documento de un cliente?»).

De la 12 conviene saber que **hoy no hay pantalla de revisión para el documento de un cliente**: la
ficha ofrece Descargar y Editar, y el estado se queda en «Pendiente de revisión» sin nada que lo
mueva. En Personal sí existe. No es un arreglo de minutos ni una pregunta suelta: es una pantalla
que falta, y hay que decidir si entra.
