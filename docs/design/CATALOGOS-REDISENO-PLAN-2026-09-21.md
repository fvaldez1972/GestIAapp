# Rediseño de Catálogos — plan antes de tocar código

**21 de septiembre de 2026 · leído del código, no de la imagen de referencia**

---

## Antes que nada: hay una tanda sin commitear que pisa estos mismos archivos

La tanda de la marca de bloqueo —el defecto de «Sin decidir»— está terminada y verde, pero **sin
commitear**, y toca exactamente los tres archivos que este rediseño va a reescribir:

    M  frontend/.../catalogs-page.ts        <- la reescribe el rediseño
    M  frontend/.../catalogs-page.html      <- la reescribe el rediseño
    M  frontend/.../catalogs-page.spec.ts   <- la reescribe el rediseño
    M  backend/.../CatalogService.cs
    M  backend/.../CatalogMetadataTests.cs
    ?? backend/.../20260922023842_RetireUndecidedBlockingMark.cs
    ?? backend/.../BlockingMarkTests.cs

Además **su migración no se ha aplicado** a ninguna base, y lo publicado no la trae.

Empezar el rediseño encima deja las dos tandas enredadas en el mismo diff. **Lo que propongo:
commitear y publicar esa primero** —es corto: migración sola, código aparte— y arrancar el rediseño
con el árbol limpio.

---

## 1. Los catálogos que existen hoy

**19 tipos** en `BusinessCatalogItemType`. Tres son geografía y no se administran. Quedan **16
listas simples**, más **2 pantallas que no son listas**: 18 entradas de submenú.

Tu agrupación propuesta encaja con lo que hay. Sale así:

### Personal — 6

| Entrada | Tipo en el código | Naturaleza |
|---|---|---|
| Puestos | `JobPosition` | — |
| Experiencia requerida | `Skill` | **Sí** |
| Categorías de documento del personal | `EmployeeDocumentGroup` | — |
| Tipos de documento del personal | `EmployeeDocumentCategory` | **Sí** |
| Tipos de evaluación | `EmployeeEvaluationCategory` | **Sí** |
| Incidencias administrativas | `AdministrativeIncidentType` | **Sí** |

### Posiciones — 5

| Entrada | Tipo en el código |
|---|---|
| Sexo requerido | `Sex` |
| Rangos de edad | `AgeRange` |
| Escolaridad | `EducationLevel` |
| Equipo requerido | `RequiredEquipment` |
| **Patrones de turno** | pantalla propia, no es lista simple |

### Operación — 2

| Entrada | Tipo en el código |
|---|---|
| Motivos de incidencia | `IncidentReason` |
| Motivos de cobertura | `CoverageReason` |

### Clientes — 4

| Entrada | Tipo en el código |
|---|---|
| Categorías de documento del cliente | `ClientDocumentCategory` |
| Puestos de contacto | `ContactJobPosition` |
| Propósitos de contacto | `ContactPurpose` |
| Nacionalidades | `Nationality` |

**Nota sobre Nacionalidades**: el código dice que la consume **Solicitudes**, no Clientes —es la
nacionalidad de un cliente persona física en el alta—. Dejarla bajo Clientes es defendible; queda
dicho por si prefieres un grupo «Solicitudes».

### Reglas — 1

| Entrada | Qué es |
|---|---|
| **Reglas de elegibilidad** | pantalla propia: ámbito, tipo y requisito |

### Fuera del submenú

`Country`, `State`, `City` — **17 348 ciudades** en la base. Ya están hoy plegadas y fuera de la
vista principal por eso mismo. Coincide con tu instrucción.

---

## 2. La descripción: **sí existe**, no hace falta migración

`BusinessCatalogItem.Description` existe, se captura hoy en el editor y se guarda. La columna
Descripción de la referencia se puede dibujar **sin cambio de esquema y sin costo**.

Es la respuesta a tu pregunta: no hay nada que decidir aquí.

---

## 3. La columna de uso: existe a medias, y es la decisión cara

**Lo que hay hoy**: el conteo se calcula **en el navegador**, sobre listas que la pantalla ya trajo,
y sólo para **2 de los 16** catálogos: Puestos (cuenta personas) y Experiencia (cuenta reglas).

**Por qué no sobrevive al rediseño**: funciona porque hoy una sola pantalla carga todo. Con una
página por catálogo, la de Puestos tendría que descargar **todo el personal** para contar. Es el
tipo de cosa que anda bien con datos de prueba y se cae con datos de verdad.

**Lo que cuesta hacerlo bien**: hay **13 columnas de llave foránea** apuntando a
`BusinessCatalogItems`, en 11 tablas. Un conteo en el servidor es un método de repositorio que las
agrupa y un campo nuevo en la respuesta de la lista. **Tanda chica, bien delimitada** —el número 13
es el alcance completo, no una estimación—.

**Tres avisos que cambian lo que la columna puede prometer:**

1. **Tres catálogos no se enlazan por identificador sino por nombre**: Motivos de incidencia,
   Categorías de documento del cliente y Nacionalidades. El registro guarda el texto. Ahí el conteo
   se hace por coincidencia de texto, y desactivar el valor **no rompe nada** porque el registro ya
   tiene su copia. El aviso al desactivar tiene que decir otra cosa en esos tres.
2. **Sexo y Rangos de edad no los apunta nadie todavía.** Aquí escribí que esperaban una decisión de
   cumplimiento y **era falso**; el usuario lo corrigió el 21 de septiembre: la matriz marca bloqueo
   con asterisco sólo en experiencia, documento y evaluación, así que **sexo y edad son descriptivos
   y nunca bloquean**. Están en cero porque nadie ha llenado esos campos en las posiciones, no
   porque falte construir nada. La etiqueta «todavía no se usa» en vez de «0» sigue siendo la
   correcta, por la misma razón: que nadie lo lea como un catálogo muerto.
3. El aviso al desactivar **ya dice el uso hoy** para esos dos catálogos. No es funcionalidad nueva:
   es extenderla a los dieciséis.

---

## 4. La paginación: recomiendo del lado del cliente

No hay componente compartido de paginación —sólo Auditoría tiene el suyo—, y el endpoint de
catálogos devuelve la lista completa.

Quitada la geografía, **el catálogo más grande por organización ronda las decenas de valores**. Una
paginación en el navegador es correcta, se ve igual, y no cuesta un cambio de contrato. Si algún
catálogo crece de verdad, se cambia entonces.

---

## 5. El submenú: el modelo de navegación hoy no tiene submenús

`navigation.ts` tiene dos niveles: grupo (rótulo, no se puede pulsar) y entrada (ruta + permiso).
**No existe el concepto de hijo desplegable.** Hay que agregarlo en tres sitios: el modelo, el
dibujo del menú lateral, y `navigation.spec.ts`, que hoy afirma listas exactas de rótulos.

Se conservan los tres estados por rol y el modo condensado, como pides: son propiedades de la
entrada, no del nivel.

---

## 6. Seguridad: encaja a medias, y recomiendo **no** aplicarlo todavía

La pantalla tiene cinco pestañas: usuarios, roles, permisos, organizaciones y membresías.

- **Usuarios, roles y permisos** sí son tres listas independientes: encajan en el patrón.
- **Membresías no es una lista**, es la relación entre usuario, organización y rol.
- **Organizaciones** sólo la ve el super administrador.
- Y hay un **asistente de acceso de cinco pasos** que cruza las cinco pestañas.

Partirla en tres páginas y dejar dos pestañas sueltas más un asistente que salta entre rutas deja
peor navegación que la de ahora. **Mi recomendación: dejar Seguridad como está**, y volver a mirarla
si el asistente se rehace. No vi otro módulo que encaje.

---

## 7. Los bloques, en orden, un commit cada uno

| # | Bloque | Qué entra |
|---|---|---|
| 0 | **Cerrar la tanda anterior** | Commit + migración aplicada + publicado |
| 1 | Submenú | `navigation.ts` gana hijos; menú lateral los dibuja; spec al día |
| 2 | Página genérica de catálogo | **Una sola**, parametrizada por ruta. Encabezado, buscador, filtro de estatus, tabla, paginación, vacío. Reusa `gi-data-table`, `gi-filter-bar`, `gi-row-actions`, `gi-empty-state`, `gi-confirm-dialog` |
| 3 | Naturaleza | Columna y filtro en los cuatro que la llevan |
| 4 | Las dos propias | Patrones de turno y Reglas de elegibilidad, con ruta propia dentro de la nueva navegación |
| 5 | Uso | Conteo en el servidor para los dieciséis, y el aviso al desactivar con el número. **Tanda aparte, con su propia verificación** |
| 6 | Retirar la vieja | **Después del bloque 5, no antes** |

**Por qué el 6 va después del 5, y no en cuanto las páginas nuevas se vean bien.** Lo puso el
usuario y es la trampa que yo no había visto: la pantalla vieja **hoy sí cuenta el uso** en Puestos
y Experiencia, y **hoy sí avisa al desactivar**. Retirarla antes de que exista el conteo nuevo no
sería una migración, sería perder una función que ya funciona. Mientras tanto **conviven**: las
páginas nuevas y la vieja, hasta que el bloque 5 cubra lo que la vieja hace.

`design-system.spec` entra en el bloque 2 y crece en el 3 y el 4. Verificación en el navegador al
cerrar el bloque 4: recorrer el submenú entero y abrir cada catálogo.

---

## Las cuatro decisiones, tomadas el 21 de septiembre de 2026

1. **La tanda de la marca de bloqueo va primero**, con migración sola y código aparte, aplicada y
   publicada. El rediseño arranca con el árbol limpio.
2. **Exportar queda fuera.** Los catálogos tienen decenas de valores y nadie lo pidió: es una
   función, no parte del diseño. Si hace falta después, es barato.
3. **El conteo de uso va después, en su propia tanda con su verificación**, y eso **cambia el orden
   de los bloques**. Ver abajo.
4. **Nacionalidades se queda en Clientes.** La matriz la pone en los datos fiscales del cliente, así
   que para el negocio es un dato del cliente; que el código la consuma en Solicitudes es detalle de
   implementación. Y Solicitudes está oculta del menú en fase 1: un grupo de catálogos con el nombre
   de un módulo que no se ve confundiría.

Además: **Seguridad se queda como está** y **la paginación va del lado del cliente**.
