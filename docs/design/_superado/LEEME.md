# Diseños superados — no usar como referencia

Los tres archivos de esta carpeta se conservan **sólo como historia**. Están dibujados sobre
un sistema que ya no existe y usarlos como referencia para implementar reintroduce cosas que
se decidieron quitar.

| Archivo | Qué era |
| --- | --- |
| `barra-de-contexto.html` | Barra de contexto superior con selector de organización |
| `clientes-v1.html` | Primera propuesta de la pantalla de Clientes |
| `clientes-v2.html` | Segunda propuesta de la pantalla de Clientes |

## Por qué quedaron atrás

Son anteriores a dos decisiones que cambiaron la forma del producto:

1. **El modo soporte quedó eliminado.** Estos diseños todavía asumen que el super admin entra
   a la organización mediante una sesión de soporte, con su diálogo de motivo y duración, su
   indicador en la barra superior y las rutas operativas bloqueadas hasta activarlo. Ese
   mecanismo ya no forma parte del producto, así que cualquier elemento visual que lo
   represente sobra. La decisión y su alcance están en
   [`../../adr/0006-eliminacion-modo-soporte.md`](../../adr/0006-eliminacion-modo-soporte.md).

2. **El menú pasó de dieciséis a once entradas.** La navegación se recortó. Estos diseños
   están construidos sobre la estructura larga anterior, de modo que su jerarquía, sus accesos
   y el espacio que reservan para el menú ya no corresponden a lo que existe.

## Qué usar en su lugar

El diseño vigente vive en [`../fase-1/`](../fase-1/). El recorrido está en
[`../fase-1/recorrido/boceto.html`](../fase-1/recorrido/boceto.html) y el alcance que lo
gobierna en [`../fase-1/ALCANCE.md`](../fase-1/ALCANCE.md).

No se borran porque conservan decisiones visuales y de contenido que costaron trabajo y que
conviene poder consultar. Pero **nada de aquí se implementa** sin volver a validarlo contra el
alcance vigente.
