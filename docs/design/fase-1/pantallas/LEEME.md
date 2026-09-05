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
| Planeación | Admin de organización |
| Asistencia | Admin de organización |
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

### Asistencia — 4 vistas y un anexo

`asistencia/asistencia.html`. Dibujada como **admin de organización**. Opera sobre un día y un
servicio concretos, y reutiliza la **cuadrícula de proyección** de Planeación, plegada por
defecto: arriba manda la excepción, no la semana.

| Vista | Qué muestra |
| --- | --- |
| 1 | El día con excepciones |
| 2 | Un día sin excepciones: todo salió como se planeó |
| 3 | Registro de una asistencia, con la secuencia hacia la incidencia |
| 4 | Sin planeación publicada: no hay contra qué comparar |
| Anexo | Estados de la lista y los tres tipos de excepción |

El panel de registro va **sin pestañas**: es un solo propósito con una continuación, y el pie
lleva al siguiente paso. La regla quedó escrita en el sistema de componentes.

#### Cuatro preguntas abiertas que dejó este diseño

1. **El rol Operación** se nombra en el paso 10 del alcance pero **no existe en el menú**, que
   sólo tiene super admin fuera, super admin dentro y admin de organización.
2. **No existe el concepto de día cerrado**, y sin corte la conciliación con el cliente no
   tiene contra qué medirse.
3. **La hora real se teclea**, porque el check-in digital es etapa 13 del proceso de negocio,
   fuera de fase 1 por decisión tomada. La captura es correcta para hoy.
4. **La política de retardos** vive en configuración de la organización, pantalla que no está
   en fase 1. El diseño no asume consecuencia: la píldora dice que el descuento es
   configurable y el panel no marca nada por omisión.

> **Nota de verificación contra el código.** Las preguntas 1 y 2 son huecos de **diseño**, no
> de modelo, y conviene saberlo antes de resolverlas:
>
> - Los roles operativos **sí existen** en la base: `ORG_SUPERVISOR`, `ORG_OPERATOR` y
>   `ORG_VIEWER`, cada uno con su reparto de permisos. Lo que falta es su variante de menú y
>   decidir cuál de los tres registra la asistencia, porque `ORG_VIEWER` sólo lee.
> - El cierre del día **sí existe** en el backend desde la migración
>   `20260828200905_OperationControls`: la entidad `OperationDayClosure` guarda servicio,
>   fecha, los contadores del día, `Closed`/`Reopened`, quién cerró y quién reabrió con motivo,
>   con un cierre único por servicio y día y endpoints `GET`/`POST .../operations/day-closures`.
>   Lo que falta es exponerlo en esta pantalla, no construirlo.

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

### Planeación — 5 vistas

`planeacion/planeacion.html`. Dibujada como **admin de organización**. Introduce la
**cuadrícula de proyección**, posición por siete días, que Asistencia va a reutilizar tal cual.

| Vista | Qué muestra |
| --- | --- |
| 1 | Proyección generada, sin conflictos |
| 2 | Proyección con conflictos, el estado normal |
| 3 | Un conflicto abierto, con su resolución |
| 4 | Versión publicada, inmutable |
| 5 | Sin posiciones ni asignaciones |

#### Tres preguntas abiertas que dejó este diseño

Están escritas dentro del propio archivo y **ninguna se resuelve desde diseño**: son decisiones
de negocio.

1. **El traslape, ¿bloquea o solo advierte?** El diseño lo deja anotado literalmente: *"Si
   bloquea o solo advierte está pendiente de definir."* Hoy el código bloquea con 409, así que
   cambiarlo sería alterar conducta ya desplegada.
2. **El cubre-descansos, ¿es fijo o va por asignación?** La leyenda de la cuadrícula lo marca
   como *"fijo o por asignación: pendiente"*.
3. **La elegibilidad por texto libre.** El diseño advierte que se compara el puesto del
   empleado contra el perfil requerido de la posición y **ambos son texto libre**, de modo que
   una diferencia de redacción bloquea a alguien capaz. Queda por decidir si se mantiene así o
   pasa por el catálogo de habilidades.

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
no solo estas seis. Cualquier cambio ahí afecta a la aplicación entera.

## Faltan por diseñar

Queda una: **Incidencias con Cobertura**.

## Se implementan sin pasar por diseño terminado

**Organizaciones**, **Catálogos** y **Seguridad** se construyen directo desde
[`../recorrido/boceto.html`](../recorrido/boceto.html), aplicando el sistema de componentes.
No van a tener un archivo de diseño terminado en esta carpeta, y no hace falta esperarlo para
empezarlas.
