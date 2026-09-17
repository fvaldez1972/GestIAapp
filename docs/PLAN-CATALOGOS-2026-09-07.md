# Plan de la tanda de catálogos — 7 de septiembre de 2026

**Estado: PLAN. No se ha ejecutado nada.** Todos los números salen de leer el código y de consultas
de sólo lectura contra `db-gestia-dev`.

El objetivo que ordena la tanda, en las palabras con que se dio:

> Que el administrador no tenga que ir a Catálogos antes de trabajar. Hoy la pantalla enseña los
> catorce de golpe y el sistema le pide llenarlos; quiero lo contrario: que empiece a trabajar y los
> vaya creando desde donde los necesita.

---

## Resumen para decidir

| # | Punto | Veredicto | Migración |
|---|---|---|---|
| 1 | El código se va | **Se puede**, acotado al catálogo. Un uso **no** se resuelve por identificador y hay que partirlo en dos | 2 migraciones |
| 2 | Alta al vuelo | **Se puede.** Ya existe la pieza compartida; hay que rehacerla | ninguna |
| 3 | Geografía a tabla propia | **Se puede**, y es lo que más ahorra: **el 99,3 % del catálogo es geografía** | 3 migraciones |
| 4 | Catálogos vacíos + retirar los seis | **Se puede.** Los seis están confirmados sin lectores | 1 migración |
| 5 | Pantalla rehecha | **Se puede.** Hoy muestra **38 tarjetas**, no catorce | ninguna |
| 6 | RFC máximo 13 | **Ya está hecho.** Las tres columnas son `varchar(13)` desde siempre | ninguna, salvo que quieras aflojar el formato |

**Tres cosas que hay que decidir antes de empezar**, todas con evidencia abajo: qué se hace con las
seis reglas de elegibilidad que no apuntan a un catálogo (1.3), de dónde sale el dato de colonias
(3.2), y si «pueden ser menos» significa aflojar el formato del RFC (6).

**Y una recomendación de partición: el punto 3 va en tanda aparte.** Es la única pieza con relleno
de datos vivos sobre 145 registros de dirección, y mezclarla con el resto haría que un problema de
geografía pareciera un problema de códigos.

---

## 1. El código se va

### 1.1 Hasta dónde llega, y por qué

Hay **doce columnas de código** en el dominio. No son la misma cosa, así que el retiro se acota
**al catálogo**, que es lo que cierra la frase con la que definiste el resultado esperado: *«la
palabra código no aparece en ninguna pantalla, en ningún contrato y en ninguna columna de
catálogo»*.

**Se va:**

| Qué | Dónde |
|---|---|
| `BusinessCatalogItem.Code` | `varchar(80)`, `NOT NULL` |
| `UX_BusinessCatalogItems (IdOrganization, Type, Code)` | índice único |
| `EligibilityRequirement.RequiredCode` | se parte en dos, ver 1.3 |
| La palabra «Código» de la pantalla de Catálogos | formulario y tabla |
| `CatalogItemResponse.Code` y `CatalogItemInput.Code` | contratos |
| `useCode` de `app-catalog-select` | uno de sus tres modos |

**No se va, y conviene decir por qué:**

- **`CodeRole` y `CodePermission` no son códigos de negocio: son el mecanismo.** `SecurityPermissions.PlanningRead`
  **es** la cadena `"PLANNING.READ"`, y el seeder localiza los roles por `CodeRole == "ORGANIZATION_ADMIN"`.
  Retirarlos no es quitar una columna, es rehacer el sistema de permisos.
- **`CodeClient`, `CodeService`, `CodePosition`, `CodeEmployee`, `CodeClientSite`, `CodeServiceContract`,
  `CodeShiftPattern`, `CodeOrganization` y `CodeOperationalRequest` son identificadores que el usuario
  lee.** La rejilla de Planeación identifica cada fila por `P-01`, Asistencia y Cobertura nombran el
  turno por el código de la posición, y el super admin teclea el código al crear una organización.
  Quitarlos es una tanda propia y más grande que ésta: nueve columnas, nueve claves únicas y cambios
  de pantalla en Planeación, Asistencia, Cobertura, Personal, Clientes y Servicios.

Si quieres esa segunda tanda, la anoto; **no la meto aquí por mi cuenta**.

### 1.2 Qué índice único lo reemplaza

Hoy: `UNIQUE (IdOrganization, Type, Code)` con `Code` en `varchar(80)`, sin acentos, en mayúsculas.

**Propuesta: `UNIQUE (IdOrganization, Type, NormalizedName)`**, con una columna nueva
`NormalizedName` calculada y persistida, `varchar(200)`, no unicode.

Normalización: recortar, colapsar espacios interiores, quitar acentos y pasar a mayúsculas.
`«Guardia de acceso»`, `«guardia  de  acceso»` y `«GUARDIA DE ACCESO»` colapsan al mismo valor.

**Por qué el nombre normalizado y no el nombre a secas.** Porque el punto 2 lo exige: si el alta al
vuelo puede crear valores desde cualquier formulario, la puerta que impide `«Guardia»` y `«guardia»`
tiene que estar **en la base**, no en la pantalla. Un índice sobre `Name` sin normalizar los
aceptaría los dos con la colación por omisión de SQL Server, que distingue acentos.

**Por qué persistida y no una restricción de comprobación.** Porque el índice único necesita una
columna determinista sobre la que apoyarse, y calcularla en cada consulta impide que SQL Server la
indexe.

**Consecuencia que hay que aceptar, y es la misma de siempre:** un nombre desactivado **sigue
ocupando la clave**. Desactivar el puesto «Guardia» no libera el nombre. Es el principio 3 aplicado,
y el mensaje de error tendrá que decirlo con todas sus letras, como ya lo dice el de posiciones.

**Riesgo comprobado en la base viva: ninguno.** Los 90 valores no geográficos de `db-gestia-dev`
—14 puestos, 11 habilidades, 5 zonas, 25 motivos de incidencia, 30 de cobertura, 5 nacionalidades—
no colisionan al normalizar; lo verifico con una consulta antes de crear el índice, y si alguno
colisiona el plan se detiene ahí y te lo digo.

### 1.3 `RequiredCode`: aquí está el uso que no se resuelve por identificador

**Ésta es la parte que pediste que dijera con evidencia antes de tocar nada.**

`EligibilityRequirement.RequiredCode` **no significa lo mismo según el tipo de regla**
(`CatalogService.EvaluateEligibilityAsync`, líneas 339, 359 y 380):

| Tipo de regla | `RequiredCode` se compara contra | ¿Es un código de catálogo? |
|---|---|---|
| `Skill` | `EmployeeSkill.SkillCatalogItem.Code` | **Sí** |
| `Document` | `EmployeeDocument.DocumentType.ToString()` | **No: es el nombre de un enum de C#** |
| `Evaluation` | `EmployeeEvaluation.EvaluationType.ToString()` | **No: otro enum de C#** |
| `Restriction` | no se usa | — |

`EmployeeDocumentType` tiene catorce valores (`Curp`, `ProofOfAddress`, `DriverLicense`…) y
`EmployeeEvaluationType` cinco (`Polygraph`, `DrugTest`…). **No hay ninguna fila a la que apuntar
con un identificador**: son constantes del código, no datos.

Lo que hay en la base viva, las **siete** reglas que existen:

```text
  Document    CURP                       1
  Document    PROOFOFADDRESS             1
  Document    PROOFOFSTUDIES             1
  Document    CRIMINALRECORDCERTIFICATE  1
  Evaluation  POLYGRAPH                  1
  Evaluation  SOCIOECONOMICSTUDY         1
  Skill       PRIMEROS_AUX               1   <- la unica que apunta a un catalogo
```

**Seis de siete no pueden migrar a identificador porque no apuntan a nada que tenga identificador.**

**Propuesta: partir el campo en dos, que es lo que el modelo ya decía y el campo escondía.**

```text
  EligibilityRequirement
    IdRequiredCatalogItem   Guid?    <- FK a BusinessCatalogItems. Sólo para reglas de tipo Skill
    RequiredDocumentType    enum?    <- Sólo para reglas de tipo Document
    RequiredEvaluationType  enum?    <- Sólo para reglas de tipo Evaluation
    (RequiredCode se va)
```

Con una restricción de comprobación que garantice que **exactamente uno** está lleno según el tipo,
y `Restriction` con los tres nulos.

**Migración de las siete filas:**

- La de `Skill` (`PRIMEROS_AUX`) **mapea**: comprobé que existe un `BusinessCatalogItem` de tipo
  `Skill` con ese código. `IdRequiredCatalogItem` se rellena por `JOIN` sobre `(IdOrganization, Type, Code)`.
- Las cuatro de `Document` y las dos de `Evaluation` se convierten al valor del enum por nombre.
  Los seis nombres existen en sus enums; lo verifico en el ensayo.

**Qué pasa con los que no mapeen.** Regla: **la regla que no mapea se desactiva, no se borra y no
se inventa.** Se deja la fila con `Active = 0` y un `OperationalEvent` no aplica aquí —
`EligibilityRequirement` no está entre las cinco entidades con historial—, así que el rastro va en
el reporte de la migración y en una columna `Notes` si hace falta. **Desactivar una regla de
elegibilidad afloja un control**, así que la migración tiene que **contar cuántas desactiva y
fallar si son más de cero sin que lo hayas aprobado**. Hoy serían cero.

**Aviso sobre el mensaje al usuario.** Hoy los errores dicen `Falta habilidad requerida: PRIMEROS_AUX.`
Sin código, pasan a decir el **nombre**: `Falta habilidad requerida: Primeros auxilios.` Es mejor
mensaje, pero cambia el texto que ven Planeación y Cobertura al bloquear.

### 1.4 Qué más se rompe

| Qué | Por qué | Qué hacer |
|---|---|---|
| `OrganizationCatalogDefaults.StageAsync` | siembra 2 523 filas **por código** (`"MX"`, `"MX-{state}"`, `"RETARDO"`…) | se reescribe con el punto 3 y el 4: la geografía sale de aquí y los demás dejan de sembrarse |
| `FormCatalogValidator.AddressAsync` | busca el país **por código** (`Same(item.Code, country)`) | desaparece con el punto 3 |
| `CatalogService`, validación del país | exige `code.Length == 2` para `Country` | se va con el punto 3 |
| `app-catalog-select`, modo `useCode` | lo usan Incidencias (`IncidentReason`) y Solicitudes (`Country`) | se retira el modo; queda sólo por identificador |
| `DemoCatalog` / `DemoDataSeeder` | siembra por código | se reescribe por nombre |
| `CatalogItemResponse.Code`, `CatalogItemInput.Code` | contratos públicos | se retiran |
| Pantalla de Catálogos | columna y campo «Código» | se retiran con el punto 5 |

### 1.5 Qué pruebas cambian

| Suite | Qué pasa |
|---|---|
| `GestIA.Application.UnitTests/CatalogDefinitionsTests.cs` | revisar: valida la forma de las definiciones |
| `GestIA.Application.UnitTests/FormCatalogValidatorTests.cs` | **se reescribe entera** con el punto 3 |
| `GestIA.Application.UnitTests/JobPositionEligibilityTests.cs` | se reescribe: hoy afirma por código |
| `GestIA.IntegrationTests` | las que crean catálogos con código; **hay que revisar la regla de códigos únicos por corrida**: con el nombre normalizado como clave, la unicidad se traslada al nombre y las verificaciones tienen que generar **nombres** nuevos por corrida, no códigos |
| `frontend` `catalog-select.spec.ts` | pierde el caso de `useCode` |
| `frontend` `catalogs-page` | los que capturan código |

**La regla de las claves únicas ocupadas se muda de campo, no desaparece.** Toda verificación que
cree valores de catálogo tendrá que generar **nombres** distintos por corrida. Es el mismo tropiezo
de la tanda 5 y de la 6, en otra columna.

---

## 2. Alta al vuelo — lo más importante de la tanda

### 2.1 Qué hay hoy

Existe `shared/ui/catalog-select`, y **es la pieza a rehacer, no una nueva**. Hoy:

- Usa un **`<select>` nativo** —es una de las dos excepciones registradas del sistema de diseño—.
- Tiene **tres modos de llave**: `useId`, `useCode`, o el nombre. Los tres están en uso, y el mismo
  tipo de catálogo se elige por código en una pantalla y por identificador en otra: `CoverageReason`
  va por `useId` en dos sitios, `IncidentReason` va por `useCode`.
- Cuando no hay valores dice `«Sin opciones activas»` **y ahí se acaba**. Ésa es exactamente la
  pared que hay que quitar.

Lo usan hoy: Clientes (estado, municipio), Personal (estado, municipio), Operación vieja (motivo de
incidencia, motivo de cobertura), Solicitudes (nacionalidad, país, estado, municipio).

### 2.2 Qué se construye

**Una sola pieza**, `gi-catalog-picker`, en `shared/ui`, con el sistema de diseño aplicado —fuera el
`<select>` nativo— y **una sola llave: el identificador**.

Comportamiento:

1. Escribes. Filtra sobre lo que hay.
2. Si no hay coincidencia exacta, aparece una fila de acción al final de la lista con **la frase que
   pediste**, en primera persona del sistema y con el valor escrito entre comillas:

   ```text
   No tienes «Guardia de acceso» en el catálogo de puestos.
   [ Agregarlo para poder reutilizarlo ]
   ```

3. Al confirmar, crea el valor con `POST /api/v1/catalogs/items` y lo deja seleccionado. **Un solo
   viaje, sin salir del formulario.**
4. Si el usuario no tiene `CATALOGS.WRITE`, **la fila de acción no se dibuja** y en su lugar dice
   qué falta y a quién pedírselo. Es la forma 2 de decir que no, la que ya usan las pantallas
   rehechas: se oculta la acción, no se dibuja gris.

**Dónde entra:** puestos (Personal), habilidades (cuando exista su pantalla), zonas, motivos de
incidencia (Incidencias) y motivos de cobertura (Cobertura). **No entra en geografía**: la
geografía no se captura, se elige de lo que ya viene cargado.

### 2.3 Lo casi igual — la decisión que pediste que tomara

**Regla: el sistema no crea un valor que colapse al mismo nombre normalizado que uno existente, y
tampoco lo rechaza con un error. Lo ofrece.**

Tres franjas, decididas sobre el nombre normalizado del punto 1.2:

| Situación | Qué hace |
|---|---|
| **Colapsa exacto** al normalizar (`Guardia` vs `guardia`, `GUARDIA `) | **No ofrece crear.** Selecciona el que ya existe y lo dice: `«Guardia» ya está en el catálogo; lo seleccioné.` Sin error, sin fila nueva |
| **Se parece mucho** (distancia de edición ≤ 2 sobre el normalizado, o uno contiene al otro) | Ofrece **las dos salidas, en este orden**: `¿Querías «Guardia de acceso»?` `[ Usar el que existe ]` y debajo, más discreto, `[ Crear «Guardia de acceso B» como valor nuevo ]` |
| **No se parece a nada** | Ofrece crear directamente |

**Por qué el que existe va primero y el de crear va discreto.** Porque el error que hay que evitar
no es no poder crear: es crear un duplicado sin darse cuenta. Poner las dos opciones al mismo peso
convierte la decisión en un volado.

La franja del medio **sugiere, no bloquea**. Si el usuario insiste, crea. Dos puestos parecidos
pueden ser legítimamente dos puestos, y bloquearlo sería el sistema decidiendo por quien conoce la
operación.

**La comprobación de verdad está en la base**, en el índice único del 1.2: si dos personas crean
`Guardia` y `guardia` a la vez, la segunda recibe un 409 y la pieza lo traduce a
`«Guardia» ya está en el catálogo; lo seleccioné.`

### 2.4 Lo que hay que cambiar alrededor

`ClientSite.Municipality`, `ClientSite.State`, `Employee.Municipality` y `Employee.State` **guardan
texto libre** y `FormCatalogValidator` los valida **comparando nombres**, cargando los 2 523 valores
de la organización en cada guardado de dirección. Eso se arregla en el punto 3, no aquí — pero es la
razón de que el picker de geografía hoy devuelva un nombre y no un identificador.

---

## 3. La geografía, completa y compartida — **tanda aparte**

### 3.1 Por qué aparte

Es el único punto con **relleno sobre datos vivos**, y el que puede dejar direcciones sin resolver.
Mezclarlo con el resto haría que un problema de geografía pareciera un problema de códigos. Va con
su propio respaldo, su propio ensayo y su propio reporte.

### 3.2 De dónde sale el dato

**Lo que ya hay en el repositorio:** `GestIA.Application/Catalogs/mexico-geography.json`, 218 KB,
fuente **INEGI, catálogo único**, obtenido el 3 de septiembre de 2026. Contiene **32 estados y
2 478 municipios**. Estados y municipios están resueltos.

**Las colonias no están, y hay que traerlas.** La fuente es **SEPOMEX**, el Catálogo Nacional de
Códigos Postales, que publica el archivo de asentamientos con código postal, entidad, municipio,
nombre del asentamiento y tipo. Del orden de **145 000 asentamientos**, que es la cifra que
manejaste.

**Esto es una decisión tuya, y no la tomo yo**, porque implica meter un archivo de varios megabytes
al repositorio o resolverlo de otro modo:

| Opción | A favor | En contra |
|---|---|---|
| **Recurso incrustado**, como la geografía de hoy | mismo mecanismo ya probado; sin dependencias de red | ~15-20 MB comprimidos en Git; actualizarlo es una migración |
| **Script de siembra** que lee un archivo fuera de Git | el repositorio no engorda | hay que custodiar el archivo y documentar de dónde salió |
| **Sólo hasta municipio** por ahora, colonia después | migración mucho más pequeña | no cumple lo que pediste |

Mi recomendación: **recurso incrustado comprimido**, igual que hoy, porque el mecanismo ya está
probado y porque una geografía que depende de un archivo suelto se desincroniza entre entornos. Pero
dime tú.

### 3.3 La tabla nueva

**Una sola tabla, sin organización**, como propusiste:

```text
  GeoPlaces                     esquema dbo, SIN IdOrganization
    IdGeoPlace       uniqueidentifier   PK
    IdParentGeoPlace uniqueidentifier   FK a si misma, nulo para el pais
    Level            tinyint            1=pais 2=estado 3=municipio 4=colonia
    Name             nvarchar(200)
    NormalizedName   varchar(200)       persistida
    InegiKey         varchar(10)        clave oficial, nulo en colonia
    PostalCode       varchar(5)         solo colonia
    Active           bit
    + auditoria
```

- `UNIQUE (IdParentGeoPlace, Level, NormalizedName)`
- Índice `(IdParentGeoPlace, Level, Name)` para la cascada
- **No implementa `IOrganizationScopedEntity`**, así que **queda fuera del filtro global**. Eso hay
  que decirlo en voz alta: es la primera tabla de negocio deliberadamente fuera del aislamiento, y
  la prueba de arquitectura que vigila el filtro necesita su excepción documentada.

Ahorro: **145 000 filas una vez** en lugar de 145 000 × número de organizaciones.

### 3.4 Lo que hay hoy, medido

```text
  organizaciones                    5
  items de catalogo             12 649
    de ellos City               12 392   <- 2478 municipios x 5 organizaciones
    de ellos State                 162
    de ellos Country                 5
  geografia = 12 559 de 12 649  ->  el 99,3 % de la tabla
  lo que NO es geografia            90   (14 puestos, 11 habilidades, 5 zonas,
                                          25 motivos de incidencia, 30 de cobertura)
  + Nationality                      5
```

### 3.5 La migración, y dónde puede doler

Cuatro pasos, cada uno su propia migración salvo los dos primeros:

1. **Crear `GeoPlaces` y sembrarla** con INEGI + SEPOMEX. Tabla nueva, sin riesgo.
2. **Agregar las referencias, nulables**: `ClientSite.IdGeoMunicipality`, `IdGeoColonia`;
   `Employee.IdGeoMunicipality`, `IdGeoColonia`. **Nulables, siempre**, por la razón de las tres
   veces anteriores: EF genera `defaultValue` en columnas `NOT NULL` sobre datos existentes.
3. **Rellenar por nombre**, una sola vez, en un script idempotente y versionado.
4. **Retirar** las columnas de texto y los `BusinessCatalogItems` de tipo `Country`, `State` y `City`.
   **Sólo después de que el relleno esté verificado y aceptado por ti.**

**Cómo mapea hoy, medido:**

```text
  sedes de cliente                      24
    con municipio escrito               24
    que NO empatan con el catalogo       5   <- todas: "Ciudad de Mexico"
  empleados                            132
    con municipio escrito              121
    que NO empatan                       0
    con estado que NO empata             0
```

**Las cinco que no empatan son todas la misma cosa y tienen arreglo limpio:** dicen municipio
`«Ciudad de México»` y estado `«Ciudad de México»`. CDMX es una entidad federativa y sus municipios
son las dieciséis **alcaldías**, así que `«Ciudad de México»` no existe como municipio en INEGI.

**Qué hacer con ellas, y es decisión tuya:** (a) dejarlas con municipio nulo y estado resuelto, y
que alguien las complete desde la pantalla; o (b) mapearlas a una alcaldía concreta, que sería
inventar un dato. **Recomiendo (a)**: cinco sedes que hay que completar a mano se corrigen en cinco
minutos; un dato inventado no se detecta nunca.

**La regla del relleno:** el script **cuenta lo que no resuelve y lo reporta fila por fila**, y no
borra la columna de texto hasta que ese conteo lo hayas visto. Nada se adivina.

### 3.6 Qué se rompe

- `FormCatalogValidator` **desaparece entero** en su parte de direcciones: ya no hay que validar
  nombres contra el catálogo porque la referencia es una clave foránea.
- `OrganizationCatalogDefaults` deja de sembrar geografía: pasa de 2 523 filas por organización a 11.
- El picker de geografía de Clientes, Personal y Solicitudes cambia de devolver nombre a devolver
  identificador, y gana el cuarto nivel.
- Los contratos de `ClientSite` y `Employee` cambian: `municipality: string` → `idGeoMunicipality: string`.
  **Es cambio de contrato**, y toca `client-form`, `client-sites`, `employee-form` y la pantalla
  vieja de Solicitudes.

---

## 4. Los demás catálogos nacen vacíos, y se retiran los seis

### 4.1 Nacen vacíos

`OrganizationCatalogDefaults.StageAsync` deja de sembrar. Hoy siembra 2 523 filas; después del punto
3 sólo quedarían los 11 motivos, y con este punto **queda en cero**.

**Un aviso, y es real:** los motivos de incidencia y de cobertura **son obligatorios para operar**.
`OperationsService` exige un motivo activo del catálogo tanto para registrar una incidencia
(`Selecciona un tipo de incidencia activo del catalogo.`) como para crear una cobertura
(`Selecciona un motivo de cobertura activo de la organizacion.`). Si nacen vacíos y el alta al vuelo
del punto 2 no está lista, **el paso 11 del recorrido queda bloqueado en una organización nueva**.

**Por eso el orden importa: el punto 2 tiene que estar terminado y verificado antes del punto 4.**
Lo pongo en el orden de ejecución.

### 4.2 Los seis que nadie lee

Confirmado contando lectores fuera de la propia pantalla de Catálogos:

| Tipo | Archivos que lo leen | Filas en la base |
|---|---|---|
| `Zone` | **0** | 5 |
| `CancellationReason` | **0** | 0 |
| `DocumentRequirement` | **0** | 0 |
| `EvaluationRequirement` | **0** | 0 |
| `ClientRestriction` | **0** | 0 |
| `ServiceRestriction` | **0** | 0 |

`Zone` es el único con datos: **5 filas**. Y es el que el retiro del camino de Inicio dejó sin su
último consumidor —era el paso 1 quien contaba las zonas—, así que hoy no lo lee ni la pantalla que
lo mostraba.

**Cómo se retiran:** se quitan del enum `BusinessCatalogItemType`, de `CatalogDefinitions` y de la
pantalla, y **las 5 filas de `Zone` se borran físicamente** en la migración. No es borrado lógico:
el tipo deja de existir en el enum, así que una fila con ese valor haría fallar la lectura del
modelo. Es un borrado real de datos y por eso va con respaldo verificado y ensayo, como todo.

**Y una consecuencia que hay que aceptar:** `Zone` era el catálogo de zonas de operación, y
`Employee` no tiene ninguna columna que lo referencie. Se va sin dejar huérfanos.

---

## 5. La pantalla de Catálogos, rehecha

### 5.1 Qué se ve hoy

No son catorce: son **treinta y ocho tarjetas**. Catorce catálogos editables y **veinticuatro listas
fijas** que salen de enums de C# —estados de solicitud, tipos de documento, severidades de
incidencia, estados de planeación…— y que **no se pueden editar**. Están ahí para consultarlas.

Eso es lo que hace que abrirla se sienta una tarea pendiente: parece que hay treinta y ocho cosas
que llenar y en realidad hay, como mucho, cinco.

### 5.2 La forma que propongo

**Dos zonas, y la segunda plegada.**

```text
  ┌─ LO QUE TU ORGANIZACIÓN DEFINE ────────────────────────────────┐
  │                                                                │
  │  Puestos                14 valores    ·  usados por Personal   │
  │  Habilidades            11 valores    ·  usados por elegibilidad│
  │  Motivos de incidencia  25 valores    ·  usados por Incidencias │
  │  Motivos de cobertura   30 valores    ·  usados por Cobertura   │
  │  Nacionalidades          5 valores    ·  usados por Clientes    │
  │                                                                │
  │  Reglas de elegibilidad  7 reglas     ·  bloquean publicar     │
  └────────────────────────────────────────────────────────────────┘

  ▸ Listas del sistema (24)   No se editan. Están para consultarlas.

  ▸ Geografía                 Viene cargada. País, estado, municipio y colonia.
```

Las tres decisiones de esa forma:

1. **Sólo lo editable arriba, y cada uno dice quién lo usa.** «Puestos · usados por Personal» le
   dice al administrador para qué sirve antes de que se pregunte si tiene que llenarlo.
2. **Las veinticuatro listas del sistema, plegadas y contadas.** Se ven si las buscas; no ocupan la
   pantalla.
3. **La geografía sale de aquí.** Con el punto 3 deja de ser un catálogo: es un dato del sistema, y
   ponerla en la pantalla donde se «configuran» los catálogos sugiere lo contrario.

Un valor con cero entradas **no se pinta en rojo ni con un aviso**: dice `Sin valores todavía. Se
crean solos cuando los escribas en Personal.` Es el objetivo de la tanda dicho en la propia pantalla.

**Y se rehace con el sistema de diseño**: hoy tiene 19 selectores nativos y 134 colores escritos a
mano. Entra a la lista que vigila `design-system.spec.ts`.

---

## 6. El RFC, máximo 13 caracteres — **ya está hecho**

Medido, no supuesto:

| Dónde | Qué hay hoy |
|---|---|
| `ClientConfiguration.cs:16` | `HasMaxLength(13)`, `IsRequired` |
| `EmployeeConfiguration.cs:21` | `HasMaxLength(13)`, opcional |
| `OrganizationConfiguration.cs:15` | `HasMaxLength(13)`, opcional |
| `InputValidation.RfcRegex` | `^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$` |

Las tres columnas son `varchar(13)`: **es imposible que haya un dato de más de 13 caracteres**, la
base no lo habría aceptado. **No hay nada que migrar y no hay datos que incumplan.**

**Lo que sí hay que decidir.** La expresión de hoy exige **exactamente 12 o 13 caracteres** con
formato de RFC: 3 o 4 letras, 6 dígitos de fecha, 3 de homoclave. Tu frase dice *«pueden ser menos,
nunca más»*, y eso admite dos lecturas:

| Lectura | Qué implica |
|---|---|
| **(a) El tope ya está bien** y sólo querías confirmarlo | **Nada que hacer.** El mensaje de error podría decir mejor `El RFC debe tener 12 caracteres para persona moral o 13 para persona física.` |
| **(b) Aceptar cualquier cosa de 13 o menos** | Se retira la expresión regular. Se dejarían pasar `«ABC»` o `«12345»` como RFC de un cliente al que se le factura |

**Recomiendo (a) y sólo cambiar el mensaje.** Si es (b), dímelo y lo hago, pero conviene que sea
explícito: aflojar el formato del RFC afecta a lo que se factura.

---

## 7. Orden de ejecución

El orden no es negociable en dos puntos: **el 2 antes del 4** (si los catálogos nacen vacíos sin
alta al vuelo, una organización nueva no puede registrar una incidencia) y **el 1 antes del 5** (la
pantalla se rehace ya sin la columna de código, no dos veces).

| # | Bloque | Migración | Depende de |
|---|---|---|---|
| **0** | Confirmar las tres decisiones abiertas: reglas que no mapean (1.3), fuente de colonias (3.2), lectura del RFC (6) | — | tú |
| **1** | **RFC**: mensaje de error, si eliges (a) | ninguna | — |
| **2** | **Alta al vuelo.** `gi-catalog-picker` con una sola llave, la de identificador, y la creación desde el formulario | ninguna | — |
| **3** | **El código se va, parte 1**: `NormalizedName` persistida + índice único nuevo, conviviendo con `Code` | **M1** | 2 |
| **4** | **El código se va, parte 2**: partir `RequiredCode` en tres campos, retirar `Code` del dominio, contratos y pantallas | **M2** | 3 |
| **5** | **Retirar los seis catálogos** y dejar de sembrar puestos, habilidades y zonas | **M3** | 2, 4 |
| **6** | **Pantalla de Catálogos rehecha** | ninguna | 4, 5 |
| — | *fin de esta tanda* | | |
| **7** | **Geografía — tanda aparte**: `GeoPlaces`, siembra, referencias nulables, relleno reportado, retiro de columnas | **M4, M5, M6** | 6 |

**Seis migraciones en total**, tres en esta tanda y tres en la de geografía. **Cada una sola en su
commit**, separada del código que la acompaña.

### Antes de cada migración, sin excepción

1. Respaldo `COPY_ONLY` con `CHECKSUM`, verificado con `RESTORE VERIFYONLY WITH CHECKSUM`, copiado
   fuera de Docker, con la ruta anotada.
2. **Ensayo sobre una copia restaurada**, no sobre `db-gestia-dev`.
3. **Revisar el SQL generado antes de aplicarlo**, en concreto buscando `defaultValue`: **EF lo
   genera en columnas `NOT NULL` sobre datos existentes y ya pasó tres veces**. La regla de esta
   tanda es que **toda columna nueva sobre una tabla con datos entra nulable**, se rellena en un
   paso aparte y sólo después se endurece si hace falta.
4. Nada de reescribir una migración desplegada: si algo sale mal, va una compensatoria.

### Qué comprobar en el navegador al terminar cada bloque

| Bloque | Qué recorrer |
|---|---|
| 2 | Dar de alta un empleado con un puesto que no existe; que lo ofrezca, lo cree y lo deje elegido. Repetir con `guardia` en minúscula: debe seleccionar el que ya existe |
| 4 | Que la palabra «Código» no aparezca en Catálogos. Que Planeación siga bloqueando por elegibilidad, ahora con el **nombre** de la habilidad |
| 5 | Que una organización nueva no traiga puestos ni zonas, y que el paso 11 se pueda completar creando el motivo al vuelo |
| 6 | Que abrir Catálogos no se sienta una tarea pendiente |
| 7 | Cascada completa en Clientes y Personal, y las cinco sedes de CDMX resueltas a mano |

---

## 8. Lo que esta tanda **no** hace

Dicho para que no se busque:

- **No retira los otros nueve códigos de negocio** (`CodeClient`, `CodePosition`, `CodeEmployee`…).
  Son identificadores que el usuario lee. Si los quieres fuera, es tanda propia y más grande.
- **No toca `CodeRole` ni `CodePermission`.** No son códigos de negocio: son el mecanismo de
  permisos.
- **No construye la pantalla de habilidades.** Sigue sin existir, y con ella sigue viva la trampa
  del hallazgo 8.4 del mapa: una regla de elegibilidad de tipo `Skill` se puede crear y no se puede
  cumplir. **El alta al vuelo del punto 2 no la arregla**, porque crea el *valor de catálogo*, no la
  *habilidad del empleado*.
- **No resuelve el hueco de publicar con posiciones sin cubrir** (hallazgo 8.1).
- **No conserva nada por si acaso.** `Code`, `RequiredCode`, los seis catálogos y la siembra de
  geografía se van; lo que deje de usarse se borra en la misma tanda, no se deja apagado.
