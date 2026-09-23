# Análisis del repositorio GestIA · 23 de septiembre de 2026

Análisis completo del repositorio, hecho leyendo el código y **ejecutando** el build y las pruebas,
no leyendo la documentación. Donde un número viene de un archivo de proyecto o de una corrida, se
dice de dónde.

---

## 1 · Lo que se ejecutó, y qué salió

Todo verde. Esto no es una lectura: son corridas de hoy.

| Comprobación | Resultado |
|---|---|
| `dotnet build GestIA.sln` | **0 errores, 0 advertencias** (con `TreatWarningsAsErrors=true`) |
| `GestIA.Domain.UnitTests` | **82 / 82** |
| `GestIA.Application.UnitTests` | **91 / 91** |
| `GestIA.Architecture.Tests` | **52 / 52** |
| `GestIA.IntegrationTests` (SQL Server efímero) | **243 / 243**, **0 omitidas** |
| `npm test` (Vitest sobre jsdom) | **873 / 873**, 84 archivos |
| `npm run build` (producción) | Bundle generado, sin exceder presupuestos |

**1 341 pruebas en verde, ninguna omitida.** El contenedor efímero de `pruebas-integracion.sh` se
retiró solo, como promete.

Un detalle que vale la pena: la corrida de integración levantó su propio SQL Server en el puerto
1435, no tocó `db-gestia-dev` ni `db-gestia-local`, y no dejó contenedor ni volumen. El guion
cumple lo que documenta.

---

## 2 · Tamaño y forma

| Área | Medida |
|---|---|
| Backend (sin migraciones) | 36 700 líneas en 4 proyectos |
| Migraciones EF | 186 049 líneas — **45 migraciones** (el grueso es código generado) |
| Pruebas backend | 11 677 líneas en 4 suites |
| Frontend (sin pruebas) | 41 377 líneas TypeScript + 8 112 de plantillas |
| Pruebas frontend | 16 981 líneas |
| Documentación | 65 archivos `.md` + 6 ADR |

**Proporción de pruebas: 32 % en el backend, 41 % en el frontend.** Es una proporción alta y
sostenida, no un puñado de pruebas de adorno.

### Superficie de la API

**178 rutas** repartidas en 25 archivos de endpoints, bajo 29 grupos. El versionado `/api/v1/` es
consistente en todos.

### Frontend

15 features, cada una con `data-access/` y `pages/`. 21 componentes compartidos con prefijo `gi-`.
El bundle sale en **48 trozos perezosos**, uno por pantalla: ninguna pantalla pesada se carga hasta
que se visita.

---

## 3 · Lo que está bien, y conviene no perderlo

No es cortesía: son cosas que en la mayoría de los repositorios de este tamaño no están.

### El aislamiento entre organizaciones se sostiene solo

- **35 entidades** declaran `IOrganizationScopedEntity` y reciben el filtro global con nombre.
- El filtro **falla cerrado**: sin organización fijada devuelve cero filas.
- `IgnoreQueryFilters(["Organization"])` aparece en **6 archivos**, y los 6 están en la lista blanca
  de `OrganizationFilterBypassTests`: el sembrador demo y sus parciales, más
  `OrganizationGovernanceRepository` (vista de plataforma, con `PLATFORM.ADMIN`).
- `IgnoreQueryFilters()` sin argumentos **rompe el build**, porque apagaría los dos filtros a la vez.

Esto último es la pieza fina: la prueba no comprueba que el aislamiento funcione hoy, comprueba que
no se pueda apagar mañana sin que se vea en el diff.

### La autorización está en el servidor, en todos los endpoints

De las 178 rutas, **todas menos tres** llevan `.RequirePermission(...)`, y las tres están
justificadas en el código:

- `POST /auth/login` y `GET /auth/me`, que son el punto de entrada.
- `GET /catalogs/options`, que exige **uno de seis** permisos con una comprobación explícita (el
  filtro `.RequirePermission` sólo admite uno).

Y `OrganizationAccessGuard.ForbidIfUnauthorized` está en todos los endpoints que reciben
organización. Los tres archivos que no lo llevan son los correctos: `GeographyEndpoints` (datos
compartidos, sin dueño), `OrganizationEndpoints` y `SecurityAdministrationEndpoints` (plataforma,
todos con `PLATFORM.ADMIN`). `GeographyEndpoints` lleva además un comentario de cabecera que explica
por qué se ve distinto del resto, que es exactamente lo que evita que alguien "arregle" la
excepción.

### Las contraseñas

PBKDF2-SHA256, **210 000 iteraciones** (la recomendación vigente de OWASP), sal aleatoria de 32
bytes por usuario, comparación con `CryptographicOperations.FixedTimeEquals`. El login devuelve el
mismo mensaje para usuario inexistente y contraseña mala, así que no hay enumeración de cuentas. Y
un usuario dado de baja no puede entrar, porque el filtro `Active` global se aplica a `Users` sin
que nadie tenga que acordarse.

### Las subidas de archivos

- El nombre original **se descarta**: el archivo se guarda como GUID.
- La extensión se valida a ASCII alfanumérico, máximo 16 caracteres.
- El tamaño está topado.
- La descarga **siempre** sirve `application/octet-stream` con nombre, nunca el `Content-Type` que
  mandó el cliente. Eso cierra el XSS almacenado, que es el riesgo real de una carpeta de subidas.
- `IsSafeRelativePath` rechaza `..`, control chars, y segmentos que terminen en punto o espacio.
- La descarga de documentos pasa por `service.GetAsync`, que comprueba la sensibilidad antes de
  entregar el archivo: `DOCUMENTS.READ` no alcanza para bajar un documento sensible.

### Los contenedores

El backend **no se conecta como `sa`**. `database-init` crea `gestia_app` con `db_datareader` y
`db_datawriter` y nada más; `sa` queda sólo para las migraciones, que son un paso manual. Los cuatro
servicios llevan `no-new-privileges:true`. Las tres claves críticas usan `:?` en el compose, así que
el stack **no arranca** si faltan.

### La disciplina de escritura

Cero `TODO`, cero `FIXME`, cero `HACK` en todo el código. Cero `any` en TypeScript. Cero
`DateTime.Now` (todo es UTC por contrato). Y los comentarios explican *por qué*, no *qué*: varios
dicen qué defecto los provocó y qué pasaría si se quitaran. Eso es lo que hace que una regla
sobreviva al mes siguiente.

---

## 4 · Hallazgos

Ordenados por lo que me preocuparía primero. Ninguno rompe nada hoy; varios se vuelven graves al
crecer.

### 4.1 · La auditoría carga toda la historia en memoria en cada consulta

**Dónde:** `backend/src/GestIA.Infrastructure/Persistence/Repositories/AuditRepository.cs`,
método `SearchAsync`.

**Qué hace:** ejecuta **27 consultas**, una por familia de entidad, y acumula cada fila en una
`List<AuditRow>` en memoria. Después, sobre esa lista ya materializada:

- filtra por rango de fechas (líneas 579–584),
- filtra por texto (líneas 586–595),
- ordena (líneas 597–600),
- y **recién entonces** pagina (`Skip`/`Take`, líneas 601–602).

Es decir: **ni el filtro de fecha, ni la búsqueda, ni el paginado llegan a SQL.** Pedir la página 1
con 20 renglones trae del motor todas las altas y bajas de asistencias, incidencias, coberturas,
turnos, documentos, personal y catálogos de la organización, y tira el 99 % después.

**Por qué importa aunque hoy no se note:** las tablas que dominan ese total —`AttendanceRecords`,
`ScheduledShifts`, `Incidents`, `CoverageRecords`— crecen **por empleado y por día**. Con 100
personas se agregan del orden de 36 500 asistencias al año, más los turnos, y cada registro produce
una o dos filas de bitácora. La pantalla de Auditoría funciona hoy porque los datos son de demo.

*No pude medir los renglones reales de `db-gestia-dev`: la consulta de conteo quedó bloqueada por
la política de lecturas de producción de esta sesión. El análisis es del código, y el código no deja
lugar a dudas.*

**Qué haría:** componer las 27 consultas con `Concat` sobre `IQueryable` y dejar que fecha,
búsqueda, orden y paginado se traduzcan a SQL. Es un cambio contenido a un solo archivo.

### 4.2 · La exportación de auditoría entrega 100 renglones y no lo dice

**Dónde:** `backend/src/GestIA.Api/Endpoints/AuditEndpoints.cs`, líneas 61–68.

La ruta `GET /audit/events/export` recibe los mismos filtros que la búsqueda, pero llama al servicio
con **`page: 1, pageSize: 100` fijos**. El CSV que baja el usuario contiene, como mucho, los primeros
100 renglones del resultado filtrado, **sin ninguna indicación de que está recortado**.

Alguien que exporta la auditoría de un mes para revisarla o entregarla se lleva un archivo que
parece completo y no lo es. En un módulo cuyo propósito es dejar constancia, eso es peor que un
error visible.

**Qué haría:** o exportar el conjunto filtrado completo (encadenado, sin materializar todo), o decir
en la pantalla y en el archivo que es una muestra de los primeros N. La primera es la correcta; la
segunda es honesta.

### 4.3 · `pageSize` no tiene tope en ningún endpoint

**Dónde:** los seis endpoints paginados, y `PagedResult`.

El patrón es siempre `pageSize <= 0 ? 20 : pageSize` o `pageSize ?? 20`: se corrige el valor
inválido hacia abajo, pero **no hay techo**. Nada impide `?pageSize=1000000`.

No es una fuga: el filtro de organización sigue puesto y el usuario sólo ve lo suyo. Es dos cosas
distintas: un vector de agotamiento de recursos, y una forma cómoda de llevarse la tabla entera de
un tirón en vez de paginarla. Sumado al hallazgo 4.1, en Auditoría se multiplican.

**Qué haría:** una función única —`PageSize.Clamp(value)`— con máximo 200, usada en los seis sitios.
Es media hora.

### 4.4 · No hay límite de intentos en el login

**Dónde:** no existe. No hay `AddRateLimiter` ni `RequireRateLimiting` en todo el backend.

`POST /api/v1/auth/login` es anónimo y **cada intento cuesta 210 000 iteraciones de PBKDF2**. Ese
coste es exactamente lo que protege las contraseñas contra quien roba la base, y exactamente lo que
convierte al endpoint en un amplificador: unas pocas peticiones por segundo consumen CPU real del
servidor. El mismo endpoint permite además probar contraseñas sin freno.

Es el único endpoint anónimo del sistema, así que la superficie es pequeña y el arreglo es acotado.

**Qué haría:** el limitador integrado de ASP.NET Core sobre `/auth/login`, por IP y por correo.

### 4.5 · La firma del JWT se compara con `string.Equals`

**Dónde:** `backend/src/GestIA.Api/Security/JwtAuthenticationMiddleware.cs`, línea 51.

```csharp
if (!string.Equals(expectedSignature, parts[2], StringComparison.Ordinal))
```

`string.Equals` corta en el primer carácter distinto, así que el tiempo de respuesta filtra cuántos
caracteres de la firma acertó quien la mandó.

**Seamos honestos con la gravedad: explotarlo por red es muy difícil.** El ruido de latencia supera
de largo la diferencia, y habría que promediar una cantidad enorme de intentos por carácter. No lo
reporto porque sea explotable mañana, sino por dos razones:

1. El arreglo es una línea: `CryptographicOperations.FixedTimeEquals` sobre los bytes.
2. **El proyecto ya sabe hacerlo bien.** `Pbkdf2PasswordHashService.Verify` usa `FixedTimeEquals`.
   Que la contraseña se compare en tiempo constante y la firma no, no es una decisión: es un olvido.
   Y un olvido que se ve al lado de la versión correcta se arregla ahora o no se arregla nunca.

Lo que **sí** está bien en ese archivo, y conviene decirlo: el `alg` de la cabecera **no se lee**.
Siempre se recalcula HMAC-SHA256. Eso cierra de raíz `alg: none` y la confusión de algoritmos, que
son los dos fallos clásicos de un JWT escrito a mano.

### 4.6 · Los permisos van congelados en el token durante 8 horas

**Dónde:** `JwtOptions.ExpiresMinutes = 480`, y el middleware, que valida la firma y no consulta la
base.

Los permisos y las organizaciones del usuario viajan **dentro** del token. El middleware comprueba
firma, `exp`, `iss` y `aud`, y construye los claims a partir del payload. Nunca vuelve a preguntarle
a la base.

Consecuencia: si se le quita un permiso a alguien, se le saca de una organización o **se le da de
baja**, su token sigue funcionando con los permisos viejos hasta **8 horas** después. No hay
revocación ni refresco.

Que un usuario dado de baja no pueda *entrar* está bien resuelto; que el que ya entró siga dentro
ocho horas es otra cosa. En un sistema donde revocar accesos es una operación de negocio —y la
pantalla de Seguridad existe precisamente para eso— esa ventana es larga.

**Qué haría, en orden de esfuerzo:** bajar `ExpiresMinutes` a algo entre 30 y 60 con renovación
silenciosa; o comprobar contra la base una marca de "sesiones válidas desde" por usuario, que se
mueve al cambiar permisos o al dar de baja.

### 4.7 · Las subidas de los usuarios se versionan en Git

**Dónde:** `.gitignore`, últimas líneas, y `storage/`.

El `.gitignore` dice, textualmente, que `storage/` **sí está versionado**. Hoy hay 15 archivos
seguidos por Git y 5 más sin agregar, entre ellos cuatro `.jpg` y un `.pdf` subidos durante las
pruebas del 22 y 23 de septiembre.

Son documentos de negocio de un módulo cuyo propósito es guardar expedientes de personal:
identificaciones, actas, comprobantes. El riesgo no es de hoy, es de estructura:

- **Un archivo que entra a Git no sale.** Borrarlo en un commit posterior lo deja en la historia, y
  el proyecto tiene 341 commits que se clonan enteros.
- El sistema ya distingue documentos **sensibles** con un permiso propio (`DOCUMENTS.SENSITIVE.READ`).
  Ese control vive en la base de datos. **En Git no hay control ninguno**: quien clona, los tiene
  todos.
- Es la contradicción más grande que encontré entre lo que el código protege con cuidado y lo que el
  repositorio deja pasar.

Entiendo por qué está así —el stack que sirve el dominio monta `./storage`, y así los archivos
sobreviven a la reconstrucción—. Pero eso es un problema de persistencia, y la solución de
persistencia es un volumen Docker o una carpeta fuera del repositorio, no el control de versiones.

**Qué haría:** montar `storage/` desde fuera del repositorio (como ya se hizo con el padrón de
SEPOMEX, por la misma clase de razón), ignorarlo en Git, y decidir aparte qué hacer con los 15
archivos que ya están en la historia. Esa segunda parte es una decisión tuya, no técnica.

### 4.8 · La contraseña del administrador inicial es pública y el sembrador viene encendido

**Dónde:** tres sitios que se refuerzan entre sí.

1. `Program.cs`, línea 50: `GetValue("SecuritySeed:Enabled", true)` — **por omisión, encendido**.
2. `SecurityDataSeeder.cs`, línea 240: `configuration["BootstrapAdmin:Password"] ?? "GestIA.Local.2026!"`
   — valor de respaldo en el código compilado.
3. `.env.example`: `GESTIA_BOOTSTRAP_ADMIN_PASSWORD=GestIA.Local.2026!` — el mismo valor, en el
   archivo que se copia para arrancar.

El compose principal apaga el sembrador (`SecuritySeed__Enabled: "false"`, con un comentario que
explica bien por qué). `compose.local.yaml` lo deja en `"true"`.

El problema no es el stack de hoy: es que **el valor por omisión de las tres capas apunta al mismo
lado**. Un ambiente nuevo que no ponga explícitamente las dos variables arranca con un administrador
de contraseña conocida y publicada en el repositorio. Y a diferencia de `GESTIA_JWT_SECRET`, que
usa `:?` y detiene el arranque si falta, ésta usa `:-` y sigue.

En su favor: el sembrador es idempotente y registra una advertencia al crear el usuario.

**Qué haría:** que `SecuritySeed:Enabled` sea **`false` por omisión** y haya que encenderlo a
propósito, y que `BootstrapAdmin:Password` no tenga respaldo en el código —si el sembrador está
encendido y la variable falta, que falle el arranque, igual que el secreto del JWT—.

### 4.9 · El frontend no tiene modo estricto, y ya lo cumple

**Dónde:** `frontend/tsconfig.json`.

No están `"strict": true` ni `"strictTemplates": true`. Tampoco hay ESLint. El contraste con el
backend es grande: ahí `Directory.Build.props` pone `TreatWarningsAsErrors`, `Nullable=enable` y
`AnalysisLevel=latest-recommended`, y una advertencia rompe el build.

**Lo comprobé, y el resultado es el mejor posible:**

```
npx tsc -p tsconfig.app.json --noEmit --strict   →  0 errores
ng build con strict + strictTemplates            →  compila limpio
```

**El código ya cumple modo estricto en su totalidad.** Encenderlo hoy no rompe nada y no cuesta
ningún arreglo: son dos líneas. Lo que se gana es que siga cumpliéndolo mañana, que es justo la
lógica con la que está armado el backend.

*(Hice la prueba sobre una copia y dejé `tsconfig.json` como estaba. El árbol de trabajo está igual
que al empezar.)*

### 4.10 · La descarga entrega el nombre GUID, no el nombre original

**Dónde:** `BusinessDocumentEndpoints.cs`, línea 204, y `FileUploadEndpoints.cs`, línea 91.

El archivo se guarda como `a3f2c7b184cb41e2aabb5ae22ecf80f3.pdf` —lo cual está bien, es la defensa
contra nombres maliciosos— pero la descarga usa **ese mismo nombre** como nombre de archivo. El
usuario que subió "Contrato firmado 2026.pdf" se baja un GUID.

`FileUploadResponse` ya lleva `OriginalFileName`. Es cuestión de usarlo en la descarga.

Es menor comparado con lo demás, pero encaja con una regla que el proyecto ya tiene escrita: que al
usuario no se le muestran identificadores. Un archivo llamado con un GUID es exactamente eso.

### 4.11 · Cinco componentes de pantalla pasan de las mil líneas

| Archivo | Líneas |
|---|---|
| `operations/pages/operations-page/operations-page.ts` | 2 257 |
| `services/pages/services-page/services-page.ts` | 2 033 |
| `requests/pages/requests-page/requests-page.ts` | 1 574 |
| `workforce/pages/workforce-page/workforce-page.ts` | 1 534 |
| `clients/pages/clients-page/clients-page.ts` | 1 304 |

No es un defecto y no está roto —las cinco tienen pruebas—, pero son las pantallas que más se van a
tocar y donde más caro sale equivocarse. El patrón de extracción ya existe en el repositorio:
`clients/ui/client-zones.ts`, `client-contacts.ts`, `workforce/ui/employee-data.ts`. Está inventado;
falta aplicarlo a las cinco grandes.

Lo anoto como deuda conocida, no como algo que haya que atender ya.

---

## 5 · Deriva entre `CLAUDE.md` y el código

`CLAUDE.md` es una guía cuidadosa y en lo conceptual está al día. Los **números** se quedaron atrás,
y son justamente lo que se usa para verificar:

| Concepto | Dice | Es |
|---|---|---|
| Migraciones | 24 | **45** |
| Clases `IEntityTypeConfiguration<T>` | 36 | **43** |
| Entidades con `IOrganizationScopedEntity` | 29 | **35** |
| Features del frontend | 15 | 15 ✓ |
| Entidades con historial funcional | 5 | 5 ✓ |

Las versiones de paquetes que declara —EF Core 10.0.10, Angular ^22.1.0, TypeScript ~6.0.2, Vitest
^4.0.8, npm 11.16.0— **coinciden todas** con los `.csproj` y el `package.json`. Eso está bien.

Hay además una tabla que ya es histórica: la que dice que `db-gestia-dev` está al día "con 24
migraciones hasta `AddConcurrencyTokens`". Hoy hay 21 migraciones más, la última
`20260923011611_RenameBlockingMarkToRequired`, del día de hoy.

Y un comentario del CI habla de "121 pruebas de integración" cuando hoy son **243**. El mecanismo
que protege —fallar si alguna queda omitida— sigue siendo correcto; sólo el número envejeció.

**Sugerencia concreta:** esos conteos se pueden sacar de una prueba en vez de escribirlos a mano. Si
el número vive en `CLAUDE.md`, envejece en silencio; si vive en una aserción, avisa. Es el mismo
criterio con el que está hecho `OrganizationFilterBypassTests`.

---

## 6 · Estado del repositorio

- **Rama:** `s0/feature/gestIaProject/filtro-organizacion`
- **341 commits** en total; **321 por delante** de `v0` local.
- **34 commits sin subir a `origin`.** Es el trabajo del 22 y 23 de septiembre: geografía
  compartida, SEPOMEX, el cambio de «bloqueante» a «obligatorio», el rediseño de Clientes y la
  tanda de Personal. **Existen únicamente en esta máquina.**
- Frente a `origin/v0` hay 3 commits que esta rama no tiene, y **los tres son commits de mezcla** de
  los PR #4, #6 y #8. El `git diff` entre ambos es vacío: **no hay divergencia de contenido**, sólo
  de forma. No hay nada que reconciliar.
- Sin commitear: el resumen del 21 al 23 y cinco archivos subidos en pruebas (ver 4.7).

Los 34 commits sin subir son, con diferencia, el riesgo operativo más alto de esta lista. Un build
roto se arregla; dos días de trabajo en un solo disco, no.

---

## 7 · Qué haría, en orden

**Esta semana, barato y con efecto inmediato:**

1. Subir los 34 commits. Todo lo demás puede esperar; esto no.
2. Encender `strict` y `strictTemplates` en el frontend (4.9). Dos líneas, cero arreglos, ya
   comprobado.
3. Topar `pageSize` (4.3). Media hora, una función, seis llamadas.
4. `FixedTimeEquals` en la firma del JWT (4.5). Una línea.

**Antes de que entren datos de verdad:**

5. Sacar `storage/` del control de versiones y decidir qué hacer con lo que ya está en la
   historia (4.7). La parte técnica es sencilla; la decisión sobre el pasado es tuya.
6. Apagar `SecuritySeed` por omisión y quitar la contraseña de respaldo del código (4.8).
7. Límite de intentos en el login (4.4).
8. Acortar la vida del token o comprobar la revocación contra la base (4.6).

**Cuando la auditoría empiece a doler:**

9. Llevar filtros, orden y paginado de `AuditRepository` a SQL (4.1).
10. Arreglar la exportación recortada (4.2) — o, si se va a hacer el 9, hacerlos juntos.

**Deuda anotada, sin prisa:**

11. Nombre original en las descargas (4.10).
12. Partir las cinco pantallas grandes (4.11), aprovechando cuando haya que tocarlas.
13. Actualizar los conteos de `CLAUDE.md`, o mejor, moverlos a una prueba (sección 5).

---

## 8 · Juicio de conjunto

Es un repositorio en **buen estado**, y bastante por encima de lo habitual para su tamaño.

Lo que lo distingue no es que las pruebas pasen —eso es lo mínimo—, sino **de qué tipo son las
pruebas**. `OrganizationFilterBypassTests` no comprueba que el aislamiento funcione: comprueba que
no se pueda apagar sin que se vea. `LayerDependencyTests` lee los `.csproj`. El CI falla si alguna
prueba queda omitida, porque ya pasó que 121 se saltaran en silencio y el verde no cubriera lo que
importaba. Eso es un equipo que aprendió de sus propios sustos y convirtió cada uno en un candado.

Los hallazgos de la sección 4 caen casi todos en la misma categoría, y conviene nombrarla: **son
decisiones razonables para el tamaño de hoy que no escalan al tamaño de mañana.** La auditoría en
memoria funciona con datos de demo. El token de 8 horas funciona mientras nadie tenga que revocar un
acceso con urgencia. `storage/` en Git funciona mientras los archivos sean de prueba. Ninguna está
rota; todas tienen fecha de caducidad.

La excepción, y por eso la puse dos veces, es `storage/`. Ahí sí hay una contradicción de fondo
entre el cuidado del código —que separa documentos sensibles con un permiso propio— y lo que el
repositorio permite. Vale la pena resolverla antes de que entren expedientes reales, no después.
