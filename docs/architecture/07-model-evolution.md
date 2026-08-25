# Proceso para evolucionar el modelo de datos

## Objetivo

Permitir que GestIA avance aunque todavía falte información, sin convertir supuestos en contratos difíciles de cambiar.

## Niveles de definición

| Nivel | Contenido | ¿Genera migración? |
| --- | --- | --- |
| Conceptual | Conceptos, actores y relaciones del negocio | No |
| Lógico | Entidades, atributos candidatos e invariantes | No |
| Físico propuesto | Tablas, columnas, tipos, índices y FKs | No |
| Aprobado | Corte vertical validado por negocio y desarrollo | Sí |
| Desplegado | Migración aplicada en un ambiente compartido | Sólo cambios incrementales |

## Ficha mínima por dato

Antes de aprobar una columna se documentará:

```text
Concepto de negocio:
Nombre de código propuesto:
Descripción y ejemplo:
Fuente del dato:
Responsable:
Obligatorio:
Tipo, longitud o precisión:
Regla de validación:
Unicidad y alcance:
Sensibilidad/privacidad:
Vigencia e histórico:
Uso en reportes o integraciones:
Estado: Borrador | Validado | Aprobado | Desplegado
```

## Flujo por corte vertical

1. Confirmar lenguaje y escenario con negocio.
2. Actualizar el modelo conceptual y las reglas.
3. Proponer contrato API y modelo físico SQL Server.
4. Revisar privacidad, auditoría, aislamiento e índices.
5. Implementar Domain/Application sin detalles del proveedor.
6. Configurar entidades con Fluent API en Infrastructure.
7. Generar y revisar la migración SQL.
8. Probar migración hacia adelante, compatibilidad y rollback operativo.
9. Aplicar mediante el proceso de despliegue, nunca automáticamente al arrancar la API de producción.

## Política de cambios

- Antes de una migración compartida se puede corregir el diseño propuesto libremente.
- Después de desplegar, no se modifica una migración histórica.
- Renombrar usa una migración explícita; no se simula eliminando y recreando si hay datos.
- Columnas nuevas se introducen de forma compatible cuando existan clientes o procesos anteriores.
- Datos derivados no se duplican salvo que exista una proyección reconstruible y justificada.
- Ningún nombre del prototipo se considera definitivo sólo por aparecer en una pantalla.

## Registro de decisiones pendientes

| Tema | Estado inicial | Evidencia requerida |
| --- | --- | --- |
| Empresa vs. organización | Pendiente | Término usado en operación y contratos |
| Cliente vs. razón social/sucursal | Pendiente | Casos reales y jerarquía comercial |
| Persona vs. empleado/guardia | Pendiente | Relación laboral y fuentes de identidad |
| Servicio, posición y puesto | Pendiente | Diferencias operativas y comerciales |
| Periodo de planeación | Pendiente | Reglas semanales, quincenales y excepciones |
| Catálogo de incidencias | Pendiente | Responsables, impactos y autorizaciones |
| Datos personales sensibles | Pendiente | Necesidad, retención y permisos |
| Integración de asistencia | Pendiente | Sistemas fuente y confiabilidad |

Este registro deberá transformarse en tickets o decisiones trazables conforme se obtenga información.
