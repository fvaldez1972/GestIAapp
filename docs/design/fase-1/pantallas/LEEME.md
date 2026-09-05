# Pantallas de la fase 1

Diseños terminados a 1440 px. Cada archivo `.html` se abre directo en el navegador y contiene
todas las vistas de esa pantalla, una debajo de otra.

## Regla que manda sobre todo lo demás

**[`../SISTEMA-COMPONENTES-CERRADO.md`](../SISTEMA-COMPONENTES-CERRADO.md) manda sobre
cualquier decisión visual de estos archivos.** Si un diseño y el sistema de componentes no
coinciden, gana el sistema. Los diseños son la aplicación del sistema a un caso concreto, no
una fuente alterna de reglas.

## Los colores están en hex crudo

Estos archivos traen los colores escritos a mano, como `#10104e`, y **no** usan
`var(--gestia-*)`. Al implementar hay que traducirlos a los tokens de la aplicación; copiar el
hex directo al código es un error, porque rompe el tema y duplica la definición del color.

La tabla de equivalencias está en el sistema de componentes y en
[`../../refactor-ux/BRIEF-COMPONENTES.md`](../../refactor-ux/BRIEF-COMPONENTES.md).

## Cada pantalla se dibuja con el rol que realmente la usa

No todas las pantallas están dibujadas desde el mismo rol, y es deliberado: cada una se dibuja
con el rol que de verdad la opera. Se nota en el menú lateral y en si aparece la salida a la
vista de plataforma.

| Pantalla | Rol con el que está dibujada |
| --- | --- |
| Clientes | Admin de organización |
| Personal | Admin de organización |
| Servicios | Super admin dentro de una organización |
| Inicio | Ambos: las vistas 1 a 3 como admin de organización, la 4 como super admin que entró |

## Terminadas

### Clientes — 5 vistas

`clientes/clientes.html`. Dibujada como **admin de organización**: no lleva salida a la vista
de plataforma, porque quien administra la cartera de clientes es la organización misma.

| Vista | Qué muestra |
| --- | --- |
| 1 | Listado con la barra de filtros del sistema |
| 2 | Panel de detalle abierto, pestaña Datos |
| 3 | Panel abierto, pestaña Sedes |
| 4 | Formulario de alta de cliente |
| 5 | Cliente guardado sin sede: el aviso llega aquí, con la salida a un clic |

### Personal — 5 vistas

`personal/personal.html`. Dibujada como **admin de organización**. El panel de detalle lleva
tres pestañas: **Datos · Documentos · Asignaciones**.

| Vista | Qué muestra |
| --- | --- |
| 1 | Listado con cuatro filtros y el vencimiento a la vista |
| 2 | Panel de detalle, pestaña Datos, con la franja de elegibilidad |
| 3 | Panel, pestaña Documentos, con vigencias |
| 4 | Formulario de alta: el expediente mínimo, completo |
| 5 | Sin puestos en catálogo: se crea aquí, o se va y se vuelve sin perder nada |

### Servicios — 6 vistas

`servicios/servicios.html`. Cubre los pasos 5, 6 y 8 del recorrido. Dibujada como
**super admin dentro de una organización**, así que sí lleva la salida a la vista de
plataforma.

| Vista | Qué muestra |
| --- | --- |
| 1 | Listado de servicios, sin cascada |
| 2 | Ficha en panel lateral, pestaña Datos |
| 3 | Pestaña Posiciones, patrón semanal |
| 3-B | Patrón cíclico, N días anclados a una fecha |
| 4 | Pestaña Asignaciones, vacantes visibles |
| 5 | Titular dado de baja y el calendario no se mueve |

### Inicio — 4 vistas y un anexo

`inicio/inicio.html`.

| Vista | Qué muestra |
| --- | --- |
| 1 | Organización recién creada; todo el cuerpo es el camino de configuración |
| 2 | Configuración a medias; el camino se encoge y aparece la primera franja |
| 3 | Organización en operación; el camino queda en una línea y manda el tablero |
| 4 | La vista 3 vista por un super admin que entró a la organización |
| Anexo | Los cuatro estados de la tarjeta de indicador y los tokens que usan |

## Compartido entre pantallas

`componentes/side-menu.html` vive en su propia carpeta porque **lo usan todas las pantallas**,
no solo estas cuatro. Cualquier cambio ahí afecta a la aplicación entera.

## Faltan por diseñar

Quedan tres, en este orden:

1. Planeación
2. Asistencia
3. Incidencias con Cobertura

## Se implementan sin pasar por diseño terminado

**Organizaciones**, **Catálogos** y **Seguridad** se construyen directo desde
[`../recorrido/boceto.html`](../recorrido/boceto.html), aplicando el sistema de componentes.
No van a tener un archivo de diseño terminado en esta carpeta, y no hace falta esperarlo para
empezarlas.
