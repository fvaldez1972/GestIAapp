# GestIA — Requerimientos consolidados

**Versión 1 · 19 de septiembre de 2026**

Consolida dos fuentes: el documento *Requerimientos de Ajuste del Módulo de Clientes* y la matriz
*Datos necesarios para GestIA*. Donde se contradicen, gana la matriz por ser más reciente y más
específica.

Cada requerimiento lleva su estado contra el sistema real: rama
`s0/feature/gestIaProject/filtro-organizacion` y **34 migraciones**, todas aplicadas en
`db-gestia-dev`.

> **Corregido el 19 de septiembre de 2026, después de verificar contra el código.** La versión
> original de este documento marcaba como *Nuevo · migración* trece cosas que ya existen y
> funcionan —entre ellas el código postal, la colonia, el contacto principal y el periodo del
> precio—, y contaba 31 migraciones cuando hay 34. Las tablas de abajo ya llevan el estado
> verificado; el detalle de cada comprobación, con archivo y línea, está en
> `PD-04-Y-PLAN-2026-09-19.md`. Si algo aquí vuelve a contradecir al código, gana el código.

| Marca | Significado |
|---|---|
| **Existe** | Está construido y funcionando; solo hay que verificar contra los criterios |
| **Ajuste** | Existe pero no cumple lo pedido |
| **Nuevo** | No existe |
| **Migración** | Requiere cambio de esquema |

---

## 1. Lo que cambia de fondo

Tres cosas que no son campos, son decisiones de arquitectura.

### 1.1 La regla de bloqueo se mueve al catálogo

**Es el cambio más importante de la matriz y no estaba en el documento de Clientes.**

Hoy existe `EligibilityRequirement` como entidad aparte: una regla que dice qué exige una posición
y si bloquea. La matriz pide algo distinto: que **cada entrada del catálogo lleve su propia marca**
de bloqueante o informativa.

> *"Bloqueante impide asignar al personal a un servicio que lo requiera e impide publicar; una
> informativa sólo deja constancia."*

Aplica a cuatro catálogos: tipo de documento, evaluación, experiencia e incidencias
administrativas.

**Decidido el 19 de septiembre de 2026: la marca del catálogo es el valor por omisión, y
`EligibilityRequirement` se conserva.** Son dos hechos distintos: el catálogo dice qué tan grave es
que falte, y la regla dice quién lo exige. Lo zanjan las 29 reglas vivas de `db-gestia-dev`, de las
que **trece son por posición**: una marca de catálogo vale para toda la organización y no puede
expresar lo que exige un puesto concreto. La propia matriz separa los dos conceptos cuando dice
«impide asignar a un servicio *que lo requiera*».

En la práctica, `IsBlocking` entra en el catálogo y pasa a ser nulable en la regla, donde un nulo
significa «hereda la del catálogo».

### 1.2 El perfil de la posición pasa de texto a cinco catálogos

Hoy el perfil es texto libre —o, desde hace dos días, habilidades por identificador—. La matriz
pide que la posición declare, todos **obligatorios**:

patrón de turno · experiencia requerida · sexo · edad · escolaridad · equipo requerido

Y el texto libre sobrevive como *"Perfil en palabras"*, opcional, que es exactamente lo que ya se
decidió.

### 1.3 Sede pasa a Zona, y Habilidades a Experiencia

Renombrado sistémico. El detalle está en RF-CLI-001 y RF-CAT-001 del documento original.

---

## 2. Decisiones ya tomadas

| # | Decisión | Razón |
|---|---|---|
| **D-01** | El renombrado a Zona es **de vista y contratos, no de base de datos**. La entidad y la tabla siguen siendo `ClientSite` | `ClientSite` tiene columna de organización desde la tanda E, llaves foráneas desde contratos y servicios, y aparece en las pruebas de aislamiento. Un renombrado físico es migración sobre datos vivos sin ganancia funcional |
| **D-02** | Un contacto principal **por alcance**: uno general del cliente y uno por cada zona | Cubre el caso real sin cerrar puertas |
| **D-03** | El propósito del contacto es **catálogo administrable**, sembrado con los ocho valores observados | Lista fija obligaría una migración cada vez que aparezca un propósito nuevo |
| **D-04** | Persona física y moral **se pospone** | No bloquea ninguna tanda |
| **D-05** | La colonia es **texto libre**, no catálogo | Lo pide así la matriz, y evita las ~145 000 filas del catálogo de colonias |
| **D-06** | El código postal es **texto**, nunca numérico | Un CP como `01000` se corrompe si se guarda como número |

---

## 3. Decisiones que faltan

Las tres primeras están marcadas por Fernando en la propia matriz.

| # | Qué | Quién |
|---|---|---|
| **PD-01** | **Tipos de asignación**: la matriz propone Principal, Apoyo, Relevo y Sustitución temporal. *"Definir cuáles tipos hacen sentido"* | Negocio |
| **PD-02** | **Asignación principal** Sí/No: *"Definir si es necesario esto"*, dado que el tipo de asignación ya lo puede decir | Negocio |
| **PD-03** | **Estados del personal**: hoy son Candidato, Activo, En licencia, Inactivo y Baja. *"Definir otros estados necesarios"* | Negocio |
| ~~**PD-04**~~ | ~~La regla de bloqueo~~ · **Resuelta el 19 de septiembre**: valor por omisión en el catálogo, y `EligibilityRequirement` se conserva. Ver la sección 1.1 | Técnica y negocio |
| **PD-05** | **Contacto de emergencia**: la matriz lo pide obligatorio pero no define su forma. ¿Nombre, parentesco y teléfono como campos, o texto? | Negocio |
| **PD-06** | Las **tres preguntas del patrón de turno** que siguen abiertas desde la llamada anterior: días de descanso, festivos y cubre-descansos | Óscar y Joab |

---

## 4. Clientes

### 4.1 Identificación

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Razón social | Obligatorio | **Existe** |
| Nombre corto | Recomendado | **Verificar** |
| RFC | Obligatorio · máximo 13 caracteres | **Existe** |
| Código de cliente | Automático | **Existe** |
| Fecha de alta | Automático | **Existe** |

### 4.2 Datos fiscales y constitutivos

Nacionalidad, actividad fiscal, domicilio fiscal, registro patronal, fecha de constitución, número
de escritura, fecha del registro público, folio mercantil e instrumento del representante legal.

**Existe.** Todos opcionales. Se vieron en el video.

### 4.3 Zona

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Nombre de la Zona | Condicional | **Existe** |
| Calle y número | Condicional | **Existe** |
| Código postal | Condicional · 5 dígitos, conserva ceros | **Existe** — `ClientSite.PostalCode`, ya es texto obligatorio |
| Colonia | Recomendado | **Existe** — `ClientSite.Neighborhood`, opcional |
| Estado | Condicional · catálogo geográfico | **Existe** |
| Municipio | Condicional · depende del estado | **Existe** |

**Reglas, todas ya implementadas, incluida la del CP:**

1. Un cliente puede existir sin Zona; queda como expediente.
2. Sin Zona no se puede crear un Servicio.
3. El municipio depende del estado.
4. El CP conserva ceros iniciales.
5. Un cliente puede tener varias Zonas.

### 4.4 Contactos

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Nombre completo | Condicional | **Existe** |
| Puesto | Recomendado · catálogo editable | **Ajuste** — ya sale de catálogo con alta al vuelo, pero del catálogo de personal; falta que sea el suyo |
| **Propósito** | Recomendado · catálogo | **Ajuste · migración** — existe como enum con los ocho valores; pasa a catálogo por D-03 |
| **Alcance** | Recomendado · General o Zona | **Ajuste** — existe implícito en `IdClientSite` nulo; falta nombrarlo |
| Teléfono | Condicional | **Existe** |
| Correo | Condicional | **Existe** |
| Contacto principal | Opcional · Sí/No | **Existe** — `ClientContact.IsPrimary`, con su píldora en la lista |

**Propósitos observados:** Administrativo, Operativo, Facturación, Legal, Emergencia, Pagos,
Compras y Seguridad interna.

**Dos reglas de servidor que hoy no existen:**

- Debe existir al menos un teléfono **o** un correo.
- Cuando el alcance es Zona, la Zona elegida **debe pertenecer al cliente actual**. Se valida en el
  servidor, no solo en la pantalla.

### 4.5 Documentos del cliente

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Tipo de documento | Obligatorio · catálogo editable | **Ajuste** |
| Archivo | Obligatorio · preferentemente PDF | **Existe** |

---

## 5. Servicios

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Cliente | Obligatorio · se crea desde la ficha | **Existe** |
| Zona donde se entrega | Obligatorio | **Existe y es obligatoria** — `Service.IdClientSite` no es nulable |
| **Cédula de servicio** | Opcional · documento | **Nuevo** — la pieza documental ya existe (`BusinessDocumentOwnerType.Service`); falta la categoría y el acceso desde la ficha |
| Nombre | Obligatorio | **Existe** |
| Descripción / alcance | Obligatorio | **Existe** |
| Fecha de inicio | Obligatorio | **Existe** |
| Fecha de fin | Opcional | **Existe** |

---

## 6. Posición

**Es donde más cambia.** La matriz es explícita: *"los siguientes campos definen los requerimientos
de la posición, NO a la gente asignada"*.

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Nombre de la posición | Obligatorio | **Existe** |
| Personas requeridas | Obligatorio | **Existe** |
| Precio ofrecido al cliente | Obligatorio | **Existe** |
| Periodo del precio | Obligatorio · semanal, catorcenal, quincenal o mensual | **Existe** — `Position.PriceFrequency`, migración `20260917034936` |
| IVA incluido | Obligatorio | **Existe** |
| **Patrón de turno** | Obligatorio · catálogo editable | **Bloqueado por PD-06** — el catálogo `ShiftPatternTemplate` ya existe desde `20260917044429`; lo que falta son reglas, no esquema |
| **Experiencia requerida** | Obligatorio · catálogo, varias por posición | **Ajuste** — existe como habilidades, falta renombrar |
| **Sexo** | Obligatorio · catálogo editable | **Nuevo · migración** |
| **Edad** | Obligatorio · catálogo de rangos | **Nuevo · migración** |
| **Escolaridad** | Obligatorio · catálogo editable | **Nuevo · migración** |
| **Equipo requerido** | Obligatorio · catálogo editable | **Nuevo · migración** |
| Perfil en palabras | Opcional · texto largo | **Existe** — ya quedó como nota |
| Notas de la posición | Opcional | **Existe** — `Position.Notes` |

**Nota sobre el patrón:** *"Sin patrón no se pueden proyectar turnos ni publicar correctamente la
planeación."* Coincide con lo que el sistema ya hace.

---

## 7. Asignación

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Posición | Obligatorio | **Existe** |
| Empleado | Obligatorio | **Existe** |
| Tipo de asignación | Obligatorio · lista fija | **Existe** — `ServiceAssignmentType` ya tiene los cuatro valores. PD-01 sólo decide cuáles se conservan |
| Fecha de inicio | Obligatorio | **Existe** |
| Fecha de fin | Opcional | **Existe** |
| Asignación principal | Opcional | **Existe** — `ServiceAssignment.IsPrimary`. PD-02 sólo decide si se conserva |
| Notas | Opcional | **Existe** — `ServiceAssignment.Notes` |

La matriz pide que al asignar se revise *"disponibilidad, puesto, documentos, evaluaciones y
habilidades"* — **eso ya existe** desde el bloque A.

---

## 8. Personal

### 8.1 Identificación y relación laboral

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Nombre completo | Obligatorio | **Existe** |
| CURP | Opcional en alta | **Existe** — `Employee.Curp`, opcional |
| RFC | Opcional | **Existe** — `Employee.Rfc`, opcional |
| Fecha de ingreso | Obligatorio | **Existe** |
| Puesto | Condicional · catálogo | **Existe** |
| Estado del personal | Automático | **Existe** · PD-03 puede sumar estados |

### 8.2 Domicilio — todo obligatorio

| Campo | Estado |
|---|---|
| Calle y número · CP · Estado · Municipio | **Existe** — `Employee.Address`, `PostalCode`, `State`, `Municipality` |
| **Colonia** | **Nuevo · migración** — es lo único que falta del domicilio |

La matriz lo marca **obligatorio**, a diferencia del cliente donde la colonia es recomendada.

### 8.3 Contacto

| Campo | Obligatoriedad | Estado |
|---|---|---|
| Teléfono | Obligatorio | **Existe** — `Employee.MobilePhone` y `HomePhone` |
| Correo | Opcional | **Existe** — `Employee.Email` |
| **Contacto de emergencia** | Obligatorio | **Ajuste** — existen nombre y teléfono; falta el parentesco, que es lo que pregunta PD-05 |

### 8.4 Documentos

| Campo | Estado |
|---|---|
| Tipo de documento · 14 tipos | **Existe** como enum; la matriz lo quiere catálogo editable |
| **Regla de bloqueo** | **Nuevo · PD-04** |
| Fecha de emisión · vencimiento | **Existe** |
| Archivo | **Existe** |
| **Documento sensible** Sí/No | **Nuevo · migración** |
| Notas | **Existe** — `EmployeeDocument.Notes` |

Confirma una regla ya implementada: *"por vencer lo que caduca en 30 días o menos"*.

### 8.5 Evaluaciones

| Campo | Estado |
|---|---|
| Tipo de evaluación | **Existe** |
| **Regla de bloqueo** | **Nuevo · PD-04** |
| **Resultado**: Aprobada, aprobada con observaciones, Pendiente, No concluyente, No aprobada | **Existe** — `EmployeeEvaluationResult`, los cinco |
| Fecha · vencimiento · folio · notas | **Existe** — `EvaluatedDate`, `ExpiresDate`, `CertificateNumber`, `Notes` |

Regla explícita: **aprobada y aprobada con observaciones cubren el requisito**; las otras tres no.

### 8.6 Experiencia

| Campo | Estado |
|---|---|
| Tipo de experiencia | **Ajuste** — existe como habilidad |
| **Regla de bloqueo** | **Nuevo · PD-04** |
| Fecha de acreditación · vencimiento | **Existe** |
| Notas | **Existe** — `EmployeeSkill.Notes` |

Regla: *"sin fecha se considera que no caduca; vencida deja de cubrir el requisito"*. Coincide con
lo implementado.

### 8.7 Incidencias administrativas — entidad nueva

| Campo | Obligatoriedad |
|---|---|
| Tipo de incidencia | Obligatorio · catálogo editable |
| Regla de bloqueo | Obligatorio |
| Fecha de ocurrencia | Obligatorio |
| Detalles o comentarios | Obligatorio · texto largo |

**No existe.** Es una entidad completa con su tabla, sus endpoints y su pestaña, y participa en la
elegibilidad. No confundir con los motivos de incidencia operativa, que son otra cosa.

---

## 9. Catálogos

Trece configurables por organización.

| # | Catálogo | Estado |
|---|---|---|
| 1 | Puestos | **Existe** |
| 2 | **Experiencia requerida** | **Ajuste** — renombrar desde Habilidades, y sumar la marca de bloqueo |
| 3 | Tipo de documento | **Ajuste** — hoy es enum fijo de 14; se pide editable con marca de bloqueo |
| 4 | Evaluación | **Ajuste** — igual que el anterior |
| 5 | **Incidencias administrativas** | **Nuevo** |
| 6 | Motivos de incidencia | **Existe** |
| 7 | Motivos de cobertura | **Existe** |
| 8 | Patrones de turno | **Existe** desde `20260917044429` · su uso espera PD-06 |
| 9 | **Sexo** | **Nuevo** |
| 10 | **Edad** · rangos | **Nuevo** |
| 11 | **Escolaridad** | **Nuevo** |
| 12 | **Equipo requerido** | **Nuevo** |
| 13 | Documentos cliente | **Existe** — `ClientDocumentCategory`, con 3 valores en `dev` |
| — | **Puestos de contacto** | **Nuevo** — del documento de Clientes |
| — | **Propósito de contacto** | **Ajuste** — existe como enum; pasa a catálogo por D-03 |

**Siete catálogos nuevos y tres a ajustar** una vez descontados los dos que ya existían. El
mecanismo de alta al vuelo ya existe desde el 7 de septiembre, así que es aplicarlo, no construirlo.

---

## 10. Orden de ejecución

### Bloque 1 · Nomenclatura

RF-CLI-001 y RF-CAT-001. **Va primero y completo**: si va después, todo lo que se construya hay
que renombrarlo otra vez.

Sede a Zona en los catorce sitios del documento. Habilidades a Experiencia, que cuesta poco ahora
porque se construyó hace dos días.

Depende de **D-01**, ya decidido.

### Bloque 2 · Los catálogos nuevos

Siete nuevos y tres ajustes, con su marca de bloqueo. Aplicar el alta al vuelo existente.

Sin `Patrones de turno`, que espera PD-06.

Dependía de **PD-04**, resuelta el 19 de septiembre: la marca del catálogo es el valor por omisión y
`EligibilityRequirement` se conserva.

Incluye la conversión de **Tipo de documento** y **Evaluación** de enum a catálogo editable, que es
la parte cara: 1 450 documentos de personal y 722 evaluaciones en ocho organizaciones. Se hace por
coexistencia —se agrega el identificador, se conserva el enum, se rellena en la misma migración y el
enum se retira cuando no queden nulos—, que es el camino que ya funcionó con
`IdJobPositionCatalogItem`.

### Bloque 3 · Los campos nuevos — una sola migración

Todo junto, no repartido:

- Contacto: propósito y puesto por identificador, y alcance explícito.
- Posición: sexo, edad y escolaridad por identificador; equipo requerido como tabla de detalle,
  porque pueden ser varios.
- Empleado: colonia y parentesco del contacto de emergencia.
- Documento del personal: sensible sí/no.
- Incidencias administrativas: la entidad completa.

El código postal y la colonia de la Zona, el contacto principal y el periodo del precio **no entran
aquí porque ya existen**.

Las columnas de catálogo entran **nulables en la base** y obligatorias en el servidor para lo que se
cree o edite desde hoy: hay 69 posiciones y 271 empleados capturados antes de que los campos
existieran, y un nulo significa «no se sabe», no «no cumple». Es el criterio que ya está escrito en
`Position.IdJobPositionCatalogItem`.

Y las dos validaciones de servidor: teléfono o correo, y la zona que pertenece al cliente.

### Bloque 4 · Ficha, interfaz y verificación

RF-CLI-002 a 005, 008 a 010 y los cuatro UX. Buena parte ya existe: **verificar contra los
criterios de aceptación antes de construir.**

### Bloque 5 · Lo bloqueado

Patrones de turno, tipos de asignación, estados del personal. Esperan PD-01, PD-03 y PD-06.

---

## 11. Definition of Done

Del documento original, con lo que agrega la matriz:

1. Nomenclatura Zona y Experiencia homologada en todo el sistema.
2. La ficha única contiene lo solicitado, sin duplicidad.
3. La relación Cliente → Zona → Servicio → Posición es consistente.
4. Los trece catálogos existen y son administrables.
5. La regla de bloqueo funciona: bloqueante impide asignar y publicar; informativa deja constancia.
6. Las validaciones críticas viven en el servidor, no en la pantalla.
7. Contactos y documentos cumplen sus reglas.
8. Sin defectos críticos abiertos del módulo.
9. Datos maestros validados antes de Planeación.

---

## 12. Lo que la matriz pregunta y hay que contestar

> *"Si hubieran datos de clientes, servicios o empleados que falten por agregar, favor de
> mencionarlo."*

Tres que el sistema tiene y la matriz no menciona, y conviene confirmar si se conservan:

1. **Contratos del cliente.** Existe `ServiceContract` con su vigencia.
2. **La organización del cliente.** El aislamiento multiempresa no aparece en la matriz.
3. **El historial de correcciones.** La bitácora funcional registra qué cambió, quién y por qué.
