# Análisis del despliegue y la publicación — 28 de septiembre de 2026

Revisión de cómo está armado hoy el despliegue de GestIA: los dos stacks de Docker, el túnel de
Cloudflare y el procedimiento con el que se publica. Todo lo que dice «comprobado» se midió en esta
sesión contra la máquina y el dominio; lo que no se pudo medir está marcado como tal.

---

## 1. Lo que conviene decidir primero

Tres cosas muerden hoy, en este orden:

1. **El mapa de las sedes no se ve en ningún ambiente publicado.** La política de seguridad del
   portal bloquea los mosaicos de OpenStreetMap. Funciona sólo con `ng serve`, que es donde no hay
   política. Es una función recién entregada que ibas a revisar en pantalla.
2. **El freno de intentos de contraseña no distingue visitantes.** Detrás de nginx la API ve
   siempre la misma dirección, así que el límite quedó reducido a «cinco por minuto por correo»;
   quien rota correos no encuentra freno.
3. **Nada vuelve solo después de un reinicio.** Ningún contenedor tiene política de reinicio: si se
   reinicia la máquina o Docker, el túnel sigue arriba y `dev.gestia-demo.com` responde error hasta
   que alguien levante los contenedores a mano.

---

## 2. El mapa de lo que hay hoy

### Los dos stacks

| | `gestia` (el del dominio) | `gestia-local` |
|---|---|---|
| Archivo | `compose.yaml` | `compose.local.yaml` |
| Portal | `localhost:4200` | `localhost:4400` |
| API | `localhost:8080` | `localhost:8081` |
| SQL Server | `localhost:1433` | `localhost:1434` |
| Base | `db-gestia-dev` | `db-gestia-local` |
| Volumen | `gestia_mssql-data` | `gestia-local_mssql-data` |
| Archivos subidos | `./storage` | `./storage-local` |
| Etiquetas de imagen | `:local` | `:localhost` |
| Usuario de la base | `gestia_app` (lectura y escritura) | `sa` |
| Siembra de seguridad | apagada | encendida |

Los dos se construyen del mismo árbol de código y comparten el `.env`. Las etiquetas distintas son
lo que permite publicar en uno sin tocar el otro.

**Comprobado:** ambas bases están al día, con **54 migraciones**, la última
`20260926223637_RemoveClientContactScope`. El repositorio tiene esas mismas 54.

### El camino de una petición

```text
navegador
   -> Cloudflare (TLS, proxy, plan gratuito)
   -> tunel con nombre «gestia-demo» (servicio de Windows «Cloudflared agent»)
   -> nginx del contenedor gestia-frontend-1   (localhost:4200)
        - archivos estaticos del portal
        - /api/*  ->  backend:8080 dentro de la red de Compose
   -> backend  ->  sqlserver:1433  ->  db-gestia-dev
```

El portal y la API comparten origen: el frontend llama a `/api/...` en relativo, así que no hay
CORS que configurar ni dirección de API incrustada en el paquete.

**Comprobado que el dominio sirve el stack `gestia` y no el local**, sin suponerlo: agoté el cupo de
intentos de un correo en `localhost:4200` y el mismo correo ya llegó frenado por el dominio, mientras
que en `localhost:4400` seguía admitiendo intentos. Comparten cubo, luego comparten backend.

### El túnel

- Servicio de Windows **Cloudflared agent**, arranque automático, corriendo.
- Orden: `cloudflared tunnel run --token-file C:\ProgramData\cloudflared\token`, versión 2026.8.2.
- Es un **túnel administrado desde el panel**: no hay `config.yml` local. Las reglas de ingreso
  —qué nombre entra a qué dirección local— viven en Cloudflare Zero Trust, no en el repositorio.
- DNS del dominio (de tus capturas): **dos registros**, los dos de tipo Tunnel y con proxy,
  `dev.gestia-demo.com` y `gestia-demo.gestia-demo.com`.

De ahí salen dos observaciones:

- **`gestia-demo.com` y `www` no llegan a ningún lado.** Es lo que avisa el propio panel. Hoy sólo
  sirve `dev.`.
- **`gestia-demo.gestia-demo.com` parece un registro escrito de más**, de cuando se tecleó el
  nombre completo en un campo que ya agrega el dominio. No estorba, pero es ruido.

### Tráfico

24 horas: 1.15k peticiones, 2 visitantes únicos. Es un ambiente de demostración, y el dimensionado
que sigue se escribe pensando en eso.

---

## 3. Cómo se publica hoy

El procedimiento vigente, tal como quedó acordado:

1. **Etiquetar la imagen que está corriendo** como `rollback-AAAAMMDD-HHMM-local` (o `-localhost`).
2. **Reconstruir** sólo el servicio que cambia: `docker compose build frontend`.
3. **Recrear** con `up -d --force-recreate --no-deps frontend`. El `--no-deps` es lo que impide que
   SQL Server se reinicie de paso.
4. **Comprobar por identificador y por el dominio**: que el paquete servido cambió, y que la frase
   nueva está en él —corriendo la misma búsqueda contra el paquete anterior para que el «sí
   aparece» valga algo.

Cuando hay cambio de esquema, antes va el respaldo `COPY_ONLY` verificado, sacado del contenedor, y
la migración ambiente por ambiente publicando cada uno en seguida.

**Lo que vale de este procedimiento:** publicar un solo servicio no toca la base, el paso 1 permite
volver atrás sin reconstruir, y el paso 4 distingue «reconstruí» de «se está sirviendo».

**Lo que no cubre:** la reconstrucción toma el **árbol de trabajo**, no un commit. Lo que se publica
es lo que hay en disco, incluido lo no commiteado. Hoy eso lo sostiene la disciplina de commitear
antes de publicar, no el procedimiento.

---

## 4. Hallazgos

### A. La política de seguridad bloquea los mosaicos del mapa · **alta**

`frontend/nginx.conf` declara `img-src 'self' data:`. El selector de mapa pide los mosaicos a
`https://tile.openstreetmap.org`, que no está en la lista.

**Comprobado en Chrome** sirviendo una página con esa misma política: la imagen permitida carga y el
mosaico queda bloqueado —`{"permitida":"carga","mosaico":"bloqueada"}`—. El control importa: si
hubiera fallado también la permitida, el resultado sólo diría que no hay red.

Consecuencia: en `dev.gestia-demo.com` y en `localhost:4400` el mapa dibuja su marco y sus
controles, sin imagen. Con `ng serve` se ve bien, porque ahí no hay política. Es exactamente el tipo
de diferencia que hace que algo «funcione en mi máquina».

**Arreglo:** agregar el origen de los mosaicos a la política, sólo para imágenes:

```nginx
img-src 'self' data: https://tile.openstreetmap.org;
```

No hace falta tocar `script-src`: Leaflet viaja dentro del paquete, no de un CDN.

### B. El freno de intentos de contraseña no distingue visitantes · **alta**

El limitador reparte por dirección y correo a la vez, y ese diseño es el correcto. Pero la dirección
que usa es la de la conexión, y detrás de nginx ésa es siempre la del contenedor del portal.
`ASPNETCORE_FORWARDEDHEADERS_ENABLED` está encendido, pero de fábrica sólo confía en proxies de
bucle local, y nginx no lo es: la cabecera `X-Forwarded-For` llega y se descarta.

**Comprobado:** el mismo correo, desde la misma máquina, cae en cubos distintos según el camino
—agotado hablando directo a la API por el 8080, seguía admitiendo intentos al entrar por nginx—.
Eso sólo puede pasar si la dirección que cuenta es la del salto anterior y no la del cliente.

Consecuencia práctica: el límite queda en cinco por minuto **por correo**. Quien prueba mil correos
distintos no encuentra freno, que es justo el caso que el diseño quería cubrir. Y al revés: dos
personas de la misma organización nunca se estorban, así que no hay daño visible que delate el
problema.

**Arreglo:** configurar las cabeceras reenviadas con la red de Docker como proxy conocido, y tomar
la dirección de `CF-Connecting-IP` cuando venga del túnel. Es código, no infraestructura.

### C. Nada vuelve solo después de un reinicio · **alta**

Los seis contenedores corren con `restart=no`. Un reinicio de Windows, o de Docker, los deja
apagados; el servicio del túnel sí arranca solo, así que el dominio queda respondiendo error de
origen hasta que alguien entre a levantarlos.

**Arreglo:** `restart: unless-stopped` en los cuatro servicios largos de cada stack —SQL Server,
backend y frontend—, dejando `database-init` como está. Con eso el reinicio se recupera solo y sigue
sin arrancarse nada que se haya detenido a propósito.

### D. Todo está abierto a la red local · **media**

Comprobado contra la dirección de la máquina en la red, no contra `localhost`: responden **4200,
8080, 4400, 8081, 1433 y 1434**. Es decir, cualquiera en la misma red llega al portal, a la API sin
pasar por nginx, y a los dos SQL Server directo —donde el del stack local admite `sa`—.

No es una exposición a internet: el túnel sólo publica lo que el panel diga. Es exposición a la red
donde esté la máquina.

**Arreglo:** publicar los puertos sólo en la interfaz local, `"127.0.0.1:1433:1433"` y así con los
demás. El túnel sigue funcionando porque entra por `localhost`. Los puertos de base de datos son los
que más urgen; los del portal puede que los quieras dejar abiertos si alguna vez muestras la demo
desde otra computadora de la casa.

### E. Las tres últimas publicaciones no dejaron etiqueta de retorno · **media**

La última etiqueta de imagen es `rollback-20260926-1730`. Las publicaciones del 26 por la noche y
las dos del 27 de madrugada —las del campo de fecha, el desplazamiento de las tablas y la ficha—
se hicieron sin etiquetar la imagen que estaba corriendo. En su lugar quedaron etiquetas de git con
ese nombre, que no son lo mismo: la etiqueta de git apunta al commit nuevo, no a la imagen vieja.

Es un desvío mío del procedimiento y lo anoto como tal. El daño es acotado: cada publicación tuvo su
commit, así que volver atrás es reconstruir desde el commit anterior en lugar de reetiquetar una
imagen. Cuesta unos minutos más, no se pierde nada.

### F. La integración continua lleva días en rojo · **media**

El trabajo de GitHub corre en esta rama y falla desde por lo menos el 26 de septiembre:

- **Backend en verde**, con sus pruebas de integración contra SQL Server.
- **Frontend en rojo: 19 pruebas.** Son las que quedaron desfasadas con los cambios de pantalla
  —el campo de fecha, los textos retirados, la franja del puesto—, no defectos del producto.
- **El trabajo de imágenes nunca llega a correr**, porque depende de los dos anteriores.

Y cuando llegue va a fallar por otra cosa: `docker compose config` pide hoy cuatro variables y el
flujo sólo define una. **Reproducido** en una carpeta limpia con sólo `GESTIA_SQL_PASSWORD`: se queja
de `GESTIA_JWT_SECRET`, `GESTIA_APP_SQL_PASSWORD` y `GESTIA_BOOTSTRAP_ADMIN_PASSWORD`. El fallo
estaba escondido detrás del rojo del frontend.

**Arreglo:** poner al día las 19 pruebas cuando lo pidas, y agregar las tres variables de relleno al
flujo. Son dos líneas en el archivo de CI.

### G. Los archivos subidos no entran en ningún respaldo · **media**

Los respaldos son de la base. Los archivos de los expedientes viven en `./storage` —hoy 30 archivos,
1.6 MB— montado en el contenedor. La base guarda la ficha del documento; el contenido está en esa
carpeta. Restaurar un `.bak` sin ella deja expedientes que dicen tener un archivo que no se puede
abrir.

**Arreglo:** copiar `storage/` junto al `.bak` cada vez que se respalda. Es una carpeta pequeña.

### H. No hay respaldo automático · **media**

Todos los respaldos son manuales y atados a una migración: el último es del 26 de septiembre, antes
de quitar el alcance del contacto. No hay ninguna tarea programada que respalde por calendario.

Mientras la base sólo tenga datos de prueba, es una decisión defendible. Deja de serlo el día que
alguien capture algo que no se pueda volver a capturar.

**Arreglo cuando lo decidas:** una tarea diaria que haga `COPY_ONLY` con verificación y conserve los
últimos siete días.

### I. La configuración del túnel no está en el repositorio · **baja**

El túnel usa un token, así que sus reglas de ingreso viven en el panel de Cloudflare. Si se pierde
esta máquina, el repositorio no dice a qué dirección local entraba cada nombre: hay que reconstruirlo
de memoria o del panel.

**Arreglo:** un documento corto en `docs/deployment/` con los nombres publicados, a qué puerto local
entra cada uno y dónde está el token. Sin el token, claro.

### J. El disco de Docker crece sin límite · **baja**

231 imágenes y 4.68 GB, de las cuales **220 son etiquetas de retorno**; más **14.64 GB de caché de
construcción**. Son casi 20 GB para un proyecto de dos contenedores.

**Arreglo:** conservar las etiquetas de retorno de las últimas dos semanas y borrar el resto, y
limpiar la caché de construcción de vez en cuando. Ninguna de las dos cosas toca datos.

### K. El stack local se conecta como `sa` · **informativo**

Deliberado y documentado: el del dominio usa `gestia_app` con lectura y escritura, que es lo que
pide el ADR, y el local usa `sa` porque siembra su propia seguridad al arrancar. Vale la pena tenerlo
presente al leer un error: el mismo código tiene permisos distintos en cada ambiente, así que un
fallo de permisos puede aparecer sólo en el del dominio.

---

## 5. Lo que está bien y no hay que tocar

- **Dos stacks de verdad aislados**: nombre de proyecto, puertos, volumen, base y etiqueta de imagen
  distintos. Es lo que permite romper cosas sin que se vean fuera.
- **La API no crea ni migra la base al arrancar.** Las migraciones son un paso a mano, con respaldo
  verificado antes.
- **El backend del dominio no usa `sa`**, y la siembra de seguridad está apagada ahí.
- **Imágenes chicas y sin privilegios**: nginx no privilegiado, backend sobre Alpine con usuario
  propio, y comprobaciones de salud en los dos.
- **Origen único para portal y API**, que quita de en medio toda una familia de problemas de CORS y
  de direcciones incrustadas.
- **El túnel no abre puertos en el router.** La máquina no tiene nada publicado hacia internet salvo
  lo que el túnel entrega.
- **Los respaldos que hay están bien hechos**: `COPY_ONLY`, verificados y fuera del contenedor.

---

## 6. Qué haría yo, en orden

| | Qué | Por qué ahora | Tamaño |
|---|---|---|---|
| 1 | Permitir los mosaicos en la política | El mapa no se ve en ningún ambiente publicado | una línea |
| 2 | `restart: unless-stopped` | Un reinicio deja la demo caída | seis líneas |
| 3 | Cerrar 1433 y 1434 a `127.0.0.1` | Dos motores de base abiertos a la red | dos líneas |
| 4 | Arreglar la dirección real del visitante | El freno de contraseñas no frena lo que debía | código |
| 5 | Poner al día las 19 pruebas y las variables del CI | Recuperar el semáforo | medio día |
| 6 | Sumar `storage/` a los respaldos | Un restore hoy deja expedientes sin archivo | el guion de respaldo |
| 7 | Limpiar imágenes y caché | 20 GB | un rato |
| 8 | Anotar el túnel y limpiar el registro de más | Que no viva sólo en el panel | un documento |

## 7. Lo que necesito que decidas

1. **Los cuatro primeros, ¿los hago ya?** Son cambios chicos y los tres primeros no tocan código de
   negocio. El cuarto sí y prefiero avisarte antes.
2. **Las pruebas.** Siguen en rojo porque pediste no tocarlas. Dime cuándo las pongo al día.
3. **`gestia-demo.com` y `www`.** ¿Los quieres sirviendo lo mismo que `dev.`, o apuntando a una
   página de presentación? Hoy no llegan a ningún lado.
4. **Respaldo automático.** ¿Lo dejamos manual mientras los datos sean de prueba, o programamos uno
   diario desde ya?
