# Frontend

Aplicacion web de GestIA con Angular 22, componentes standalone y TypeScript estricto.

## Estructura

- `core/`: servicios singleton, autenticacion, interceptores y shell.
- `features/`: capacidades de negocio cargadas por ruta.
- `shared/`: componentes visuales reutilizables sin reglas de negocio.
- `api-generated/`: cliente OpenAPI generado; no debe editarse manualmente.

INSPINIA v5 incluye un StarterKit en Angular 21. Se adaptaran sus patrones visuales y componentes autorizados sobre esta base Angular 22, en lugar de copiar el proyecto completo. Los archivos comerciales originales no se publicaran en el repositorio.

## Comandos

```powershell
npm install
npm start
npm test -- --watch=false
npm run build
```
