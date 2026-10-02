# Avance y lo que falta — corte del 16 de septiembre de 2026, 21:40

**Sustituye al corte de las 21:15 del mismo día.** Desde entonces entraron cuatro piezas más: el
punto ciego del servidor, el perfil por habilidades y los dos ajustes de minutos.

Rama `s0/feature/gestIaProject/filtro-organizacion`, último commit `347a80f`.

| Referencia | Valor |
|---|---|
| Migraciones | **31**, ninguna nueva desde el 12 de septiembre |
| Pruebas de frontend | **793** en 79 archivos, 0 fallos |
| Pruebas de backend | **390**: 269 pasan, 121 se saltan por falta de SQL, 0 fallan |
| Compilación | 0 advertencias, que en este repositorio es obligatorio |
| Sin commitear | **26 archivos**: 14 modificados, 12 nuevos |
| Sin integrar a `v0` | 68 commits, desde el 6 de septiembre |
| Publicado en `dev.gestia-demo.com` | la imagen del **12 de septiembre**: nada de lo de hoy |

---

## 1 · Lo hecho hoy — siete piezas

| # | Pieza | Esquema | Estado |
|---|---|---|---|
| 1 | **Documentos del empleado**: subir, mover la bandera, categoría de catálogo, obligatorios marcados | no | commit `347a80f` |
| 2 | **El requisito ya no miente**: un documento rechazado se dice «Rechazado», no «Al día» | no | sin commitear |
| 3 | **A1 · Pestaña de evaluaciones** | no | sin commitear |
| 4 | **A2 · Pestaña de habilidades** | no | sin commitear |
| 5 | **A3 · Estado en la lista de candidatos** de Servicios | no | sin commitear |
| 6 | **El punto ciego del servidor**: la insignia del listado contaba un rechazado como cubierto | no | sin commitear |
| 7 | **C5 · Perfil requerido por habilidades**, y los ajustes B3-3 y B3-4 | no | sin commitear |

**Ninguna tocó el esquema.** Las 31 migraciones siguen siendo las mismas.

### Qué cambió de fondo

**El recorrido quedó desatorado.** Antes de hoy, de los 156 empleados activos de `db-gestia-dev`
sólo **56** podían volverse asignables desde el portal; los otros 100 necesitaban una evaluación y
no había pantalla, así que sólo se arreglaban por backend. Ahora **los tres tipos de requisito
bloqueante —documento, evaluación y habilidad— tienen su pantalla de captura**, así que los 156 se
pueden volver asignables capturando lo que falte.

Lo que no cambió: **hoy siguen siendo 0 los elegibles**, porque el código no mueve datos.

**Dejó de haber contradicciones entre pantallas.** Tres arreglos del mismo defecto de fondo —una
pantalla afirmando lo que el servidor iba a negar—:

| Dónde | Decía | Dice |
|---|---|---|
| Ficha del empleado, requisitos | «Al día» con un documento rechazado | «Rechazado» · «Sin validar», y explica que el requisito sigue abierto |
| Listado de Personal, insignia | «Al día» | «1 sin validar», en rojo |
| Filtro «Al día» | traía a quien tenía un rechazado | ya no lo trae |
| Lista de candidatos al asignar | ofrecía a todos sin distinguir | «Ocupado · con 2 asignaciones vigentes» · «No cumple · Falta documento vigente: Curp» |

**Y el perfil de una posición pasó de descripción a requisito comprobable.** Antes decía «30 a 40
años de edad, hombre o mujer, buen trato»: algo que nadie puede cumplir a ojos del sistema porque
nada lo compara con nadie. Ahora se arma con habilidades del catálogo, por identificador, y el
texto libre queda como nota que la pantalla declara como tal.

---

## 2 · De las 21 peticiones de Fernando

**7 hechas, 14 pendientes.**

| Grupo | Hechas | Pendientes |
|---|---|---|
| Documentos del empleado (4) | **4** | — |
| Estado al asignar (1) | **1** | — |
| Perfil por habilidades (1) | **1** | — |
| Ajustes menores (6) | **2** (el 3 y el 4) | 4 |
| El cambio estructural (4) | — | **4** |
| Lo que se elimina (3) | — | 3 |
| Precio semanal y periodicidad (2) | — | 2 |

Más dos que no estaban en su lista y sí bloqueaban: la pestaña de evaluaciones y la de habilidades.

---

## 3 · Lo que falta, y qué necesita cada cosa

### Listo para arrancar, sin junta y sin decisiones

| Pieza | Qué es | Tamaño | Esquema |
|---|---|---|---|
| **B1 · Precio semanal y periodicidad de pago** | Periodicidad del precio en el puesto y periodicidad de pago del personal a nivel organización. Quincenal y catorcenal entran las dos: son cosas distintas | mediano | **migración** |
| **B2 · Columna `IdBusinessDocument`** | El enlace entre el archivo y el requisito del empleado, que hoy no existe | chico | **migración aditiva** |
| **D1 · Integrar a `v0`** | 68 commits sin merge desde el 6 de septiembre | — | no |
| **D2 · SQL en el CI** | Un servicio de SQL Server en el workflow, para que dejen de saltarse **121 pruebas** en silencio | chico | no |
| **B3-2 · Ficha del cliente a ventana emergente** | El mismo movimiento que ya se hizo en Organizaciones | mediano | no |

**Unas tres tandas.** Y un aviso de ritmo: hasta hoy todo fue interfaz sobre un servidor que ya
estaba listo. **De B1 en adelante empiezan las migraciones**, y ahí el ritmo baja: cada una lleva
respaldo `COPY_ONLY` verificado, ensayo sobre copia restaurada y su commit aparte.

### Esperan una palabra que no es código

| Pieza | Qué falta | Quién |
|---|---|---|
| **B3-5 · Datos fiscales al alta** | **Decidido**: no se suman. El alta se queda mínima y la captura posterior se explica. Falta escribir esa explicación en la pantalla | queda como trabajo chico |
| **B3-1 · El botón de crear servicio** | El código lo tiene en la cabecera, línea 18. Lo que Fernando describió no cuadra | confirmar con Fernando |
| **B3-6 · Ver si una posición está asignada** | La lista ya pinta «N vacantes» y «N de más». ¿Hablaba de esa pestaña o de Asignaciones? | confirmar con Fernando |

### El bloque C, que es el grueso — bloqueado

**No arranca sin la junta.** Tres preguntas siguen abiertas y **dos cambian la forma de la
migración**, así que empezar antes significa rehacerla.

1. ¿Cuántos días de descanso tiene una posición típica, uno o dos?
2. ¿Qué pasa cuando el ciclo cae en día festivo o en el corte de semana?
3. ¿El cubre-descansos es fijo de la posición o se asigna cada vez?

Lo ya decidido, que no se vuelve a discutir: los horarios viven en la plantilla del catálogo; el
ciclo de un 12×48 son tres días y 28 horas semanales; un patrón que excede 48 h se puede usar
avisando por cuántas horas excede; los 54 patrones vivos se promueven deduplicando con reporte de
qué se unió con qué; y los traslapes se permiten con advertencia.

| # | Movimiento | Tamaño |
|---|---|---|
| C1 | El catálogo de patrones con su constructor | Pantalla nueva, **dos tablas nuevas**, migración con relleno sobre 54 patrones |
| C2 | La posición elige el patrón de un desplegable | mediano |
| C3 | Los segmentos desaparecen | **Migración destructiva sobre 257 segmentos** + reescribir el generador de turnos en dos sitios |
| C4 | Planeación se vuelve visor | Rehacer la pantalla más compleja de las ya rehechas |

**De cuatro a seis tandas.** Y la decisión de alcance sigue abierta: Servicios son 1 796 líneas con
cuerpo viejo. **Acordado:** si la junta tarda más de dos días, se rehace Servicios mientras.

### Los pendientes del proyecto

| # | Qué | Tamaño |
|---|---|---|
| D3 | **La geografía**: 20 092 filas repetidas por organización, creciendo con cada alta | 1–2 tandas, migración con datos |
| D4 | **`Incident.IncidentType` por identificador** | 1 tanda, migración con datos |
| D5 | **Los nueve códigos de negocio**: el diagnóstico va antes que el código | por determinar |

---

## 4 · La cuenta

```text
Hecho hoy ..........................  7 piezas, 0 migraciones
Listo para arrancar ya .............  ~3 tandas    ≈ 25 %
Bloqueado por la junta (bloque C) ..  4–6 tandas   ≈ 50 %
Pendientes del proyecto ............  3–4 tandas   ≈ 25 %
                                      ──────────────────
Total restante .....................  10–13 tandas
```

Esta mañana eran 12–15 tandas. **Sin la junta se puede avanzar cerca de un cuarto de lo que
queda**; la mitad espera tres respuestas que sólo dan Óscar y Joab.

---

## 5 · Orden propuesto

| | Pieza | Necesita |
|---|---|---|
| **1** | **Verificar en el navegador y publicar** | **tu sesión en `localhost:4300`** y tu visto bueno |
| 2 | B1 · Precio y periodicidad | — |
| 3 | B2 · `IdBusinessDocument` | — |
| 4 | D1 · Integrar a `v0` | — |
| 5 | D2 · Las 121 pruebas del CI | — |
| 6 | B3-2 · Ficha del cliente a ventana | — |
| 7 | B3-5 · La explicación de la captura posterior | — |
| 8 | B3-1 y B3-6 | confirmar con Fernando |
| 9 | **C** · El cambio estructural | **la junta** |
| 10 | D3, D4, D5 | — |

---

## 6 · Lo único que bloquea todo, y no es código

**Las siete piezas de hoy están verificadas por pruebas y ninguna ejercitada a mano.** La pestaña
de acceso lleva abierta en `localhost:4300` desde las 18:30 sin sesión. No escribo contraseñas en
ningún formulario, ni en local; eso lo tienes que hacer tú.

En cuanto entres, el recorrido es de unos minutos:

1. Subir un documento a un empleado y ver el requisito cambiar de estado.
2. Registrar una evaluación de polígrafo y ver que el requisito se cubra.
3. Acreditar una habilidad del catálogo, creándola al vuelo.
4. Abrir el alta de asignación y ver «Ocupado» y «No cumple · motivo» en las filas.
5. Abrir una posición y armar su perfil con dos habilidades.
6. Comprobar que la insignia del listado y la ficha dicen lo mismo.
7. Y que «Agregar documento» de Clientes por fin abre el alta.

Después, publicar con etiqueta de respaldo primero, y avisarle a Fernando con qué personas hacer
el recorrido — la lista está en `Downloads\GESTIA-PERSONAS-PARA-LA-DEMO.md`.

---

## 7 · Los 26 archivos sin commitear

```text
Modificados (14)
  backend/  EmployeeListContracts.cs · EmployeeSearchRepository.cs · EmployeeSearchTests.cs
  frontend/ clients-page.html · entity-documents.{ts,spec.ts} · services-page.{ts,html}
            employee-list.models.{ts,spec.ts} · workforce-page.{ts,html}
            employee-documents.ts · employee-fixtures.ts

Nuevos (12)
  frontend/ employee-evaluations.{ts,spec.ts} · employee-skills.{ts,spec.ts}
            assignment-candidates.{ts,spec.ts} · position-skills.{ts,spec.ts}
  docs/     ESTADO-ACTUAL.md · PLAN-PENDIENTE-2026-09-16.md
            manual-rapido-admin-organizacion.pdf (×2, del 12 de septiembre)
```

Conviene commitearlos por tema, no de un golpe: el arreglo del servidor, cada pestaña, el perfil y
los ajustes son cinco temas distintos.
