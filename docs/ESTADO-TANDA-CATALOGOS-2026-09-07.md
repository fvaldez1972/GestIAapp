# Tanda de catálogos — cerrada el 7 de septiembre de 2026

**La tanda está completa en código. Falta aplicar las tres migraciones a `db-gestia-dev` y
publicar; hasta entonces nada está commiteado y la base sigue intacta.**

81 archivos tocados: 63 modificados, 17 nuevos y 1 borrado. Tres migraciones, escritas y ensayadas
sobre copia restaurada.

Plan de origen: [`PLAN-CATALOGOS-2026-09-07.md`](PLAN-CATALOGOS-2026-09-07.md).

---

## Resumen

| Punto del plan | Estado |
|---|---|
| **6. RFC máximo 13** | ✅ **Nada que hacer.** El formato ya era correcto |
| **1. El código se va** | ✅ **Hecho.** Backend, frontend y dos migraciones ensayadas |
| **2. Alta al vuelo** | ✅ **Hecho y cableado** en Personal, Incidencias y Cobertura |
| **4. Catálogos vacíos, retirar los seis, y `Group`/`Synonyms`** | ✅ **Hecho.** Tercera migración escrita y ensayada |
| **5. Pantalla de Catálogos rehecha** | ✅ **Hecha.** Dos zonas, sin diálogo de entrada, y con pruebas |
| **3. Geografía** | ⬜ **Tanda aparte**, como acordamos |

Verificaciones: **373 pruebas de backend verdes**, **625 de frontend verdes**, `dotnet build` con
0 advertencias (recordar que en este repo una advertencia rompe el build), y `ng build` correcto.

**El orden de lo que sigue, ya acordado:**
[`design/pendientes/ORDEN-DE-LO-QUE-SIGUE.md`](design/pendientes/ORDEN-DE-LO-QUE-SIGUE.md).

---

## 1. Lo que ya está hecho

### 1.1 El RFC: no había nada que hacer

La columna ya era `varchar(13)` y el formato que valida el servidor es el oficial del SAT: tres o
cuatro letras, seis dígitos de fecha y tres caracteres de homoclave. No rechaza nada legítimo. **No
se tocó.**

### 1.2 El código desapareció del catálogo

`BusinessCatalogItem.Code` ya no existe. Con él se fue la única forma que había de referirse a un
valor de catálogo por texto.

Lo que sostiene ahora la unicidad es una **columna calculada persistida**, `NormalizedName`, que el
propio SQL Server deriva del nombre: recorta, colapsa espacios y pasa a mayúsculas, con
intercalación `Latin1_General_CI_AI` para que los acentos no cuenten. El índice único es
`(IdOrganization, Type, IdParentCatalogItem, NormalizedName)`, filtrado para dejar fuera la
geografía.

> **Por qué columna calculada y no columna normal con relleno.** EF genera
> `nullable: false, defaultValue: ""` sobre datos existentes, y en este proyecto eso ya salió mal
> tres veces. Una columna calculada no necesita relleno: nace con valor en las 12 649 filas.
>
> Hay una razón añadida y menos obvia. La migración desplegada
> `20260903211914_GeographicCatalogRelations` inserta filas de catálogo con SQL crudo listando
> columnas. Cualquier columna nueva `NOT NULL` la rompería al reproducirla desde cero. Dos pruebas
> que reproducían migraciones desplegadas se retiraron con nota explicando esto.

**El índice que yo había propuesto estaba mal.** Sin el padre, el nombre normalizado choca **452
veces** en los datos reales. Con el padre incluido quedan **10 colisiones**, y esas diez son datos
correctos del INEGI: hay dos *San Juan Mixtepec* y dos *San Pedro Mixtepec* en Oaxaca, en distritos
distintos. Por eso la geografía queda fuera del filtro.

> Anotado para la tanda de geografía: el índice por nombre que se propuso para `GeoPlaces` se
> rompería igual. Tiene que ir por clave del INEGI.

### 1.3 `RequiredCode` partido en tres

El campo era uno solo y significaba tres cosas distintas según el tipo de regla. Nada impedía
guardar el nombre de un enum de documentos en una regla de habilidad.

Ahora son tres campos, y el dominio exige **exactamente uno**:

| Tipo de regla | Campo |
|---|---|
| `Skill` | `IdRequiredCatalogItem` — clave foránea al valor de catálogo |
| `Document` | `RequiredDocumentType` — enum `EmployeeDocumentType` |
| `Evaluation` | `RequiredEvaluationType` — enum `EmployeeEvaluationType` |

La migración se escribió **a mano**, porque EF la generó al revés (borraba antes de agregar). El
orden real es **agregar → rellenar → verificar → borrar**, y la verificación es un `THROW 50000`
que detiene la migración nombrando cualquier regla que no haya mapeado. Como acordaste: la que no
mapea se desactiva, no se borra ni se inventa, y la migración se detiene si desactivaría más de
cero.

En el ensayo sobre copia restaurada, **cero reglas quedaron sin mapear**.

### 1.4 El alta al vuelo, construida y cableada

`gi-catalog-picker` es el componente nuevo. Trabaja **sólo por identificador** y tiene tres bandas
de comportamiento:

| Situación | Qué ofrece |
|---|---|
| El nombre ya existe | Lo selecciona. No ofrece crear un duplicado |
| Se parece a uno que existe | **«Usar el que existe» primero**, y «Crear … como valor nuevo» discreto debajo |
| No se parece a nada | Ofrece crearlo |

La comparación del lado del cliente usa `normalizeCatalogName`, espejo exacto de la regla del
servidor, más una distancia de edición acotada para el parecido.

**El botón de crear no se dibuja sin permiso de escritura.** Sin eso, la pantalla ofrecería crear
algo que el servidor devolvería con 403.

Cableado en tres pantallas:

| Pantalla | Catálogo |
|---|---|
| Personal, alta y edición de empleado | Puestos |
| Incidencias | Motivos de incidencia |
| Cobertura | Motivos de cobertura |

En Incidencias, el mensaje de «catálogo vacío, ve a Catálogos» **desapareció**. Obligaba a
abandonar una incidencia a medias, y una incidencia que no se registra en el momento se registra
fuera del sistema, o no se registra.

> Deuda reconocida y con tanda propia: el motivo de incidencia viaja **por nombre** porque
> `Incident.IncidentType` guarda texto; el de cobertura viaja **por identificador** porque
> `CoverageRecord` tiene su clave foránea. Que las dos no se parezcan es lo que hay que arreglar.

### 1.5 Los seis catálogos que nadie leía, retirados

`Zone`, `CancellationReason`, `DocumentRequirement`, `EvaluationRequirement`, `ClientRestriction`
y `ServiceRestriction`. Se podían llenar, y llenarlos no cambiaba nada: ninguna pantalla ni regla
del servidor leía sus valores.

La tercera migración lleva **una guarda que lanza excepción si algo los referencia** antes de
borrar nada, después el `DELETE`, y por último los dos `DROP COLUMN`.

### 1.6 `Group` y `Synonyms`, fuera

Dos columnas sin lectores, aprobadas en el diagnóstico anterior y no recogidas en el plan. Se
fueron en la misma migración que los seis catálogos.

`CatalogDefinition` perdió también su grupo: agrupar catorce catálogos en tres cajones no ayudaba
a encontrarlos.

### 1.7 El residuo `SMOKE_OPERACION`, desactivado

Basura de la prueba de humo, abierta y activa en la organización GESTIA desde el 27 de agosto.
Habría detenido la migración de `IncidentType` cuando llegue esa tanda.

**Desactivado, no borrado**, que es lo que corresponde aquí. Con respaldo verificado
(`db-gestia-dev-pre-desactivar-smoke-20260907-091114.bak`), dentro de una transacción que revierte
si el conteo no es exactamente 1, y con
`UpdatedByName = 'Limpieza de residuo de prueba de humo, 7 sep 2026'`. Después: **cero incidencias
activas sin mapear**.

### 1.8 Un defecto encontrado de paso, en la pantalla de Catálogos

Al quitar el campo de código de la pantalla quedó su control de formulario, con
`Validators.required` sobre un valor vacío. Eso dejaba el formulario **inválido para siempre**: no
se podía guardar ningún valor de catálogo. Corregido al limpiar la pantalla.

### 1.9 La pantalla de Catálogos, rehecha

|  | Antes | Ahora |
|---|---|---|
| Componente | 1 189 líneas | 1 000 |
| Plantilla | 689 | 586 |
| Estilos | 931 | **383** |
| `<select>` nativos | 19 | **0** |
| Colores escritos a mano | 134 | **0** |
| Tarjetas de conteo antes del contenido | 13 | **0** |
| Pruebas de la pantalla | 0 | **10** |

**Lo que se fue:**

- **El diálogo modal de entrada.** La pantalla recibía con un cuadro que obligaba a elegir un
  catálogo antes de ver nada. Un modal como portada es una puerta cerrada.
- **Tres navegaciones para lo mismo:** tres pestañas, una lista lateral de categorías y el propio
  diálogo llevaban al mismo sitio.
- **Trece tarjetas de conteo** antes del contenido, varias de ellas afirmando cosas falsas.
- **La columna «Usado en»**, que adivinaba comparando el nombre del valor con el texto de otros
  módulos: acertaba por casualidad y fallaba en silencio.

**Lo que quedó:**

- **Zona 1, «Lo que tu organización define»:** los cinco catálogos, cada uno diciendo **quién lo
  usa y si lo guarda por identificador o por nombre**. Esa distinción se dice en pantalla porque
  cambia lo que pasa al renombrar un valor. Cada línea se comprobó contra el código del servidor.
- **La geografía, plegada**, con la nota de que se va a un catálogo compartido.
- **Reglas de elegibilidad** con su validador, y el aviso de la trampa de habilidades donde se
  crean las reglas, no sólo en un documento.
- **Zona 2, las listas fijas del sistema**, plegadas y de sólo lectura.

La pantalla entra en la lista de `design-system.spec.ts`, que es la señal de que una pantalla ya se
rehizo: desde ahora un color a mano, un tamaño fuera de la escala o un `<select>` nativo rompen la
suite.

---

## 2. Lo que falta

### 2.1 Aplicar las tres migraciones y publicar

Cuando lo indiques. El procedimiento de siempre: respaldo `COPY_ONLY` con `CHECKSUM`, verificado
con `RESTORE VERIFYONLY`, ensayo sobre copia restaurada — **ya hecho para las tres** —, y después
`db-gestia-dev`.

### 2.2 Commits

Ninguno hecho. Los indicas tú.

---

## 3. El orden de lo que sigue

Acordado y escrito aparte, para que no se relea al revés:
[`design/pendientes/ORDEN-DE-LO-QUE-SIGUE.md`](design/pendientes/ORDEN-DE-LO-QUE-SIGUE.md).

| # | Qué | Por qué ahí |
|---|---|---|
| **1** | **La pestaña de habilidades en el expediente** | No requiere esquema, y hoy alguien puede bloquearse la publicación de una semana sin forma de desbloquearla |
| **2** | **La geografía** | Con las tres decisiones ya tomadas |
| **3** | **`Incident.IncidentType` por identificador** | Ya no lo estorba `SMOKE_OPERACION` |
| **4** | **Los nueve códigos de negocio** | Cuando decidamos cuáles estorban de verdad |

### 3.1 La trampa de las habilidades — **prioridad alta**

Documento completo: [`design/pendientes/TRAMPA-DE-HABILIDADES.md`](design/pendientes/TRAMPA-DE-HABILIDADES.md).

**Una regla de elegibilidad de tipo `Skill` se puede crear y no se puede cumplir.** La regla se
evalúa de verdad, y si es bloqueante detiene la publicación de la planeación. Pero **ninguna
pantalla permite otorgarle la habilidad a un empleado**: los endpoints existen, los métodos del
cliente Angular existen, y nadie los llama.

Quien cae en ella sólo puede salir desactivando la regla, que es lo contrario de lo que quería al
crearla. Y lo descubre al publicar la semana, que es cuando ya no hay tiempo.

Falta sólo la interfaz: una pestaña de habilidades en el expediente del empleado. No requiere
cambio de esquema.

Mientras no exista esa pestaña, la pantalla de Catálogos lo avisa en dos sitios: en la ficha del
catálogo de habilidades y al elegir «Habilidad» como tipo de regla. Además, si ya hay reglas de ese
tipo bloqueantes y activas, lo dice arriba del listado con el número exacto.

---

## 4. Archivos tocados, sin commitear

**Nuevos (17):**

```text
backend/src/GestIA.Domain/Catalogs/CatalogName.cs
backend/src/GestIA.Infrastructure/Persistence/Migrations/20260907140528_AddCatalogNormalizedName.cs (+ Designer)
backend/src/GestIA.Infrastructure/Persistence/Migrations/20260907143057_SplitEligibilityRequirementAndDropCatalogCode.cs (+ Designer)
backend/src/GestIA.Infrastructure/Persistence/Migrations/20260907152722_RetireUnreadCatalogsAndGroupSynonyms.cs (+ Designer)
backend/tests/GestIA.Domain.UnitTests/CatalogNameTests.cs
docs/ESTADO-TANDA-CATALOGOS-2026-09-07.md
docs/MODULOS-Y-ROLES.md
docs/PLAN-CATALOGOS-2026-09-07.md
docs/design/pendientes/TRAMPA-DE-HABILIDADES.md
docs/design/pendientes/ORDEN-DE-LO-QUE-SIGUE.md
frontend/src/app/features/catalogs/pages/catalogs-page/catalogs-page.spec.ts
frontend/src/app/shared/ui/gi-catalog-picker/  (componente + prueba)
frontend/src/app/shared/util/catalog-name.ts  (+ prueba)
```

**Borrado (1):** `frontend/src/app/features/workforce/ui/job-position-missing.ts` — era el aviso
de «no hay puestos, ve a Catálogos». El alta al vuelo lo deja sin objeto.

**Modificados (63):** dominio, aplicación, infraestructura y API del lado del catálogo y la
elegibilidad; el sembrador demo; y del lado del frontend, los modelos, la pantalla de Catálogos
completa —componente, plantilla y estilos—, los formularios de incidencia y cobertura, el
formulario de empleado, `design-system.spec.ts` y varias pruebas.
