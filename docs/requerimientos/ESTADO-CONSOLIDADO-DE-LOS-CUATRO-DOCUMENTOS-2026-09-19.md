# Qué falta, de los cuatro documentos juntos

**19 de septiembre de 2026, al cierre · commit `d66037f`, 41 migraciones**

Los cuatro consolidados —Clientes, Personal, Posiciones, y Catálogos/Reglas/Auditoría— describen el
sistema **como estaba esta mañana**. Desde entonces se construyeron y desplegaron cuatro tandas.
Esto mide lo que queda **contra el código de ahora**, no contra lo que los documentos dicen.

---

## La respuesta corta

**Queda poco por construir y bastante por decidir.**

| | Cuántos |
|---|---|
| Requerimientos identificados en los tres documentos con clave | **82** |
| Satisfechos | **71** |
| **Pendientes** | **11** |

De esos once, **uno solo se puede construir hoy sin esperar a nadie.** Los otros diez esperan una
decisión: seis de negocio, dos de cumplimiento legal y dos de datos que llena operación.

**No es un problema de capacidad de construcción. Es una cola de decisiones.**

---

## Los once, y quién los desbloquea

### Se puede hacer ya — 1

| Qué | De dónde | Tamaño |
|---|---|---|
| **Cédula de servicio**: el documento opcional del servicio | Clientes §5 | Chico. El mecanismo de documentos ya existe |

### Espera una decisión de negocio, ya no datos — 2

Los dos son el bloque de patrones. **Ya no los bloquea el catálogo a medio llenar**: el 20 de
septiembre se quitó la exigencia de declarar los siete días del ciclo, y las diez plantillas se
pueden usar tal como están.

| Qué | De dónde | Quién lo desbloquea |
|---|---|---|
| **RF-PAT-002** · Retirar el patrón propio de la posición | Catálogos §3 | La junta con Óscar y Joab |
| **RF-PAT-005** · Migrar los 51 horarios propios al catálogo | Catálogos §3 | La misma junta |

Lo que queda por decidir no es qué días declara cada plantilla, sino si el patrón propio de la
posición se retira. La lista de `PLANTILLAS-DE-TURNO-PARA-LA-JUNTA-2026-09-19.md` sigue sirviendo
para la junta, pero **ya no como bloqueo**: sirve para acordar nombres y horarios, no para poder
usar el catálogo.

### Espera decisiones de negocio — 6

| Qué | De dónde | Pendiente | Tamaño |
|---|---|---|---|
| **RF-MAT-003** · Disponibilidad contra el patrón | Posiciones §3 | PD-POS-004 | **Grande. Entidad nueva, no un campo** |
| **RF-MAT-004** · Escolaridad en el matching | Posiciones §3 | PD-POS-003: ¿exacta, mínima o conjunto? | Chico. El campo ya existe en los dos lados |
| **RF-MAT-007** · Equipo requerido en el matching | Posiciones §3 | PD-POS-005: cómo acredita la persona que lo tiene | Medio |
| **RF-ASG-002** · Tipo de asignación desde catálogo | Posiciones §25 | PD-POS-008 / PD-01, con Fernando | Chico. Hoy es enum de cuatro y se usa |
| **RF-ASG-003** · Asignación principal | Posiciones §25 | PD-02: ¿hace falta, si el tipo ya lo dice? | Chico. Hoy existe y se usa en 112 asignaciones |
| **RF-INC-ADM-003** · Evidencia obligatoria en incidencias | Personal §2.6 | PD-PER-004: ¿en todas, sólo bloqueantes, o según el motivo? | Medio |

### Espera revisión de cumplimiento, no de negocio — 2

| Qué | De dónde | Pendiente |
|---|---|---|
| **RF-MAT-005** · Edad como criterio de bloqueo | Posiciones §22 | PD-POS-002 |
| **RF-MAT-006** · Sexo como criterio de bloqueo | Posiciones §23 | PD-POS-001 |

Los campos existen y se capturan; lo que no se construyó es que **bloqueen automáticamente**. El
propio documento pide aprobación formal antes, y esa aprobación no la puede dar el equipo técnico.

---

## Lo que ya no hay que hacer, aunque los documentos lo pidan

Esto es la mitad útil de la respuesta: **los cuatro consolidados piden cosas que ya están hechas**, y
quien los lea sin esta nota va a construirlas otra vez.

### Se construyó hoy

| | |
|---|---|
| **Clientes** | Zona en vista y contratos · CP con ceros · colonia · alcance, propósito y puesto del contacto · contacto principal · siete catálogos nuevos · las dos validaciones de servidor |
| **Personal** | El motor lee las incidencias administrativas · publicar nombra a todas las personas · calle y número · categoría del documento · la pantalla de Incumplimientos · la bitácora del catálogo |
| **Posiciones** | Los cinco catálogos de perfil, sembrados · vigencia de la posición · escolaridad de la persona · fuente única de la severidad, con retrocarga |
| **Catálogos y reglas** | La Zona en el historial · fuera «Validar a una persona» y las listas fijas · retirado el tipo «Restricción bloqueante» · calendario de sólo lectura en la posición |

### Ya existía y los documentos lo daban por pendiente

| Lo que el documento dice | Lo que el código hace |
|---|---|
| «Las reglas tienen dos niveles; hay que construir cuatro» | Los cuatro existen desde antes: organización, cliente, servicio y posición |
| «La cascada no se puede construir sin dos respuestas» (PD-REG-001, PD-REG-002) | Ya está construida, y resuelve las dos: las de arriba siempre aplican, las de abajo sólo agregan, y no hay desempate porque se evalúan todas |
| «Hay que verificar si las asignaciones están auditadas» (RF-AUD-001) | `ServiceAssignment` está en la bitácora funcional desde antes |
| «El historial muestra sólo la asignación actual» | Muestra la trayectoria completa, ordenada, con la vigencia resuelta en el servidor. Sólo faltaba la Zona, que se hizo hoy |
| «PD-PAT-001: ¿editar un patrón cambia lo ya publicado?» | No puede. Cada turno guarda su horario como copia y la planeación publicada es inmutable |
| «PD-HIS-001: qué es vigente» | Ya está decidido: hoy cae dentro del rango, no «el más reciente» |

---

## Lo que ninguno de los cuatro documentos menciona, y conviene tener presente

**1. Los catálogos de perfil nacieron vacíos.** Sexo, rango de edad, escolaridad, equipo y motivos
de incidencia existían como pantalla y no tenían un solo valor en las ocho organizaciones. Se
sembraron hoy. Era el tipo de hueco que no aparece en ninguna matriz porque todo está «construido».

**2. Nueve de diez plantillas de turno están a medio llenar.** Ya no bloquea nada —ver la decisión
del 20 de septiembre, al final— pero sigue sin figurar como pendiente en ningún documento, y el
catálogo sigue enseñando cuáles están completas porque saberlo es útil.

**3. Incumplimientos no distingue «sin reglas» de «en regla».** El validador manual que se retiró
hoy sí lo distinguía: decía «sin reglas suficientes para concluir» cuando no había ninguna regla
activa que aplicara. Incumplimientos no lo dice, y una organización recién dada de alta enseñaría
una lista vacía que parece tranquilizadora y no lo es. Pequeño, y conviene recuperarlo.

**4. Persona física y moral** sigue pospuesto por la decisión D-04. No bloquea nada, pero sigue sin
existir.

**4-bis. Confirmar por observación tres cosas que hoy sólo están comprobadas por prueba** —que los
contratos se guardan y se leen completos, que una organización no ve la otra desde la pantalla, y
que una corrección deja su rastro visible— **queda omitido por instrucción del usuario**, el 20 de
septiembre. No se descartó porque esté hecho: se descartó porque el usuario decidió no gastar la
tanda ahí. El filtro global, el historial funcional y los contratos siguen cubiertos por las suites
de integración.

**5. RF-CLI-002 a 005, 008 a 010 y los cuatro UX** del documento original de Clientes nunca se
verificaron contra sus criterios de aceptación, porque ese documento no se subió completo. Puede que
estén cumplidos; no lo sé, y prefiero decirlo a suponerlo.

---

## Si hay que elegir por dónde seguir

1. **Llevar la lista de plantillas a la junta.** Desbloquea la pieza más grande y cuesta una
   reunión, no una tanda de trabajo.
2. **Responder PD-POS-003** —escolaridad exacta, mínima o conjunto—. Es la comparación de perfil más
   barata: los datos ya están en los dos lados.
3. **Cerrar PD-01, PD-02 y PD-03 con Fernando.** Son tres preguntas cortas que desbloquean tres
   requerimientos chicos.
4. **Disponibilidad**, cuando haya modelo. Es lo único que se parece a un módulo nuevo, y conviene
   tratarlo como tal y no como parte de una tanda.

---

## Una decisión que los documentos piden y que NO se va a hacer

**Que Planeación genere los turnos desde la plantilla del catálogo.** Los documentos lo piden —el
criterio dice «Planeación consume la misma definición»— y el 20 de septiembre de 2026 se empezó a
construir. Se revirtió antes de commitearlo, por instrucción del usuario:

> necesito que eso no esté candadeado, nosotros debemos de elegir cuándo descansan; el domingo no es
> de a fuerzas descanso, es conforme se haga la planeación

Queda anotado como **decisión**, no como pendiente, porque quien lea el documento sin esta nota lo
va a reabrir.

### Por qué pesa más que el criterio del documento

Generar desde la plantilla amarra la forma de la semana al catálogo. Dos consecuencias concretas,
las dos medidas antes de revertir:

- **El ciclo habría quedado anclado a un día fijo.** La plantilla declara días numerados y no dice
  en qué fecha empieza a contar; su `EffectiveFromDate` es «vigente desde», y las diez del catálogo
  la tienen en un jueves, que es el día en que se capturaron. Anclar ahí habría hecho que «Rol
  diurno lunes a sábado» descansara los miércoles. Anclar en lunes lo arregla y sigue siendo un
  candado: fija qué día natural le toca a cada día del ciclo.
- **Se habría perdido el número de personas por día.** El patrón propio puede pedir dos elementos el
  lunes y uno el sábado; la plantilla sólo conoce el número de la posición, igual toda la semana.
  Sobre los datos de prueba, la semana pasaba de **378 a 583 plazas**: 33 posiciones hacia arriba y
  13 hacia abajo.

### Lo que sí es cierto hoy, y conviene no romper

**El alta manual de un turno no consulta el patrón ni la plantilla.** Se puede programar a alguien
cualquier día —incluido uno que la plantilla marque como descanso— y se puede quitar. La generación
automática es una **propuesta**; lo que queda planeado es lo que alguien dejó. Ninguna validación
nueva debería quitar esa libertad.

Si más adelante hace falta que la planeación diga «este domingo sí se trabaja» de una vez para toda
la semana, es una pieza propia —una excepción declarada sobre la semana— y no se resuelve haciendo
que el catálogo mande.

---

## La segunda mitad de esa decisión: el catálogo tampoco exige el ciclo completo

**20 de septiembre de 2026**, por instrucción del usuario:

> Eso de los horarios déjalo que sea flexible para que no nos quebremos la cabeza.

Hasta ese día, una plantilla de turno sólo se ofrecía en la posición si declaraba **los siete días**
de su ciclo. El efecto medido: de las diez plantillas del catálogo, el selector ofrecía **una**.

Ahora basta con que declare **al menos un día de trabajo**. Un día sin declarar significa «aquí no
hay turno propuesto», no «aquí está prohibido trabajar»; el alta manual de un turno sigue sin
consultar ni el patrón ni la plantilla, así que se puede programar a alguien cualquier día.

Lo único que se sigue rechazando es una plantilla que no declara ni un día de trabajo: no es un
patrón de turno, no propondría un solo turno nunca. Esa es la prueba de control.

Se quitó en el repositorio (`IsAssignableAsync`), en el servicio (`ListOptionsAsync`) y en el texto
del calendario de la posición, que ahora dice que es **la referencia del patrón** y que la semana que
de verdad se trabaja se decide al planear.
