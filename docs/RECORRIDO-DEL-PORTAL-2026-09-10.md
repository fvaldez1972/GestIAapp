# Recorrido del portal — 10 de septiembre de 2026

Los once módulos, entrando como **Admin de organización**, con la sesión instrumentada: toda
petición con código 400 o superior, todo error de JavaScript y toda promesa rechazada quedaban
registrados sin depender de que yo los viera. La segunda vuelta se hizo sobre una organización con
datos de verdad —27 turnos, 27 asistencias y 9 incidencias— para poder disparar los guardados y no
sólo abrir pantallas.

## Corregidos en este recorrido

### 1. Tres paneles de Operación abrían vacíos

«Registrar incidencia», «Cubrir turno» y «Registrar la asistencia» abrían una caja de 96 px con su
título, su «×» y **nada dentro**. Con eso, la captura del día operativo era imposible.

Las dos pantallas usan `<ng-template giTab="…">` sin importar `GiTabContent`. Sin ese import el
atributo queda inerte, `contentChildren` no encuentra ninguna plantilla y el panel se dibuja sólo con
su cabecera. **Angular no protesta**: un `ng-template` con un atributo desconocido es legal. Tres
paneles inservibles y ni un error en consola.

Añadida una guarda en `gi-detail-panel` que rompe en desarrollo cuando el panel se queda sin
contenido, con su prueba. Sin ella esto vuelve en la pantalla siguiente, porque el síntoma no se
distingue de un panel que aún no ha cargado.

### 2. El selector del día ofrecía cinco opciones idénticas

La barra de Asistencia, Incidencias y Planeación armaba la opción sólo con `service.name`, y esta
organización tiene **cinco** servicios llamados «Control de acceso vehicular». Elegir el equivocado
significa capturar contra el cliente que no es. Ahora dice
`Control de acceso vehicular · Comercial Norte · Sucursal Centro`.

## Encontrados y NO corregidos: necesitan tu decisión

### 3. Auditoría: el resumen describe una página, no la consulta

Las cinco tarjetas se calculan sobre los 30 registros visibles, no sobre la búsqueda:

```
EVENTOS 30        (debajo: «2641 total(es) en la consulta»)
Página 1 de 89
```

Al pasar a la página 2, Altas va de 17 a 21 y Bajas de 10 a 5, con el total quieto en 2641.
**«ERRORES 0 · Eventos fallidos» es el caso peligroso**: afirma que no hubo errores mirando 30 de
2641. Las salidas son calcular los totales en el servidor, o rotular las tarjetas «en esta página».

### 4. Un botón promete una cosa y hace otra

En Asistencia, una falta o un retardo muestran **«Registrar incidencia»** y al pulsarlo abre
**«Corregir la asistencia»**. El proyecto se contradice a sí mismo sobre cuál es lo correcto:

```
spec:        «la falta y el retardo llevan a incidencia; el hueco, a cobertura»
página:      «Una excepción de persona se abre para corregirla»
Incidencias: «Una falta abre una incidencia…»
```

Dos fuentes dicen incidencia y el código abre la corrección. No es un rótulo: es qué debe pasar al
pulsar una falta.

### 5. Se puede guardar «Asistió» con minutos de retardo

Registré una entrada a las 08:05 sobre un turno planeado a las 08:00 con 5 minutos de retardo. Se
guardó como `Status = Present, MinutesLate = 5`, y la pantalla siguió diciendo **«EXCEPCIONES 0 ·
Cero real»**. El retardo queda escrito y **no se ve en ningún contador**.

El formulario muestra «Minutos de retardo» siempre que el estado no sea «No se presentó», incluido
«Asistió». Lo conservador es no ofrecer ese campo salvo con el estado «Llegó tarde»; lo otro es
promover el estado solo. Las dos cambian comportamiento, por eso no elegí.

### 6. «El día salió como se planeó» con turnos sin capturar

Con dos turnos pendientes de captura, la tarjeta decía **«EXCEPCIONES 0 · Cero real · El día salió
como se planeó»**, y el bloque de abajo remataba: «No es que falten datos: es que no hubo
excepciones». Faltaban datos: nadie había capturado la mitad del día. El cero sólo es real cuando
todo está capturado.

## Verificado funcionando, con datos reales

| Acción | Resultado |
|---|---|
| **Guardar una asistencia** | Panel cerrado, «Asistencia de Carlos Alvarado Martínez guardada», pendientes 2 → 1 |
| Abrir la corrección de una excepción | Abre con persona, posición, horario planeado y estado |
| Registrar incidencia: panel y validación | Abre con su formulario; el botón deshabilitado dice «Elige el motivo del hecho» |
| Catálogos: alta y baja | Contador 2 → 3 → 2 al instante, con sus avisos |
| Auditoría: paginado | Correcto, sin acumular |
| Navegador de días | Retrocede bien; el «›» está **deshabilitado** en el día de hoy, que es un tope deliberado |
| Los once módulos | **Cero peticiones fallidas, cero errores de consola** |

## Lo que quedó sin resolver

- **Guardar una incidencia de punta a punta.** El formulario exige un motivo del catálogo y no logré
  seleccionarlo en la sesión automatizada. La validación funciona; el guardado sigue sin comprobarse.
- **El selector de motivo** mostró un comportamiento raro —la sugerencia se quedaba en el primer
  texto escrito— pero **sólo con eventos sintéticos**. Con teclado real no lo reproduje, así que no
  lo cuento como defecto: hace falta comprobarlo a mano.
- **Cobertura, y publicar una semana en Planeación**, siguen sin ejercitarse.
