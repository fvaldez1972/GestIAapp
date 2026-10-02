# ADR-0006: Eliminación del modo soporte

- Estado: Aceptado
- Fecha: 2026-09-04
- Sustituye parcialmente a: el mecanismo descrito en `docs/V5-AVANCE-2026-09-03.md`

## Contexto

Hasta ahora el super admin no podía acceder a los datos de ninguna organización salvo que
abriera una **sesión de soporte** para esa organización concreta: un diálogo pedía motivo de al
menos diez caracteres y una duración, la sesión se guardaba en la tabla `SupportSessions` con
inicio y expiración, y cada petición debía llevar la cabecera `X-GestIA-Support-Session`, que un
middleware validaba contra actor, organización y ventana de tiempo.

El mecanismo cumplía su función pero imponía fricción constante a la operación cotidiana del
super admin, que en la práctica necesita entrar a las organizaciones de forma habitual y no
excepcional.

## Decisión

**El modo soporte se elimina.** El super admin entra a una organización directamente y opera
dentro de ella con el menú completo hasta que sale. No hay diálogo, ni motivo obligatorio, ni
duración, ni expiración, ni franja de advertencia.

`OrganizationAccessGuard` queda con dos reglas:

- **Admin de organización y roles operativos:** sólo las organizaciones donde el usuario tiene
  membresía, que viajan como claims `organization` del token. **Esta regla no cambió.**
- **Super admin:** cualquier organización, autorizado por el permiso `PLATFORM.ADMIN`.

La autorización del super admin es **explícita** y no una caída al caso general. Los claims
`organization` se derivan de `OrganizationMemberships`, y el super admin sólo tiene membresía en
su propia organización: dejarlo caer al caso general lo habría encerrado ahí.

### Dónde vive el contexto de organización

En el **cliente**. El identificador de organización ya viajaba en cada petición, y el guard ya
lo recibía; lo único que cambia es la respuesta para un super admin. La organización activa es
una selección de la interfaz que se recuerda en `localStorage`, no estado de servidor.

Se descartaron dos alternativas:

- **En el token:** obligaría a reemitirlo en cada cambio de organización y volvería el token
  estado mutable.
- **En el servidor:** sería la sesión de soporte otra vez, sin motivo ni duración.

## Consecuencias

- El alcance del super admin pasa de *una organización, con ventana de tiempo y motivo* a
  *todas las organizaciones, siempre*. Es un ensanchamiento deliberado.
- **"Hasta que salga" es una convención de la interfaz, no una restricción aplicada.** No hay
  noción de servidor de en qué organización está parado el super admin, así que nada le impide
  consultar dos organizaciones en paralelo desde dos pestañas. Si el negocio quisiera impedirlo,
  haría falta reintroducir estado en el servidor.
- Las **escrituras** siguen siendo atribuibles por `CreatedBy`, `UpdatedBy` y los campos de
  nombre. Las **lecturas** no dejan rastro.
- La cabecera `X-GestIA-Support-Session` se ignora; los cuatro endpoints
  `/api/v1/support-sessions` devuelven 404.
- El aislamiento entre organizaciones para el admin de organización **no cambió**, y hay tres
  pruebas que lo sostienen en `OrganizationAccessGuardTests`.

## Sobre la tabla `SupportSessions`

**No se tocó el esquema.** La entidad, su configuración de Fluent API y la tabla se conservan a
propósito, y sólo por eso: mantienen vivas las sesiones históricas, que siguen consultables
desde Auditoría. Verificado con `dotnet-ef migrations has-pending-model-changes`.

Ninguna migración existente se reescribió y no se creó ninguna nueva.

## Decisión pendiente

**¿Se conserva un registro de qué organizaciones abre el super admin?** No está resuelta.
Quedan dos opciones abiertas:

| Opción | Trabajo | Consecuencia |
| --- | --- | --- |
| **A · Ningún registro** | Ninguno. Habilita borrar `SupportSessions` con una migración compensatoria, previo respaldo `COPY_ONLY` con `CHECKSUM` y `RESTORE VERIFYONLY` | Deja de existir la respuesta a *"¿qué organizaciones abrió y cuándo?"* |
| **B · Bitácora de acceso** | Entidad y **tabla nueva**, migración nueva, escritura al cambiar de organización y exposición en Auditoría. Abre una sub-decisión: registrar al cambiar de organización o por petición | Responde la pregunta |

Se descartó una tercera opción que consistía en resemantizar `SupportSessions` soltando el
`NOT NULL` de `Reason` y su restricción de expiración. El criterio: una tabla cuyo nombre miente
sobre lo que guarda es deuda garantizada. **Si se decide registrar accesos, será tabla nueva.**
