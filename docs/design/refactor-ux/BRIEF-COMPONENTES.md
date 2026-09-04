# Brief para Claude Design — Sistema de componentes GestIA

Destino: definir ocho componentes antes de rediseñar cualquier pantalla.
Base: tokens leídos en vivo de `dev.gestia-demo.com` el 2026-09-04.

---

## Enfoque

**Quitar antes que agregar.** Cada componente de este brief existe para reemplazar tres o
cuatro formas distintas de resolver lo mismo. Si una propuesta suma elementos en pantalla
en lugar de restarlos, está mal enfocada.

Criterio para decidir si algo se queda: *si lo quito, ¿el usuario pierde la capacidad de
hacer algo?* Si la respuesta es no, se va. Un borde decorativo, un icono que acompaña a
una etiqueta que ya lo dice, una tarjeta que repite el menú lateral, un contador junto a
un filtro que ya muestra el total: todo eso es ruido.

---

## Reglas no negociables

Vienen del ADR-0002 y de `docs/integrations/inspinia-5.md`. Un diseño que las rompa no se
puede implementar.

1. **Solo se portan piezas de INSPINIA, no carpetas.** Cada componente portado registra
   archivo de origen, dependencias nuevas, adaptación visual, prueba y módulo consumidor.
2. **No están disponibles Preline, Simplebar, Flatpickr, ECharts ni Google Maps.** Agregar
   cualquiera exige justificar un caso funcional. Consecuencia directa: **no se puede
   diseñar con selectores de fecha bonitos ni gráficas de librería** sin abrir esa
   discusión primero.
3. **La identidad es de GestIA, no de INSPINIA.** Colores, tipografía, iconografía y
   textos son propios.
4. **Tailwind 4.1 vía PostCSS.** Sin plugin de formularios instalado.
5. **La plataforma es plana.** Las tres variables de sombra valen `none`. La separación se
   logra con borde y color de superficie, nunca con elevación.

---

## Tokens reales, tomados de la aplicación

Usar estos nombres exactos. No inventar colores.

### Color

| Token | Valor | Uso |
|---|---|---|
| `--gestia-navy` | `#10104e` | Sidebar, botón primario, títulos |
| `--gestia-navy-soft` | `#1c1c66` | Estado hover del navy |
| `--gestia-cyan` | `#22c6ee` | Acento, foco, elemento activo |
| `--gestia-cyan-dark` | `#087f9c` | Cian sobre fondo claro, para contraste de texto |
| `--gestia-cyan-soft` | `#e9f7fa` | Fondo de selección, resaltado suave |
| `--gestia-canvas` | `#f4f6fa` | Fondo de página |
| `--gestia-surface` | `#ffffff` | Superficie de tarjeta y tabla |
| `--gestia-surface-soft` | `#f7f9fb` | Encabezado de tabla, fila alterna |
| `--gestia-border` | `#dce2e9` | Todo borde |
| `--gestia-text` | `#253040` | Texto principal |
| `--gestia-muted` | `#5f6b7a` | Texto secundario, etiquetas |
| `--gestia-success` | `#16a34a` | Estado positivo |
| `--gestia-warning` | `#d97706` | Advertencia, modo soporte |
| `--gestia-danger` | `#dc2626` | Destructivo, error |
| `--gestia-info` | `#0284c7` | Informativo |

### Estructura

| Token | Valor |
|---|---|
| `--gestia-sidebar-width` | `17rem` |
| `--gestia-sidebar-condensed-width` | `5rem` |
| `--gestia-topbar-height` | `4.5rem` |
| `--gestia-page-gap` | `1rem` |
| `--gestia-card-padding` | `1rem` |
| `--gestia-radius` | `6px` |
| `--gestia-control-height` | `2.5rem` |
| `--gestia-shadow-sm` / `md` / `action` | `none` |

**Nota sobre el cian.** `#22c6ee` sobre blanco no alcanza contraste suficiente para texto.
Sirve como acento, borde de foco e indicador activo. Para texto en cian usar
`--gestia-cyan-dark`.

---

## Los ocho componentes

### 1. Barra de contexto

**Reemplaza:** once selectores de organización repartidos por la aplicación, incluidos los
dos idénticos de Clientes.

**Problema que resuelve:** hoy la franja de soporte dice "GestIA Operadora Local" mientras
los selectores de cada pantalla muestran "Breakthrough Consulting Services". El usuario no
sabe dónde está parado.

**Contenido:** organización activa (con cambio), fecha operativa, y el estado de soporte
cuando aplica.

**Estados:** sin organización seleccionada · organización activa · modo soporte activo con
tiempo restante · soporte por expirar.

**Medidas:** altura `--gestia-topbar-height`. En modo soporte, franja completa bajo la
barra en `--gestia-warning` con texto oscuro.

**Regla:** ninguna pantalla de módulo vuelve a preguntar la organización. Se hereda.

---

### 2. Encabezado de página

**Reemplaza:** cinco maneras distintas de titular una pantalla.

**Contenido:** etiqueta de sección en mayúsculas pequeñas y `--gestia-muted`, título en
`--gestia-navy`, descripción de una línea opcional, y **una sola acción principal** a la
derecha.

**Regla dura:** una acción principal por pantalla. Las secundarias van en menú. Hoy
Clientes tiene "Nueva organización" y "Nuevo cliente" al mismo nivel, y Seguridad tiene
"Nuevo acceso" dos veces.

**Lo que se elimina:** breadcrumb duplicado. Hoy la ruta aparece arriba y el título la
repite abajo. Se queda uno.

---

### 3. Barra de filtros

**Reemplaza:** nueve filtros expuestos en Clientes, nueve en Personal, seis en Solicitudes,
siete controles en Servicios.

**Estructura:**
- Buscador siempre visible, ancho completo.
- Botón "Filtros" que abre el resto en panel plegable, cerrado por defecto.
- Chips de filtros activos bajo la barra, cada uno con su equis para quitarlo.
- Contador de resultados junto al buscador.

**Estados:** limpio · con filtros aplicados · sin resultados por filtro (distinto de sin
datos).

**Lo que se elimina:**
- El botón "Filtrar". Los filtros se aplican al cambiar.
- El botón "Limpiar" como botón separado: se sustituye por "Quitar todos" junto a los chips,
  visible solo cuando hay filtros.
- Filtros con una sola opción real. En Personal hay al menos dos ("Sin sede visible",
  "Todos los servicios").
- Los chips de acceso rápido cuando duplican un filtro que ya está en el panel.

---

### 4. Tabla de datos

**Reemplaza:** tres diseños de tabla distintos, más el patrón de acciones como enlaces de
texto sueltos.

**Estructura:** encabezado en `--gestia-surface-soft`, filas sobre `--gestia-surface`,
separador `--gestia-border` de 1px, sin sombra. Altura de fila cómoda: la operación se
revisa muchas filas seguidas.

**Acciones de fila:** un menú al final de la fila, no tres enlaces. Hoy en Servicios se
lee "Editar · Desactivar · Documentos", con la acción destructiva del mismo peso que las
otras dos.

**Estados:** cargando (esqueleto, no spinner) · con datos · vacío por filtro · vacío sin
datos · error.

**Lo que se elimina:** el botón "Actualizar" manual. Está en Monitor, Servicios,
Planeación y Seguridad. *Confirmar antes de quitarlo por qué se puso.*

---

### 5. Panel de detalle lateral

**Reemplaza:** el patrón de apilar la ficha debajo de la tabla. Es el cambio de mayor
impacto del brief.

**Problema que resuelve:** en Servicios, al elegir un servicio la ficha aparece **debajo**
de la tabla, en el mismo scroll. El usuario recorre barra de filtros, encabezado de
cliente, segunda barra de filtros, tabla, y hasta abajo la ficha con sus cuatro pestañas.
Son 1,529 líneas en una sola columna vertical.

**Estructura:** panel a la derecha, la tabla se comprime, la fila seleccionada queda
resaltada en `--gestia-cyan-soft`. Encabezado fijo con título y cierre; cuerpo con
pestañas; pie con acciones.

**Estados:** cerrado · abierto cargando · abierto con contenido · abierto en edición con
cambios sin guardar.

**Aplica a:** Servicios, Personal, Clientes, Solicitudes.

---

### 6. Tarjeta de indicador

**Reemplaza:** las cuatro tarjetas de Inicio donde tres dicen "Contexto: Sin contexto" y
valen 0.

**Estructura:** etiqueta, valor, y una línea de apoyo que explique el número.

**Estados:** con dato · cargando · **sin contexto** · cero real.

La distinción entre "sin contexto" y "cero real" es el punto del componente. Hoy ambos se
ven igual: un cero grande. Un cero real merece mostrarse; un "sin contexto" debe explicar
qué falta y ofrecer la acción para resolverlo.

**Lo que se elimina:** la tarjeta "ROL PARA ALTA · ORGANIZATION_ADMIN". No es una métrica,
es una constante, y además expone el identificador técnico del rol.

---

### 7. Diálogo de confirmación destructiva

**Reemplaza:** los enlaces "Desactivar" que hoy conviven con "Editar" con el mismo peso, y
el botón "Desactivar" pegado a "Guardar cambios" en Organizaciones.

**Contenido:** qué se va a desactivar, nombrado; qué consecuencia tiene; y la confirmación.

**Regla:** el botón destructivo usa `--gestia-danger` y nunca queda adyacente al primario.
En el diálogo, cancelar es la acción por defecto.

---

### 8. Estado vacío

**Reemplaza:** los muros de "Esta consulta requiere una sesión de soporte activa para una
organización", que hoy son un título, una línea y un botón en una página en blanco.

**Estructura:** explicación breve de por qué no hay nada y una acción que lo resuelva.
Sobre `--gestia-surface`, dentro del área de contenido, no flotando en el vacío.

**Variantes:** sin permiso · sin contexto de organización · sin datos aún · sin resultados
por filtro.

**Regla:** un estado vacío nunca dice solo qué falta. Siempre ofrece cómo resolverlo.

---

## Reglas transversales

Aplican a los ocho componentes.

| Regla | Qué corrige hoy |
|---|---|
| Un solo formato de fecha: `04 sep 2026` | Conviven `viernes, 04 de septiembre de 2026`, `09/04/2026` y `2026-08-27` |
| Selectores con estilo propio | Todos los `<select>` son nativos del sistema |
| Español con acentos, sin excepción | Monitor global dice "Operacion", "sesion", "Organizacion", "Duracion" |
| Todo botón con nombre accesible | 6 sin etiqueta en Clientes, 7 en Solicitudes, 5 en Planeación, más de 20 en Catálogos |
| Toda etiqueta asociada a su campo | En el login, hacer clic en "Correo" no enfoca el campo |
| Foco visible en `--gestia-cyan` | Navegación por teclado sin rastro visual |

**Sobre las fechas hay una decisión pendiente.** Sin Flatpickr, los campos de fecha son
`<input type="date">` nativos, que se rinden en el formato del sistema operativo — de ahí
el `09/04/2026`. Para tener un formato consistente hay que incorporar Flatpickr,
justificando el caso funcional según la regla de INSPINIA, o construir el selector. El
diseño debe contemplar ambos escenarios.

---

## Cómo trabajarlo en Claude Design

Un componente por sesión, en este orden. Cada uno alimenta al siguiente.

1. Barra de contexto
2. Encabezado de página
3. Barra de filtros
4. Tabla de datos
5. Panel de detalle lateral
6. Tarjeta de indicador
7. Diálogo destructivo
8. Estado vacío

Para cada sesión, entregar a Design: este brief, la tabla de tokens, y una captura de la
pantalla actual que el componente va a reemplazar.

Pedir siempre **todos los estados**, no solo el estado ideal con datos. El estado vacío y
el de carga son donde la plataforma se siente hoy sin terminar.

Al cerrar cada componente, guardar el resultado en
`docs/design/refactor-ux/componentes/<nombre>/` con la captura y una nota de qué tokens usa
y qué estados cubre. Eso es lo que va a leer Claude Code al implementar.

---

## Pendientes que bloquean

1. **Datos de demo realistas.** Con un cliente, un servicio y un empleado no se puede
   diseñar ni evaluar una tabla. Bloquea los componentes 3, 4 y 5.
2. **Qué significa "estado" al filtrar servicios.** Cambia el diseño de la barra de filtros
   y de la tabla.
3. **Flatpickr sí o no.** Define si el selector de fecha se diseña o se hereda.
4. **Qué ruta de Catálogos se queda**, dado que `/catalogos` y `/configuracion/documentos`
   muestran la misma pantalla.
5. **Por qué existen los botones "Actualizar".** Si responden a un problema real de datos
   viejos, se corrige la causa antes de quitar el botón.
