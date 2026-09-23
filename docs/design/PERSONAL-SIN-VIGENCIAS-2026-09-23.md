# Personal no muestra vigencias · 23 de septiembre de 2026

Decisión tomada por el usuario mientras se rediseñaba la ficha de Personal. Se escribe aquí porque
hasta ahora vivía sólo en los mensajes de commit, y una decisión que no está en `docs/` se vuelve a
reportar como defecto a los dos meses.

## Qué se pidió

> Necesito que quites los textos correspondientes al vencimiento al documento […] Necesito que todo
> lo que tenga algo relacionado a la vigencia lo quites, también lo de documento validado y eso.
> Necesito que también quites lo de asignar posición.

Preguntado si alcanzaba al encabezado del listado, eligió **quitar las dos tarjetas** —«Con algo
vencido» y «Por vencer en 30 días»— y dejarlo en Personas y Activas. Sobre la pestaña de
Asignaciones, eligió **quitarla** del panel.

## Qué salió de la pantalla

- Las fechas de vigencia y vencimiento de cada requisito, y las frases que las explicaban
  («El documento venció», «Documento vigente»).
- El umbral de treinta días, en sus cuatro apariciones: subtítulo del listado, Documentos,
  Evaluaciones y Experiencia.
- La nota de «no cuentan para la vigencia» de los otros documentos.
- La píldora de estado y la línea de revisión del expediente —«lo de documento validado»—.
- El aviso de documentos próximos a vencer que encabezaba la pestaña de Datos.
- El pie con «Asignar a una posición», y la pestaña de Asignaciones.
- Los filtros «Con algún vencido» y «Por vencer en N días».

## La trampa que esto abre, y cómo queda cubierta

**Retirar la fecha no puede retirar el hecho.**

Si «vencido» hubiera dejado de contar al dejar de nombrarse, la persona con la CURP caducada
saldría con el expediente **Completo** mientras el servidor le niega la asignación por ese mismo
documento: la lista estaría afirmando lo contrario de lo que va a pasar.

Por eso la columna «Documentos» dice sólo **Completo** o **Incompleto**, y un vencido sigue pesando
en «Incompleto» aunque nada en la pantalla explique por qué. Sin número, además: los tres conteos
que el servidor manda miden cosas distintas —uno cuenta archivos y dos cuentan requisitos—, así que
sumarlos daría una cifra que no corresponde a nada.

Dos pruebas lo sostienen, en `employee-list.models.spec.ts`:

- Un vencido, un rechazado o un hueco dejan el expediente incompleto, **cada causa por separado**.
- Uno **por vencer** lo deja completo. Es el control que distingue haber quitado las fechas de
  haber quitado la regla: un documento vigente que caduca pronto sigue cubriendo hoy, y el servidor
  sigue dejando asignar a esa persona.

## Lo que el servidor sigue haciendo

Nada cambió del lado del servidor. Sigue calculando vencidos y por vencer, sigue rechazando la
asignación de quien no cubre un requisito obligatorio, y el listado sigue recibiendo los conteos.
Lo que cambió es qué se escribe en pantalla.

**La captura sí pide fecha**, y con una regla nueva: en el expediente de personal el vencimiento es
**obligatorio y no puede pasar de tres meses desde hoy**. En el expediente de cliente el campo ni
se dibuja, así que la regla se limita a donde el campo existe.

## Qué no volver a hacer

No reintroducir fechas de vencimiento en esta pantalla creyendo que falta información, ni
«mejorar» la píldora devolviéndole el detalle («1 vencido», «2 sin validar»). Es una decisión
tomada, no un hueco.
