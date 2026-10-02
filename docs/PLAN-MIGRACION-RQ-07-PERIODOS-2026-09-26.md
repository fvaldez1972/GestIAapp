# RQ-07 · Plan de migración del historial de ingresos, bajas y reingresos

**26 de septiembre de 2026. Nada ejecutado.** Este documento es lo que pediste revisar antes de que
se escriba una línea.

## 1. Lo primero: las tres decisiones que bloquean

| # | Decisión | Por qué no la puedo tomar yo |
|---|---|---|
| **1** | **Hoy hay dos estados que parecen «baja»: `Inactive` (28 personas) y `Terminated` (31).** ¿Cuál es la baja de RQ-07, y qué pasa con el otro? | Son 59 expedientes reales. Elegir mal deja a la mitad sin poder reingresar, o convierte un borrado lógico en una baja laboral que nadie registró. |
| **2** | **Los 59 no tienen fecha de baja: esa columna no existe.** ¿Su periodo inicial queda **abierto y marcado**, o se cierra con la fecha de su última modificación y motivo `(sin motivo registrado)`? | Inventar una fecha de baja es inventar un dato laboral. Dejarla abierta es decir «no se sabe», que es cierto pero deja a esas personas sin poder reingresar hasta que alguien las cierre a mano. |
| **3** | **¿La baja cierra las asignaciones vigentes del empleado?** | Es la pregunta que la especificación deja abierta. Hoy no hay backlog: **0 de las 139 asignaciones vigentes pertenecen a alguien dado de baja**, así que la decisión sólo afecta de aquí en adelante. |

Y una confirmación que la especificación pide y no bloquea si la das por buena: **«aquí no se va a
poner una restricción» se lee como sin límite de reingresos ni tiempo mínimo entre baja y reingreso.**
Así se implementaría salvo que digas lo contrario.

## 2. Lo que hay hoy, medido en `db-gestia-dev`

| Estado | Personas | De ellas, con `Active = 1` |
|---|---|---|
| `Active` | 167 | 165 |
| `Candidate` | 31 | 31 |
| `OnLeave` | 21 | 21 |
| `Inactive` | 28 | 24 |
| `Terminated` | 31 | 31 |
| **Total** | **278** | |

- `Employee.HireDate` existe, **ninguna fila la tiene nula**, y va de `2020-08-29` a `2026-09-24`.
- **No hay fecha de baja ni motivo de baja en ninguna parte.** No es que estén vacíos: las columnas
  no existen.
- `HireDate` tiene **15 usos** en el servidor, todos de fontanería: contratos, proyecciones de lista
  y búsqueda. **Nadie calcula antigüedad hoy**, así que «la antigüedad parte del último ingreso» no
  arregla un cálculo existente: es un cálculo nuevo.
- Los dos caminos de baja de hoy hacen cosas distintas, y ése es el origen de la decisión 1:
  - La pantalla («Dar de baja») manda `PATCH …/status` con `Terminated`.
  - `DeactivateEmployeeAsync` pone `Inactive` **y** apaga el borrado lógico.
- `ServiceAssignment` ya tiene `StartDate` y `EndDate?`, así que cerrar una asignación no necesita
  esquema nuevo.
- Las **cinco** entidades con historial funcional son `AttendanceRecord`, `Incident`,
  `CoverageRecord`, `ServiceAssignment` y `BusinessCatalogItem`. **`Employee` no está entre ellas**,
  y eso importa para el criterio «cada baja y reingreso queda en auditoría» (§5).

## 3. Qué se propone guardar

Una tabla **nueva**. No se reutiliza ninguna existente.

```text
dbo.EmploymentPeriods
  IdEmploymentPeriod   uniqueidentifier  NOT NULL   PK
  IdEmployee           uniqueidentifier  NOT NULL   FK -> Employees
  IdOrganization       uniqueidentifier  NOT NULL   FK -> Organizations   (alcance, como las otras 35)
  StartDate            date              NOT NULL   la fecha de ingreso de ESTE periodo
  EndDate              date              NULL       la baja; nulo = periodo abierto
  TerminationReason    nvarchar(500)     NULL       texto libre, obligatorio si hay EndDate
  Active               bit               NOT NULL
  CreatedAt/By/ByName, UpdatedAt/By/ByName, RowVersion
```

Restricciones, e **importa que estén en la base y no sólo en la pantalla**:

| Objeto | Regla |
|---|---|
| `CK_EmploymentPeriods_DateRange` | `EndDate >= StartDate` |
| `CK_EmploymentPeriods_TerminationReason` | O hay fecha de baja **y** motivo, o no hay ninguno de los dos. **Una baja sin motivo no se puede guardar, ni por API.** |
| `UX_EmploymentPeriods_IdEmployee_Abierto` | Único sobre `IdEmployee` **filtrado a `EndDate IS NULL`**: como máximo **un periodo abierto** por persona. Es lo que hace imposible un reingreso sobre alguien que no está dado de baja, sin depender de que el botón esté escondido. |
| `IX_EmploymentPeriods_IdEmployee_StartDate` | Para el historial y para resolver el último ingreso. |

### `HireDate` se conserva, derivada

Misma decisión que con el nombre completo en RQ-06, y por la misma razón: **la fecha de ingreso pasa
a ser el `StartDate` del periodo abierto más reciente**, escrita por el dominio en un solo punto.
Quince usos siguen funcionando sin tocarse, la antigüedad sale de restarle hoy, y nadie puede
escribir una fecha de ingreso que no corresponda a ningún periodo.

> Si prefieres eliminarla y que todo lea el periodo, se puede, pero es otra tanda y no gana ninguna
> función.

## 4. Cómo queda el comportamiento

| Acción | Qué pasa, en una sola transacción |
|---|---|
| **Alta** | Se crea la persona y su **primer periodo**, abierto, con la fecha de ingreso capturada. |
| **Baja** | Se cierra el periodo abierto con la fecha de baja y el motivo, y el estado pasa a baja. **Sin motivo no hay baja**: lo impide la restricción, no el formulario. |
| **Permiso** (`OnLeave`) | **No cierra ningún periodo.** Un permiso no es una baja: la persona sigue contratada y su antigüedad no se interrumpe. Esta distinción no está en la especificación y la propongo explícitamente. |
| **Reingreso** | Se abre un periodo **nuevo** con su propia fecha de ingreso, y el estado vuelve a activo. Nada del expediente se recaptura. Sólo está disponible si la persona está dada de baja, y el índice único lo garantiza. |
| **Antigüedad** | Desde el `StartDate` del periodo abierto. Los periodos anteriores **no suman**, y la ficha lo dice con esas palabras para que nadie lo lea como un error. |

Sobre el motivo, dos cosas que el proyecto ya decidió y aquí aplican:

- **El campo va vacío, nunca prellenado ni sugerido**, y con un mínimo de caracteres.
- **Es el motivo del hecho —por qué la persona deja de trabajar—, no el motivo de una corrección.**
  Son conceptos distintos y ninguna pantalla debe fundirlos. Si más adelante alguien corrige una
  fecha de baja mal capturada, eso pedirá **su propio** motivo, y no es este campo.

## 5. La auditoría: lo que propongo y por qué no es lo obvio

El criterio de aceptación dice «cada baja y reingreso queda en auditoría». Lo obvio sería meter la
tabla nueva en el juego de las cinco entidades con historial funcional. **Propongo no hacerlo**, y
conviene que la decisión sea consciente:

1. **La tabla ya *es* el historial.** Un periodo se crea y se cierra; no se reescribe. Meterlo
   además en `OperationalEvent` guardaría dos veces el mismo hecho.
2. **El motivo es texto libre, y las bitácoras de este proyecto no copian texto libre**: sólo
   registran si cambió, porque copiarlo lo saca del control de permisos del registro original. Así
   que la bitácora no podría guardar lo único que de verdad importa del motivo.
3. Quién y cuándo ya quedan: `CreatedAt/By/ByName` al abrir el periodo y `UpdatedAt/By/ByName` al
   cerrarlo.

Si aun así lo quieres en el historial funcional, se hace; pero entonces el motivo viajará a la
bitácora sólo como «se llenó», no como texto.

## 6. La migración, paso a paso

1. **Respaldo** de `db-gestia-local` y `db-gestia-dev`: `COPY_ONLY` + `CHECKSUM`, verificado con
   `RESTORE VERIFYONLY`, y **copiado fuera del contenedor**.
2. **Migración aditiva:** la tabla nace vacía. Nada se rompe: el código sigue leyendo `HireDate`.
3. **Relleno:** un periodo por persona, con `StartDate = HireDate`. El cierre de los 59 depende de
   la decisión 2. Dentro de la misma migración.
4. **Comprobaciones que abortan la migración completa si algo no cuadra**, como en RQ-06:
   - **278 periodos para 278 personas**, ni uno más ni uno menos.
   - Cero periodos con `StartDate` distinta de la `HireDate` de su persona.
   - Cero personas con más de un periodo abierto.
   - Cero periodos cerrados sin motivo.
5. **Ensayo sobre copia restaurada** de `db-gestia-dev`, con el resultado traído aquí **antes** de
   tocarla.
6. **Ambiente por ambiente:** respaldo → migración → comprobación → **publicar backend y frontend de
   ese ambiente en seguida**, y sólo entonces el siguiente. Es la ventana que señalaste: entre migrar
   y publicar, la base ya exige lo que el binario viejo no manda.

## 7. Qué se va a probar, y con qué control

| Prueba | Su control |
|---|---|
| Una baja cierra el periodo abierto y guarda el motivo | El periodo empieza abierto: el cierre sólo puede venir de la baja |
| Una baja sin motivo no se guarda | Con motivo sí se guarda, en la misma prueba |
| El reingreso abre un periodo nuevo y no toca el anterior | Se comprueba que el cerrado **conserva** su fecha y su motivo |
| Un reingreso sobre alguien activo falla | Sobre alguien dado de baja pasa |
| La antigüedad parte del último ingreso | Una persona con dos periodos, donde contar desde el primero daría un número distinto |
| Un permiso no cierra el periodo | Una baja sí, con el mismo expediente |
| El ciclo baja → reingreso n veces | Tres vueltas, y el historial conserva las tres |

## 8. Lo que **no** entra en esta tanda

- El efecto de la baja sobre documentos y evaluaciones. Eso es **RQ-08**, el paso siguiente, y
  necesita el atributo «vence al causar baja» del catálogo.
- Cerrar asignaciones vigentes al dar de baja, **si la decisión 3 dice que sí**: entra aquí, pero se
  construye después de decidirlo, no antes.
- Tocar `EmployeeStatus`. Los cinco estados se quedan como están salvo lo que decida el punto 1.

## 9. Lo que necesito de ti

1. Decisión 1: `Inactive` o `Terminated` como la baja de RQ-07, y qué pasa con el otro.
2. Decisión 2: los 59 sin fecha de baja, abiertos y marcados o cerrados con `(sin motivo registrado)`.
3. Decisión 3: si la baja cierra las asignaciones vigentes.
4. Confirmar que no hay límite de reingresos ni espera mínima.
5. Si el permiso no interrumpe la antigüedad, como propongo en §4.
6. Si la auditoría se resuelve con la propia tabla, como propongo en §5.

Con eso se escribe la entidad, la migración con sus frenos, el ensayo y el reporte. **No se ejecuta
nada hasta que respondas.**
