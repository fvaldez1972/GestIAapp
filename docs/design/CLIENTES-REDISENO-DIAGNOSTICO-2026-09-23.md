# Clientes: rediseño y corrección. Diagnóstico antes de tocar

**23 de septiembre de 2026 · las tres pantallas del módulo: alta, ficha y editor**

---

## Lo primero: tu hipótesis es acertada a medias

Sospechabas que **1, 2 y 5 eran la misma causa** —que estas pantallas no recibieron la tanda de
geografía—. Lo comprobé y son tres cosas distintas, y una de ellas ya no existe.

| Defecto | Causa real | Estado |
|---|---|---|
| 1 · Municipio «Sin opciones activas» | Sí era la tanda de geografía | **Ya arreglado**, ayer mismo |
| 2 · Falta el flujo del código postal | La tanda de geografía, por omisión | Pendiente, y es reúso |
| 5 · Selectores nativos | **Nada que ver con geografía** | Pendiente, y toca más de tres pantallas |

### 1 · El municipio ya funciona, y la captura es de antes

El alta **sí recibió la tanda**: `client-form.ts` usa `app-catalog-select` con `type="State"` y
`type="City"`, y ese componente pide `/api/v1/geography/*` desde ayer. Su propia prueba lo fija —
`client-form.spec.ts` responde peticiones a `/geography/` desde entonces—.

La captura que mandaste es del portal **antes del despliegue de ayer**. Lo comprobaré en el
navegador antes de darlo por bueno.

**Lo que sí queda de verdad**: el mensaje. «Sin opciones activas» aparece cuando **no has elegido
estado todavía**, que no es lo mismo que «este catálogo está vacío». Dice la verdad técnica y la
cosa equivocada: quien lo lee cree que el sistema no tiene municipios. Debe decir «Elige primero el
estado».

### 2 · El código postal: es reúso, no obra nueva

El campo de CP del alta es un `<input>` suelto sin ninguna consulta detrás. La pieza que hace el
trabajo **ya existe**: `DireccionPorCodigoPostal`, el servicio compartido que salió de la tanda del
paso 4 y que hoy usan las zonas de un cliente y el domicilio de una persona. Trae el pliego
completo: resuelve país, estado, municipio y colonias; deja «Otra: escribirla» al final; un código
fuera del padrón **no borra lo ya escrito**; y abrir para editar no consulta solo.

El alta lo hereda entero proveyendo el servicio y cambiando cinco campos de sitio. No hay nada que
reimplementar.

### 3 · Los modales se apilan, y es literal

`@if (selected())` dibuja la ficha y `@if (editingClient())` dibuja el editor, y **las dos
condiciones pueden ser ciertas a la vez**: `startEdit` nunca limpia `selected`, y `cancelEdit` sólo
limpia `editingClient`. Resultado: dos velos superpuestos y dos cierres para salir.

### 4 · Las fechas: esto no se puede con lo que hay

`04/28/2016` sale de dos `<input type="date">` del editor. **El formato de un campo de fecha nativo
lo decide el navegador y el sistema operativo, no la página.** No hay atributo, CSS ni configuración
de Angular que lo cambie: en un equipo en inglés se verá `04/28/2016` y en uno en español
`28/04/2016`, con el mismo código.

O sea que «un solo formato: 28 abr 2016» **no es alcanzable con el campo nativo**. Tres salidas:

- **(a) Dejar el campo nativo para capturar y usar «28 abr 2016» en todo lo que sólo se lee.** El
  formateador ya existe (`formatOperationalDate`) y es lo que usan las demás pantallas. El único
  sitio con el formato del navegador queda siendo el editor, mientras se escribe. Coste: cero.
- **(b) Cambiarlo por un campo de texto** con nuestro formato. Se pierde el calendario del
  navegador y hay que escribir a mano la fecha. No lo recomiendo.
- **(c) Un `gi-date` propio**, con su calendario. Es un componente nuevo del sistema de diseño, no
  una pieza que ya tengamos: entre dos y tres días con sus pruebas y su accesibilidad, y afecta a
  todas las pantallas con fecha, no sólo a estas tres.

**Recomiendo (a)** en esta tanda, y (c) como decisión aparte si el formato mixto molesta.

### 5 · Los selectores: el choque de alcance

Aquí hay una sorpresa. **`features/clients` ya está en `design-system.spec`** y las tres pantallas
tienen **cero** `<select>` nativos escritos por ellas. Lo que se ve con pinta de selector nativo es
`app-catalog-select`, que **es la excepción nombrada del sistema de diseño**: por dentro dibuja un
`<select>` real, y hay una prueba que sostiene esa excepción a propósito.

Entonces el trabajo no es «meter estas pantallas en la regla» —ya están—, sino **retirar la
excepción**, es decir, cambiar `catalog-select` para que use `gi-select`. Y ahí está el choque con
tu «solo estas tres pantallas»:

`app-catalog-select` lo usan hoy **Clientes, Personal, Operaciones y Solicitudes**. Cambiarlo por
dentro cambia las cuatro. No se puede tocar sólo para Clientes sin dejar dos componentes que hacen
lo mismo, que es peor.

**Tres salidas, y la decisión es tuya:**

- **(a) Cambiar `catalog-select` a `gi-select` para todos.** Las cuatro pantallas ganan el selector
  del sistema. Es lo correcto a largo plazo y lo que quita la excepción. Sale de las tres pantallas
  que acotaste.
- **(b) Dejarlo como está en esta tanda** y anotar el retiro de la excepción como tanda propia.
- **(c)** En el alta, los desplegables pasan a ser **el respaldo** del código postal, así que se ven
  bastante menos. Si eso basta por ahora, (b) cuesta cero.

---

## Lo que no se puede construir con lo que ya existe

Miré las maquetas contra el inventario de componentes. Casi todo se arma con lo que hay:

| Pieza de la maqueta | Con qué se hace |
|---|---|
| Secciones numeradas con título y descripción | Marcado y CSS. No hace falta componente. |
| Aviso «puede crearse sin zona» | La clase `gi-alert`, que ya se usa en Catálogos. |
| Pestañas con conteo | `gi-detail-panel`, que ya lo hace. |
| Dos botones con el aviso de qué falta | Ya existe en el alta actual. |
| Notas explicativas al pie de una sección | Marcado. |

**Lo que no:**

1. **El campo de fecha con formato propio.** Explicado arriba: haría falta un `gi-date` que no
   existe.
2. **La pestaña de Servicios.** La API ya sirve —`/api/v1/services` acepta `idClient`—, pero no hay
   un componente de lista de servicios reutilizable para meter dentro de la ficha. Se arma con
   `gi-data-table`, que sí existe; es trabajo, no un hueco.
3. **Los selectores del sistema en Estado y Municipio**, por lo del punto 5.

---

## Las dos verificaciones que pediste sobre el modelo

**«Zona principal»: sigue sin existir, y lo confirmo.** No hay ninguna marca de principal en
`ClientSites`. Lo que la pantalla llama zona principal es **la primera por nombre**, calculado en la
consulta, y hay un comentario en el repositorio que lo dice con todas sus letras: elegir una al azar
haría que la misma fila cambiara entre cargas.

Así que la ficha **muestra las zonas sin destacar una**, como pides. Agregar el concepto costaría:
una columna `IsMainSite` con su migración, la regla de que sólo una por cliente pueda tenerla —que
es una restricción que la base no expresa sola—, el sitio donde se marca, y decidir qué pasa con los
16 clientes que ya existen. Medio día largo, y no por el código sino por esa última pregunta.

**Nombre corto y nacionalidad: el código ya está bien.** Las maquetas les ponen asterisco y la
matriz dice recomendado y opcional. Comprobado: el alta sólo exige razón social y RFC, y el editor
manda la nacionalidad como opcional. **No hay nada que cambiar**; simplemente no se copia el
asterisco de la maqueta.

---

## «Actividad reciente»: qué costaría

Está fuera de esta tanda, como dijiste. El coste, para cuando lo decidas:

`Client` no está entre las cinco entidades con bitácora funcional. Agregarlo lleva un valor nuevo al
enum `OperationalEntityType` —**sin migración**, porque se guarda como texto a propósito—, un
registro de foto con su lista blanca de campos —sin texto libre, que es la regla—, el enganche en
`SaveChanges` y la lectura en la ficha. Un día.

**La advertencia que importa no es el coste.** La bitácora empieza el día que se enciende: los 16
clientes que ya existen tendrían la línea de tiempo **vacía**, y la maqueta la enseña llena. Esa
pantalla diría «no ha pasado nada» de clientes que llevan meses editándose. Si se hace, hay que
decirlo en la propia pantalla.

---

## Cómo lo haría, si estás de acuerdo

Cuatro bloques, cada uno con su commit, y publico al final:

1. **Los dos arreglos que no dependen de nada.** Los modales dejan de apilarse y el mensaje del
   municipio dice «Elige primero el estado». Es lo que hoy estorba para trabajar.
2. **El código postal en el alta**, reusando el servicio compartido.
3. **El alta rediseñada**: tres secciones numeradas, los dos botones con su aviso, sin los iconos
   circulares y sin asteriscos de más.
4. **La ficha y el editor**: pestañas Resumen · Zonas · Contactos · Documentos · Servicios, sin las
   tarjetas de conteo ni la línea del pie, con las notas que explican, «Crear servicio de este
   cliente» en el pie, y el editor en sus tres secciones.

Lo que queda esperando tu decisión: **el punto 5** —si `catalog-select` pasa a `gi-select` para las
cuatro pantallas o se queda para otra tanda— y **las fechas**, entre (a) y (c).

---

## Decidido el 23 de septiembre, y lo que queda anotado

**Fechas: opción (a).** El formato propio se usa en toda fecha que se **muestra**; los campos de
captura nativos se quedan con el del sistema operativo. El enunciado de la regla en
`SISTEMA-COMPONENTES-CERRADO.md` se corrigió para que diga eso, porque escrito como absoluto era
inalcanzable y se iba a volver a reportar como defecto.

**Selectores: opción (b).** La excepción de `catalog-select` se queda. Con el código postal al
frente los desplegables pasan a ser respaldo y se ven mucho menos.

### Tanda pendiente · `catalog-select` pasa a `gi-select`

Retirar la excepción del sistema de diseño. Toca **Clientes, Personal, Operaciones y Solicitudes**,
que son las cuatro pantallas que usan el componente. Es mejora, no corrección: la excepción es una
decisión documentada con una prueba que la sostiene y otra que comprueba que sigue existiendo.

### Tanda pendiente · `gi-date`

Un selector de fecha propio, para que los campos de captura dejen de depender del formato del
sistema operativo. Dos o tres días con sus pruebas y su accesibilidad, y afecta a todas las
pantallas con fecha.

### Lo que apareció al hacerlo, y no estaba en la lista

**«Resumen» no se pudo poner.** `gi-detail-panel` comprueba en tiempo de ejecución que la primera
pestaña se llame **«Datos»**, y lo llama decisión cerrada del sistema para que el mismo sitio se
llame igual en todos los módulos. La maqueta pedía «Resumen»; cambiarlo es un acuerdo del sistema de
diseño, no de esta pantalla, así que se quedó «Datos».

**La columna del listado afirmaba una ubicación que el cliente sólo tiene a medias.** Almacenes
Reforma tiene una zona en Tijuana y otra en León, y la columna decía «Baja California · Tijuana».
Con más de una ubicación ahora dice cuántas. El servidor manda `ZoneLocationCount` para poder
distinguir dos zonas en sitios distintos de dos zonas en el mismo sitio.
