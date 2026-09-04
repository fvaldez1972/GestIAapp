# Alcance de la Fase 1 — GestIA

Fecha: 2026-09-04. Sustituye al documento de ajustes del 31 de agosto como alcance vigente.
Base: reconocimiento del código, proceso consolidado de Oscar y Joab, y proceso de negocio de
Joab.

---

## Objetivo

Que un recorrido completo se pueda hacer de punta a punta sin tropiezos, con datos verosímiles
y frente a Oscar o Joab.

**Criterio de éxito, uno solo:**

> El super admin crea una organización con su usuario admin. El admin entra, da de alta un
> cliente con su sede, crea un servicio con su contrato, define las posiciones con su turno y
> su descanso, da de alta empleados, los asigna, publica la planeación de la semana, registra
> la asistencia del día, registra una incidencia y la cubre.

Si eso se recorre en quince minutos y Oscar o Joab lo reconocen como su operación, la fase 1
está lista.

**Regla de alcance:** todo lo que no sirva a ese recorrido queda fuera. Si aparece una mejora
obvia durante la implementación, se anota y no se ejecuta.

---

## El recorrido, paso a paso

| # | Paso | Rol | Módulo |
|---|---|---|---|
| 1 | Crear organización y su usuario admin | Super admin | Organizaciones |
| 2 | Entrar como admin de la organización | Admin org. | — |
| 3 | Configurar catálogos mínimos | Admin org. | Catálogos |
| 4 | Dar de alta cliente con sede y contacto | Admin org. | Clientes |
| 5 | Crear servicio con su contrato y su configuración | Admin org. | Servicios |
| 6 | Definir posiciones con turno y descanso | Admin org. | Servicios |
| 7 | Dar de alta empleados con expediente mínimo | Admin org. | Personal |
| 8 | Asignar titulares y cubre-descansos a las posiciones | Admin org. | Servicios |
| 9 | Generar y publicar la planeación de la semana | Admin org. | Planeación |
| 10 | Registrar la asistencia del día | Operación | Asistencia |
| 11 | Registrar una incidencia y cubrir el hueco | Operación | Incidencias, Cobertura |

---

## Módulos

### Visibles en fase 1

| Módulo | Por qué |
|---|---|
| Inicio | Punto de entrada de ambos roles |
| Organizaciones | Paso 1. Solo super admin |
| Catálogos | Paso 3. Sin puestos ni motivos no se puede dar de alta ni registrar nada |
| Clientes | Paso 4 |
| Servicios | Pasos 5, 6 y 8. El módulo más pesado del recorrido |
| Personal | Paso 7 |
| Planeación | Paso 9 |
| Asistencia | Paso 10 |
| Incidencias | Paso 11 |
| Cobertura | Paso 11 |
| Seguridad | Usuarios, roles y permisos de la organización |

Once entradas. El menú hoy tiene dieciséis.

### Fuera de fase 1

| Módulo | Qué se hace | Por qué |
|---|---|---|
| Solicitudes | Ocultar | En este recorrido el admin da de alta directo, no pide autorización |
| Reportes | Ocultar | No participa en el recorrido |
| Monitor global | Ocultar | Duplica lo que ya hace Organizaciones |
| Reglas documentales | Ocultar | Hoy renderiza exactamente la misma pantalla que Catálogos |
| Auditoría | Pendiente | Depende de la decisión sobre el registro de acceso del super admin |

**Ocultar primero, borrar después.** Se sacan del menú, el código queda intacto, se recorre el
flujo completo. Lo que después de recorrerlo siga sin usarse, se borra con confianza. Ocultar
cuesta una línea y borrar antes de tiempo cuesta descubrir a media demo que algo dependía de
ahí.

---

## Qué ya existe y no hay que construir

Esto es lo que más importa del documento: **la mayor parte del recorrido ya está hecha.** El
alcance del 31 de agosto asumía lo contrario y por eso se planeó trabajo que ya estaba
entregado.

| Pieza | Estado |
|---|---|
| Alta de organización con admin inicial | Existe, en una sola unidad de guardado |
| Aislamiento por organización | Existe, validado en servidor, no solo en el menú |
| Catálogos por organización | Existe. 10 administrables y 24 listas del sistema |
| Geografía de México | Existe. 32 estados y 2,478 municipios del INEGI, recurso repetible |
| Clientes con sedes, contratos, contactos y documentos | Existe |
| Servicios con configuraciones históricas por vigencia | Existe |
| Posiciones y patrones de turno | Existe, con la limitación del punto siguiente |
| Asignaciones con tipo y marca de principal | Existe |
| Detección de traslapes al asignar | Existe. Bloquea con error, no advierte |
| Planeación versionada con publicación y sustitución | Existe |
| Detección de huecos al publicar | Existe |
| Asistencia, incidencias y cobertura | Existen |
| Seguridad: usuarios, roles, permisos | Existe. 23 permisos, 5 roles |

---

## Qué hay que construir

Tres piezas. Salen de la propuesta de descanso y posición.

### 1. Patrón con ancla y descanso explícito

**Problema:** `ShiftSegment` guarda día de la semana, así que el modelo solo expresa patrones
semanales. Un 24x48 es un ciclo de tres días que se recorre cada semana y no se puede
representar. Y el descanso no existe como dato: es la ausencia de un segmento, así que "el
domingo es descanso" y "nadie configuró el domingo" se ven igual.

**Solución:** el patrón declara si es **semanal**, anclado al día de la semana, o **cíclico**,
anclado a una fecha con ciclo de N días. Y cada día del ciclo declara si es **turno** o
**descanso**.

Ambos cuelgan de la posición, así que el descanso sobrevive al cambio de persona, que es la
regla central del proceso de Joab.

**Implica migración nueva.** Toca dominio, generación de turnos y la pantalla de patrones.

### 2. Vacancia consultable

**Problema:** la vacante se calcula al vuelo y se tira. El proceso pide que el hueco sea
visible, marcado en rojo.

**Solución:** proyección reconstruible —elementos requeridos menos asignaciones vigentes a una
fecha— en el esquema `report` que los estándares de base de datos ya contemplan. No columna
almacenada: una columna obliga a sincronizarla en cada alta y baja, y basta un camino olvidado
para que mienta.

**No implica migración de esquema principal.**

### 3. Persona original y persona que cubre

**Por confirmar antes de construir.** El proceso exige que toda cobertura guarde a quién se
sustituyó y quién sustituyó. Si el modelo de incidencia y cobertura ya lo tiene, no hay nada
que hacer. Si no, es requisito para la conciliación con el cliente.

---

## Qué hay que ajustar

Trabajo de reorganización sobre lo que ya existe. Sale del análisis de pantallas.

### Transversal

| Ajuste | Qué corrige |
|---|---|
| Contexto de organización en un solo lugar | Once selectores repetidos, y la contradicción de que la franja diga una organización y las pantallas otra |
| Un solo formato de fecha | Hoy conviven tres formatos, uno de ellos en formato estadounidense |
| Selectores con estilo propio | Todos los desplegables son nativos del sistema |
| Acentos en las pantallas que faltan | Monitor y sus mensajes |
| Nombre accesible en botones de icono | Decenas de botones que un lector de pantalla anuncia sin nombre |
| Acción destructiva separada, con confirmación | "Desactivar" hoy pesa igual que "Editar" |

### Por pantalla

| Pantalla | Ajuste |
|---|---|
| Inicio | Tablero que no muestre cuatro ceros sin contexto |
| Servicios | Quitar la cascada organización → cliente → servicio. Listado directo con filtros, ficha en panel lateral y no apilada debajo |
| Clientes | Reducir de nueve filtros a buscador más panel plegable. Quitar el selector duplicado y el botón que no pertenece |
| Personal | Mismo tratamiento. Quitar los filtros con una sola opción |
| Planeación | Dar peso propio a la resolución de conflictos, que es la acción principal |
| Asistencia | Mostrar por excepción. El proceso dice que la asistencia normal puede quedar en segundo plano y que lo que importa son las excepciones |

---

## Fuera de fase 1, explícitamente

Del proceso consolidado, se excluyen los bloques E y F completos y partes de A, B y D.

| Fuera | De dónde viene |
|---|---|
| Prenómina, conceptos de pago, cierre semanal | Bloque E |
| CONTPAQi, dispersión, nómina interna y externa | Bloque E |
| REPSE, facturación, portales del cliente, notas de crédito | Bloque F |
| Costeo, cotización, escenarios de precio, penalizaciones | Bloque A |
| Antidoping, uniformes, psicometría, Infonavit, registro estatal | Bloque B |
| Geolocalización, evidencia fotográfica, prueba de vida, detección de fraude | Bloque D |
| SLA de sustitución y escalamiento | Bloque D |
| Salario y bonos por posición | Requiere permiso propio; los 23 actuales no cubren nómina |
| Perfil de posición por catálogo de habilidades | Hoy es cotejo de texto libre. Mejora real, no bloquea |
| Control de capacidad con autorización de sobreplantilla | Se habilita con la vacancia, pero el flujo de autorización es aparte |
| Check-in y check-out digital | Etapa 13 del proceso de Joab, tendencia futura |

---

## Decisiones pendientes

### Para Oscar y Joab

1. ¿Cuántos días de descanso tiene una posición típica? Uno o dos cambia el modelo.
2. ¿Qué pasa cuando un patrón cíclico cae en festivo o en el corte de semana?
3. ¿El cubre-descansos es alguien fijo de la posición o se asigna cada vez? Joab habla de
   asignarlos desde el rol; Oscar de comodines zonales.

### Para BKT

4. ¿Se conserva el registro de acceso del super admin a las organizaciones? Define si Auditoría
   entra en fase 1.
5. ¿Los traslapes de asignación bloquean, como hoy, o advierten?
6. ¿Se puede corregir una configuración de servicio con vigencia pasada? Hoy sí, libremente, y
   eso choca con el principio de conservar valor anterior, motivo, usuario y fecha.
7. ¿Qué significa "estado" al filtrar servicios? Define si hay migración.
8. ¿Cuál de las dos rutas de Catálogos se queda?

---

## Bloqueo previo a todo

**Datos de demo realistas.** El ambiente solo tiene datos de humo: un cliente, un servicio, un
empleado. Con eso no se puede recorrer el flujo, ni evaluar ninguna tabla, ni demostrar nada.
Es requisito de la fase 1, no preparativo.

---

## Orden de ejecución

1. Sembrador de datos demo.
2. Ocultar del menú los cinco módulos fuera de alcance.
3. Resolver las decisiones pendientes 1 a 3 con Oscar y Joab.
4. Construir el patrón con ancla y descanso explícito, con su migración.
5. Construir la vacancia consultable.
6. Confirmar o construir persona original y persona que cubre.
7. Ajustes de diseño, empezando por el contexto de organización y siguiendo por Servicios.
8. Recorrer el flujo completo de punta a punta y corregir lo que tropiece.
