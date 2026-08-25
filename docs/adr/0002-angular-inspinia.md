# ADR-0002: Angular 22 con INSPINIA adaptado

- Estado: Aceptado
- Fecha: 2026-08-24

## Decisión

El frontend se crea limpio con Angular 22. INSPINIA 5.0 Angular 21 se utiliza como fuente comercial de layout y componentes, portados selectivamente y ajustados a Angular 22 y al Brand Book.

## Motivo

Copiar el Admin completo agregaría cientos de vistas y dependencias sin relación con GestIA. Permanecer en Angular 21 perdería la versión activa actual cuando el proyecto aún no tiene deuda de migración.

## Consecuencias

- Hay trabajo inicial de adaptación.
- Cada dependencia debe justificar un caso de uso.
- El ZIP completo permanece fuera de Git.
- Los activos y tokens de INSPINIA se reemplazan por la identidad GestIA.

## Implementación inicial

El primer corte se completó con Tailwind CSS 4.1, navegación tipada, layout vertical, sidebar condensado, menú móvil off-canvas, topbar y footer. No se copiaron rutas demo, activos comerciales ni el árbol completo de dependencias. El detalle está en `docs/integrations/inspinia-5.md`.
