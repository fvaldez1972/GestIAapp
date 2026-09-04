# Documentación de diseño

Índice de esta carpeta. Si sólo vas a leer un archivo, que sea
[`fase-1/ALCANCE.md`](fase-1/ALCANCE.md).

## Documento vigente

**[`fase-1/ALCANCE.md`](fase-1/ALCANCE.md)** es el alcance que gobierna el trabajo actual.
Sustituye al de ajustes del 31 de agosto.

## Carpetas

### `fase-1/` — vigente

El alcance activo y todo lo que lo acompaña.

| Archivo | Qué es |
| --- | --- |
| `ALCANCE.md` | El alcance vigente. Define el recorrido completo que debe poder hacerse de punta a punta |
| `ANEXO-FLUJO.md` | Complemento del alcance. Define cómo se encadenan los once pasos: qué necesita cada uno, qué deja listo y cómo se llega al siguiente |
| `PROPUESTA-DESCANSO-POSICION.md` | Propuesta de modelo para descanso, vacancia y sucesión de posición. Responde a tres huecos detectados al contrastar el código con el proceso de negocio |
| `recorrido/boceto.html` | Boceto visual del recorrido completo |
| `recorrido/nav-componente.html` | Componente de navegación |

### `refactor-ux/` — vigente, de apoyo

Insumos de diseño visual que siguen sirviendo.

| Archivo | Qué es |
| --- | --- |
| `BRIEF-COMPONENTES.md` | Brief del sistema de componentes: tokens reales tomados de la aplicación y las reglas no negociables que vienen del ADR-0002 y de la integración de INSPINIA |
| `ANALISIS-PANTALLAS-SUPERADMIN.md` | Análisis de las pantallas de super admin |

### `ajustes-310826/` — histórico

El alcance anterior y la evidencia de por qué se sustituyó.

| Archivo | Qué es |
| --- | --- |
| `ALCANCE.md` | Alcance del 31 de agosto. **Superado.** Lleva su propia advertencia al inicio |
| `RECONOCIMIENTO.md` | Reconocimiento del código contra ese alcance, paquete por paquete. Demuestra que buena parte ya estaba implementada antes de escribirse |

### `_superado/` — no usar

Diseños dibujados sobre un sistema que ya no existe: son anteriores a la eliminación del modo
soporte y al recorte del menú de dieciséis a once entradas. Se conservan sólo como historia.
El detalle está en [`_superado/LEEME.md`](_superado/LEEME.md).

## Convención de nombres

Los nombres de archivo no llevan espacios. Los documentos en mayúsculas son texto normativo o
de análisis; los `.html` son bocetos visuales.
