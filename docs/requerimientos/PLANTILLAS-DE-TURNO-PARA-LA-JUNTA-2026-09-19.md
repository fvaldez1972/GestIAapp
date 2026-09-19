# Las nueve plantillas de turno que están a medio llenar

**Para la junta con Óscar y Joab · 19 de septiembre de 2026**

---

## Qué es esto y por qué importa

GestIA tiene un catálogo de patrones de turno: el horario se declara una vez y cada posición lo
elige. Es lo que sustituye a que cada puesto capture su propio horario a mano.

El catálogo tiene **diez patrones**, y **nueve están a medio llenar**: declaran unos días del ciclo
y dejan otros sin decir nada. Un día sin declarar **no es un descanso** —el sistema no puede
suponerlo, porque suponerlo mal genera turnos que nadie pidió o deja huecos sin cubrir—, así que
mientras falten días esos patrones no se pueden usar.

El efecto práctico, hoy: de los diez, **el selector de la posición sólo ofrece uno**. Por eso de las
66 posiciones activas sólo 2 usan el catálogo.

**Esto no espera a ninguna decisión de diseño del sistema. Espera a que alguien diga qué se
trabaja y qué se descansa cada día.** Es lo único que bloquea el bloque de patrones.

---

## Lo que se gana al llenarlas

Comparé el horario que cada posición tiene capturado a mano contra lo que declaran las plantillas,
suponiendo que los días que faltan fueran de descanso:

> **De las 53 posiciones con horario propio, 51 encajarían exactamente con una plantilla existente.**

No haría falta recapturar nada: el sistema las enlazaría solo. Las dos que sobran y las 13 que no
tienen ningún horario capturado quedan marcadas para revisión, una por una.

---

## Las nueve, y qué le falta a cada una

Los días van numerados dentro del ciclo: **d1** es el primer día, **d2** el segundo, y así.

### Grupo 1 · Sólo hace falta confirmar que los días que faltan son de descanso

**Son 46 de las 51 posiciones, y se resuelven con dos confirmaciones**, porque cada una está
duplicada en el catálogo.

| Patrón | Ciclo | Lo que declara | Le falta | Posiciones que encajarían |
|---|---|---|---|---|
| **Rol diurno lunes a sábado** *(duplicado)* | 7 días | d1 a d6: 07:00–19:00 | **d7** | **30** |
| **Rol nocturno 12x12** *(duplicado)* | 7 días | d1, d3, d5, d7: 20:00–08:00 | **d2, d4, d6** | **16** |

**Lo que hay que decidir:** ¿el día 7 del rol diurno es descanso? ¿Los días 2, 4 y 6 del nocturno
son descanso? Si la respuesta es sí en los dos casos, 46 posiciones quedan enlazadas.

**Y además:** las dos están **duplicadas**, con el mismo nombre y el mismo contenido. Hay que
decidir cuál se queda; la otra se retira.

### Grupo 2 · El nombre no coincide con el horario que declara

Aquí no basta con completar: hay que decidir cuál de los dos dice la verdad.

| Patrón | Ciclo | Lo que declara | Le falta | Posiciones |
|---|---|---|---|---|
| **Dia 6h - 16h** | 7 días | d1 y d2: **08:00–16:00** | d3 a d7 | 2 |
| **Mixto 10h - 20h** | 7 días | d1: **20:00–08:00**, y está marcado *nocturno* | d2 a d7 | 1 |
| **Turno 8 horas** | 7 días | d1 a d3: 08:00–16:00 | d4 a d7 | 1 |

**Lo que hay que decidir:** «Dia 6h - 16h» declara de 8 a 4, no de 6 a 4. «Mixto 10h - 20h» declara
un turno de noche, de 20:00 a 08:00, y está marcado como nocturno. ¿El nombre está mal o el horario
está mal?

### Grupo 3 · Parece de prueba

| Patrón | Ciclo | Lo que declara | Le falta | Posiciones |
|---|---|---|---|---|
| **Diurno smoke** | 7 días | d1: 08:00–16:00 | d2 a d7 | 1 |
| **Patrón turno matutino 1** | 7 días | d1 a d5: 08:00–16:00 | d6 y d7 | 1 |

**Lo que hay que decidir:** «Diurno smoke» tiene nombre de prueba técnica. Si lo es, se retira en
vez de completarse —pero hay **una posición** que encajaría con él, así que primero hay que ver cuál
es—. «Patrón turno matutino 1» parece una semana de lunes a viernes con el fin de semana libre; si
es eso, basta confirmarlo.

---

## Una más, que sí está completa pero dice algo raro

| Patrón | Ciclo | Lo que declara | Marcado como |
|---|---|---|---|
| **de 12x12** | 6 días | d1 a d3: 07:00–19:00 · d4 a d6: descanso | **Nocturno** |

Es el único patrón completo del catálogo, y el único que hoy se puede elegir. Trabaja de 7 de la
mañana a 7 de la tarde y está marcado como **nocturno**. La franja no es cosmética: de ella depende,
entre otras cosas, si aplica prima nocturna.

**Lo que hay que decidir:** ¿es diurno y la marca está mal, o el horario está mal?

---

## Resumen de lo que la junta tiene que resolver

1. ¿El día 7 del **rol diurno** es descanso? *(desbloquea 30 posiciones)*
2. ¿Los días 2, 4 y 6 del **rol nocturno 12x12** son descanso? *(desbloquea 16)*
3. De cada pareja duplicada —rol diurno y rol nocturno—, ¿cuál se queda?
4. **Dia 6h - 16h** y **Mixto 10h - 20h**: ¿manda el nombre o manda el horario?
5. **Diurno smoke**: ¿se retira o se completa?
6. **de 12x12**: ¿es diurno, o el horario está mal?

Con las dos primeras respondidas, el sistema enlaza 46 de las 51 posiciones sin que nadie recapture
un horario. Con las seis, quedan **51 de 53**, y las que no encajen se marcan una por una para que
alguien las revise a mano, sin inventarles nada.

---

## Lo que NO hay que decidir en esta junta

Tres preguntas que veníamos arrastrando y que ya no bloquean nada:

- **Si editar un patrón en uso cambia lo ya publicado.** No puede: cada turno generado guarda su
  propio horario como copia, y una planeación publicada no se toca. Editar un patrón sólo afecta a
  lo que se genere después.
- **Si un patrón retirado se puede borrar.** En GestIA nada se borra: se desactiva y sigue
  consultable.
- **Cómo se resuelven las reglas de elegibilidad entre organización, cliente, servicio y posición.**
  Ya está resuelto en el sistema: las de arriba siempre aplican y las de abajo sólo agregan.
