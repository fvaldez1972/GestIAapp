# Propuesta: descanso, vacancia y sucesión

Modelo de posición que cubre la operación de Oscar y la de Joab sin construir dos productos.
Base: proceso consolidado de seguridad privada, proceso de negocio de Joab, y el estado real
del código al 2026-09-04.

---

## El problema

Tres huecos, detectados al revisar el código contra el proceso de negocio:

1. **El descanso no existe como dato.** Es la ausencia de un segmento. "El domingo es
   descanso" y "nadie configuró el domingo" se ven idénticos en la base.
2. **La vacante no existe como estado.** Se calcula al vuelo y se tira, cuando el proceso
   pide que sea un hueco visible.
3. **Los turnos publicados quedan apuntando al empleado que se fue**, y la versión publicada
   no se puede editar.

Y uno más, que es la raíz: **`ShiftSegment` guarda día de la semana**, así que el modelo solo
puede expresar patrones semanales. Un 24x48 es un ciclo de tres días que se recorre cada
semana. Ambos documentos lo listan como turno real.

---

## La propuesta

### Idea central: el patrón declara su ancla

Un patrón de turno es de uno de dos tipos, y esa es la única distinción nueva.

**Patrón semanal.** Ciclo de siete días, anclado al día de la semana. El descanso es un día
con nombre: domingo. Cubre 12x12 con descanso fijo, y los códigos DIA, NOCHE y MIXTO.

**Patrón cíclico.** Ciclo de N días, anclado a una fecha de inicio. El descanso es una
posición dentro del ciclo, no un día de la semana. Un 24x48 son tres días: trabaja, descansa,
descansa. Un 2x2x2 son seis. Cubre 24x24, 24x36, 12x36, 12x48, 24x48 y las rotaciones
día/noche/descanso.

Los dos cuelgan de la posición. Los dos sobreviven al cambio de persona. Lo único que cambia
es cómo se calcula qué toca cada día.

### Por qué esto cubre a los dos

Joab necesita descanso fijo que la vacante conserve y el que llega hereda. Eso es el patrón
semanal, y la herencia es automática porque el patrón cuelga de la posición.

Ambos necesitan ciclos que no caben en una semana. Eso es el patrón cíclico, que hoy no se
puede representar.

El proceso consolidado pide un "constructor libre" con patrón, ciclo, día/noche, descanso y
vigencia. Esta es la forma mínima de tenerlo sin inventar un motor complicado.

### El descanso se vuelve un hecho

Cada día del ciclo declara qué es: **turno** o **descanso**. Un día sin declarar es un día sin
configurar, y el sistema lo señala como patrón incompleto.

Esto resuelve el problema de fondo: si el descanso está escrito, se puede heredar, se puede
verificar y se puede proteger. Si es una ausencia, no.

Y habilita una regla que hoy no se puede aplicar: **cambiar el descanso de una posición es una
operación deliberada sobre la posición, con su rastro.** Nunca un efecto colateral de mover
personal.

### La vigencia ya existe y no se toca

`ShiftPattern` ya está versionado con fecha de inicio y fin. Un cambio de patrón se hace
creando uno nuevo con vigencia posterior, no editando el anterior. Eso ya está bien y encaja
con el principio de no borrar historia.

---

## Vacancia

**Propuesta: proyección consultable, no columna almacenada.**

Vacancia es la cuenta de elementos requeridos por la posición menos las asignaciones vigentes
a una fecha. Guardarla como columna obliga a sincronizarla en cada alta, baja y cambio de
fecha, y basta un camino que se olvide para que quede mintiendo.

Los estándares de base de datos del proyecto ya contemplan un esquema `report` para
reconstruibles. Ahí vive.

Lo que sí hay que definir es cómo se ve: el proceso pide que el hueco sea visible, y Joab lo
marca en rojo. Eso es diseño de la pantalla de planeación, no modelo de datos.

---

## Sucesión sobre turnos publicados

**Propuesta: no permitir editar la versión publicada. Ya está bien como está.**

Esto no es un hueco, es una decisión correcta que el código ya tomó. Y el propio proceso de
negocio lo confirma: *"publicar rol base y conservar versiones; toda modificación posterior
debe convertirse en incidencia trazable"*.

Entonces, cuando alguien causa baja a media semana con turnos ya publicados a su nombre:

- La versión publicada **no cambia**. Queda como prueba de lo que se planeó.
- El movimiento entra como **incidencia** sobre los turnos afectados, con persona original,
  motivo, persona que cubre y autorización.
- La cobertura resuelve quién lo suple.

Así, planeado y ejecutado quedan separados y comparables, que es exactamente lo que el proceso
pide para la conciliación con el cliente.

**Falta verificar:** si el modelo de incidencia y cobertura ya guarda persona original y
persona que cubre. El proceso lo exige. Si no lo tiene, ahí sí hay que construir.

---

## Titular y cubre-descansos

Ambos lo mencionan: Oscar habla de cubre-descansos, Joab de asignar titular y cubre-descansos.

`ServiceAssignment` ya tiene tipo de asignación y marca de principal. **Probablemente ya
alcanza**, y solo hay que confirmar que el catálogo de tipos incluye cubre-descanso, y que la
generación de turnos lo prefiere cuando el titular descansa.

---

## Qué queda fuera, a propósito

**Salario y bonos.** No existen en el modelo y no hacen falta para la fase 1. Son prenómina.
Cuando entren, van versionados por vigencia con el mismo patrón que la configuración de
servicio, y necesitan permiso propio: los 23 permisos actuales no cubren nómina.

**Perfil por catálogo.** Hoy la elegibilidad se valida comparando texto libre contra texto
libre, aunque ya exista un catálogo de habilidades. Es una mejora real pero no bloquea el
flujo. Se anota y se decide después.

**Control de capacidad.** El proceso dice que nadie puede agregar una séptima persona a seis
posiciones sin autorización. Con vacancia consultable la validación se vuelve trivial, pero el
flujo de autorización es alcance aparte.

---

## Lo que hay que construir

Tres cosas, en orden.

| # | Qué | Por qué | Tamaño |
|---|---|---|---|
| 1 | Tipo de patrón: semanal o cíclico, con día declarado como turno o descanso | Sin esto no se pueden representar los turnos reales ni garantizar la herencia | Migración nueva, toca dominio y generación de turnos |
| 2 | Vacancia consultable como proyección | El hueco debe verse; hoy se calcula y se tira | Sin migración |
| 3 | Verificar persona original y persona que cubre en incidencia y cobertura | El proceso lo exige para conciliar con el cliente | Por confirmar |

Todo lo demás de la fase 1 ya existe y es trabajo de reorganización, no de construcción.

---

## Lo que hay que preguntarle a Oscar y a Joab

Son tres, y solo ellos las pueden responder.

1. **¿Cuántos días de descanso tiene una posición típica?** Uno o dos cambia el modelo.
2. **¿Qué pasa cuando un patrón cíclico cae en día festivo o en el corte de semana?** Se
   recorre el ciclo, se respeta, o se resuelve por excepción.
3. **¿El cubre-descansos es una persona asignada a la posición, o alguien que se asigna cada
   vez?** Joab habla de asignarlos desde el rol; Oscar de comodines zonales. Puede que no sea
   lo mismo.
