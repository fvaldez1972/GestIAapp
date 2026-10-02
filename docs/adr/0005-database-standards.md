# ADR 0005: Estándares obligatorios para SQL Server

- Estado: aceptado
- Fecha: 2026-08-26

## Contexto

GestIA todavía no tiene un modelo físico de negocio definitivo. Sin una norma ejecutable, cada módulo podría introducir nombres, claves, campos de auditoría y tipos incompatibles, encareciendo las futuras migraciones.

## Decisión

Adoptar `docs/database/DATABASE_STANDARDS.md` como especificación normativa. El modelo de EF Core valida las reglas estructurales mediante `GestIaDatabaseStandards`; las entidades optan a auditoría y borrado lógico mediante interfaces de dominio explícitas.

Los nombres funcionales pueden cambiar mientras se completa el levantamiento, pero toda materialización física debe respetar la forma aprobada. Los instantes `At` se almacenan en UTC y el texto humano usa Unicode.

## Consecuencias

- Una configuración no estándar falla durante la construcción del modelo y se detecta en pruebas.
- Las restricciones e índices reciben nombres deterministas y revisables.
- Cambiar un término del dominio requerirá una migración explícita.
- Las excepciones requieren un ADR y no pueden resolverse desactivando globalmente la validación.
