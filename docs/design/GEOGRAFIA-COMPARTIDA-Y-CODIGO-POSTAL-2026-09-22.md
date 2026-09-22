# La geografía sale a una tabla compartida, y la colonia entra por código postal

**22 de septiembre de 2026 · plan antes de tocar, porque lleva migración sobre datos vivos**

---

## Lo que hace esto seguro, y no lo esperaba

**Nada guarda el identificador de un país, un estado o un municipio.** Las direcciones —las de
`ClientSites` y las de `Employees`— guardan el **nombre como texto**. Lo comprobé buscando columnas
tipo `IdCity`, `IdState`, `IdCountry` en todo el backend: no existe ninguna.

Eso quiere decir que sacar la geografía del catálogo por organización **no rompe ninguna llave
foránea**. Es una migración de datos y de lectores, no de relaciones.

Y no es un hallazgo nuevo: hay una nota de una tanda anterior en `FormCatalogValidator` que dice
*«En la tanda de geografia las tres columnas pasan a ser claves foraneas y esto desaparece»*, y otra
en la pantalla de Catálogos: *«Se va a una tabla compartida en su propia tanda»*.

## El tamaño del problema, medido

| | |
|---|---|
| Catálogo hoy | 20 770 filas · 6.82 MB → **344 bytes por fila** |
| Municipios | 19 826 filas… que son **2 478 repetidos 8 veces**, uno por organización |
| Base completa | 72 MB |

Con colonias y el diseño de hoy: ≈ **50 MB por organización**, ≈ 400 MB con las ocho, y el alta de
una organización nueva pasaría de insertar 2 500 filas a insertar 147 000 en una transacción.

Compartidas: **una sola copia para todos**, y el alta de organización deja de tocar geografía.

---

## Las tablas nuevas

Fuera de `BusinessCatalogItems`, y **sin `IdOrganization`**, que es justamente el punto.

| Tabla | Qué lleva | De dónde sale |
|---|---|---|
| `GeoCountries` | clave ISO, nombre | el JSON del INEGI que ya está en el repo |
| `GeoStates` | país, clave INEGI, nombre | el mismo JSON |
| `GeoMunicipalities` | estado, clave INEGI, nombre | el mismo JSON |
| `GeoPostalCodes` | código postal, colonia, municipio | **SEPOMEX — no lo tengo** |

**Hay que declarar que no llevan organización.** El filtro global de este proyecto falla cerrado:
sin organización fijada, una entidad con alcance devuelve cero filas. Estas tablas quedan
deliberadamente fuera de ese mecanismo, y eso se escribe en la configuración y se sujeta con una
prueba, para que nadie las «arregle» agregándoles una columna de organización.

---

## Los pasos, en orden

**1 · Las tablas y su carga. Hecho y desplegado.** Migración `20260922131723_SharedGeographyTables`:
crea las cuatro tablas y siembra 1 país, 32 estados y 2 478 municipios desde el JSON del INEGI. Nada
las leía todavía, así que al terminar el sistema funcionaba igual que antes.

**2 · Los lectores cambian de fuente. Hecho y desplegado.** `catalog-select` pide país, estado y
municipio a `/api/v1/geography/*`, y la cascada la resuelve el servidor en vez de traerse el catálogo
entero y recorrer el árbol en el navegador. `FormCatalogValidator.AddressAsync` delega en
`IGeographyService` y pierde el parámetro de organización. La pantalla vieja de Catálogos deja de
ofrecer la geografía y dice por qué.

Tres cosas que aparecieron al hacerlo y no estaban en el plan:

- **La comparación de nombres necesitaba una intercalación distinta.** La base es
  `SQL_Latin1_General_CP1_CI_AS`: ignora mayúsculas pero **no acentos**. Sin `Latin1_General_CI_AI`,
  una dirección escrita «Nuevo Leon» no encontraba su estado y el mensaje decía «selecciona un estado
  activo» delante de un estado que existe y está activo.
- **El país se guardaba mal, y era un defecto mío del 22 de septiembre.** `CountryCode` es de dos
  caracteres; el desplegable de país que añadí al alta de zona ofrecía el **nombre** como valor a
  guardar, así que elegir «México» mandaba seis caracteres a una columna de dos. Ahora guarda la
  clave y muestra el nombre.
- **El sembrador demo se apoyaba en la geografía sin decirlo.** Decidía «¿ya corrió el alta aquí?»
  preguntando si la organización tenía estados. Al dejar de sembrarlos la pregunta respondía que no
  siempre y sembraba encima: clave duplicada. El centinela pasa a ser «¿tiene algún valor de
  catálogo?».

**3 · La geografía del catálogo por organización se desactiva. Hecho y desplegado.** Migración
`20260922135223_DeactivateOrganizationGeography`: **20 092 filas** de 8 organizaciones —8 países, 258
estados y 19 826 municipios— quedan con `Active = 0`. No se borran, y no sólo por el tercer principio:
los domicilios ya capturados guardan el **nombre** del estado y del municipio, no su identificador,
así que la fila del catálogo es la única constancia de de dónde salió ese texto. El alta de
organización dejó de crearlas.

El índice único conserva su filtro sobre `Country`, `State` y `City`. Desactivar una fila no la saca
de un índice filtrado por `Type`, y el catálogo del INEGI tiene municipios homónimos dentro de un
mismo estado —Oaxaca tiene dos San Juan Mixtepec, distinguidos por distrito—, así que quitar el
filtro hoy haría fallar la reconstrucción del índice. Se irá el día que las filas se vayan, si se van.

**4 · El código postal manda en la dirección. Hecho y desplegado.** En el formulario de zonas se
escriben cinco dígitos y se resuelven país, estado, municipio y la lista de colonias, que es como se
escribe una dirección en México. La colonia pasa a elegirse de las del código, con «Otra: escribirla»
siempre al final. **El formulario de personal no tiene campo de código postal**, así que no entra:
ahí la dirección sigue siendo estado y municipio, como estaba.

Los tres desplegables **se quedan**, y no de adorno: un código fuera del padrón los deja funcionando
y **no borra lo que ya había**. Quien está corrigiendo el teléfono de una zona vieja no puede perder
su dirección por teclear mal un dígito. Abrir una zona para editarla tampoco consulta el código:
resolverlo otra vez podría reescribir sola una dirección que nadie pidió cambiar.

Los datos son de SEPOMEX y están cargados **sólo en `db-gestia-dev`**: 144 242 colonias, 32 292
códigos postales, 2 458 municipios. La clave del INEGI cruzó el 100 % del archivo, sin un solo
renglón huérfano. `db-gestia-local` se quedó vacía a propósito, y ahí se puede ver el respaldo
funcionando: el mismo código postal responde 200 en dev y 404 en local, y en local el formulario
ofrece los desplegables.

Cada paso es un commit, y la migración va sola como siempre.

---

## De dónde salieron las colonias, y dónde vive el archivo

Lo tomé de `https://www.correosdemexico.gob.mx/datosabiertos/cp/cpdescarga.txt` el 22 de septiembre
de 2026: 14 336 147 bytes, 145 420 renglones de datos, 32 292 códigos postales y 2 458 municipios.

**No está en Git**, por su aviso de uso: *«no estando permitida su comercialización, total o
parcial, ni su distribución a terceros bajo ningún concepto»*. **Y tampoco se baja en cada
despliegue**, que era la otra salida que yo había propuesto y no servía: una fuente externa viva es
una dependencia que nadie del equipo controla, y si el sitio se cae o cambia el formato, se cae el
despliegue.

Vive en `C:\\Users\\danie\\Backups\\gestia\\fuentes\\`, con un archivo de procedencia al lado que registra URL, fecha, tamaño, renglones,
SHA-256 y el aviso copiado tal cual. El guion `scripts/cargar-codigos-postales.py` lee de ahí,
**exige** ese archivo de procedencia y comprueba el SHA-256 antes de escribir nada: un archivo
cambiado en silencio es justo lo que no se quiere descubrir después, con las colonias ya en la base.
El guion es idempotente —correrlo dos veces inserta cero— y las dos cosas se comprobaron.

---

## El siguiente paso natural, para otro día

**Que las direcciones guarden el identificador del estado y del municipio, no el nombre.**

Es lo que ya decía la nota vieja de `FormCatalogValidator` —*«en la tanda de geografia las tres
columnas pasan a ser claves foraneas y esto desaparece»*— y es la raíz de lo que apareció en el
paso 2: **la intercalación sin acentos existe sólo porque se compara por nombre.** Sin nombres que
comparar no hay acento que se pierda, ni «Nuevo Leon» que no encuentre su estado, ni un municipio
renombrado que deje huérfanas las direcciones capturadas antes.

**No ahora.** Es una migración sobre domicilios vivos —`ClientSites` y `Employees`—, con su propio
plan: hay que decidir qué pasa con las direcciones cuyo texto no case con ningún municipio, y eso se
mide antes de escribir nada.

## La pregunta abierta, que no es técnica

El archivo de SEPOMEX está cargado **sólo en desarrollo**. Antes de que lo use un cliente de pago
hay que resolver si mostrar este catálogo dentro de un producto que se vende cuenta como
«comercialización» en el sentido de su aviso. **Eso lo resuelve BKT, no el equipo técnico.**

El guion de carga lo tiene puesto como candado: apuntar a una base que no sea `db-gestia-dev` exige
pasar `--si-se-que-no-es-dev` y explica por qué en el propio mensaje de rechazo.
