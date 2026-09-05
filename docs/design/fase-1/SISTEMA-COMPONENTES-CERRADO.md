# Sistema de componentes cerrado

Extraído del diseño aprobado de Servicios el 2026-09-04. **Estas decisiones ya no se
discuten en cada pantalla: se aplican.** Cualquier pantalla nueva que proponga otra cosa
está mal.

Complementa `refactor-ux/BRIEF-COMPONENTES.md`, que define los tokens. Este documento
define cómo se usan.

---

## Base

| Concepto | Valor |
|---|---|
| Ancho de trabajo | 1440 px |
| Tipografía | Archivo, system-ui, sans-serif. Una sola familia |
| Radio general | 6 px |
| Radio de píldoras y etiquetas pequeñas | 3 px |
| Alto de control | 42 px |
| Superficie | Plana. Sin sombra, separación por borde de 1 px y color de superficie |

## Escala tipográfica

Siete tamaños, ni uno más. Es una herramienta operativa: densa a propósito.

| Tamaño | Peso | Uso |
|---|---|---|
| 22 px | 700 / 600 | **Título de pantalla** (peso 700) y **valor de tarjeta de indicador** (peso 600). Un número que se lee como métrica, no como texto de tabla |
| 13 px | 700 | Nombre en encabezado de panel |
| 13 px | 600 | Nombre de registro en fila de tabla |
| 12.5 px | 600 / 400 | Texto de contenido, valores de ficha |
| 12 px | 600 / 500 / 400 | Datos secundarios, celdas de apoyo |
| 11.5 px | 500 / 400 | Metadatos, notas al pie de celda |
| 11 px | 600 | Encabezado de columna, etiqueta de campo en mayúsculas |
| 10.5 px | 600 | Píldoras de estado, contadores |

**Regla:** la jerarquía se hace con peso y color antes que con tamaño. El cuerpo de la
aplicación vive entre 10.5 y 13 px; el 22 px es la única excepción y está reservado al
título de pantalla y al valor de indicador.

**Prohibido el 13.5 px** y cualquier tamaño intermedio. Está tan cerca del 13 que solo
difumina la escala sin aportar jerarquía.

## Anchos de columna de referencia

220 px para nombre de entidad · 190 px para cliente o sede · 150 px para vigencia ·
130 px para conteos y estado.

---

## Componentes

### Barra de contexto

Ocupa el ancho del área de contenido, arriba de todo. Lleva **organización activa**,
**fecha operativa**, y las acciones de **Cambiar** y **Salir**.

Es el único lugar de la aplicación donde vive el contexto de organización. Ninguna
pantalla de módulo vuelve a preguntarlo.

Tres estados de menú lateral, resueltos en el componente `SideMenu`:

| Rol | Entradas | Cuáles |
|---|---|---|
| Super admin fuera de organización | 3 | Inicio, Organizaciones, Seguridad |
| Super admin dentro de organización | 11 | Todas, incluida Organizaciones para salir o cambiar |
| Admin de organización | 10 | Todas menos Organizaciones |

Sidebar de 17 rem sobre `--gestia-navy`. Elemento activo con fondo `--gestia-navy-soft` y
marca izquierda de 3 px en `--gestia-cyan`. Pie con nombre de usuario y rótulo de rol.

### Encabezado de página

Etiqueta de sección en 11 px 600 sobre `--gestia-muted`, título en 13 px 700 sobre
`--gestia-navy`, descripción opcional de una línea, y **una sola acción principal** a la
derecha.

El breadcrumb existe una vez. No se repite en la topbar y en el encabezado.

### Barra de filtros

Buscador de ancho completo, siempre visible, con contador de resultados al lado. Botón
**Filtros** que abre el resto en panel plegable, cerrado por defecto. Chips de filtros
activos debajo, cada uno con su equis, más **Quitar todos** cuando hay alguno.

**No lleva** botón "Filtrar" —los filtros se aplican al cambiar— ni botón "Limpiar"
separado, ni filtros con una sola opción real.

### Tabla de datos

Encabezado sobre `--gestia-surface-soft` en 11 px 600. Filas sobre `--gestia-surface`,
separador de 1 px en `--gestia-border`, sin sombra. Nombre del registro en 13 px 600; el
resto en 12 o 12.5 px.

Acciones de fila en **un menú al final de la fila**, nunca como enlaces sueltos. La
destructiva va separada dentro del menú.

Estados obligatorios: cargando con esqueleto —no spinner—, con datos, vacío por filtro,
vacío sin datos, y error.

### Cuadrícula de proyección

Rejilla de **posición por siete días**. Es el componente de Planeación y **Asistencia va a
necesitar exactamente el mismo**, así que se define una sola vez aquí.

Una fila por posición, siete columnas por día. Cada celda es un estado, no un texto libre.

**La leyenda es obligatoria y vive dentro de la propia cuadrícula**, no en una nota al pie ni
en un tooltip. Sin leyenda, la rejilla es un mosaico de colores que nadie sabe leer. Son cinco
entradas, siempre las cinco, aunque alguna no aparezca esa semana:

| Entrada | Cómo se ve |
|---|---|
| Turno con titular | Borde `--gestia-border`, fondo `--gestia-surface` |
| Cubre-descansos | Borde `--gestia-cyan`, fondo `--gestia-cyan-soft` |
| Descanso | Borde `--gestia-border`, fondo `--gestia-surface-soft` |
| Hueco de cobertura | Borde `--gestia-danger`. Requeridos por encima de asignados |
| Día sin declarar | Borde `--gestia-warning`. El patrón está incompleto |

Las dos últimas son las que importan: un hueco de cobertura y un día sin declarar **no son lo
mismo** y no pueden verse igual. El primero es una falta de personal; el segundo, una falta de
configuración, y se resuelven en módulos distintos.

### Panel de detalle lateral

**620 px de ancho**, a la derecha. La tabla se comprime, no se oculta. Fila seleccionada
resaltada en `--gestia-cyan-soft`.

Encabezado fijo con título y cierre. Cuerpo con pestañas, la activa marcada en
`--gestia-cyan`. Pie con acciones.

La primera pestaña se llama **Datos**, nunca Ficha. En Servicios son Datos · Configuración ·
Posiciones · Asignaciones; en Clientes, Datos · Sedes · Contactos · Documentos. Cada pestaña
lleva su conteo cuando aplique, para no abrirla y descubrir que está vacía. Un destino que ya
existe como pestaña no se repite como acción de fila.

Nunca se apila debajo de la tabla.

### Tarjeta de indicador

Etiqueta en 11 px 600, valor en 22 px 600, y una línea de apoyo que explique el número.

Cuatro estados: **con dato** · **cargando** en esqueleto · **sin datos aún** · **cero
real**.

La distinción entre los dos últimos es el punto del componente. "Sin datos aún" muestra una
raya en lugar del valor, más una píldora con el texto y la acción que lo resuelve — nunca
depende solo del color. Un cero real se muestra como cero, porque significa que todo está
en orden.

**Regla:** si el prerrequisito del dato no existe, es "sin datos aún", no cero. Un cero
dice "todo bien" cuando en realidad nadie ha publicado nada.

### Agregador de pendientes

Bloque de la pantalla de Inicio que reúne lo que necesita atención hoy, ordenado por lo que
deja turnos al descubierto.

**Agrupado por tipo con su conteo**, no como renglones sueltos: "3 posiciones sin titular
en 2 servicios". El detalle vive en el módulo. Cada renglón lleva a donde se resuelve;
ninguno solo cuenta.

### Camino de configuración

Los siete pasos del recorrido, en la pantalla de Inicio. Cada uno con número, nombre, una
línea que dice qué bloquea o de qué depende, y su destino.

Solo el paso sin dependencias lleva acción sólida. Los bloqueados dicen de qué dependen
antes de que el usuario llegue a la pared.

Tres estados de la pantalla, una sola estructura: el camino ocupa todo cuando no hay nada,
se encoge cuando hay avance, y colapsa a una línea cuando está completo. **Se cierra, no se
borra.**

### Diálogo de confirmación destructiva

Nombra qué se va a desactivar, explica la consecuencia, y confirma. Botón destructivo en
`--gestia-danger`, nunca adyacente al primario. Cancelar es la acción por defecto.

### Estado vacío

Explica por qué no hay nada **y ofrece la acción que lo resuelve**. Sobre
`--gestia-surface`, dentro del área de contenido.

Variantes: sin permiso, sin datos aún, sin resultados por filtro, y falta un prerrequisito
—con el enlace al módulo donde se obtiene.

---

## Reglas transversales

| Regla | Detalle |
|---|---|
| Un solo formato de fecha | `04 sep 2026`. Sin excepciones |
| Sin selectores nativos | Todo `<select>` lleva estilo propio |
| Español con acentos | Sin excepciones |
| Nombre accesible en todo botón | Incluidos los de solo icono |
| Etiqueta asociada a su campo | Hacer clic en la etiqueta enfoca el campo |
| Foco visible | En `--gestia-cyan` |
| Sin librerías | No hay ECharts, Flatpickr, Preline ni Simplebar |
| Datos de ejemplo verosímiles | Español, con acentos y eñes, nombres largos y cortos, y casos incompletos |
| Nombres inventados | Nunca usar nombres de personas reales del proyecto |
| Botón primario inhabilitado | Borde `--gestia-border`, fondo `--gestia-surface-soft`, texto `--gestia-muted`, **y la razón escrita al lado**. Nunca solo el estado visual: un botón apagado sin explicación deja al usuario adivinando qué le falta |

---

## Semántica de color

| Situación | Token |
|---|---|
| Vacante, hueco de cobertura, destructivo, error | `--gestia-danger` |
| Advertencia, patrón incompleto | `--gestia-warning` |
| Estado positivo, activo | `--gestia-success` |
| Selección, resaltado | `--gestia-cyan-soft` |
| Acento, foco, pestaña activa | `--gestia-cyan` |
| Texto en cian sobre fondo claro | `--gestia-cyan-dark` |

Ningún estado depende solo del color: siempre lleva texto o forma que lo acompañe.
