# Validación de los defectos reportados — 8 de septiembre de 2026

Recorrido de **los trece defectos numerados** de los cuatro documentos, más las cinco
observaciones del documento de seguimiento. Cada uno se ejercitó contra el sistema en marcha
—navegador y API, no lectura de código— entrando como **Admin de organización**, que es el rol
con el que se reportaron.

## Resumen

| Módulo | Reportados | Confirmados corregidos | Encontrados al validar |
|---|---|---|---|
| Clientes | 5 | 5 | 2 |
| Personal | 2 | 2 | 0 |
| Seguridad | 5 | 5 | 1 |
| Servicios | 1 | 1 | 1 |
| **Total** | **13** | **13** | **4** |

Los cuatro «encontrados al validar» no estaban en ningún documento. Salieron de ejercitar la
ruta completa, y tres de ellos no se veían leyendo el código.

## Clientes

| # | Reportado | Estado | Evidencia |
|---|---|---|---|
| 1 | No se puede editar la sede | Corregido | El menú abre «EDITAR SEDE» con los datos cargados; se guarda, el formulario cierra y la lista muestra el nombre nuevo |
| 2 | El botón de desactivar sede no funciona | Corregido | 3 sedes → 2, contador de la pestaña al instante, «quedó desactivada. Sus registros se conservan» |
| 3 | Con el filtro en «Todos» aparecen sedes que no se muestran | Corregido | Con «Todos»: contador 2, lista 2, pie 2. Consistente en los tres sitios |
| 4 | Dice «sin contacto» aunque la sede tiene contactos | Corregido | Cada sede muestra quién responde y su puesto. `awddaw` sigue diciendo «sin contacto» porque tiene 0, que es correcto |
| 5 | El contador de Contactos no se actualiza al instante | Corregido | 2 → 3 al guardar, sin recargar |

### Encontrado al validar

- **Guardar una sede la guardaba y el formulario seguía abierto.** La sede cambiaba en la base y
  salía el aviso de que había quedado actualizada, pero el formulario se quedaba ahí con los datos
  dentro. «Cancelar» hacía lo mismo. Era una carrera: el formulario se cerraba solo, la página
  todavía apuntaba a esa sede mientras la petición iba en vuelo, y el efecto que sincroniza los dos
  lo reabría en el acto. Ahora manda la página, que es la única que sabe si el servidor confirmó.
- **La pestaña decía «Contactos 3» y el pie del mismo panel decía «2».** Al registrar un contacto se
  recargaba la ficha pero no la lista, y del listado salen el pie y la columna de «sin contacto».
  Era el único de los siete guardados de la pantalla que no recargaba las dos cosas.

## Personal

| # | Reportado | Estado | Evidencia |
|---|---|---|---|
| 1 | El contador de documentos no se actualiza al instante | Corregido | 5 → 6 al guardar, y el pie pasa a «6 documentos» |
| 2 | El navegador de páginas no funciona, los documentos se acumulan | Corregido | Con 6 documentos aparece «1 / 2»: 5 en la primera, 1 en la segunda, sin acumular |

## Seguridad

| # | Reportado | Estado | Evidencia |
|---|---|---|---|
| 1 | El scroll no permite ver bien (y en Auditoría → Ver detalle) | Corregido | El cajón ya no se abre solo al entrar; lleva velo con clic para cerrar y salida con Escape, en las dos pantallas |
| 2 | El botón de Cambiar contraseña no funciona | Corregido | El campo existe en el cajón; cambia la contraseña de verdad, y si falta algo lo dice |
| 3 | Al pulsar Filtrar sigue mandando a un único usuario | Corregido | Filtra a 1 fila y ya no reabre el cajón encima |
| 4 | Los botones de «Leer» no funcionan | Corregido | No son botones: son la lista de permisos del rol. Ahora se dibujan planas, con cursor normal y con la leyenda que lo dice |
| 5 | «Ocurrió un error inesperado» al crear acceso, y no se ve en Auditoría | Corregido | En `dev.gestia-demo.com`: alta 201, y Auditoría muestra el alta del usuario, el alta del acceso y la actualización |

Los **cinco endpoints de escritura** de usuarios de organización se probaron uno por uno contra
`db-gestia-dev`: crear acceso 201, editar 200, asignar acceso 200, quitar acceso 200, activar 200,
cambiar contraseña 204. Antes los cinco devolvían 500 con el cambio ya escrito.

### Encontrado al validar

- **Quitar un acceso devolvía 200 y el rol seguía en pantalla.** La fila quedaba en `Active = 0` en
  la base —comprobado consultándola— y el listado la seguía devolviendo. Las tres proyecciones de
  usuario llevan `IgnoreQueryFilters(["Active"])` a propósito, porque la pantalla muestra a los
  usuarios dados de baja con su etiqueta, pero ese operador vale para la consulta entera y apagaba
  el filtro también en las subconsultas de roles y membresías. Es la segunda vez que esta trampa
  cuesta una tanda.

## Servicios

| # | Reportado | Estado | Evidencia |
|---|---|---|---|
| 1 | Al crear un nuevo servicio dice que no tienes ninguna sede activa | Corregido | Con el mismo cliente de la captura, el aviso desapareció y el selector ofrece sus dos sedes |

El servidor nunca estuvo mal: devuelve las dos sedes, activas. Por ese camino **nadie las pedía**.
La única rutina que llenaba la lista se llamaba al abrir un servicio que ya existe, y un cliente sin
servicios no llega ahí nunca.

### Encontrado al validar

- **Los contactos del cliente anterior se quedaban en pantalla.** Al entrar con un cliente en la
  dirección se vaciaban servicios, sedes y contratos, pero no los contactos.

## El documento de seguimiento

| Observación | Estado |
|---|---|
| «Ahora dice esto, pero el cliente ya tiene sedes» | Es el defecto de Servicios; corregido |
| «Al guardar el contacto dice que no se pudo guardar» | No se reproduce: el alta guarda y el contador sube |
| «Cuando lo desactivas, ¿debe seguir apareciendo el puesto?» | Sí, y es deliberado: los registros no se borran, y un puesto desactivado sigue nombrando lo que ya se capturó con él |
| «Sigue sucediendo, pero creo que es porque al dar clic en el mismo empleado lo vuelve a cargar» | Confirmado: es recarga, no pérdida de dato |

## Cómo se validó

Todo se ejercitó sobre el sistema publicado, con el rol reportado.

- **Seguridad y sus cinco endpoints**: contra `db-gestia-dev`, la base viva, con un usuario de
  verificación creado y **desactivado al terminar** —nunca borrado— y con correo sellado por
  corrida para que la siguiente no choque con la unicidad.
- **Clientes, Personal y Servicios**: contra el stack local, que corre la **misma imagen construida
  del mismo commit** y una réplica de los datos. Se eligió así para no sembrar clientes, contactos y
  documentos de prueba en la base que sirve el dominio.
- Ningún cambio de esquema. Nada de esto necesitó migración, y se comprobó:
  `dotnet-ef migrations has-pending-model-changes` responde «No changes have been made to the model».

Pruebas automatizadas al cierre: **665 de frontend** y **384 de backend**, incluidas las nuevas que
fijan cada uno de los cuatro defectos encontrados al validar.
