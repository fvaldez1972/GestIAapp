# RQ-07 · Ensayo del historial laboral, sobre copia restaurada

**26 de septiembre de 2026. `db-gestia-dev` no se ha tocado**: sólo se leyó para respaldarla.

## 1. Tus tres preguntas, contestadas

### 1.1 ¿Cómo llegaron a `Inactive` los 24 que siguen con `Active = 1`?

**Los puso ahí el sembrador de datos demo, y no hay ninguna otra forma de llegar a ese estado.**

El sembrador reparte 120 empleados por los cinco estados del enum —15 candidatos, 70 activos, 10 en
permiso, **12 inactivos**, 13 dados de baja— y los crea directamente en el estado que les toca. Doce
por organización × dos organizaciones = **los 24**. Todos tienen `CreatedByName` y `UpdatedByName` =
`GestIA Demo Seed`, y la misma marca de tiempo de creación y modificación: nunca los tocó nadie.

Los **otros 4**, los que tienen `Active = 0`, son distintos: se llaman `VDOM2026092208…` y los dejó
`Administrador GestIA`. Son las verificaciones de domicilio de la tanda del 22 de septiembre, que
crean su registro y lo desactivan al terminar. Ésos sí pasaron por el único camino de código que
escribe `Inactive`: `DeactivateEmployeeAsync`, que además apaga el borrado lógico. **Por eso los 24
tienen `Active = 1` y estos 4 no**: no vinieron del mismo sitio.

**La pantalla nunca manda `Inactive`.** Sólo manda tres estados: `OnLeave` al registrar un permiso,
`Terminated` al dar de baja y `Active` al reincorporar. Así que ningún usuario ha llegado ni puede
llegar hoy a `Inactive`.

> **Consecuencia de dejarlos como están, que conviene que sepas:** la tabla de Personal trata
> `Inactive` igual que `Terminated` —«Ya está dada de baja», con las tres acciones apagadas—, así que
> esos 28 expedientes se quedan congelados: no se les puede asignar, ni dar permiso, ni dar de baja,
> y ahora tampoco reingresar. Como son datos del sembrador, no estorba. Si algún día un expediente
> real cayera ahí, no tendría salida.

### 1.2 ¿Qué pasa con los turnos ya generados?

**No se tocan, y la baja ahora los cuenta y los dice.**

Una versión publicada de la planeación **es inmutable por decisión del proyecto**: el dominio lanza
«La planeación publicada no puede modificarse directamente». Así que la baja no puede borrar ni
reasignar turnos ya proyectados, y no debería: el mecanismo para «esta persona no puede ir» es el
relevo —`CoverageRecord`—, que exige a alguien que la cubra. Eso es una decisión operativa con una
persona detrás, no algo que una baja pueda resolver sola.

Lo que sí hace la baja es **devolver cuántos turnos futuros quedan a nombre de la persona, con su
primer y último día**, para que la pantalla avise de que hay huecos que cubrir. Callarlo dejaría
turnos a nombre de alguien que ya no trabaja, y nadie se enteraría hasta el día del turno.

En `db-gestia-dev` hoy: **1 255 turnos, 109 futuros, y ninguno pertenece a alguien dado de baja.** No
hay nada que limpiar; la regla es para de aquí en adelante.

### 1.3 ¿Qué representa hoy `HireDate` en un candidato?

**Una fecha que el formulario exige y que no significa nada.** Los 31 candidatos tienen fecha de
ingreso —de `2020-08-29` a `2026-08-30`— y **sólo una coincide con el día en que se creó el
expediente**. Son fechas capturadas a mano para pasar el alta, no contrataciones.

Por eso tu corrección es la correcta: **no llevan periodo**. Y por eso `HireDate` se queda, para
ellos, como la fecha capturada —una fecha prevista— hasta que se les contrata; desde ese momento la
manda el periodo. Hacerla nula para las candidaturas sería lo limpio, y es otra tanda: la columna es
`NOT NULL` y la leen quince puntos.

## 2. Un hallazgo que cambia el alcance: no había forma de contratar

Al implementar «el periodo se abre al contratarlos» me encontré con que **ese acto no existe**. Las
únicas acciones que cambian el estado son registrar permiso, dar de baja y reincorporar; la única
ruta a `Active` es reincorporar a alguien que estaba en permiso. **Un candidato no tiene salida
hoy.**

Así que RQ-07 incorpora la acción de **contratar**, que es la que abre el primer periodo. No es
alcance de más: sin ella, tu propia corrección no tiene disparador y los 31 candidatos nunca
tendrían historial.

## 3. Una desviación de tu decisión 2, y por qué

Pediste cerrar los `Terminated` con `EndDate` = fecha de su última modificación. **Trece de los
treinta y uno tienen esa fecha en el futuro**: `2026-10-04`, ocho días después de hoy. Es la marca de
tiempo con la que el sembrador selló la segunda organización.

Una baja con fecha futura es un hecho que todavía no ha ocurrido, y además dejaría a esas personas
con antigüedad negativa. **Recorté la fecha a hoy en esos trece casos**, y también por abajo —nunca
anterior al ingreso, que violaría la restricción—. El motivo es el que pediste, así que quedan
igualmente marcados: `(registrado antes del historial; fecha aproximada)`.

Si prefieres que quede la fecha futura tal cual, se cambia en una línea.

## 4. El resultado del ensayo

Respaldo `COPY_ONLY` + `CHECKSUM` de `db-gestia-dev`, verificado con `RESTORE VERIFYONLY`:

```text
/var/opt/mssql/backup/db-gestia-dev-pre-rq07-periodos-20260926-143553.bak
```

Restaurado como `db-gestia-ensayo` y migrado con `20260926203229_AddEmploymentPeriods`:

| Comprobación | Resultado |
|---|---|
| Empleados | 278 |
| Candidatos **sin** periodo | 31 |
| **Periodos creados** | **247** |
| Abiertos / cerrados | 216 / 31 |
| Candidatos con periodo | **0** |
| Contratados sin periodo | **0** |
| Periodos con `StartDate` distinta de la `HireDate` del expediente | **0** |
| Cerrados sin motivo | **0** |
| Personas con dos periodos abiertos | **0** |
| Bajas con fecha en el futuro | **0** (13 recortadas a hoy) |

Y por estado, que es donde se ve que el reparto entendió la regla:

| Estado | Expedientes | Periodos | Cerrados |
|---|---|---|---|
| `Active` | 167 | 167 | 0 |
| `Candidate` | 31 | **0** | 0 |
| `Inactive` | 28 | 28 | 0 |
| `OnLeave` | 21 | 21 | 0 |
| `Terminated` | 31 | 31 | **31** |

`Inactive` lleva periodo **abierto**: no es una baja laboral, y tú pediste no tocarlos. `OnLeave`
también, porque un permiso no interrumpe la contratación.

## 5. Las reglas están en la base, y muerden

Probado sobre la copia restaurada, con su control:

```text
Segundo periodo abierto  -> RECHAZADO (error 2601, índice único filtrado)
Baja sin motivo          -> RECHAZADA (error 547, CHECK)
Baja anterior al ingreso -> RECHAZADA (error 547, CHECK)
Periodo cerrado valido   -> ACEPTADO  (el control del control)
```

La última línea es la que hace valer a las tres primeras: si todo se rechazara, los rechazos no
dirían nada.

> **Nota operativa:** el índice único filtrado obliga a que cualquier script manual que escriba en
> `EmploymentPeriods` corra con `SET QUOTED_IDENTIFIER ON`. La aplicación lo hace sola; un `sqlcmd`
> suelto, no. Lo descubrí porque mi primer intento de control falló por eso.

## 6. Qué se construyó

**Dominio.** `EmploymentPeriod`, con `Close` como único camino para cerrar y **un periodo cerrado que
no se puede volver a modificar**, como pediste. En `Employee`: `Hire`, `Terminate`, `Rehire`,
`SeniorityStartDate` y `HireDate` derivada del periodo más reciente —abierto o cerrado—, con un solo
punto de escritura.

**Aplicación y API.** Tres rutas nuevas —`/hire`, `/terminate`, `/rehire`— y el historial en
`/employment-periods`. Van aparte del cambio de estado a propósito: llamar a una baja «cambiar el
estado a Terminated» escondía que lo que ocurre es que se cierra un periodo con su fecha y su motivo.
**La baja cierra en la misma transacción las asignaciones vigentes** y devuelve el conteo de turnos
futuros.

**Base.** Tabla nueva, nunca una reutilizada, con el índice único filtrado y los dos `CHECK`.

**Sembrador demo.** Siembra el historial con la misma regla: candidaturas sin periodo, bajas con
periodo cerrado y motivo variado, el resto abierto.

## 7. Pruebas

| Suite | Resultado |
|---|---|
| Domain (unidad) | **114** pasan (16 nuevas de historial laboral) |
| Application (unidad) | **96** pasan |
| Arquitectura | **52** pasan |
| Integración (SQL Server efímero) | **249** pasan |

Controles comprobados rompiendo el código a propósito:

1. Cambiar `Max` por `Min` en la antigüedad → **2 pruebas rojas**. Es la regla «los ingresos
   anteriores no suman», y sin el control una implementación que tomara el primero pasaría.
2. La prueba del conteo de entidades con organización **se puso roja sola** al aparecer la tabla
   nueva —esperaba 32, encontró 33—, que es exactamente para lo que existe. Actualizada a 33 con su
   explicación.

## 8. Lo que falta, y lo que espera

1. **El frontend de RQ-07 todavía no está hecho**: historial en la ficha, diálogo de baja con fecha y
   motivo, botón de reingreso, acción de contratar, antigüedad desde el último ingreso y el aviso de
   turnos futuros. Va en esta misma tanda, **antes de publicar**.
2. **Migrar `db-gestia-local` y `db-gestia-dev`**, cada una con su respaldo verificado y copiado fuera
   del contenedor, y **publicando cada ambiente en seguida**. ⛔ Espera tu autorización.
3. **Borrar `db-gestia-ensayo`** cuando dev quede comprobado.
4. **Nada está commiteado** de RQ-07.
