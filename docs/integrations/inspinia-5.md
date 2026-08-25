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
