# El orden de lo que sigue

Fijado el 7 de septiembre de 2026, al cerrar la tanda de catálogos. **Es el orden acordado, no una
lista de deseos**: cada punto se hace cuando le toca, y quien lo cambie que diga por qué.

Antes de empezar el punto 1 quedan dos pasos de la tanda que se acaba de cerrar: **aplicar las tres
migraciones a `db-gestia-dev` y publicar**. Eso va primero porque el código que ya está escrito
depende del esquema nuevo.

---

## 1. La pestaña de habilidades en el expediente del empleado

**Primero, y por delante de todo lo demás.**

No requiere cambio de esquema —`EmployeeSkills` existe, con su configuración de Fluent API y sus
cuatro endpoints— y hoy **alguien puede bloquearse la publicación de una semana entera sin forma de
desbloquearla**. Eso es peor que una función faltante: una función faltante impide hacer algo, y
esto impide deshacer algo que el sistema sí dejó hacer.

Detalle completo, con la cadena verificada eslabón por eslabón:
[`TRAMPA-DE-HABILIDADES.md`](TRAMPA-DE-HABILIDADES.md).

Lo que falta es sólo la interfaz. Una pestaña en el expediente que use `listEmployeeSkills`,
`createEmployeeSkill`, `updateEmployeeSkill` y `deactivateEmployeeSkill`, con el selector de alta al
vuelo para crear la habilidad si falta del catálogo, y con la fecha de vencimiento visible, porque
la evaluación de elegibilidad ya la respeta.

Mientras tanto, la pantalla de Catálogos lo avisa en dos sitios: en la ficha del catálogo de
habilidades y al crear una regla de ese tipo.

## 2. La geografía

Las tres decisiones ya están tomadas y no se vuelven a discutir:

1. **`GeoPlaces`, tabla compartida y sin organización.** La lista es la misma para todas, y hoy son
   más de doce mil filas repetidas por cada una.
2. **Las colonias entran como recurso incrustado comprimido**, no como filas sembradas.
3. **Las cinco sedes de «Ciudad de México» se quedan con municipio nulo** (opción a).

Y un aviso que ya costó una vuelta: **el índice único de `GeoPlaces` no puede ir por nombre.** El
nombre normalizado choca 452 veces sin el padre y 10 veces con él, y esas diez son datos correctos
del INEGI —dos *San Juan Mixtepec* y dos *San Pedro Mixtepec* en Oaxaca, en distritos distintos—.
Tiene que ir por la clave del INEGI.

## 3. `Incident.IncidentType` por identificador

Ahora que el residuo `SMOKE_OPERACION` está desactivado, la migración de este campo ya no tiene
nada que la detenga.

Hoy la incidencia guarda el **texto** del motivo y la cobertura guarda su **identificador**. Los
dos hacen lo mismo y no se parecen, y la consecuencia práctica es que renombrar un motivo de
incidencia no cambia las incidencias ya registradas, sin que nada avise. La pantalla de Catálogos
lo dice hoy en la ficha del catálogo; el arreglo es que deje de ser cierto.

## 4. Los nueve códigos de negocio

`CodeClient`, `CodeEmployee` y los otros siete. **Se hace cuando decidamos cuáles estorban de
verdad**, no antes: a diferencia del código de catálogo, algunos de éstos son identificadores
visibles que la gente usa para hablar entre sí, y quitarlos por simetría sería un error.

El trabajo previo es el diagnóstico: para cada uno, quién lo lee, quién lo teclea y quién lo dice en
voz alta. Con eso sobre la mesa se decide.
