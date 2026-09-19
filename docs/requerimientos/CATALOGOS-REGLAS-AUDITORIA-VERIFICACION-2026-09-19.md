# Catálogos, reglas y auditoría — verificación y plan

**19 de septiembre de 2026 · rama `s0/feature/gestIaProject/filtro-organizacion`, commit `abd63e4`,
40 migraciones**

Cuarto y último documento de la serie, verificado contra el código y contra `db-gestia-dev`. El
consolidado acierta en los números —40 migraciones, 436 pruebas de backend, 813 de frontend— y se
equivoca en cinco cosas de fondo, todas a favor del sistema menos una.

---

## Parte 1 · Lo que ya está hecho y el consolidado da por pendiente

### 1.1 · La jerarquía de reglas existe, con sus cuatro niveles, y la cascada también

El consolidado dice que hoy hay **dos niveles** y que los cuatro son «lo nuevo de verdad». No es
así. El modelo declara los cuatro desde antes:

```csharp
public enum EligibilityRequirementTargetType { Organization, Client, Service, Position }
```

Y el motor ya los aplica en cascada:

```csharp
requirement.TargetType == EligibilityRequirementTargetType.Organization ||
(idClient.HasValue   && requirement.IdClient   == idClient.Value) ||
(idService.HasValue  && requirement.IdService  == idService.Value) ||
(idPosition.HasValue && requirement.IdPosition == idPosition.Value)
```

**Eso responde las dos preguntas que el consolidado llama «lo único genuinamente bloqueado»:**

- **PD-REG-001** — una regla de nivel inferior **sólo agrega**. No reemplaza ni desactiva nada: la
  condición es una disyunción, así que las de organización se evalúan siempre. Es exactamente la
  recomendación del consolidado, y ya está construida.
- **PD-REG-002** — no hace falta un algoritmo de desempate porque **no hay desempate**: si el mismo
  requisito está en cuatro niveles, se evalúan los cuatro y cada uno aporta su motivo. Determinista
  por construcción.

### 1.2 · El historial de asignaciones ya está casi entero

El consolidado presenta RF-HIS-001 a 005 como trabajo por hacer. La consulta no filtra por activas
ni por fecha de fin, ordena descendente y resuelve la vigencia en el servidor:

```csharp
fila.StartDate <= today && (fila.EndDate == null || fila.EndDate >= today)
```

| | Estado |
|---|---|
| **RF-HIS-001** · Trayectoria completa | **Existe** |
| **RF-HIS-002** · Orden descendente | **Existe** |
| **RF-HIS-003** · Vigente resaltado | **Existe**, y con una sola regla en el servidor |
| **RF-HIS-004** · Tipo de asignación | **Existe** |
| **RF-HIS-005** · Zona | **Falta.** Es lo único |

Y **PD-HIS-001 ya está decidido de hecho**: vigente es «hoy cae dentro del rango», no «el registro
más reciente». La pantalla ni siquiera lo infiere, lo recibe resuelto.

### 1.3 · La auditoría de asignaciones ya existe

RF-AUD-001. El consolidado dice que «hay que verificar si `ServiceAssignment` está en la bitácora
funcional». Está, y desde antes de esta jornada:

```csharp
entity is AttendanceRecord or Incident or CoverageRecord or ServiceAssignment or BusinessCatalogItem
```

### 1.4 · PD-PAT-001 no necesita decidirse: el modelo ya la respondió

El consolidado la llama «la importante» de las dos técnicas. Editar un patrón **no puede** cambiar
turnos ya generados, porque `ScheduledShift` guarda su propio horario —fecha, hora de inicio y hora
de fin— como copia, no como referencia al patrón. Y una versión publicada es inmutable.

Así que las dos opciones que el documento plantea —«actualiza todas las posiciones» o «genera una
versión nueva»— dan el mismo resultado sobre lo ya publicado: **no lo tocan**. La pregunta sólo
afecta a lo que se genere después, y ahí lo natural es que el patrón editado valga.

### 1.5 · «Registro bloqueante» es «Restricción bloqueante», y no hay ninguna

No existe ningún campo con ese nombre. Lo que el video describe es el **cuarto tipo de regla** del
desplegable de Catálogos, rotulado «Restricción bloqueante».

En datos: **cero reglas de ese tipo**, ni activas ni inactivas. Document 9, Evaluation 4, Skill 16.
Retirarlo no cuesta un solo registro.

> **Esto toca una decisión de hoy.** Esta tarde se aprobó que una restricción bloquea por lo que es
> y no por una marca, porque no apunta a ningún catálogo del que heredar la severidad. Si el tipo se
> retira, esa decisión deja de aplicar a nada. Conviene resolver las dos juntas y en este orden:
> primero si el tipo se va, y sólo si se queda, cómo se comporta.

---

## Parte 2 · El hueco que creí encontrar, y que no existe

**Esta parte decía que al asignar no se consideraban las reglas de cliente ni de servicio. Es
falso, y lo escribí sin comprobarlo hasta el final.**

Lo que vi fue cierto por separado: el motor filtra las reglas por el contexto que recibe, y
`AssignmentService` lo llama con el cliente y el servicio en nulo.

```csharp
new EligibilityCheckQuery(idOrganization, idEmployee, null, null, idPosition, effectiveDate)
```

Lo que no miré es lo que pasa **entre** esas dos cosas. `CheckEligibilityAsync` resuelve el contexto
antes de evaluar nada:

```csharp
if (query.IdPosition.HasValue)
{
    var position = await repository.GetPositionAsync(...);
    return (position.Service.IdClient, position.IdService, position.IdPosition);
}
```

La posición determina su servicio y el servicio su cliente, así que los nulos se rellenan solos con
exactamente el alcance correcto. **Una regla de nivel Cliente sí impide asignar.** Comprobé los dos
extremos y no el tramo de en medio.

Lo descubrió la única comprobación que podía descubrirlo: retirar el arreglo y volver a correr las
pruebas. Pasaron igual, y una prueba que pasa con y sin el cambio no prueba el cambio. El arreglo
era un no-op que además repetía una consulta que el motor ya hace.

**Lo que queda de esto:** cuatro pruebas que fijan la garantía —una regla de cliente y una de
servicio impiden asignar, sin regla la misma asignación pasa, y una regla de otro cliente no
estorba— y un comentario donde están los nulos, explicando por qué son correctos. La garantía
existía y no se veía en el sitio donde uno la busca, que es justo lo que alguien rompe más tarde
«limpiando» una resolución que parece redundante.

**El paso 1 del plan desaparece.** No había nada que cerrar.

---

## Parte 3 · El bloque de patrones, con su tamaño real

Lo más grande que queda, y el consolidado acierta en que **ya no espera la junta**: las tres
preguntas de Óscar y Joab afinan *qué declara una plantilla*; esto decide *de dónde sale el patrón
de una posición*. Son cosas distintas.

Pero el tamaño no es el que dice. Sobre las **66 posiciones activas**:

| | Cuántas |
|---|---|
| Con plantilla del catálogo | **2** |
| Con patrón propio capturado | **51** |
| **Sin patrón de ningún tipo** | **13** |

El catálogo tiene 12 plantillas, 10 activas. Los patrones propios son 56, con 261 segmentos
semanales.

**Las 13 sin patrón son el problema que el documento no vio.** El proceso que describe —comparar la
configuración manual contra las plantillas y asociar donde coincida— no se les puede aplicar: no hay
nada que comparar. No es que no coincidan; es que no hay configuración.

Hoy esas 13 no generan turnos, así que el problema ya existe y sólo se vuelve visible cuando el
patrón pase a ser obligatorio.

---

## Parte 4 · Lo que hay que decidir

Dos cosas, y ninguna es la que el consolidado señalaba.

### 4.1 · Las 13 posiciones sin patrón

Cuando el patrón del catálogo sea obligatorio, ¿qué pasa con ellas?

| | Qué implica | Costo |
|---|---|---|
| **A · Se marcan y se quedan** | Quedan sin patrón y sin poder planearse, visiblemente marcadas para revisión | Bajo. Conserva la verdad: nadie declaró su horario |
| **B · Se les asigna una plantilla por omisión** | Alguien elige un patrón «normal» y se les pone | Bajo, y **inventa un horario que nadie declaró**. No lo recomiendo |
| **C · Se desactivan** | Se retiran del catálogo de posiciones | Medio, y decide por el negocio que esos puestos no existen |

**Mi recomendación: A.** Es el mismo criterio que ya se aplicó dos veces —el puesto que no mapeó
quedó nulo, y la calle que no se podía partir no se partió—: lo que no se puede reconciliar no se
inventa, se marca. Y la marca tiene que verse en la pantalla, no sólo en un log de la migración.

### 4.2 · El tipo «Restricción bloqueante»

¿Se retira, como pide RF-REG-005, o se queda? No hay datos que dependan de la respuesta —cero
reglas— así que es una decisión de modelo, no de migración.

**Mi recomendación: retirarlo.** Su efecto lo absorbieron las incidencias administrativas, que son
mejores para lo mismo: dejan constancia con fecha, tipo y detalle, y se retiran sin borrarse. Una
restricción era una regla sin requisito, que es justamente lo que la hacía rara de resolver.

Si se retira, lo de esta tarde se simplifica en vez de complicarse: `Severity` vuelve a ser una sola
línea.

---

## Parte 5 · El plan propuesto

| | Paso | Necesita | Migración |
|---|---|---|---|
| **1** | La Zona en el historial de asignaciones | Nada | No |
| **2** | Retirar «Validar a una persona» de Catálogos, y las listas fijas | Nada. Incumplimientos ya la sustituye | No |
| **3** | Retirar el tipo «Restricción bloqueante» | **4.2** | Sí, con rastro |
| **4** | El bloque de patrones: retirar la creación desde la posición, los segmentos manuales y el patrón propio; calendario de sólo lectura | **4.1** | Sí |
| **5** | La migración de las 51, con las 13 marcadas y evidencia | **4.1** | Sí |

El paso que encabezaba esta lista —cerrar el hueco de la asignación— se retiró: no había hueco. Lo
que queda de aquel trabajo son las cuatro pruebas que fijan la garantía.

---

## Parte 6 · Lo que no entra

**RF-CAT-003, las listas fijas.** Ya están plegadas y en sólo lectura desde el 7 de septiembre. El
documento las quiere fuera de la pantalla; es un cambio de presentación sin riesgo, y cabe en la
tanda del paso 3. Ojo con su tercer criterio: se ocultan, no se retiran, porque las referencias
internas siguen vivas.

**PD-PAT-002, retirar un patrón en uso.** No hace falta decidirla aparte: el principio 3 del
proyecto ya dice que nada se borra, y el catálogo ya tiene activo/inactivo. Lo único que falta es
que la pantalla avise de cuántas posiciones lo usan antes de retirarlo.

**PD-HIS-002, referencias vivas o fotografía.** Tiene precedente y conviene seguirlo, pero no bloquea
la Zona: el historial de asignaciones lee nombres vivos hoy, y cambiar eso es una tanda propia con
su propia migración.

---

## Parte 7 · Lo que doy por supuesto

1. Que el cliente y el servicio se resuelven **desde la posición** y no se le piden a quien llama.
   Sigue siendo el criterio correcto; resulta que el sistema ya lo hacía.
2. Que la Zona del historial es la del servicio de esa asignación, leída hoy, no una fotografía del
   momento en que se asignó.
3. Que marcar una posición para revisión significa que se ve en la pantalla de posiciones, no sólo
   en la evidencia de la migración.

---

# Parte 8 · Lo que quedó construido, y dónde me detuve

## Pasos 1 a 4, hechos

**Paso 1 · La Zona en el historial** (RF-HIS-005). Sale del servicio de cada asignación y se lee
hoy, según la decisión tomada: si la zona se renombra, el historial enseña el nombre nuevo. La fila
dice ahora cliente, zona y servicio, en ese orden, que es como se baja por la estructura. Sin ella,
dos servicios homónimos de un cliente grande no se distinguían en la trayectoria de una persona.

**Paso 2 · Fuera «Validar a una persona» y las listas fijas** (RF-CAT-002, RF-CAT-003). Se retiró la
pantalla y también su código: el formulario, sus cuatro selectores de contexto y los métodos. Media
jubilación —quitar el botón y dejar la capacidad viva— habría dejado a quien lea esto mañana sin
saber si sigue en uso.

**Pendiente que deja abierto:** el validador distinguía tres estados y no dos. Además de «elegible»
y «no elegible», decía **«sin reglas suficientes para concluir»** cuando la organización no tenía
ninguna regla activa que aplicara a esa persona. La diferencia no es cosmética: «elegible» afirma
que se comprobó y se cumplió; «sin reglas suficientes» admite que no se comprobó nada. Tratarlas
igual convierte la ausencia de configuración en un visto bueno.

Incumplimientos no lo dice hoy: lista a quien incumple algo, y quien no tiene ninguna regla que
incumplir simplemente no aparece —que se lee como que está en regla—. Conviene recuperarlo ahí,
porque es la pantalla que heredó el trabajo: una organización recién dada de alta, sin reglas
configuradas, enseñaría una lista vacía que parece tranquilizadora y no lo es.

**Paso 3 · Retirado el tipo «Restricción bloqueante»** (RF-REG-005). Desaparece del desplegable y
**el servidor lo rechaza**, porque quitarlo de la pantalla sola no es protegerlo. El miembro del
enum se conserva —el tipo se persiste como texto y borrarlo dejaría ilegible cualquier fila que lo
tuviera— y una migración desactiva las que hubiera. En `db-gestia-dev` no había ninguna.

Con esto, la decisión de la tarde sobre cómo se comporta una restricción **queda sin objeto**. No se
revirtió por capricho: se retiró aquello de lo que era excepción, y `Severity` vuelve a una línea.

**Paso 4 · La posición deja de configurar horarios** (RF-PAT-001 a 004). Se fueron las dos secciones
editables —patrones propios y segmentos semanales—, sus dos modales y el código que las servía. En
su lugar hay un calendario de sólo lectura que pinta lo que declara el patrón del catálogo, con su
ciclo y sus horas.

## Paso 5 · Dónde me detuve, y por qué

**La migración de las 51 posiciones no se hizo, y no debe hacerse todavía.**

El proceso que pide RF-PAT-005 es comparar cada configuración manual contra las plantillas
existentes y asociar donde haya coincidencia. Lo medí antes de escribirlo:

| | |
|---|---|
| Patrones propios activos | 56, con **8 formas distintas** entre ellos |
| Plantillas activas del catálogo | 10 |
| …**completas**, que son las únicas que el selector ofrece | **1** |
| Coincidencias exactas entre un patrón propio y una plantilla | **0** |

Las nueve plantillas incompletas tienen días del ciclo sin declarar, y un día sin declarar no es un
descanso: el sistema ya lo sabe y por eso no las ofrece. «Rol diurno lunes a sábado» declara seis
días de siete; «Diurno smoke», uno de siete.

Así que hacer obligatorio el patrón del catálogo hoy dejaría **64 de 66 posiciones sin poder
planearse**, y la asociación automática no tendría contra qué asociar.

### El bloque de patrones no está bloqueado por el modelo. Está bloqueado por los datos

**La distinción importa porque cambia a quién hay que pedirle qué.**

El consolidado daba por hecho que este bloque esperaba las tres preguntas de la junta —descansos,
festivos, cubre-descansos—, y acertaba al decir que ya no: el modelo está construido. `ShiftPatternTemplate`
existe con su ciclo, la posición puede apuntarle, el generador puede leerla y la pantalla ya la
pinta. **Nada de eso espera una decisión.**

Lo que falta son **datos**: nueve de las diez plantillas activas tienen días del ciclo sin declarar,
y hasta que alguien diga qué se trabaja y qué se descansa cada día, no se pueden usar. No es un
requerimiento pendiente ni una pregunta de diseño; es un catálogo a medio llenar.

| | Quién lo resuelve | Qué hay que pedirle |
|---|---|---|
| El modelo | Nadie. Está hecho | — |
| Los datos | **Operación**, en la junta | Qué días son de descanso en cada patrón, y cuál de cada pareja duplicada se queda |
| La migración | Se escribe sola en cuanto los datos estén | — |

Y hay una medición que le pone tamaño: **de las 53 posiciones con horario propio, 51 encajarían
exactamente** con una plantilla existente si los días que faltan fueran de descanso. Con dos
confirmaciones —el día 7 del rol diurno y los días 2, 4 y 6 del nocturno— quedan enlazadas 46. La
lista completa, en `PLANTILLAS-DE-TURNO-PARA-LA-JUNTA-2026-09-19.md`.

**Lo que sí se hizo:** la marca de revisión, visible donde se miran las posiciones y no sólo en la
evidencia de una migración. Una posición sin patrón del catálogo lo dice en su tarjeta, y la opción
del selector dejó de llamarse «Conserva su patrón propio» —que sonaba a decisión— para decir «Sin
patrón del catálogo · queda pendiente de revisión», que es lo que es.

**Lo que falta, y es de negocio:** completar las nueve plantillas. Hasta entonces, retirar el patrón
propio apagaría la planeación de casi todo el sistema.

## Pruebas

| Suite | Resultado |
|---|---|
| Dominio | 78 |
| Aplicación | 86 |
| Arquitectura | 52 |
| Integración | **224** |
| Frontend | **811** |

Las cuatro de `AssignmentScopeEligibilityTests` fijan la garantía del hueco que no existía. Dos del
frontend se retiraron con la función que probaban —el segmento semanal y el patrón propio— y una
entró con la Zona.
