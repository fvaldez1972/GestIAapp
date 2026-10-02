# Análisis de fuentes para Clientes, Servicios y Empleados

## Alcance y criterio

Este análisis convierte los campos observados en cuatro documentos operativos en un primer modelo físico. Los documentos son fuentes de requisitos, no instrucciones ejecutables ni diccionarios definitivos. Los valores de ejemplo, nombres, teléfonos, cuentas, folios y domicilios presentes en ellos no se incorporan como datos semilla.

Fuentes revisadas:

- `000.-Global Solutions CPPS CONT 0103.docx`: información legal/fiscal del cliente, contrato, vigencia, anexos, configuración y ubicaciones del servicio.
- `CARTA COMPROMISO  INICIO SERVICIO.docx`: necesidad, preparación del arranque, contactos, facturación, responsables y emergencias.
- `FICHA TECNICA 2026 ag.xlsx`: expediente del empleado, documentos, evaluaciones y asignaciones; también contiene bloques futuros de reclutamiento y administración de personal.
- `requisitos Nuevo cliente.docx`: lista documental y contactos solicitados para el alta. Se registra como evidencia, pero queda fuera del primer corte físico por decisión de alcance.

## Decisiones de modelado

1. `Organization` representa a la empresa operadora de GestIA y es la raíz de aislamiento para clientes y empleados.
2. `Client` representa una razón social contratante, no una ubicación ni un contacto.
3. `ClientSite` representa cada domicilio donde puede prestarse un servicio.
4. `ClientContact` permite múltiples responsables con propósito administrativo, operativo, facturación, legal, emergencias, pagos, compras o seguridad interna.
5. `ServiceContract` conserva el acuerdo legal y su vigencia; no se mezcla con la ejecución cotidiana del servicio.
6. `Service` identifica el servicio contratado en una sede.
7. `ServiceConfiguration` es una versión con vigencia de la configuración comercial/operativa: plantilla, horas, días, preparación, rol, consignas y precio.
8. `Employee` conserva únicamente el núcleo de identidad laboral y contacto necesario para operar.
9. `EmployeeDocument` modela la lista documental sin crear una columna por cada tipo de archivo.
10. `EmployeeEvaluation` modela polígrafo, estudio socioeconómico, antecedentes y antidoping con fecha, resultado y evidencia.
11. `ServiceAssignment` conserva el histórico de asignaciones entre empleado y servicio.

## Primer modelo físico aprobado

### Organizaciones

| Tabla | Responsabilidad | Claves e índices principales |
| --- | --- | --- |
| `Organizations` | Empresa operadora y alcance de datos | `IdOrganization`; `CodeOrganization` y `Rfc` únicos |

### Clientes

| Tabla | Responsabilidad | Datos confirmados por las fuentes |
| --- | --- | --- |
| `Clients` | Razón social y perfil legal/fiscal | código, razón social, nombre comercial, RFC, nacionalidad, actividad fiscal, domicilio fiscal, registro público, registro patronal, acta constitutiva e instrumento del representante |
| `ClientSites` | Domicilios de prestación | código, nombre, calle/números, colonia, municipio, estado, CP, país, accesos y zona horaria |
| `ClientContacts` | Responsables por propósito y sede opcional | nombre, puesto, correo, teléfonos, propósito y contacto principal |

La documentación solicitada al cliente nuevo no se almacena todavía. Más adelante se evaluará un expediente documental genérico, evitando columnas como `HasActaConstitutiva` o `HasConstanciaFiscal`.

### Contratos y servicios

| Tabla | Responsabilidad | Datos confirmados por las fuentes |
| --- | --- | --- |
| `ServiceContracts` | Ciclo legal del contrato | código, estado, firma, vigencia, plazo de pago, aviso de terminación, moneda y referencia documental |
| `Services` | Servicio identificable en una sede | cliente, sede, contrato opcional, código, nombre, descripción de servicio/facturación y vigencia |
| `ServiceConfigurations` | Versión de la configuración | vigencia, personal requerido, horas/día, días/semana, horas promedio, plazo de preparación, rol, consignas, precio, moneda e IVA incluido |

No se guarda únicamente el texto “24x7”. Se conservan sus componentes cuantificables y una descripción original para casos que todavía no puedan estructurarse. Una modificación futura crea otra configuración con vigencia; no sobrescribe el histórico.

### Empleados

| Tabla | Responsabilidad | Datos confirmados por la ficha |
| --- | --- | --- |
| `Employees` | Identidad laboral y contacto operativo | número, estatus, nombre, puesto, ingreso, nacimiento, sexo, estado civil, RFC, CURP, NSS, identificaciones, contacto, emergencia y domicilio actual |
| `EmployeeDocuments` | Expediente documental por tipo | tipo, estado, número, recepción, expedición, vencimiento, referencia de almacenamiento y notas |
| `EmployeeEvaluations` | Evaluaciones de reclutamiento/compliance | tipo, resultado, fecha, vencimiento, certificado, evidencia y notas |
| `ServiceAssignments` | Histórico empleado–servicio | tipo, inicio, fin, asignación principal y notas |

`Age` y `ResidenceDuration` no se almacenan como valores calculados. La edad se deriva de `BirthDate`; la permanencia se deriva de `ResidenceSinceDate` cuando se disponga de una fecha confiable.

## Información diferida

Los siguientes bloques existen en la ficha, pero no entran en la primera migración:

- Familiares y dependientes.
- Escolaridad detallada.
- Historial y referencias laborales/personales.
- Créditos INFONAVIT, FONACOT, bancarios y otros.
- Historial de capacitaciones.
- Entrega y devolución detallada de uniformes.
- Bonos, rifas y beneficios.
- Baja, reingreso y actualizaciones documentales como procesos completos.

Se difieren porque requieren reglas de vigencia, responsables, retención o catálogos aún no confirmados. No se pierden: quedan registrados para cortes posteriores.

## Privacidad y seguridad

Los datos de empleados incluyen identificadores oficiales, información de contacto, domicilio y resultados de evaluaciones. Por ello:

- No se incluyen datos personales reales en migraciones, pruebas ni repositorio.
- La API deberá autorizar lectura por propósito y rol, no sólo por módulo.
- Los archivos se almacenarán fuera de SQL Server; la base guardará una referencia opaca y metadatos.
- Se debe definir retención y eliminación segura antes de cargar expedientes reales.
- Los resultados de evaluaciones deben exponerse de forma mínima; los detalles y evidencias requieren permisos más restrictivos.
- El registro de auditoría no debe copiar el contenido sensible completo.

## Pendientes antes de los primeros endpoints

- Confirmar si el término del negocio será cliente, beneficiaria o razón social.
- Definir quién asigna `CodeClient`, `CodeService` y `CodeEmployee`.
- Confirmar estados y transiciones de contratos y empleados.
- Definir si cada servicio puede abarcar varias sedes.
- Detallar turnos y posiciones para sustituir gradualmente la descripción libre del rol.
- Definir almacenamiento documental, antivirus, cifrado, permisos y retención.
- Confirmar si RFC, CURP y NSS se capturan completos o parcialmente según cada rol.
