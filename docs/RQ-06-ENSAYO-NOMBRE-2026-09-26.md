# RQ-06 · Ensayo de la migración del nombre, sobre copia restaurada

**26 de septiembre de 2026.** Resultado del ensayo que pediste antes de tocar `db-gestia-dev`.
La base de trabajo **no se ha tocado**: lo único que se le hizo fue leerla para respaldarla.

## 1. Lo primero: el veredicto

| Comprobación | Resultado |
|---|---|
| Respaldo `COPY_ONLY` + `CHECKSUM` de `db-gestia-dev` | hecho |
| `RESTORE VERIFYONLY WITH CHECKSUM` | «The backup set on file 1 is valid» |
| Migración aplicada sobre la copia | `20260926192259_SplitEmployeeNameIntoParts` |
| Filas de personal en la copia | **278** |
| Filas sin nombre o sin apellido paterno | **0** |
| Nombre rearmado = original **normalizado** | **273 de 273** |
| Filas rellenadas con `(sin apellido)` | **5** (quedan fuera de la comprobación anterior a propósito) |
| `FullName` distinto de lo que compondría el dominio | **0 de 278** |
| Parte más larga producida | **14 caracteres** (el tope es 80) |

**Nada se perdió y nada se duplicó.** La suma cuadra: 273 comprobadas + 5 sin apellido = 278.

El respaldo quedó en el volumen del SQL Server del stack `gestia`:

```text
/var/opt/mssql/backup/db-gestia-dev-pre-rq06-nombre-20260926-132705.bak
```

La copia restaurada se llama **`db-gestia-ensayo`** y sigue en pie, en el mismo motor, por si
quieres mirarla. No sustituye a nada y se puede borrar cuando digas.

## 2. Cómo quedaron las columnas

```text
FirstName           nvarchar(80)   NOT NULL
LastNamePaternal    nvarchar(80)   NOT NULL
LastNameMaternal    nvarchar(80)   NULL
FullName            nvarchar(250)  NOT NULL   ← derivada, ya no se captura
```

## 3. Forma de los nombres, medida en la copia

| Palabras del nombre original | Filas | Qué hizo la regla |
|---|---|---|
| 1 | 5 | Nombre = la palabra; paterno = `(sin apellido)`; **marcadas** |
| 2 | 7 | 1.ª nombre, 2.ª paterno, materno vacío |
| 3 | 256 | 1.ª nombre, 2.ª paterno, 3.ª materno |
| 4 | 10 | Las dos últimas como apellidos, con las partículas pegadas |
| **Total** | **278** | |

## 4. La lista de dudosos, para repasar a mano

### 4.1 Sin apellido (5 filas)

Se rellenaron con `(sin apellido)` porque `LastNamePaternal` es obligatorio. **No se desactivaron:**
una fila inactiva sigue existiendo y la columna sigue siendo `NOT NULL`, así que desactivar no
habría ahorrado el relleno.

| Original | Nombre | Paterno | Materno |
|---|---|---|---|
| `atisnuma` | atisnuma | `(sin apellido)` | — |
| `dwa` | dwa | `(sin apellido)` | — |
| `yahir` | yahir | `(sin apellido)` | — |
| `yahir` | yahir | `(sin apellido)` | — |
| `yahir123123` | yahir123123 | `(sin apellido)` | — |

Consecuencia aceptada: en las listas se leerá «yahir (sin apellido)». Son datos de prueba.

### 4.2 Nombre de dos o más palabras (8 filas, 4 nombres distintos ×2 organizaciones)

Aquí la regla acertó en lo que podía: el nombre quedó con dos palabras porque el original tiene
cuatro y sólo dos pueden ser apellidos.

| Original | Nombre | Paterno | Materno |
|---|---|---|---|
| `Empleado con perfil ACENTO` | Empleado con | perfil | ACENTO |
| `Empleado con perfil ESPACIOS` | Empleado con | perfil | ESPACIOS |
| `Empleado con perfil MINUSCULA` | Empleado con | perfil | MINUSCULA |
| `Empleado con perfil SINMAPEO` | Empleado con | perfil | SINMAPEO |

### 4.3 Resuelto por la regla de partículas (2 filas)

| Original | Nombre | Paterno | Materno |
|---|---|---|---|
| `Empleado dado de baja` | Empleado | dado | de baja |

Cuatro palabras que la regla convirtió en tres al pegar «de» al apellido que le sigue. **Es el
único caso del ensayo donde la regla de partículas cambió el resultado**, y es la prueba de que
está funcionando: sin ella habría quedado «Empleado dado» · «de» · «baja».

### 4.4 Lo que este ensayo no prueba

Los diez nombres de cuatro palabras de esta base **no son nombres reales**: son datos de prueba. En
una base con nombres reales, los de cuatro palabras serán nombres compuestos («José Luis Pérez
García», que quedará con «José Luis» en el nombre, correctamente) y apellidos con partículas («Ana
Pérez de la Cruz» → Ana · Pérez · de la Cruz, también correctamente). La regla acertará la mayoría
de las veces y fallará algunas, y por eso la pantalla de Personal ahora **deja corregir el nombre**.

## 5. Qué se construyó

### Servidor

- `EmployeeName` (Domain): compone el nombre completo de las tres partes y normaliza para comparar.
  80 por parte, 250 el compuesto — 80 × 3 + 2 = 242, así que un nombre válido en cada campo siempre
  cabe en el derivado.
- `Employee`: tres propiedades nuevas y `FullName` **derivada**, con un único punto de escritura.
  Nadie puede escribir un nombre completo que no corresponda a sus partes.
- Contratos de alta y edición: piden las tres partes. La respuesta devuelve las tres **y** el
  compuesto, que es lo que leen listas, orden alfabético, selectores y reportes.
- Configuración física, sembrador demo, casos duros y los fixtures de las pruebas: todos los puntos
  que crean personal quedaron al día.
- La migración lleva **tres frenos** que la abortan completa si el reparto no cuadra: parte más
  larga que su columna, nombre rearmado distinto del original normalizado, y parte obligatoria
  vacía. Fallar deja la base como estaba.

### Navegador

- El alta pide **Nombre(s)**, **Apellido paterno** y **Apellido materno · opcional**. El materno no
  bloquea el guardado: hay personas con un solo apellido.
- La ficha muestra las tres partes con su etiqueta, y dice «Sin apellido materno» —no «Sin dato
  capturado»— cuando no hay: no es un campo pendiente.
- **Botón «Editar nombre»** en Datos, con permiso de escritura. Existe por la migración: sin él, un
  reparto equivocado se quedaría así para siempre.
- El navegador nunca compone el nombre completo. Lo manda en tres partes y muestra lo que el
  servidor devuelve.

## 6. Pruebas, con sus controles

| Suite | Resultado |
|---|---|
| Domain (unidad) | **98** pasan |
| Application (unidad) | **96** pasan |
| Arquitectura | **52** pasan |
| Integración (SQL Server efímero) | **249** pasan |
| Frontend (Vitest) | **932** pasan en 88 archivos |

Dos controles se comprobaron rompiendo el código a propósito y viendo la prueba roja:

1. Sustituir `Compose` por la interpolación ingenua `$"{a} {b} {c}".Trim()` → **1 prueba de dominio
   falla**. Sin ese control, «el materno vacío no deja espacio de más» pasaría igual.
2. Quitar `FullName` del filtro de búsqueda del repositorio → **la prueba nueva de búsqueda por
   cualquiera de las tres partes falla**. Con ella puesta, pasa. (Y de paso: el primer intento de
   este control tocó el filtro equivocado —`ListEmployeesAsync` en vez de
   `EmployeeSearchRepository`—, la prueba siguió verde, y eso fue lo que reveló que el control no
   estaba probando nada.)

## 7. Lo que falta, y lo que espera tu palabra

1. **Aplicar la migración a `db-gestia-dev`** (278 filas) y a **`db-gestia-local`** (271). Cada una
   con su respaldo `COPY_ONLY` + `CHECKSUM` verificado antes. ⛔ **Espera tu autorización.**
2. **Publicar** backend y frontend en los dos ambientes, después de la migración.
3. **Nada está commiteado.** El árbol de trabajo tiene todo lo de arriba y espera tu indicación.

Cuando digas, el orden es: respaldo → migración en local → comprobar → respaldo → migración en dev →
comprobar → publicar los dos ambientes.
