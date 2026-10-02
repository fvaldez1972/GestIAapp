# Posiciones, matching y asignación — verificación y plan

**19 de septiembre de 2026 · rama `s0/feature/gestIaProject/filtro-organizacion`, commit `b8ac22e`,
38 migraciones**

Verifica el consolidado de Posiciones contra el código y contra `db-gestia-dev`. No contra
documentación: es la tercera vez en esta jornada que un consolidado afirma cosas que el sistema no
hace, y las dos anteriores costaron construir sobre supuestos falsos.

---

## Parte 1 · Lo que el consolidado dice mal

Seis afirmaciones. Cuatro a favor del sistema, dos en contra.

### 1.1 · La posición NO tiene vigencia. RF-POS-004 no está cumplido

El consolidado lo da por existente. La tabla `Positions` tiene 24 columnas y **ninguna es una fecha
de negocio**: no hay `StartDate` ni `EndDate`.

La vigencia que existe es la del **servicio**, no la del puesto. Son cosas distintas: un servicio
vigente todo 2026 puede tener una posición de refuerzo que sólo va de octubre a diciembre, y hoy eso
no se puede expresar.

El propio *Definition of Done* del documento fuente lo pide —«La Posición tenga vigencia»—, así que
no es un detalle: **falta, y lleva migración.**

### 1.2 · El tipo de asignación y el titular YA existen

El consolidado los da por bloqueados por PD-POS-008 y PD-POS-009. No lo están:

```text
ServiceAssignment.AssignmentType  ->  enum { Primary, Support, Relief, TemporaryReplacement }
ServiceAssignment.IsPrimary       ->  bool
```

En datos: 151 asignaciones activas, **38 con un tipo distinto de titular** y **112 marcadas como
principal**. Se está usando.

Lo que los pendientes deciden no es si se construye, sino **si el enum pasa a catálogo por
organización** (PD-POS-008) y **si se limita cuántos titulares admite una posición** (PD-POS-009).
Eso es afinar algo que funciona, no construirlo.

### 1.3 · El solapamiento ya se valida

RF-ASG-004 pide que no existan solapamientos incompatibles para la misma persona. `AssignmentService`
tiene `EnsureNoOverlapAsync` y corre antes de crear y de editar. El consolidado no lo menciona.

### 1.4 · El matching contra el perfil ya empezó

El consolidado dice que a RF-ASG-007 «le falta el perfil». Le falta una parte. La comparación de
**puesto** ya existe y ya bloquea:

```csharp
if (JobPositionEligibility.IsBlocked(position.IdJobPositionCatalogItem, employee.IdJobPositionCatalogItem))
    throw new ResourceConflictException("El empleado no tiene el puesto que la posición requiere.");
```

Y trata el nulo como «no se sabe», no como «no cumple», que es el criterio que hay que repetir en
los criterios nuevos.

### 1.5 · La escolaridad no es una regla de comparación: es un campo que no existe

El consolidado presenta RF-MAT-004 como «nuevo, y necesita PD-POS-003: ¿exacta, mínima, o conjunto
aceptado?».

La pregunta está bien y llega tarde, porque **la persona no tiene escolaridad**. `Employees` no tiene
ninguna columna de escolaridad, ni texto ni identificador. La posición sí la tiene desde hoy, como
`IdEducationLevelCatalogItem`.

O sea que RF-MAT-004 no es una regla: es **columna nueva, migración, captura en la ficha, y después
la regla**. Es el doble de trabajo de lo que aparenta.

### 1.6 · El sexo no es comparable, y el rango de edad no es un rango

Dos problemas distintos que el consolidado junta bajo «bloqueado por revisión legal»:

**El sexo de la persona es texto libre** y el de la posición es identificador de catálogo. En datos:
«Masculino» 161, «Femenino» 80, nulo 30. Compararlos exige homologar el lado de la persona primero.

**El rango de edad no tiene números.** Una entrada de catálogo guarda nombre, descripción, orden,
padre y marca de bloqueo. «18 a 30 años» es un **nombre**. Comparar la edad de alguien contra eso
exigiría leer el texto del nombre y sacarle los números, que es frágil y además decide por nombre
visible, en contra del principio 4. Para compararlo de verdad hacen falta dos columnas numéricas en
el catálogo.

La edad de la persona sí se puede calcular: 241 de 271 tienen fecha de nacimiento.

---

## Parte 2 · El hueco que ningún documento menciona: los catálogos están vacíos

**Esto es más urgente que el matching, y no aparece en ninguno de los tres documentos.**

Los catálogos de perfil se construyeron ayer y hoy. Existen como tipo, tienen pantalla, tienen
endpoints. Y en `db-gestia-dev`, con ocho organizaciones vivas:

| Catálogo | Valores capturados |
|---|---|
| Sexo | **0** |
| Rango de edad | **0** |
| Escolaridad | **0** |
| Equipo requerido | **0** |
| Incidencias administrativas | **0** reales (las 2 que hay son de mi verificación, inactivas) |

No se siembran en el alta de organización —que sólo siembra geografía, grupos de documento,
categorías de documento, evaluaciones y propósitos de contacto— ni los sembró ninguna migración.

La consecuencia práctica: **los tres selectores de perfil de la posición y el de equipo salen
vacíos**, y la pestaña de incidencias administrativas no deja registrar nada porque no hay ningún
motivo que elegir. Lo construido ayer no se puede usar todavía.

Y encadena con el matching: no tiene sentido construir un motor que compare escolaridad contra una
posición que no puede declarar escolaridad porque la lista está vacía.

**Es media hora de trabajo y desbloquea lo demás.**

---

## Parte 3 · El tamaño real

| | Cuántos |
|---|---|
| Ya cumplidos, verificados contra el código | 26 |
| Cumplidos pero **inutilizables** hasta sembrar catálogos | 5 |
| Falta construir, sin esperar a nadie | 3 |
| Falta construir, esperando definición | 4 |
| Bloqueados por revisión de cumplimiento | 2 |

Lo que se puede hacer hoy sin preguntarle a nadie:

1. **Sembrar los cinco catálogos** (Parte 2).
2. **La vigencia de la posición** (1.1). Lleva migración.
3. **La escolaridad de la persona** (1.5). Lleva migración, y la captura.

Con esas tres, el matching de escolaridad queda a una decisión de distancia en vez de a tres.

---

## Parte 4 · La única pregunta que bloquea

**RF-POS-010 / PD-POS-006: ¿de dónde sale la naturaleza de un requisito?**

El documento pide una sola fuente y propone quitar la casilla «Que la nueva impida asignar si no la
tiene» de la posición. Eso choca con PD-04, que se resolvió esta mañana al revés: el catálogo pone el
valor por omisión y la regla puede afinarlo.

### Lo que dicen los datos, que cambia la respuesta

| Medición sobre `db-gestia-dev` | |
|---|---|
| Reglas de elegibilidad activas | 19 |
| …con marca propia (no nula) | **19, todas** |
| …de las cuales bloquean | 13 |
| Valores de catálogo marcables | 175 |
| …con marca de bloqueo puesta | **2**, y las dos son de mi verificación, inactivas |
| Valores de catálogo con dos severidades distintas entre reglas | **0** |

Dos lecturas, y las dos importan:

**La contradicción que el documento teme no existe en los datos.** Ningún requisito está hoy
configurado como bloqueante en un sitio e informativo en otro. Es un riesgo del modelo, no un defecto
vivo.

**Y la opción A, aplicada tal como está escrita, sería una regresión.** Si la naturaleza pasa a salir
sólo del catálogo, y el catálogo no dice nada en 173 de 175 valores, entonces
`IsBlocking ?? catálogo ?? false` devuelve **falso**: las 13 reglas que hoy bloquean dejarían de
bloquear, en silencio, el día del despliegue. Es exactamente lo que decidimos no hacer con las
incidencias: quitar una protección ya puesta.

### Las tres opciones, con su costo

| | Qué implica | Costo | Qué se pierde |
|---|---|---|---|
| **A tal cual** | Se quita la casilla y se deja de leer `IsBlocking` de la regla | Bajo | **13 reglas dejan de bloquear.** No lo recomiendo |
| **A con retrocarga** | Una migración copia la marca de cada regla a su valor de catálogo; después se deja de leer la de la regla y se quita la casilla | Una migración + retirar lectores + ajustar la pantalla. Medio | Que la misma experiencia sea bloqueante en una posición e informativa en otra. **Hoy: 0 casos** |
| **B · statu quo** | Se queda como está, con el catálogo como sugerencia | Ninguno | No cumple el criterio 3 de RF-POS-010 |

**Mi recomendación: A con retrocarga.** Cumple el requerimiento al pie, y la retrocarga es
determinista justamente porque no hay ningún valor con dos severidades: cada valor de catálogo recibe
la única marca que sus reglas le dan. Sin ese paso, A es la quinta versión del mismo error de hoy
—una protección que deja de proteger sin que nadie se entere—.

---

## Parte 5 · El plan propuesto

Nada de esto se toca hasta que se apruebe.

| | Paso | Necesita | Migración |
|---|---|---|---|
| **1** | Sembrar los cinco catálogos vacíos, para las 8 organizaciones y para las nuevas | Nada | Sí, una |
| **2** | Vigencia de la posición, con la coherencia contra la del servicio | Nada | Sí |
| **3** | Escolaridad de la persona, por identificador de catálogo, y su captura | Nada | Sí |
| **4** | Retirar la doble fuente de bloqueo, con retrocarga | **La respuesta a la Parte 4** | Sí |
| **5** | Matching de escolaridad | PD-POS-003 | No |
| **6** | Tipos de asignación a catálogo, y límite de titulares | PD-POS-008, PD-POS-009 | Sí |
| **7** | Equipo requerido en el matching | PD-POS-005 | Depende |
| **8** | Patrón obligatorio desde catálogo | PD-POS-007 | Sí |
| **9** | Disponibilidad | PD-POS-004 | Entidad nueva |
| **10** | Sexo y edad como bloqueo | Revisión de cumplimiento | Sí |

Los pasos 1 a 3 son una migración cada uno, y las tres se pueden juntar en una sola si se prefieren
menos tandas de respaldo y ensayo. **Los pasos 1 a 4 caben en una jornada.**

El paso 8 tiene tamaño medible: de 69 posiciones, **3 usan el patrón del catálogo y 66 siguen con
patrón propio**. No es un interruptor, es una migración de datos con decisión de negocio detrás.

---

## Parte 6 · Lo que no entra, y por qué

**La disponibilidad (RF-MAT-003).** El documento la marca crítica antes de Planeación y admite que no
tiene modelo: no define cómo se captura, cómo se compara ni qué es un conflicto. No existe nada en el
sistema de lo que colgarla. Es un módulo propio, no un paso de esta tanda.

**Sexo y edad como bloqueo (RF-MAT-005, RF-MAT-006).** No por dificultad técnica: porque el propio
documento pide aprobación formal de cumplimiento antes de convertir un dato demográfico en regla de
exclusión, y esa aprobación no la puede dar el equipo técnico. Los campos se capturan y se muestran;
la severidad espera.

**La evidencia obligatoria en incidencias (RF-INC-ADM-003).** Sigue esperando PD-PER-004, igual que
ayer.

---

## Parte 7 · Lo que doy por supuesto

1. Que la vigencia de la posición debe caber dentro de la del servicio, y que salirse es un error, no
   un aviso.
2. Que la escolaridad de la persona se captura por identificador de catálogo, igual que el puesto, y
   que un nulo significa «no se sabe» y no bloquea.
3. Que sembrar un catálogo con valores por omisión no impide que cada organización los edite o los
   desactive después, igual que pasó con los tipos de documento.

---

# Parte 8 · Lo que quedó construido

**Los pasos 1 a 4, sin aplicar todavía a `db-gestia-dev`.** Dos migraciones: una para los pasos 1, 2
y 3 juntos, con el paso 1 primero; otra sola para la retrocarga del paso 4.

## La sexta aparición de la trampa del `defaultValue`

EF generó `StartDate` con `defaultValue: new DateOnly(1, 1, 1)`, que habría puesto el año 1 en las
69 posiciones existentes. Se reescribió a mano: columna nulable, relleno con la vigencia del
servicio al que pertenece cada puesto, y sólo entonces `NOT NULL`. La restricción de coherencia se
agrega después del relleno, porque sobre filas a medio llenar fallaría.

El SQL generado se revisó buscando `default`: no aparece ninguno.

## Lo que la retrocarga va a hacer, medido sobre `db-gestia-dev`

| | |
|---|---|
| Valores de catálogo que reciben marca | **19** |
| …de ellos, bloqueantes | **13** |
| …informativos | 6 |
| Reglas activas que quedan sin lector | **19** |
| Valores con dos severidades en conflicto | **0** |

Es uno a uno: cada regla apunta a su propio valor de catálogo, ninguno recibe dos marcas. Las 13
reglas que hoy impiden asignar seguirán impidiéndolo, ahora desde el catálogo. **El comportamiento
no cambia; cambia de dónde sale.**

La columna `IsBlocking` de `EligibilityRequirement` **no se borra**: queda sin lector, que es
distinto de vaciarla. El perfil de la entidad dejó de llevarla, así que editar una regla tampoco la
pisa.

## Una consecuencia que la suite destapó, y la decisión que hubo que tomar

Al estrenar la fuente única, una prueba de cobertura se puso roja: **una regla de tipo
«Restricción» dejó de prohibir**. No apunta a ninguna entrada del catálogo —no exige nada,
prohíbe—, así que heredaba de un catálogo que no tiene y quedaba informativa siempre.

**Decisión tomada: una restricción bloquea por lo que es, no por una marca.** Una prohibición que
no prohíbe es una nota. No reabre la doble fuente, porque no hay dos sitios que puedan
contradecirse: se resuelve por el tipo de la regla. En `db-gestia-dev` hay **0 reglas de
restricción**, así que no cambia nada vivo; queda escrito por si negocio prefiere otra cosa.

## Lo construido, por pieza

**Paso 1 · Los cinco catálogos.** `ProfileCatalogSeed` con 32 valores: 3 de sexo, 4 rangos de edad,
7 niveles de escolaridad, 9 piezas de equipo y 8 motivos de incidencia. Los siembra la migración
para las 8 organizaciones vivas y `OrganizationCatalogDefaults` para las que vengan, que es la única
forma de que una organización creada mañana tenga lo mismo que una creada ayer. De los 8 motivos de
incidencia, **sólo dos nacen bloqueando** —abandono de puesto y suspensión vigente—; los demás dejan
constancia.

**Paso 2 · La vigencia de la posición.** `StartDate` obligatoria y `EndDate` opcional, con
`CK_Positions_DateRange`. Que caiga dentro de la del servicio se valida en el servidor, con el
mensaje diciendo la fecha límite. Una petición sin fechas hereda la del servicio, que mantiene el
alta mínima.

**Paso 3 · La escolaridad de la persona.** `IdEducationLevelCatalogItem`, nulable, con el mismo
criterio que el puesto: un nulo dice «no se sabe» y no bloquea. Se captura desde la ficha.

**Paso 4 · La fuente única.** La casilla «Que la nueva impida asignar si no la tiene» desaparece de
la posición, y el selector de severidad desaparece del editor de reglas. Las dos pantallas dicen
ahora de dónde sale la marca.

## Pruebas

**8 nuevas** en `PositionValidityAndSeverityTests`, y la que de verdad importa es
`TheRuleOwnMarkNoLongerDecidesAnything`: escribe a mano la marca en la columna de la regla, por EF,
y exige que **no** bloquee. Si alguien vuelve a leer esa columna, la prueba se pone roja. Sin ella,
volver a la doble fuente no rompería nada visible.

Con su control al lado —`TheCatalogMarkDecidesTheSeverity`—, porque ver «no bloquea» sin él no
distinguiría la regla ignorada de un motor que no bloquea por nada.

| Suite | Resultado |
|---|---|
| Dominio | 78 |
| Aplicación | 86 |
| Arquitectura | 52 |
| Integración | **220** |
| Frontend | **813** |

## Lo que falta para que esto sirva

**Aplicar las dos migraciones y publicar.** Hasta entonces, `db-gestia-dev` sigue con los cinco
catálogos vacíos y el binario desplegado sigue leyendo la marca de la regla.
