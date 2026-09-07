# Anexo de flujo — Fase 1

Complemento de `ALCANCE.md`. Define la lógica que encadena los once pasos: qué necesita cada
uno para empezar, qué deja listo, cómo llega el usuario al siguiente y qué ve cuando falta
algo.

Este documento es lo que convierte once pantallas sueltas en un recorrido.

---

## Principio

Cada pantalla debe saber **de dónde viene el usuario y a dónde va**. Hoy cada paso funciona,
pero la cadena entre pasos no existe: al crear un servicio el usuario queda parado en Servicios
sin saber que las posiciones viven en una pestaña; al asignar personal descubre que no hay
empleados porque el selector aparece vacío; al publicar una planeación incompleta recibe un
aviso que no lo lleva a resolverlo.

**Un callejón sin salida es cuando el sistema dice que falta algo y no ofrece cómo obtenerlo.**
Eliminarlos es el objetivo de este anexo.

---

## Orden real de dependencias

El recorrido se numera del 1 al 11, pero las dependencias no son una fila:

- **Catálogos** debe existir antes de Personal, porque los puestos salen de ahí.
- **Cliente con sede** debe existir antes de Servicio, porque el servicio se liga a una sede.
- **Posiciones con patrón** y **empleados** son independientes entre sí, pero ambos deben
  existir antes de Asignaciones.
- **Planeación** requiere posiciones con patrón y al menos una asignación.
- **Asistencia** requiere planeación publicada.

Lo que no dependa de nada puede hacerse en cualquier momento. Lo que dependa, debe avisar de
qué depende antes de que el usuario llegue a la pared.

---

## Los once pasos

### 1. Crear organización y su usuario admin

**Rol:** Super admin. **Módulo:** Organizaciones.

**Precondición:** ninguna.

**Resultado:** organización activa, con sus catálogos base creados en la misma operación de
guardado, y un usuario administrador con credencial inicial.

**Continuidad:** hoy no hay puente. El super admin queda en la misma pantalla sin señal de qué
sigue. Debe quedar claro que el trabajo se traslada al admin de la organización, y cómo se le
entrega su acceso.

**Decisión abierta:** hoy el super admin teclea una contraseña temporal que se comparte por
fuera del sistema.

---

### 2. Primera entrada del admin de organización

**Rol:** Admin de organización.

**Precondición:** credencial entregada.

**Resultado:** sesión iniciada, con alcance limitado a su organización.

**Este es el momento más frágil de todo el recorrido.** El admin entra a una organización
recién creada: sin clientes, sin servicios, sin empleados, sin planeación. Hoy cae en un Inicio
con indicadores en cero y una gráfica vacía.

**Lo que debe ver:** no un tablero, sino el camino. Qué falta configurar, en qué orden, y por
dónde empezar. El tablero aparece cuando haya algo que mostrar.

**Continuidad:** hacia Catálogos.

---

### 3. Configurar catálogos mínimos

**Módulo:** Catálogos.

**Precondición:** organización creada.

**Los cinco que bloquean el recorrido:**

| Catálogo | Bloquea |
|---|---|
| Puestos | Alta de empleados |
| Habilidades | Perfil requerido de la posición |
| Zonas | Jerarquía zona → cliente → servicio |
| Motivos de incidencia | Paso 11 |
| Motivos de cobertura | Paso 11 |

La geografía —estados y municipios— ya viene cargada y no se configura.

**Resultado:** catálogos poblados con los valores propios de esa organización. El sistema no
inventa puestos ni reglas: cada organización los define según su operación.

**Continuidad:** hacia Clientes.

**Si falta:** al intentar dar de alta un empleado sin puestos, el sistema debe ofrecer crear el
puesto ahí mismo o llevar a Catálogos y regresar. Nunca un selector vacío.

---

### 4. Alta de cliente, sede y contacto

**Módulo:** Clientes.

**Precondición:** organización creada. La geografía ya está disponible.

**Resultado:** cliente activo con al menos una sede y un contacto.

**La sede es obligatoria para continuar**, porque el servicio se liga a una sede. Un cliente sin
sede es un expediente válido pero no permite crear servicios, y eso debe decirse en el momento,
no al fallar el paso siguiente.

**Continuidad:** hacia crear el servicio de ese cliente, sin volver al menú.

---

### 5. Crear servicio con contrato y configuración

**Módulo:** Servicios.

**Precondición:** cliente con al menos una sede.

**Resultado:** servicio vigente, ligado a cliente y sede, con contrato opcional y una
configuración con vigencia que define elementos requeridos, horas, precio, días por semana e
instrucciones.

**Continuidad:** hacia las posiciones de ese servicio.

**Hoy:** la pantalla obliga a elegir organización, luego cliente, y hasta entonces muestra
servicios. Esa cascada se elimina en fase 1.

---

### 6. Definir posiciones con turno y descanso

**Módulo:** Servicios.

**Precondición:** servicio creado.

**Aquí vive la pieza nueva.** Cada posición lleva su patrón de turno, y el patrón declara su
ancla:

- **Semanal:** ciclo de siete días anclado al día de la semana. El descanso es un día con
  nombre.
- **Cíclico:** ciclo de N días anclado a una fecha. El descanso es una posición del ciclo.

Cada día del ciclo declara si es **turno** o **descanso**. Un día sin declarar es un patrón
incompleto y el sistema lo señala.

**Resultado:** posiciones con cupo de elementos requeridos, perfil, y calendario definido.

**La regla que el diseño debe hacer evidente:** el turno y el descanso pertenecen a la posición,
no a la persona. Cuando alguien causa baja, la posición conserva su calendario y quien llega lo
hereda.

**Continuidad:** hacia Personal si no hay empleados, o hacia Asignaciones si ya los hay.

---

### 7. Alta de empleados

**Módulo:** Personal.

**Precondición:** catálogo de puestos configurado.

**Expediente mínimo de fase 1:** identidad, contacto, zona, puesto, fecha de ingreso y los
documentos indispensables. Quedan fuera antidoping, uniformes, psicometría, Infonavit y registro
estatal.

**Resultado:** empleados en estado que permita asignarlos.

**Advertencia:** hoy la elegibilidad se valida comparando el puesto del empleado contra el
perfil requerido de la posición, ambos texto libre. Una coincidencia accidental habilita, y una
diferencia de redacción bloquea. Va a molestar en el paso 8.

**Continuidad:** hacia Asignaciones.

---

### 8. Asignar titulares y cubre-descansos

**Módulo:** Servicios.

**Precondición:** posiciones con patrón, y empleados dados de alta.

**Resultado:** posiciones con titular asignado, cubre-descansos donde aplique, y **vacantes
visibles** donde falte gente.

**Aquí entra la segunda pieza nueva:** la vacancia como estado consultable. Elementos requeridos
menos asignaciones vigentes. El proceso pide que el hueco se vea, marcado en rojo.

**Comportamiento actual:** un traslape bloquea la asignación con error. Está pendiente confirmar
si debe bloquear o advertir.

**Continuidad:** hacia Planeación.

---

### 9. Generar y publicar la planeación

**Módulo:** Planeación.

**Precondición:** posiciones con patrón y al menos una asignación vigente.

**Secuencia:** generar la proyección de la semana, revisar los conflictos detectados, resolverlos,
y publicar.

**Resultado:** versión publicada e inmutable. Toda modificación posterior se convierte en
incidencia trazable — no se edita el rol publicado.

**Lo que el diseño debe resolver:** hoy "Resolver conflictos" no tiene más peso visual que el
resto, siendo la acción principal de la pantalla. Y un conflicto debe llevar a donde se resuelve,
no solo anunciarse.

**Continuidad:** hacia la operación diaria.

---

### 10. Registrar la asistencia del día

**Módulo:** Asistencia.

**Precondición:** planeación publicada para esa fecha.

**Principio de diseño, tomado del proceso:** la asistencia normal puede quedar en segundo plano.
Lo que importa son **las excepciones que cambian cobertura**. La pantalla debe mostrar primero
lo que se salió de lo planeado, no una lista completa donde todo pesa igual.

**Resultado:** asistencia registrada y comparable contra lo proyectado.

**Continuidad:** una falta o un retardo lleva directamente al paso 11.

---

### 11. Registrar incidencia y cubrir el hueco

**Módulos:** Incidencias, Cobertura.

**Precondición:** turno proyectado con una excepción.

**Resultado:** incidencia registrada con su motivo, y el hueco resuelto —con persona que cubre—
o declarado como turno no cubierto.

**Debe guardarse:** persona original, causa, persona que cubre, turno, cliente y autorización.
Es lo que después permite conciliar con el cliente.

**Cierre del recorrido:** el hueco queda resuelto o explícitamente declarado sin cubrir. No hay
un tercer estado.

---

## Estados de "falta algo"

Cada pared del recorrido necesita salida. Estos son los casos, y ninguno debe ser un selector
vacío:

| Situación | Qué debe ofrecer |
|---|---|
| Organización sin catálogos configurados | Llevar a Catálogos, indicando cuáles faltan |
| Alta de empleado sin puestos en catálogo | Crear el puesto en el momento, o ir y regresar |
| Cliente sin sede al crear servicio | Crear la sede desde ahí |
| Servicio sin posiciones | Explicar que sin posiciones no hay planeación, y llevar a crearlas |
| Posición con patrón incompleto | Señalar qué días faltan por declarar |
| Asignación sin empleados disponibles | Llevar a Personal, o explicar por qué ninguno es elegible |
| Planeación sin posiciones ni asignaciones | Indicar qué falta y en qué módulo |
| Planeación con conflictos | Llevar a cada conflicto, no solo contarlos |
| Asistencia sin planeación publicada | Explicar que primero hay que publicar |

---

## Transiciones que hoy no existen

Estas son las que hay que crear para que el recorrido se sienta continuo:

1. Crear organización → entregar acceso al admin
2. Primera entrada del admin → guía de configuración inicial
3. Crear cliente → crear su primer servicio
4. Crear servicio → definir sus posiciones
5. Definir posiciones → dar de alta empleados o asignar
6. Asignar → generar planeación
7. Publicar planeación → operación del día
8. Falta o retardo en asistencia → registrar incidencia
9. Incidencia → resolver cobertura
