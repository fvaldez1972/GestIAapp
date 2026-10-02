# RQ-06 · Plan de migración del nombre del personal

**Estado: aprobado con ajustes el 26/09/2026.** La revisión encontró tres errores en la versión
anterior de este plan; los tres están corregidos abajo y señalados como tales.

Decisión recibida: **tres campos** — Nombre(s), Apellido paterno y Apellido materno. «Dos campos»
del documento principal se lee como que los apellidos quedan separados en dos. Nombre(s) y
apellido paterno obligatorios; apellido materno **opcional**, porque hay personas con un solo
apellido.

## 1. Lo que hay hoy, medido

`Employee.FullName` es un solo campo y **no existe ninguna copia denormalizada** del nombre: las
demás tablas no lo guardan. `EmployeeName` aparece sólo en contratos de salida, que se arman al
leer. Eso es la mejor noticia de este plan: el nombre vive en un sitio.

Lo que sí hay es **uso**:

| | Usos | Archivos |
|---|---|---|
| Backend (`FullName`) | 158 | 73 |
| Frontend (`fullName`) | 78 | 28 |

Y la búsqueda, el orden alfabético y varias proyecciones del servidor van contra esa columna.

### Forma de los nombres vivos

| Palabras | `db-gestia-dev` | `db-gestia-local` | Lectura |
|---|---|---|---|
| 1 | 5 | 4 | Sin apellido |
| 2 | 7 | 6 | Nombre + un apellido |
| **3** | **256** | **251** | Nombre + paterno + materno |
| 4 | 10 | 10 | Ambiguo |
| **Total** | **278** | **271** | |

**El 92 % cae en el caso limpio de tres palabras.** Los 22 restantes de dev son, uno por uno:

- **Una palabra (5):** `atisnuma`, `dwa`, `yahir`, `yahir`, `yahir123123`.
- **Dos palabras (7):** `Carlos Arroyo`, `Casimiro Hernández`, `Hugo Ramirez`, `Oscar Perez`,
  `Sergio Camacho`, `Empleado Smoke`, `primer empleado`.
- **Cuatro palabras (10):** `Empleado con perfil ACENTO` ×2, `… ESPACIOS` ×2, `… MINUSCULA` ×2,
  `… SINMAPEO` ×2, `Empleado dado de baja` ×2.

**Ninguno de los de cuatro palabras es un nombre real.** Son datos de prueba. Eso importa para
decidir el riesgo de esta migración aquí, y para no confiarse fuera de aquí (ver §5).

## 2. Qué se propone guardar

```
FirstName           nvarchar(80)   NOT NULL
LastNamePaternal    nvarchar(80)   NOT NULL
LastNameMaternal    nvarchar(80)   NULL
FullName            nvarchar(250)  NOT NULL   ← se conserva, derivada
```

> **Corregido.** La versión anterior proponía 120 por parte. **No cuadraba:** tres partes de 120
> más dos espacios dan hasta 362 caracteres, y `FullName` admite 250. Un nombre válido en cada
> campo podía no caber en el derivado y reventar al guardar. Con 80: 80 × 3 + 2 = **242**, que sí
> cabe. El nombre más largo que hay hoy mide 37.

### Por qué `FullName` se conserva y no se elimina

Es la decisión de fondo del plan, y va contra lo que parece obvio.

Con 158 usos en el servidor y 78 en el navegador —búsqueda, orden alfabético, listas, selectores,
candidatos, asignaciones, reportes— quitarla obliga a reescribir todo eso **sin ganar ninguna
función**. Y la búsqueda «por cualquiera de las tres partes» sale gratis si la columna existe:
contiene las tres.

Lo que cambia es **quién la llena**. Deja de capturarse y pasa a **derivarse de los tres campos en
el dominio**, al crear y al editar, igual que se hizo con el título del documento. Una sola
fuente: los tres campos. Nadie puede escribir un `FullName` que no corresponda.

> Si prefieres eliminarla, se puede, pero es otra tanda: 236 puntos de código y el riesgo se
> multiplica. Lo digo aquí para que la decisión sea tuya y no una consecuencia silenciosa.

## 3. La migración, paso a paso

Cada paso es reversible por sí solo hasta el 4.

1. **Respaldo** de `db-gestia-dev` y `db-gestia-local`: `COPY_ONLY` + `CHECKSUM`, verificado con
   `RESTORE VERIFYONLY WITH CHECKSUM`, con la ruta y el nombre anotados aquí antes de seguir.
2. **Migración aditiva:** las tres columnas nacen **nullable**. Nada se rompe: el código sigue
   leyendo `FullName`.
3. **Reparto de los datos vivos**, con la regla de §4, dentro de la misma migración.
4. **Cierre:** `FirstName` y `LastNamePaternal` pasan a `NOT NULL`. Este paso **sólo se ejecuta si
   el paso 3 no dejó ninguna fila vacía**, y la propia migración lo comprueba y se detiene si no.
5. **Ensayo sobre una copia restaurada** de `db-gestia-dev` antes de tocar `db-gestia-dev`. Es el
   procedimiento que ya se siguió con las cinco migraciones del 6 de septiembre.

## 4. Regla de reparto, y por qué ésta

Sobre el nombre con espacios colapsados:

| Palabras | Nombre(s) | Paterno | Materno | Revisión |
|---|---|---|---|---|
| 1 | la palabra | `—` (ver abajo) | vacío | **Sí** |
| 2 | 1.ª | 2.ª | vacío | No |
| 3 | 1.ª | 2.ª | 3.ª | No |
| 4 o más | todas menos los dos últimos | penúltimo | último | **Sí** |

**Antes de contar se pegan las partículas.** `de`, `del`, `la`, `las`, `los`, `van`, `von` y `y`
se unen a la palabra que les sigue y cuentan como una sola. Así «Ana Pérez de la Cruz» da tres
partes —Ana · Pérez · de la Cruz— y se reparte bien, en vez de quedar como «Ana Pérez» · «de» ·
«Cruz». Es barato y quita casos dudosos cuando lleguen nombres reales.

**Por qué las dos últimas y no las dos primeras.** En México el nombre compuesto es mucho más
frecuente que el apellido compuesto: «José Luis Pérez García» es lo normal y «Ana Pérez de la
Cruz» la excepción. Tomar las dos últimas acierta en el caso frecuente y falla en el raro; al
revés fallaría en el frecuente.

**El caso de una palabra no se puede repartir**, y `LastNamePaternal` es obligatorio: se llena con
`(sin apellido)` y la fila queda marcada en la lista de dudosos. Son cinco filas en dev y cuatro en
local, todas basura de prueba.

> **Corregido.** La versión anterior ofrecía «desactivarlas en vez de rellenarlas» como
> alternativa. **No lo es:** una fila desactivada sigue existiendo y la columna sigue siendo
> `NOT NULL`, así que necesita apellido de todos modos. Desactivar sería *además*, no *en vez de*,
> y se decidió no desactivarlas.
>
> Consecuencia aceptada: `(sin apellido)` entra en el `FullName` derivado, así que en las listas
> se leerá «yahir (sin apellido)». Para datos de prueba no importa.

## 5. Lo que este plan **no** garantiza

La migración se ve tranquila **porque los datos de dev y local son de prueba**. En una base con
nombres reales, los de cuatro palabras no serán «Empleado con perfil ACENTO»: serán nombres
compuestos y apellidos con partículas —«de la», «del», «van»—, y ahí la regla de §4 acertará la
mayoría de las veces y fallará algunas.

Por eso el entregable del paso 3 incluye **la lista de casos dudosos**, y por eso la lista se
guarda: no es un informe que se lee y se tira, es lo que alguien tiene que repasar a mano después.

## 6. Qué se entrega y cómo se comprueba

- **La lista de dudosos**, en `docs/`, con el nombre original y el reparto propuesto, para repasar
  a mano. En dev serían 15 filas (5 de una palabra + 10 de cuatro).
- **Pruebas** con su control: que el nombre completo se arma de los tres campos; que el materno
  vacío no deja un espacio de más; que la búsqueda encuentra por cualquiera de las tres partes; y
  que `FullName` no se puede escribir a mano —el control es intentarlo y ver que gana lo derivado—.
- **Comprobación de datos** tras el reparto: cero filas con `FirstName` o `LastNamePaternal`
  vacíos, y **278 de 278** filas donde el nombre rearmado coincide con el original **normalizado**
  —espacios colapsados y bordes recortados—, no con el crudo. Esa segunda es la que de verdad
  vale: si el reparto perdió o duplicó una palabra, no coincide.

> **Corregido.** La versión anterior comparaba contra el crudo. Como el reparto colapsa espacios,
> una fila con espacios dobles habría dado una diferencia legítima y la comprobación habría
> gritado sin motivo. Los nombres de esos fixtures están limpios —sin espacios dobles ni bordes—,
> así que normalizar no los toca; el «ESPACIOS» de su nombre se refiere al perfil que prueban, no a
> su nombre.

> **Y una corrección mía, de esta misma tanda.** Dije que **ninguna** prueba dependía del texto
> exacto de esos fixtures. **Es falso:**
> `backend/tests/GestIA.IntegrationTests/DemoSeederJobPositionTests.cs` busca la fila con
> `FullName == $"Empleado con perfil {variante}"`. Sigue pasando, pero no por suerte: el sembrador
> ahora crea esa persona con las partes «Empleado con perfil» · variante · vacío, que **componen
> exactamente la misma cadena**. Mantener el nombre completo carácter por carácter en los fixtures
> fue una decisión, no una casualidad, y es la razón por la que el reparto de los casos duros no se
> escribió «como quedaría más bonito».

- **Todo punto que crea empleados**, no sólo los formularios: el alta, las importaciones, los
  sembradores y los fixtures de prueba. Un punto de creación que siga mandando un solo nombre
  dejaría filas sin repartir el día que corra.

## 7. Lo que necesito que revises antes de ejecutar

1. **`FullName` se conserva, derivada en el dominio.** No se elimina.
2. **Regla de las dos últimas partes, con partículas pegadas** (§4).
3. **Las filas de una palabra se rellenan** con `(sin apellido)` y se marcan. **No se desactivan.**
4. **Longitudes: 80 por parte, 250 para el nombre completo.**

Queda por hacer: escribir la migración, actualizar todo punto que crea empleados, ensayar sobre una
copia restaurada y traer el resultado **antes de tocar `db-gestia-dev`**.
