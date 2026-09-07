# Integración de INSPINIA 5

## Fuente licenciada revisada

- Variante: `INSPINIA_v5.0/Tailwind CSS/Angular/StarterKit`.
- Versión original: Angular 21.1, TypeScript 5.9 y Tailwind CSS 4.1.18.
- Destino GestIA: Angular 22 y TypeScript 6.

La carpeta comercial completa se mantiene fuera del repositorio. Sólo se portan patrones y piezas necesarias para GestIA.

## Primer corte integrado

Se adaptaron los siguientes conceptos del StarterKit:

- Layout vertical con sidebar, topbar, área de contenido y footer.
- Navegación declarativa mediante una fuente de datos tipada.
- Sidebar normal, condensado y off-canvas móvil.
- Persistencia de preferencia de navegación en `sessionStorage`.
- Tokens de estructura equivalentes a ancho de sidebar y altura de topbar.
- Tailwind CSS 4 mediante PostCSS.

La identidad, colores, textos, navegación e iconografía son propios de GestIA.

## Segundo corte: el cromo del shell (2026-09-05)

Tanda 1 del rediseño de fase 1. Cada pieza con su origen, adaptación, prueba y consumidor, como
pide la regla de abajo.

### `GiSelect` — `frontend/src/app/shared/ui/gi-select/gi-select.ts`

| | |
|---|---|
| **Origen** | Patrón de menú desplegable de la topbar del StarterKit vertical. |
| **Dependencias nuevas** | **Ninguna.** La plantilla resuelve el desplegable con Preline, que no entra al repositorio; aquí se reimplementa con señales de Angular 22. |
| **Adaptación** | Se sustituye el marcado de Preline por `role="combobox"` + `role="listbox"` propios, con teclado completo, `aria-activedescendant` y foco visible en `--gestia-cyan`. Colores por token; ningún hex crudo. |
| **Prueba** | `gi-select.spec.ts`, doce casos, incluido «no usa el select nativo del sistema». |
| **Consumidor** | La barra de contexto. Queda disponible para cualquier selector de módulo. |

### Barra de contexto — `frontend/src/app/core/layout/context-bar/context-bar.ts`

| | |
|---|---|
| **Origen** | Franja de contexto de la topbar del StarterKit. |
| **Dependencias nuevas** | Ninguna. |
| **Adaptación** | Pieza propia de GestIA: no existe equivalente comercial que lleve organización y día operativo. Del StarterKit se conserva sólo la proporción de la franja y su relación con la topbar. |
| **Prueba** | `context-bar.spec.ts`, ocho casos. |
| **Consumidor** | El shell completo: es el único lugar donde vive el contexto de organización. |

### Menú lateral plano — `frontend/src/app/core/layout/navigation.ts`

| | |
|---|---|
| **Origen** | `docs/design/fase-1/pantallas/componentes/side-menu.html`. |
| **Dependencias nuevas** | Ninguna. |
| **Adaptación** | El bosquejo marca cada entrada con un punto de 6 px; aquí se conserva el **icono** del primer corte, porque el sidebar condensado —que el bosquejo no contempla— necesita algo legible a 5 rem de ancho. El resto es literal: lista plana sin grupos, activo sobre `--gestia-navy-soft` con marca de 3 px en `--gestia-cyan`, inactivos en `--gestia-cyan-soft`. |
| **Prueba** | `navigation.spec.ts` (los tres estados con su cuenta exacta) y `app-shell.spec.ts`. |
| **Consumidor** | El shell. |

**Los cinco hex del bosquejo, traducidos:** `#10104e` → `--gestia-navy`, `#1c1c66` →
`--gestia-navy-soft`, `#22c6ee` → `--gestia-cyan`, `#e9f7fa` → `--gestia-cyan-soft`, `#ffffff` →
`--gestia-surface`. Ninguno quedó sin token y no hizo falta inventar variables. `--gestia-cyan-soft`
está nombrado como superficie y el bosquejo lo usa como texto sobre navy: mismo valor, otro papel,
anotado en el CSS en vez de duplicar el token.

**Fuente:** el bosquejo usa `Archivo`. La aplicación declara `Inter` en `--font-sans` y **no la
carga desde ningún lado**, así que hoy se dibuja con la del sistema. No se agregó ninguna fuente:
sería una dependencia externa, y entraría con su caso, no de paso.

## Dependencias incorporadas

- `tailwindcss` 4.1.18.
- `@tailwindcss/postcss` 4.1.18.
- `postcss` 8.5.26. La versión 8.5.6 de la plantilla se actualizó por seguridad.
- `postcss-normalize-charset` 7.0.1.

No se incorporaron todavía Preline, Simplebar, Flatpickr, ECharts, Google Maps ni plugins de formularios. Se agregarán solamente cuando exista un caso funcional que los requiera.

## Elementos descartados

- Rutas y pantallas demo del Admin.
- Autenticación simulada de la plantilla.
- Customizer de skins y configuraciones no gobernadas por GestIA.
- Logos, fotografías, banderas y activos de demostración.
- Dependencias de gráficos, mapas, calendarios y tablas sin uso actual.

## Regla para siguientes componentes

Cada componente portado debe registrar su archivo de origen, dependencias nuevas, adaptación visual, prueba y módulo de negocio consumidor. No se copiarán carpetas completas del paquete comercial.
