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

**1 · Las tablas y su carga.** Migración que las crea y siembra países, estados y municipios desde
el JSON del INEGI. Nada las lee todavía: al terminar este paso el sistema funciona igual que antes.

**2 · Los lectores cambian de fuente.** `catalog-select` para país, estado y municipio; el validador
de direcciones; la pantalla de Catálogos. Aquí es donde se nota: las mismas pantallas, otra tabla
detrás.

**3 · La geografía del catálogo por organización se desactiva.** No se borra: son 19 826 filas y el
principio del proyecto es que nada se elimina. Desactivadas dejan de ofrecerse y siguen consultables
por si algo salió mal. Y el sembrador deja de crearlas para las organizaciones nuevas.

**4 · El código postal manda en la dirección.** Escribes el CP y se resuelven estado y municipio, y
se ofrece la lista de colonias de ese CP. Los tres desplegables se quedan como respaldo para cuando
el CP no aparezca —los hay recientes que el catálogo no trae— y para el día que haya un país que no
sea México.

Cada paso es un commit, y la migración va sola como siempre.

---

## Lo único que no puedo resolver yo

**Las colonias.** Los países, estados y municipios ya están en el repositorio —un JSON de 214 KB del
catálogo único del INEGI, tomado el 3 de septiembre—. Las colonias no, y son de **SEPOMEX**, no de
RENAPO: el padrón de asentamientos que viene con el catálogo de códigos postales.

Comprobé que hay salida a internet y que el sitio de Correos de México responde. Lo que no voy a
hacer por mi cuenta es rastrear el sitio a ver de dónde cuelga hoy el archivo y meter al repositorio
un paquete de datos de origen externo sin que alguien lo mire: el proyecto ya tiene la costumbre de
registrar de dónde salió cada dato y cuándo —el JSON del INEGI lleva su `Source` y su
`RetrievedAt`— y eso se decide, no se improvisa.

**Dos salidas, y la primera es la que recomiendo:**

- Me pasas el archivo de SEPOMEX —el `CPdescarga.txt` o el CSV equivalente— y lo cargo con su
  procedencia anotada, igual que el del INEGI.
- O me dices de qué dirección bajarlo y lo traigo yo, quedando anotado que se tomó de ahí ese día.

**Mientras tanto, los pasos 1, 2 y 3 no dependen de eso** y los puedo hacer ya: la tabla de códigos
postales se crea vacía y el paso 4 la llena cuando haya datos. La colonia sigue siendo texto libre
hasta entonces, que es lo que es hoy.
