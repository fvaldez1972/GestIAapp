# Menú por rol

Estado: **el backend no necesita nada.** Los permisos de los cinco roles ya existen y ya están
asignados en `SecurityDataSeeder`, y `frontend/src/app/core/layout/navigation.ts` ya filtra cada
entrada por su permiso. Este documento existe para que quien implemente el menú no tenga que
deducirlo, y para dejar dicho por qué dos roles ven lo mismo.

---

## La regla que ordena todo esto

**El menú dice a dónde puedes ir, no qué puedes hacer ahí.**

Es la razón de que `ORG_OPERATOR` y `ORG_VIEWER` vean exactamente las mismas entradas: la
diferencia entre ellos no es el acceso a los módulos, es que uno puede guardar y el otro no. Eso
lo resuelven `OPERATIONS.WRITE` y `REQUESTS.WRITE` **dentro** de la pantalla, deshabilitando las
acciones, no ocultando el módulo.

Si alguien lee ese empate como un defecto y "corrige" el menú duplicando la lógica de escritura
en la navegación, va a producir dos fuentes de verdad para lo mismo. No lo es: es la separación
correcta.

---

## Los permisos de cada rol

Tal como los asigna `SecurityDataSeeder`, no como parecería razonable.

| Rol | Permisos |
| --- | --- |
| `ADMINISTRATOR` | Todos, incluido `PLATFORM.ADMIN` |
| `ORGANIZATION_ADMIN` | Todos **menos** `PLATFORM.ADMIN` y `ORGANIZATIONS.WRITE` |
| `ORG_SUPERVISOR` | `CLIENTS.READ` · `DOCUMENTS.READ` · `DOCUMENTS.WRITE` · `CATALOGS.READ` · `WORKFORCE.READ` · `WORKFORCE.WRITE` · `PLANNING.READ` · `PLANNING.WRITE` · `OPERATIONS.READ` · `OPERATIONS.WRITE` · `REQUESTS.READ` · `REQUESTS.WRITE` · `REPORTS.READ` · `AUDIT.READ` |
| `ORG_OPERATOR` | `CLIENTS.READ` · `DOCUMENTS.READ` · `CATALOGS.READ` · `WORKFORCE.READ` · `PLANNING.READ` · `OPERATIONS.READ` · **`OPERATIONS.WRITE`** · `REQUESTS.READ` · `REQUESTS.WRITE` · `REPORTS.READ` |
| `ORG_VIEWER` | `CLIENTS.READ` · `DOCUMENTS.READ` · `CATALOGS.READ` · `WORKFORCE.READ` · `PLANNING.READ` · `OPERATIONS.READ` · `REQUESTS.READ` · `REPORTS.READ` |

`ORG_OPERATOR` tiene `OPERATIONS.WRITE`, así que **sí puede registrar la asistencia**, que es lo
que el paso 10 del alcance de fase 1 le pide. No hacía falta agregarle nada.

`ORG_VIEWER` conserva `CLIENTS.READ` y `CATALOGS.READ` por decisión explícita: un consultor que
no puede ver a qué cliente pertenece un turno no puede consultar nada útil.

---

## El menú resultante, ya con los módulos de fase 1

Ocultando Monitor global, Solicitudes, Reportes, Reglas documentales y la entrada duplicada de
Seguridad, que quedan fuera de fase 1.

| Entrada | Permiso | `ORGANIZATION_ADMIN` | `ORG_SUPERVISOR` | `ORG_OPERATOR` | `ORG_VIEWER` |
| --- | --- | :-: | :-: | :-: | :-: |
| Inicio | ninguno | sí | sí | sí | sí |
| Planeación | `PLANNING.READ` | sí | sí | sí | sí |
| Asistencia | `OPERATIONS.READ` | sí | sí | sí | sí |
| Incidencias | `OPERATIONS.READ` | sí | sí | sí | sí |
| Cobertura | `OPERATIONS.READ` | sí | sí | sí | sí |
| Clientes | `CLIENTS.READ` | sí | sí | sí | sí |
| Servicios | `CLIENTS.READ` | sí | sí | sí | sí |
| Personal | `WORKFORCE.READ` | sí | sí | sí | sí |
| Catálogos | `CATALOGS.READ` | sí | sí | sí | sí |
| Auditoría | `AUDIT.READ` | sí | sí | **no** | **no** |
| Seguridad | `USERS.READ` | sí | **no** | **no** | **no** |
|  | | **11** | **10** | **9** | **9** |

El super admin fuera de organización ve tres entradas —Inicio, Organizaciones y Seguridad—, y
dentro de una organización ve las 11. Eso ya está resuelto en
`pantallas/componentes/side-menu.html` y no depende de este documento.

### Auditoría desaparece para los roles operativos, y está bien

La bitácora de la tanda C hace que Auditoría valga la pena, pero **ni el operador ni el consultor
tienen `AUDIT.READ`**, así que no la ven. Es la regla aplicada al pie de la letra: si un rol no
tiene permiso para un módulo, ese módulo no va en su menú.

Si el negocio quiere que el supervisor **no** vea Auditoría, o que el operador **sí**, es un
cambio de permisos en `SecurityDataSeeder`, no un ajuste de navegación.

---

## Qué necesita el frontend

**Nada estructural.** `navigation.ts` ya filtra por `permission`, y el token ya trae los permisos
del rol. Lo que falta es sólo lo de la tanda 1 del rediseño:

1. **Ocultar** —no borrar— las entradas fuera de fase 1: Monitor global, Solicitudes, Reportes,
   Reglas documentales y la segunda entrada de Seguridad.
2. Que el estado del menú siga los tres casos ya resueltos en el diseño: super admin fuera de
   organización, super admin dentro, admin de organización.

Y una comprobación que conviene dejar escrita en una prueba del frontend: **ninguna entrada sin
`permission` salvo Inicio**. Una entrada sin permiso se le muestra a todo el mundo, y hoy eso sólo
es correcto para Inicio.
