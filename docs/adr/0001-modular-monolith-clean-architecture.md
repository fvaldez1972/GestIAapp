# ADR-0001: Monolito modular con Clean Architecture

- Estado: Aceptado
- Fecha: 2026-08-24

## Decisión

El backend inicia como monolito modular con proyectos Domain, Application, Infrastructure y Api. Los módulos se separan por negocio dentro de cada capa y se comunican mediante contratos explícitos y eventos internos.

## Motivo

El producto necesita consistencia transaccional y todavía está validando reglas. Microservicios aumentarían despliegues, observabilidad y fallos distribuidos antes de que existan límites estables.

## Consecuencias

- Un despliegue y una base transaccional al inicio.
- Reglas aisladas del framework y proveedor de datos.
- Pruebas de arquitectura impiden dependencias inversas.
- Un módulo podrá extraerse posteriormente si volumen, equipo o aislamiento lo justifican.
