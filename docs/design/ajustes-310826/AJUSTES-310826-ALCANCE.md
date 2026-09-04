# Ajustes 31-08-26: reorganización funcional, roles y módulo de Servicios

Fuente: `Ajustes310826.docx`. Este documento traduce la propuesta a alcance ejecutable.
Ubicación sugerida en el repo: `docs/design/ajustes-310826/ALCANCE.md`.

## Decisión de dirección

GestIA se reorganiza asumiendo que la información base ya está capturada. La pantalla
principal orienta la operación diaria; la configuración queda separada por rol y por
organización.

## Regla de alcance

Solo se implementa lo listado en los paquetes A–E. Cualquier cambio que no esté aquí
—rediseño del sistema visual, nuevos módulos, refactors de conveniencia, cambios al
layout base de INSPINIA— queda fuera y se anota en "Fuera de alcance" para decidirlo
después. Si al implementar aparece una mejora obvia no solicitada, se reporta y no se
ejecuta.

## Jerarquía de entidades

Aclarar dos niveles de cliente, hoy confundidos:

| Nivel | Qué es | Ejemplo |
|---|---|---|
| Organización | Empresa que usa GestIA | La empresa de Oscar, la de Joab |
| Cliente operativo | Empresa atendida por una organización | Walmart, Autozone |

Estructura funcional objetivo:

- **Configuración > Clientes**: clientes operativos de cada organización.
- **Configuración > Servicios**: servicios contratados por cliente, con sedes, configuraciones, posiciones, patrones, asignaciones, planeación y turnos.
- **Configuración > Personal**: empleados por organización, con documentos, estatus y validaciones.
- **Operación**: asistencia, incidencias, coberturas, evidencias y cierre diario.

---

## Paquete A — Navegación e información

**Tipo:** UX. **Depende de:** nada. **Hacer primero.**

- Renombrar la sección `Gestión` a `Configuración` en menú, rutas, breadcrumbs y títulos.
- Elevar `Operación` en la jerarquía visual: asistencia, incidencias y cobertura como accesos principales, no anidados.
- La pantalla principal orienta operación diaria, no configuración.

**Criterio de aceptación:** un usuario nuevo distingue a primera vista qué es preparación
y qué es ejecución diaria.

**Riesgo:** rutas viejas rompen enlaces guardados. Definir si se redirige o se corta.

---

## Paquete B — Roles y separación de vistas

**Tipo:** frontend + backend. **Depende de:** A.

| Rol | Alcance | Puede hacer | No debe ver/hacer |
|---|---|---|---|
| Super admin | Toda la plataforma, todas las organizaciones | Crear organizaciones, administrar admins de organización, revisar estado general | Operar datos diarios como si fuera de una sola organización, salvo modo soporte/auditoría |
| Admin de organización | Solo su organización | Crear clientes operativos, sedes, contratos, contactos, documentos, servicios y personal | Ver organizaciones o clientes de otras empresas |
| Usuario operativo | Operación diaria asignada | Registrar asistencia, incidencias, coberturas y evidencias según permisos | Modificar configuración estructural sin permiso |

- Vistas distintas para super admin y admin de organización, no la misma pantalla con elementos ocultos.
- Al crear una organización debe poderse crear su usuario administrador en el mismo flujo.
- El modo soporte/auditoría del super admin requiere definición: cómo se activa, qué registra, cómo se distingue visualmente.

**Criterio de aceptación:** el aislamiento por organización se valida en el servidor, no
solo ocultando opciones en el menú.

---

## Paquete C — Clientes: reducir a expediente

**Tipo:** frontend + rutas. **Depende de:** D (lo que sale de Clientes necesita destino).

**Se queda:** ficha fiscal/comercial, sedes, contratos, contactos, documentos relacionados.

**Se va, con destino:**

| Sale de Clientes | Destino |
|---|---|
| Configuración profunda del servicio | Servicios |
| Posiciones y patrones de turno | Servicios |
| Asignación de personal | Servicios |
| Planeación versionada y turnos | Servicios / Planeación |
| Resumen operativo del servicio | Reportes u Operación |

**Criterio de producto:** en Clientes el usuario entiende quién es el cliente, dónde
opera, con qué contrato y documentos cuenta y quiénes son sus contactos. Para definir
cómo se trabaja el servicio, va a Servicios.

**Riesgo:** no ejecutar C antes que D, o el usuario se queda sin dónde configurar.

---

## Paquete D — Servicios: módulo nuevo

**Tipo:** módulo completo, frontend + backend + datos. **Depende de:** A, B.
**El más grande del lote. Subdividir en cortes verticales.**

Cada servicio se liga a una organización, un cliente operativo, una sede y opcionalmente
un contrato.

| # | Corte | Contenido |
|---|---|---|
| D1 | Listado y ficha | Listado filtrable por organización, cliente, sede, estado y contrato. Ficha con descripción, vigencia, contrato asociado e instrucciones. |
| D2 | Configuraciones históricas | Versionadas por fecha: elementos requeridos, horas, precio, días por semana, instrucciones. |
| D3 | Posiciones | Posiciones requeridas con perfil, cantidad y notas. |
| D4 | Patrones de turno | Patrones y segmentos semanales. |
| D5 | Asignación de personal | Con validación documental, evaluaciones, estatus y detección de traslapes. |
| D6 | Planeación y turnos | Planeación versionada, programación y publicación controlada. |

**Definiciones pendientes antes de empezar:**

- Configuración histórica: ¿se corrige una versión pasada o solo se agrega una nueva vigencia?
- Traslapes en D5: ¿bloquean la asignación o solo advierten?
- Publicación controlada en D6: ¿quién publica, qué pasa con una planeación publicada que se modifica?

**Recomendación:** entregar D1 completo y validarlo con Oscar o Joab antes de seguir.
Los cortes D2 a D6 dependen de reglas de negocio que conviene confirmar contra el modelo
real, no inferir del documento.

---

## Paquete E — Documentos: corrección de relación

**Tipo:** bug. **Depende de:** nada. **Puede ir en paralelo con A.**

Los documentos cargados desde Cliente no están bien relacionados con el módulo
Documentos. Objetivo: una sola fuente documental. Clientes muestra documentos filtrados
por entidad; Documentos administra reglas, archivo, vencimientos, privacidad y descarga.

| Caso | Comportamiento esperado |
|---|---|
| Documento subido para cliente | Aparece en Documentos con propietario Cliente y en el expediente del cliente |
| Documento de contrato | Se asocia al contrato y al cliente, sin duplicar archivo |
| Documento sensible | Respeta permisos de privacidad desde cualquier módulo |
| Vencimiento | Genera indicador visible en Clientes y en Documentos |

**Criterio de aceptación:** el archivo se almacena una sola vez, sin importar desde qué
módulo se cargó.

---

## Orden de ejecución sugerido

1. **A** y **E** en paralelo. Ambos independientes, ambos dan valor visible rápido.
2. **B**. Habilita el aislamiento que C y D necesitan.
3. **D1**. Validar con negocio antes de continuar.
4. **C**. Ya con destino para lo que sale de Clientes.
5. **D2–D6**, por cortes, cada uno con su migración revisada.

## Fuera de alcance

Registrar aquí lo que aparezca durante la implementación y no esté en A–E:

- `Configuración > Personal` aparece en la estructura funcional pero no se desarrolla en el documento. Definir si se toca en este corte o se deja como está.
- Modo soporte/auditoría del super admin: mencionado sin especificar.
- Rediseño del sistema visual más allá de lo que exija la reorganización de navegación.

## Restricciones heredadas

Aplican sin excepción, vienen de los ADR y el README del proyecto:

- Los registros operativos no se eliminan. Una corrección conserva valor anterior, valor nuevo, motivo, usuario y fecha.
- Sin reglas de negocio en el frontend que deban protegerse en servidor.
- Las dependencias apuntan hacia el dominio. Domain y Application no referencian EF Core.
- Una migración desplegada no se reescribe; se agrega una compensatoria.
- Solo componentes adaptados de INSPINIA, el paquete comercial no entra a Git.
