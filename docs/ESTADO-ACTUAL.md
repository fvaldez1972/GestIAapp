# GestIA — estado actual

**Corte del 1 de octubre de 2026.** Sólo lectura sobre código, esquema y datos: no se modificó
nada. Lo que sigue se leyó del árbol de trabajo, de las dos bases vivas y de los contenedores en
marcha. Donde no pude comprobar algo, lo digo.

Referencia del corte: rama `s0/feature/gestIaProject/filtro-organizacion`, punta `445f32e`.

El corte anterior (16 de septiembre, punta `fcd4ed9`) queda superado: desde entonces entraron
**228 commits**.

---

## 1. Lo publicado coincide con el repositorio

| | `gestia` (sirve `dev.gestia-demo.com`) | `gestia-local` |
|---|---|---|
| Base | `db-gestia-dev` | `db-gestia-local` |
| Migraciones aplicadas | **57 de 57** | **57 de 57** |
| Última migración | `20260930234739_EvaluacionUnicaPorCategoriaDelCatalogo` | la misma |
| Imagen backend | `gestia/backend:local`, construida 30-sep 17:49 | `gestia/backend:localhost`, 30-sep 17:49 |
| Imagen frontend | `gestia/frontend:local`, construida 30-sep 18:24 | `gestia/frontend:localhost`, 30-sep 18:24 |

Cómo se comprobó, con control:

- Migraciones: contadas en `__EFMigrationsHistory` de cada base, contra 57 archivos en el repositorio.
- Backend: la cadena `20260930234739_EvaluacionUnica` está en `GestIA.Infrastructure.dll` de los dos
  contenedores, y **no** está en la imagen `rollback-20260930-1752-local`.
- Frontend: `punteroDentro`, del último commit (`445f32e`), está en dos archivos del paquete de los
  dos contenedores y **también servido por el dominio**; no está en `rollback-20260930-1807-local`.

**Incidente al hacer este corte.** Al arrancar Docker, `gestia-frontend-1` se cerró con
`host not found in upstream "backend"`: nginx arrancó antes de que el backend estuviera en la red.
El dominio quedó caído hasta que se volvió a arrancar el contenedor, sin reconstruir nada. Es el
hallazgo C de `deployment/ANALISIS-PUBLICACION-2026-09-28.md` (§6), que sigue sin corregirse.

---

## 2. Rama

| | |
|---|---|
| Rama | `s0/feature/gestIaProject/filtro-organizacion` |
| Último commit | `445f32e` · 2026-09-30 18:27 · «La lista de un desplegable ya no se cierra al agarrar su barra» |
| Contra su remoto | al día |
| Contra `origin/…/v0` (`origin/HEAD`) | **138 commits por delante**, 3 por detrás |

`v0` no recibe merge de esta rama desde el 6 de septiembre. Todo lo que sirve el dominio vive sólo
en la rama de feature.

---

## 3. Qué entró desde el corte anterior

| Fechas | Tanda |
|---|---|
| 16–19 sep | Evaluaciones y habilidades en el expediente; Sede pasa a Zona y Habilidades a Experiencia |
| 21 sep | Rediseño de Catálogos y patrones de turno; la organización se muda al menú de la cuenta |
| 22 sep | **Geografía compartida** (`GeoCountries`, `GeoStates`, `GeoMunicipalities`, `GeoPostalCodes`) con el código postal al mando; domicilio del personal; `IsBlocking` pasa a `IsRequired`; rediseño de Clientes |
| 23–24 sep | Planeación rehecha; Documentos de Personal desde el catálogo; endurecimiento: freno de login (5/min), JWT en tiempo constante, techo de página 200, sembrador de seguridad apagado por omisión, modo estricto en el frontend |
| 26 sep | **RQ-01 a RQ-11** de los ajustes del 26 (ver §4); pantalla que cabe en la pantalla, tablas con scroll propio |
| 28–29 sep | Un solo contacto principal por cliente; mapa de la zona con Leaflet y mosaicos de Esri; identificador de tres entidades lo pone el dominio |
| 30 sep | Crear servicio arreglado; ficha de cliente con datos fiscales y de constitución; Personal se abre sin reglas documentales; las pestañas de Documentos, Evaluaciones y Experiencia muestran el catálogo; evaluaciones únicas por categoría del catálogo |

---

## 4. Requerimientos de los ajustes del 26 de septiembre

Fuente: `ANALISIS-AJUSTES-2026-09-26.md`.

| ID | Qué pide | Estado |
|---|---|---|
| RQ-01 | Catálogos del Excel | hecho (26 sep) |
| RQ-02 | Instrumento del representante legal en el alta | hecho (26 sep) |
| RQ-03 / RQ-04 | Coordenadas y mapa de la zona | hecho (26 y 29 sep); en dev sólo 2 de 60 zonas tienen coordenadas |
| RQ-05 | Alcance del contacto | resuelto: se retiró el alcance (migración `RemoveClientContactScope`) |
| RQ-06 | Nombre en tres partes | hecho, con migración ensayada |
| RQ-07 | Historial de ingresos y bajas | hecho, con migración ensayada |
| RQ-08 | La baja vence documentos marcados; prueba psicométrica | hecho |
| RQ-09 | Política de vencimiento por tipo | hecho |
| RQ-10 | Sensibilidad por tipo de documento | hecho; la casilla salió de la pantalla el 29 sep |
| RQ-11 | Candidatos cercanos y otros disponibles | hecho, en Planeación y en el alta de asignación de Servicios |
| **RQ-12** | **Rol de turnos por guardia** | **sin empezar.** La regla está decidida (manda el rol, el patrón es informativo); falta el diseño: descanso declarado, horarios de Día/Noche por servicio, etiqueta del patrón y rejilla guardia × día. Abierto: si hay ciclos de más de siete días |

---

## 5. La lista acordada (`design/pendientes/ORDEN-DE-LO-QUE-SIGUE.md`)

| # | Punto | Estado |
|---|---|---|
| 1 | Pestaña de habilidades en el expediente | **hecho**: la pestaña Experiencia de Personal usa `EmployeeSkills` |
| 2 | Geografía compartida | **hecho** (22 sep). Las 19 826 ciudades por organización quedaron desactivadas, no borradas |
| 3 | `Incident.IncidentType` por identificador | **abierto**: sigue siendo `string` con `Trim()` |
| 4 | Los nueve códigos de negocio | **abierto**: siguen los nueve, más `CodePermission` y `CodeRole` |

---

## 6. Los números de hoy

### Esquema y modelo

| | |
|---|---|
| Migraciones | 57 |
| Configuraciones Fluent API | 45 clases `IEntityTypeConfiguration<T>` en 41 archivos |
| Entidades con filtro de organización | 34 |
| Entidades con historial funcional | 5: catálogo, asistencia, incidencia, cobertura, asignación |
| Permisos | 23 |

### Datos vivos

| Tabla | `db-gestia-dev` | `db-gestia-local` |
|---|---|---|
| Organizaciones | 9 | 8 |
| Clientes | 46 | 43 |
| Zonas (`ClientSites`) | 60 | 56 |
| Zonas con coordenadas | 2 | 0 |
| Contactos | 46 | 43 |
| Servicios | 68 | 70 |
| Posiciones | 76 | 71 |
| Empleados | 280 | 271 |
| Periodos laborales | 256 | 240 |
| Documentos de empleado | 1 465 | 1 451 |
| Evaluaciones | 729 | 723 |
| Pruebas psicométricas | 4 | 0 |
| Habilidades de empleado | 483 | 478 |
| Asignaciones | 176 | 168 |
| Patrones de turno | 57 | 57 |
| Reglas de elegibilidad | 51 | 29 |
| Eventos operativos | 148 | 90 |
| Filas de catálogo | 21 168 | 21 071 |
| Geografía compartida (país / estado / municipio / CP) | 1 / 32 / 2 478 / 144 242 | igual |

Los datos de las dos bases son de prueba.

### Pruebas

**No se corrieron en este corte**: está vigente el modo rápido (26 sep), que pide no ejecutarlas
hasta nueva orden. El último dato es el del análisis de publicación del 28 sep: backend en verde,
**19 pruebas de frontend desfasadas** con los cambios de pantalla, y por eso la integración continua
en rojo. Desde entonces hubo más cambios de pantalla sin ajustar pruebas.

---

## 7. Pantallas

Una pantalla está **rehecha** si su carpeta entra en la lista que vigila
`frontend/src/app/shared/ui/design-system.spec.ts`.

### Rehechas

| Pantalla | Ruta | Líneas TS |
|---|---|---|
| Inicio | `/` | 373 |
| Clientes | `/clientes` | 1 600 |
| Personal | `/personal` | 2 475 |
| Planeación | `/planeacion` | 888 |
| Asistencia | `/operacion/asistencia` | 457 |
| Incidencias / Cobertura | `/operacion/incidencias`, `/operacion/cobertura` | 749 |
| Catálogos | `/catalogos`, `/catalogos/:catalogo`, zonas, patrones, reglas | 1 472 + 981 + 238 + 47 |

### Con cuerpo viejo

| Pantalla | Ruta | Líneas TS | `<select>` | Hex a mano |
|---|---|---|---|---|
| **Servicios** | `/servicios` | **3 254** | 11 | 29 |
| Operación (vieja) | `/operacion/:section` | 2 258 | 15 | 130 |
| Solicitudes | `/solicitudes` | 1 667 | 17 | 178 |
| Documentos | `/documentos` | 1 234 | 8 | 112 |
| Seguridad | `/seguridad`, `/usuarios` | 1 023 | 6 | 97 |
| Plataforma | `/plataforma/organizaciones` | 976 | 1 | 23 |
| Auditoría | `/auditoria` | 774 | 4 | 61 |
| Reportes | `/reportes` | 697 | 2 | 98 |
| Login | `/login` | 50 | 0 | 27 |

Servicios casi duplicó su tamaño desde el corte anterior (1 796 → 3 254) y sigue con cuerpo viejo.

### Fuera del menú

Sin entrada: `/documentos`, `/operacion/:section`, `/plataforma/clientes-gestia`. Con entrada
marcada `phase: 2`, que no se dibuja: Solicitudes, Monitor global, Reportes y Reglas documentales.

---

## 8. Publicación: hallazgos del 28 de septiembre

Fuente: `deployment/ANALISIS-PUBLICACION-2026-09-28.md`.

| | Hallazgo | Estado |
|---|---|---|
| A | La CSP bloqueaba los mosaicos del mapa | **resuelto** (29 sep): mosaicos de Esri, permitidos en `frontend/nginx.conf` |
| B | El freno de login no distingue visitantes detrás de nginx | abierto |
| C | Nada vuelve solo tras un reinicio (`restart: "no"`, sin espera al backend) | abierto; **se presentó en este corte** (§1) |
| D | Todo abierto a la red local | abierto |
| E | Publicaciones sin etiqueta de retorno | ya hay etiquetas `rollback-20260930-*` de las publicaciones del 30 sep |
| F | Integración continua en rojo | abierto |
| G | Archivos subidos fuera de todo respaldo | abierto |
| H | Sin respaldo automático | abierto |
| I–K | Túnel fuera del repositorio, disco de Docker, local con `sa` | abiertos, prioridad baja |

---

## 9. Sin commitear

```text
?? docs/deployment/ANALISIS-PUBLICACION-2026-09-28.md
?? docs/deployment/MANUAL-PUBLICAR-CON-TUNEL.md
?? docs/deployment/Manual-publicar-con-tunel.pdf
```

Más este documento y la actualización de `CLAUDE.md` de este corte.

---

## 10. Lo que no pude comprobar

- **No abrí el navegador.** El estado funcional de cada pantalla sale de los commits, que dicen
  dónde se comprobó cada cambio.
- **No corrí pruebas** (modo rápido).
- **No revisé la integración continua** en GitHub; el dato de las 19 en rojo es del 28 sep.
