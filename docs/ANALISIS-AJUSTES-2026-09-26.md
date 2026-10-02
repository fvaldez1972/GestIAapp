# Análisis de los ajustes del 26 de septiembre de 2026

Se analizan las **notas originales de la reunión** (`Ajustes_260926.docx`), sus dos imágenes —la
cédula de servicio y la conversación de seguimiento— y se contrastan contra el código de GestIA.
La especificación formal (`Especificacion_Ajustes_260926`) es una lectura posterior de esas notas;
donde las dos difieren, manda el Word, y aquí se dice en qué difieren.

## 1. Lo que sólo está en el Word y no llegó a la especificación

**Las dos imágenes son la mitad del requerimiento crítico**, y la especificación las trata como
anexo.

- **La cédula** (imagen 1) trae, además del rol de turnos: `POSICIÓN 4 · CANTIDAD 6 · JORNADA 5X2 ·
  CUBRE DESCANSO NO · SUELDO $2,000 · BONO P/A $1,400`, el perfil de RH —hombre, 31 a 50 años,
  escolaridad secundaria mínima, experiencia descrita en prosa— y el estado de requisitos
  (contrato en proceso, expediente/móvil/chaleco/EPP sí, equipo adicional «fornitura completa, gas
  y PR-24»).
- **La conversación** (imagen 2) **cierra RQ-12**, que la especificación marca «En definición».
  Textual: *«creo que si dejamos que ellos definan los días, las horas y descansos, eso es más
  universal que nada»*, *«el patrón terminaría siendo informativo, así como en el formato»*, *«lo
  importante es cómo asignan entre los días a los diferentes guardias y cuándo descansan»*.

**RQ-12 no está en definición: está decidido.** Lo que falta no es la regla, es el diseño.

## 2. Estado real de cada requerimiento contra el código

| ID | Qué pide | Qué hay hoy | Falta |
|---|---|---|---|
| RQ-01 | Ver los catálogos del Excel | — | El Excel no se adjuntó. Sin él no hay nada que analizar |
| RQ-02 | Instrumento del representante legal | **Ya existe**: `LegalRepresentativeInstrumentNumber`, en dominio, contrato y formulario de edición | Sólo el alta, que hoy lo manda en nulo |
| RQ-03 | Latitud y longitud de la zona | **No hay ni una coordenada en todo el dominio** | Columnas + mapa |
| RQ-04 | Ubicación de la sede: CP, Plus code, lat/long | `ClientSite` ya tiene calle, número, colonia, municipio, estado y **código postal** | Coordenadas, Plus code y mapa |
| RQ-05 | ¿Sirve el «alcance» del contacto? | **Sí sirve, y está escrito en el código** — ver §4 | Nada que hacer: la pregunta tiene respuesta |
| RQ-06 | Nombre en campos separados | `Employee.FullName`, un solo campo | Migración con reparto de los datos vivos |
| RQ-07 | Historial de ingresos y bajas | `Employee` tiene `HireDate` y `ChangeStatus`; **no tiene fecha de baja ni motivo** | Entidad de periodos + motivo obligatorio |
| RQ-08 | La baja vence documentos | — | Depende de RQ-07 y RQ-09 |
| RQ-09 | «Maneja vigencia» y «vence al causar baja» por tipo | `BusinessCatalogItem` sólo tiene `IsRequired` | Dos atributos nuevos |
| RQ-10 | Sensibilidad por tipo | `EmployeeDocument.IsSensitive`, **por documento** | Mover al tipo y quitar la casilla |
| RQ-11 | Dos pestañas por cercanía | El domicilio del empleado tiene municipio y estado, **no coordenadas** | Depende de RQ-03/04 |
| RQ-12 | Rol de turnos por guardia | Ver §3 | Ver §3 |

## 3. RQ-12: el modelo aguanta más de lo que dice la especificación

La especificación advierte *«cambio en ShiftPatterns/ShiftSegments: requiere plan revisado antes de
migrar»*. **Lo que hay se acerca mucho más de lo que parece.**

Hoy: una **posición** tiene un **patrón**, y el patrón tiene **segmentos** con día de la semana,
hora de entrada, hora de salida y cuántos elementos pide. Eso ya expresa el rol de la cédula casi
entero: cada «Guardia N» es una posición, y su renglón del rol son sus segmentos.

Lo comprobé contra la cédula: los seis guardias dan **2 de día y 2 de noche todos los días**, y los
guardias 5 y 6 trabajan 4 y descansan 3 aunque la cédula declare 5x2. Nada de eso choca con el
modelo.

**El hueco real es uno solo, y ya lo conocíamos:** el modelo **no distingue un descanso declarado
de un día que nadie configuró**. Un día sin segmento es ausencia, no decisión — está escrito en
Planeación: *«ninguna celda dice Descanso, porque afirmarlo sería afirmar una decisión que nadie
tomó»*. El rol de la cédula **sí declara el descanso**, en su propia casilla.

Lo que falta, entonces:

1. **Poder decir «descanso»**, que es el cambio de esquema de verdad.
2. **Los horarios de Día y Noche por servicio**, para capturar «Día/Noche» en vez de repetir horas
   en cada segmento.
3. **La etiqueta informativa del patrón** («5x2»), que hoy no existe como dato del servicio.
4. **La pantalla de captura**: una rejilla guardia × día, como la cédula.

Esto además **destraba** la decisión que quedó pendiente sobre el patrón con ancla y los descansos:
la respuesta del negocio es que el patrón no manda, manda el rol.

## 4. Preguntas abiertas que ya tienen respuesta

La especificación deja 19 preguntas. **Tres se pueden cerrar hoy**, sin reunión:

- **RQ-05 — ¿para qué sirve el alcance del contacto?** Sirve, y el porqué está escrito en
  `ClientContactScope`: distingue el contacto de **todo el cliente** del de **una zona concreta**, y
  esa diferencia se volvió necesaria con la decisión de *un contacto principal por alcance*, donde
  hay que contar cuántos principales hay de cada clase. Antes se deducía de si el contacto tenía
  zona, y un nulo era ambiguo: «no se le puso» no es lo mismo que «vale para todas». **Quitarlo
  rompería esa regla.**
- **RQ-04 — ¿la ubicación va en la sede o en el cliente?** En la sede: `ClientSite` es la que ya
  guarda la dirección completa.
- **RQ-03 vs RQ-04 — ¿son dos trabajos?** No. **«Zona» y «sede» son la misma tabla**: la pantalla
  dice zona y por debajo es `ClientSite`. Poner coordenadas una vez resuelve los dos.

## 5. Choques con lo que se construyó esta semana

Esto es lo que más conviene mirar antes de empezar, porque son cosas hechas hace días.

1. **RQ-09 contra la regla de los tres meses.** El 23 de septiembre se pidió que el vencimiento del
   documento de personal fuera **obligatorio y máximo tres meses**. El Word dice lo contrario para
   el comprobante de domicilio: *«estos como tal no tienen una vigencia, porque cuando ingresas
   siempre te piden que sean no mayores a 3 meses, pero el documento es válido por toda la
   instancia del ingreso»*. Es decir: **los tres meses son una regla de captura, no una vigencia**,
   y con RQ-09 ese tipo pasaría a «no maneja vigencia». **Hay que decidir cuál gana.**
2. **RQ-10 contra la casilla que sigue en pantalla.** El formulario de carga de documentos sigue
   mostrando «Documento sensible». RQ-10 la manda quitar.
3. **RQ-11 contra la lista de candidatos.** Las dos pestañas —cerca y lejos— tocan justo el
   selector de candidatos de Planeación y el alta de asignación de Personal.
4. **El perfil de RH de la cédula** —sexo, edad, escolaridad, experiencia— es exactamente el que
   ya se declaró **informativo** en la posición. La cédula lo confirma: es criterio de
   reclutamiento, no regla que bloquee.

## 6. Lo que sigue abierto de verdad

- **RQ-06**: el Word dice «nombre, apellido paterno y materno» y remata «para que sean **dos**
  campos». Son tres cosas y dos campos: hay que confirmar cuál.
- **RQ-11**: qué es «vivir cerca» —¿misma zona, o kilómetros?— y de dónde sale la ubicación del
  domicilio del empleado.
- **RQ-12**: si el rol es siempre semanal o hay ciclos de más de siete días (24×24, 12×36). El
  modelo de hoy es semanal; un ciclo largo es otro cambio.
- **RQ-01**: falta el Excel.
- **RQ-09**: marcar los demás tipos —INE, licencia, cartilla— con sus dos atributos.

## 7. Orden que propongo, y por qué difiere del de la especificación

La especificación propone RQ-12 primero «para cerrar su definición». **La definición ya está
cerrada** por la conversación, así que RQ-12 puede entrar a diseño de una vez. Pero antes conviene
resolver lo que no depende de nadie:

1. **RQ-05 y RQ-02** — se cierran hoy: uno es una respuesta escrita y el otro es casi todo código
   que ya existe.
2. **RQ-09 + RQ-10** — un solo cambio de catálogo, tres atributos, y desbloquean RQ-08. Aquí se
   decide antes lo de los tres meses.
3. **RQ-07 + RQ-08** — periodos laborales y el efecto de la baja. Es el bloque con más migración.
4. **RQ-12** — el rol de turnos, que es lo prioritario para el negocio pero también lo que más
   diseño necesita.
5. **RQ-03 + RQ-04 juntos** — una sola tanda de coordenadas y mapa.
6. **RQ-11** — última, porque depende de la anterior.
7. **RQ-06** — cuando se confirme si son dos o tres campos.
8. **RQ-01** — cuando aparezca el Excel.
