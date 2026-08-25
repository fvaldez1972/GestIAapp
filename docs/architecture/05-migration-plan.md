# Plan de migración desde el prototipo

## Fuentes

- Flujo consolidado: visión completa y controles.
- Plan consolidado de primera etapa: alcance inmediato.
- Brand Book: identidad normativa.
- Prototipo React: escenarios, textos, datos demo y hallazgos de usabilidad.
- INSPINIA: patrones visuales y componentes comerciales autorizados.

## Qué se reutiliza

- Navegación de la primera entrega.
- Datos demo ficticios y deterministas, después de normalizarlos.
- Jerarquía de trabajo cliente -> servicio -> posición -> turno -> asignación, pendiente de glosario.
- Recorrido planeación -> asistencia -> incidencia -> cobertura -> reporte.
- Paleta y tono de GestIA.
- Casos de aceptación funcional.

## Qué no se copia directamente

- `localStorage` como fuente productiva.
- Fechas fijas de agosto de 2026.
- Estados basados en nombres visibles.
- Empalme por igualdad de hora de inicio.
- Cobertura como casilla independiente del sustituto.
- Logo, favicon y OG antiguos.
- Componentes Joab/Oscar no conectados.
- Pruebas que sólo buscan texto en archivos.
- Nombres de tablas o columnas inferidos únicamente de las pantallas.

## Incrementos

### 0. Preparación técnica

- Solución .NET y Angular.
- Documentación, reglas de dependencias y CI.
- OpenAPI, health checks y configuración local segura.
- SQL Server y EF Core configurados sin migración de negocio prematura.
- Decisión de autenticación pendiente.

### 1. Acceso e interfaz principal

- Tokens GestIA y activos oficiales.
- Layout INSPINIA adaptado.
- Navegación, rutas, errores y accesibilidad.
- Sesión simulada sólo hasta conectar identidad real.

### 2. Empresa, clientes y personal

- Validar glosario y diccionario mínimo.
- Multiempresa y permisos base.
- Clientes, sedes, perfiles y empleados.
- Primera migración revisada del corte aprobado.
- Validaciones de duplicados y estatus.

### 3. Servicios, posiciones y turnos

- Solicitud y conversión.
- Posiciones con capacidad real.
- Patrones y segmentos de turno.

### 4. Planeación

- Periodo seleccionable y versionado.
- Asignaciones, sustituciones, empalmes y publicación.

### 5. Asistencia, incidencias y cobertura

- Generación desde versión publicada.
- Confirmación masiva por excepción.
- Coberturas consistentes y evidencia.

### 6. Dashboard y reportes

- Proyecciones derivadas.
- Filtros, exportaciones y personal efectivo.

### 7. Calidad y piloto

- Pruebas de dominio, API, integración y UI.
- Seguridad, aislamiento, auditoría y accesibilidad.
- Datos demo restaurables mediante seed controlado.

## Puertas de aceptación

Cada incremento requiere:

1. Glosario y datos del corte validados.
2. Reglas de negocio probadas.
3. Migración SQL Server revisada cuando cambie persistencia.
4. OpenAPI actualizado.
5. Build y pruebas de backend/frontend.
6. Sin dependencias circulares.
7. Revisión de privacidad y permisos.
8. Evidencia visual en 1440x900 y 1024x768 cuando incluya interfaz.
