# Análisis de pantallas y acciones — GestIA, vista Super Admin

Levantado el 2026-09-04 sobre `dev.gestia-demo.com`, con sesión de soporte activa en
GestIA Operadora Local. Inventario tomado del árbol de accesibilidad de cada ruta, no de
lectura de código.

Advertencia de método: el ambiente solo contiene datos de humo (un cliente, un servicio,
un empleado). Los problemas de densidad y escala no son observables todavía.

---

## Parte 1 — Problemas sistémicos

Estos aparecen en varias pantallas. Arreglarlos una vez arregla todo el producto, y son
los que más peso tienen para el rediseño.

### 1.1 El selector de organización se repite en cada pantalla

Está en Inicio, Monitor, Clientes, Servicios, Personal, Catálogos, Planeación,
Incidencias, Solicitudes, Reglas documentales y Seguridad. Once pantallas con el mismo
control.

Peor: **contradice la sesión de soporte**. La franja amarilla declara GestIA Operadora
Local y los selectores muestran Breakthrough Consulting Services. El usuario no sabe en
qué organización está parado.

En Clientes el selector aparece **dos veces en la misma pantalla**.

Corrección: el contexto de organización se elige una vez, vive en la barra superior, y
las pantallas lo heredan. Ningún módulo lo vuelve a preguntar.

### 1.2 Dos rutas, una pantalla

`/catalogos` y `/configuracion/documentos` renderizan contenido idéntico. Son dos
entradas de menú distintas —Catálogos y Reglas documentales— que llevan a lo mismo.

### 1.3 Botones sin nombre accesible

Contados: 6 en Clientes, 7 en Solicitudes, 5 en Planeación, más de 20 en Catálogos. Son
botones que solo comunican por su icono. Un lector de pantalla los anuncia como "botón",
sin más.

### 1.4 Tres formatos de fecha conviviendo

`viernes, 04 de septiembre de 2026` en Inicio, `09/04/2026` en el campo de fecha
operativa del Monitor (formato estadounidense, ambiguo para un usuario mexicano), y
`2026-08-27` en la tabla de Servicios.

### 1.5 Desplegables nativos sin estilo

Todos los `<select>` de la aplicación son del sistema operativo. Contrastan con los
botones y tarjetas cuidados del resto y son la causa principal de que la plataforma se
vea a medio terminar.

### 1.6 Acciones destructivas con el mismo peso que las neutras

"Desactivar" aparece como enlace de texto junto a "Editar" en Servicios, Clientes,
Personal y en cada configuración. En Organizaciones el botón "Desactivar" está pegado a
"Guardar cambios".

### 1.7 Acentos faltantes en algunas pantallas

Monitor global y sus mensajes: "Operacion en soporte", "Sin sesion activa", "Se requiere
una sesion de soporte", columna "Organizacion". El modal de soporte dice "Duracion". En
otras pantallas los acentos sí están.

### 1.8 Botones "Actualizar" manuales

En Monitor, Servicios, Planeación y Seguridad. Si los datos se quedan viejos eso es un
defecto a corregir, no una tarea que se delega al usuario.

---

## Parte 2 — Inventario por pantalla

### Inicio (`/`)

| Elemento | Observación |
|---|---|
| 4 tarjetas de KPI | Tres dicen "Contexto: Sin contexto" y valen 0 |
| Gráfica de dona | 0 turnos esperados, sin datos |
| Panel "Necesita tu atención" | Vacío |
| Tabla "Organizaciones en seguimiento" | Duplica el Monitor global |
| 4 tarjetas de acceso rápido al pie | Duplican entradas que ya están en el menú lateral |
| Botón "+ Nueva organización" | Lleva a Organizaciones, donde el formulario ya está abierto |

**Diagnóstico:** la primera pantalla después de entrar no comunica nada. Un tablero
vacío enseña al usuario a ignorar el tablero.

### Monitor global (`/monitor`)

Actualizar · Buscar · filtro Estado · Gestionar organizaciones · Iniciar soporte por fila
· fecha operativa · 4 KPIs.

**Diagnóstico:** tercera lista de las mismas tres organizaciones, con un tercer diseño.
Es la única de las tres que ofrece iniciar soporte, así que es la que debería quedarse.

### Organizaciones (`/plataforma/organizaciones`)

Ver seguridad · Entrar a vista admin · Gestionar accesos · formulario de alta con stepper
de 3 pasos · directorio · Desactivar · Guardar cambios · crear admin con contraseña
temporal.

**Diagnóstico:** tres formularios compitiendo en pantalla. El de alta está siempre
desplegado ocupando la mejor posición aunque hayas entrado a revisar otra organización.
Al llegar desde Inicio no respeta cuál organización elegiste: selecciona la primera de la
lista, y no regresa el scroll al inicio.

La contraseña temporal se teclea a mano y se comparte fuera del sistema. Es el mismo
patrón que dejó viva la contraseña por defecto en este ambiente.

### Clientes (`/clientes`)

9 filtros · 4 chips rápidos · rango de fechas · búsqueda de contacto · Limpiar · Filtrar
· Nueva organización · Nuevo cliente · Ver expediente · Editar cliente · Desactivar
cliente · Editar ficha · Desactivar · 6 botones sin etiqueta.

**Diagnóstico:** dos selectores de organización idénticos. Pares de acción duplicados
("Editar cliente" y "Editar ficha"). Un botón "Nueva organización" que no pertenece a
esta pantalla.

### Servicios (`/servicios`)

Cascada organización → cliente → servicio antes de mostrar nada. 7 controles de filtro.
Nuevo servicio · Actualizar · Editar/Desactivar/Documentos por fila · 4 pestañas · Ir a
planeación · Nueva configuración.

**Diagnóstico:** la ficha del servicio se abre **debajo** de la tabla, en el mismo scroll.
El filtro "Estado" promete un ciclo de vida que el dominio no tiene. Es la pantalla en
peor estado y la que ya tiene trabajo definido en D1.

### Personal (`/personal`)

9 filtros · Limpiar · Filtrar · Nuevo empleado · Ver/Editar por fila · selector de estado
en línea · Editar ficha · Desactivar · 5 pestañas.

**Diagnóstico:** varios filtros tienen una sola opción real ("Sin sede visible", "Todos
los servicios"). Filtros que no filtran nada ocupan espacio y erosionan la confianza.

### Catálogos (`/catalogos`) y Reglas documentales (`/configuracion/documentos`)

**Misma pantalla, dos rutas.** Elegir catálogo (abre modal) · Ir al checklist · Completar
puestos / habilidades / motivos / tipos · Configurar reglas · 2 pestañas
(Administrables / Del sistema) · más de 20 botones sin etiqueta.

**Diagnóstico:** elegir un catálogo requiere abrir un modal. Debería ser navegación
directa.

### Planeación (`/planeacion`)

Actualizar · Nueva versión · 4 selectores en cascada · Resolver 7 conflictos · Publicar
versión · 5 botones sin etiqueta.

**Diagnóstico:** "Resolver 7 conflictos" es la acción más importante de la pantalla y no
tiene tratamiento visual distinto al resto.

### Solicitudes (`/solicitudes`)

Nueva solicitud · 6 filtros · rango de fechas · responsable · Limpiar · Filtrar · 4 chips
· ordenamiento · 7 botones sin etiqueta.

### Seguridad (`/seguridad`)

Actualizar · **"Nuevo acceso" dos veces** · 5 pestañas · 4 filtros · Limpiar · Filtrar ·
Ver detalle / Asignar acceso por fila · Ver auditoría.

**Diagnóstico:** aparece un rol llamado "Rol QA Temporal" en la lista de roles
asignables. Es residuo de pruebas.

### Incidencias (`/operacion/incidencias`)

Cascada de 3 selectores · fecha · Actualizar · Confirmar asistencia pendiente · Cerrar día.

**Diagnóstico:** las acciones son de asistencia y cierre diario, no de incidencias.
Revisar si la ruta está renderizando el componente equivocado.

---

## Parte 3 — Qué quitar

Ordenado por relación entre ruido eliminado y riesgo.

| # | Qué se quita | Por qué | Riesgo |
|---|---|---|---|
| 1 | Segundo selector de organización en Clientes | Duplicado exacto | Nulo |
| 2 | Segundo "Nuevo acceso" en Seguridad | Duplicado exacto | Nulo |
| 3 | Botón "Nueva organización" en Clientes | No pertenece a esta pantalla | Nulo |
| 4 | Rol "QA Temporal" de la lista de roles | Residuo de pruebas | Nulo |
| 5 | Las 4 tarjetas de acceso rápido de Inicio | Duplican el menú lateral | Bajo |
| 6 | Tabla de organizaciones en Inicio | Tercera copia de la misma lista | Bajo |
| 7 | Tarjeta "ROL PARA ALTA · ORGANIZATION_ADMIN" | No es métrica; expone nombre técnico | Bajo |
| 8 | Botones "Actualizar" manuales | La app debe refrescar sola | Medio — confirmar por qué se pusieron |
| 9 | Selector de organización en pantallas de módulo | El contexto se hereda de la barra superior | Medio — toca 11 pantallas |
| 10 | Una de las dos rutas de Catálogos | Contenido idéntico | Medio — definir cuál se queda |
| 11 | Filtros con una sola opción en Personal | No filtran nada | Bajo |
| 12 | Formulario de alta siempre abierto en Organizaciones | Debe vivir detrás del botón | Bajo |

**Criterio general:** una pantalla, un trabajo. Una acción, un camino. Si algo aparece
dos veces, gana el lugar donde el usuario lo busca naturalmente y desaparece del otro.

---

## Parte 4 — Sistema de componentes a definir en Claude Design

El problema no es que las pantallas estén feas, es que **cada una resolvió lo mismo de
forma distinta**. Antes de rediseñar pantallas hay que definir las piezas.

### Los ocho componentes que resuelven casi todo

1. **Barra de contexto.** Dónde vive la organización activa, el modo soporte y la fecha
   operativa. Una sola, arriba, siempre visible. Reemplaza once selectores.

2. **Encabezado de página.** Etiqueta de sección, título, descripción y acción principal.
   Hoy cada pantalla lo hace distinto.

3. **Barra de filtros.** Un buscador siempre visible y el resto plegado tras "Más
   filtros", con los chips activos visibles. Resuelve las nueve de Clientes y las nueve
   de Personal.

4. **Tabla de datos.** Columnas, orden, paginación, estado vacío y estado de carga
   consistentes. Con acciones de fila como menú, no como enlaces sueltos.

5. **Panel de detalle lateral.** Sustituye el patrón actual de apilar la ficha debajo de
   la tabla. Es el cambio que más mejora Servicios y Personal.

6. **Tarjeta de indicador.** Con estado vacío diseñado, no con un cero sin explicación.

7. **Diálogo de confirmación destructiva.** Para todo lo que hoy es un enlace
   "Desactivar" junto a "Editar".

8. **Estado vacío.** Con explicación de por qué no hay nada y una acción para resolverlo.
   Reemplaza los muros de "Se requiere una sesión de soporte".

### Reglas transversales

- Un solo formato de fecha en toda la aplicación.
- Selectores con estilo propio, nunca el nativo del sistema.
- Español con acentos, sin excepción.
- Acción destructiva siempre separada visualmente y con confirmación.
- Todo botón con nombre accesible, aunque solo muestre icono.
- Solo componentes portados de INSPINIA, con la identidad del brand book.

---

## Parte 5 — Orden propuesto

1. **Definir el sistema de componentes en Claude Design.** Ocho piezas, sin pantallas
   todavía.
2. **Rediseñar Servicios** aplicándolas. Es la peor y ya tiene trabajo definido en D1.
3. **Rediseñar Inicio del super admin.** Primera impresión, no depende de decisiones
   pendientes.
4. **Aplicar el sistema al resto**, pantalla por pantalla.
5. **Ejecutar la lista de la Parte 3** como paquete propio, con visto bueno explícito.

### Bloqueos reales

- **Datos de demo realistas.** Con un cliente y un servicio no se puede evaluar ninguna
  tabla. Esto bloquea todo lo demás.
- **Qué significa "estado" en Servicios.** El rediseño de esa pantalla cambia según la
  respuesta.
- **Qué ruta de Catálogos se queda.**
- **Si "Actualizar" se puso por un problema real de datos viejos.**

---

## Parte 6 — Higiene detectada

1. Contraseña por defecto del sembrador viva en el ambiente publicado.
2. Rol "QA Temporal" en la lista de roles asignables.
3. Carpeta `docs/design/` sin commitear.
4. README describe el proyecto como "en preparación inicial".
5. La ruta de Incidencias muestra acciones de asistencia y cierre diario.
