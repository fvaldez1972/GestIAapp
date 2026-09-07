# Requisitos para la pantalla de historial de un registro

Estado: **el backend está listo, la pantalla no está diseñada.** Este archivo existe para que lo
que ya se decidió no se pierda entre una sesión y la siguiente.

La bitácora funcional (tanda C) dejó escrito el historial de correcciones de cinco entidades:
asistencia, configuración de servicio, incidencia, cobertura y asignación. Se lee con
`GET /api/v1/history/{modulo}/{recordId}?organizationId=…`, una ruta por entidad.

## El requisito que no se puede olvidar

**La pantalla tiene que decir desde cuándo hay historial.** Una línea del tipo:

> El historial de este registro comienza el 05 sep 2026.

### Por qué

La bitácora **nació vacía**. No se puede inventar el pasado: los registros que ya existían el día
del despliegue no tienen eventos anteriores, y los suyos empiezan a acumularse desde entonces.

Sin esa línea, una lista vacía o corta se lee como **"a este registro no lo ha tocado nadie"**,
cuando lo que en realidad dice es **"no sabemos qué pasó antes de esta fecha"**. Son dos cosas
distintas y la diferencia importa justo cuando alguien consulta el historial: en una disputa.

La fecha a mostrar es la del despliegue de la tabla, no la de creación del registro.

## Lo que la pantalla va a recibir, y lo que no

Cada evento trae: la acción, el motivo cuando la regla lo exigía, quién y cuándo, y dos fotos en
JSON —antes y después—.

**Las fotos son metadatos con lista blanca, no una copia del registro.** El texto libre no viaja:
en su lugar hay booleanos `HasNotes`, `HasDescription`, `HasResolutionNotes`. La pantalla puede
decir *"cambiaron las notas"*, nunca *"antes decían esto"*. Quien necesite el contenido lo lee
del registro, con el permiso del registro.

Eso vale también para `Incident.Description`, que es obligatoria y es el relato del hecho: se
decidió así a propósito, porque una copia en la bitácora se consultaría con el permiso de la
bitácora y puede llevar nombres de terceros.

Y viajan **identificadores, nunca nombres visibles**. Para mostrar "Juan Pérez" en lugar de un
GUID hay que resolverlo contra el catálogo o el registro correspondiente, no esperarlo en la foto.

## El permiso

Cada ruta exige el permiso del **módulo dueño** del registro, no uno propio del historial:

| Historial | Permiso |
| --- | --- |
| Asistencia, incidencias, coberturas | `OPERATIONS.READ` |
| Configuraciones de servicio | `CLIENTS.READ` |
| Asignaciones | `PLANNING.READ` |

El historial no puede ser una puerta lateral para ver lo que el registro mismo no deja ver.

## El motivo

Aparece sólo cuando la regla lo exigía, y el evento guarda además `IsReasonRequired` para poder
distinguir *"no hacía falta"* de *"se coló sin motivo"*. La pantalla debería mostrar esa
diferencia, no sólo la ausencia del texto.

Cuando la interfaz **pida** un motivo, va **vacío, sin valor por defecto y sin sugerencias**, con
un mínimo de 10 caracteres. Un motivo prellenado se acepta sin leerse y deja de ser información.

## La pantalla de Auditoría es otra cosa

La pantalla de Auditoría que existe hoy muestra el **estado actual** de 24 tipos de registro con
el sello de quién lo tocó por última vez. No es un historial: si un registro se editó cinco
veces, sólo se ve la quinta.

Mezclar las dos en la misma lista haría que el usuario no supiera si "no hay más cambios"
significa que no los hubo o que no se registran. Si algún día Auditoría pasa de *"quién tocó
esto"* a *"qué le pasó a esto"*, es un rediseño con su propia decisión de producto, no un
injerto.
