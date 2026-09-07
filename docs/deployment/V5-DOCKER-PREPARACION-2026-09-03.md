# V5: preparacion Docker y bloqueo de acceso SQL

Fecha: 2026-09-03.

## Estado actualizado: publicado

El usuario autorizo explicitamente leer la credencial SA de las variables de gestia-sqlserver-1.
Las restricciones descritas mas abajo son el registro historico, ya superado en este corte.

- OperationalConcurrencyTests: 15 aprobadas, 0 fallidas, 0 omitidas. La base temporal se elimino;
  consulta posterior confirma 0 bases GestIA_OperationalTests_* restantes.
- Resultado: C:/Users/danie/Desktop/BKT/GestIA/Prototipo/qa-results/sql-puntos-1-3/operational-sql.trx.
- Respaldo COPY_ONLY, COMPRESSION, CHECKSUM creado y comprobado con RESTORE VERIFYONLY:
  /var/opt/mssql/data/db-gestia-dev-before-document-snapshots-20260903-142738-8d3a105f.bak.
- Migracion 20260903194105_DocumentAuditSnapshots aplicada en db-gestia-dev.
- BeforeSnapshot y AfterSnapshot verificados como nvarchar(max) nullable. La tabla de eventos
  tenia 0 registros antes y despues; no se inventaron eventos historicos.
- Backend y frontend recreados con `docker compose -p gestia -f compose.yaml up -d --no-deps --wait`.
- Ambos contenedores saludables con las imagenes nuevas indicadas abajo. SQL, pruebas y tunel intactos.
- Seed verificado en SQL: ADMINISTRATOR y ORGANIZATION_ADMIN tienen DOCUMENTS.SENSITIVE.READ/WRITE;
  los roles operativos no recibieron estos permisos.
- localhost:8080/health/ready, localhost:4200/healthz y /api/v1/system/info devuelven 200.
- dev.gestia-demo.com/api/v1/system/info devuelve 200.
- localhost y dev sirven main-XZ4LICBZ.js (323523 bytes) y styles-5H5NUO6U.css (14555 bytes), ambos 200.
- No se imprimio ni guardo la credencial. Las sesiones existentes necesitan nuevo login para renovar claims.
- El intento de etiquetar imagenes anteriores fallo porque Docker ya no resolvia sus IDs antiguos;
  no se crearon etiquetas de rollback. El respaldo SQL validado permanece disponible.

Pendiente de aceptacion: recorridos completos de escritura con cuentas reales Admin/Super Admin,
provisionamiento por migraciones desde cero y las diferencias funcionales de la maqueta indicadas al final.
Las pruebas SQL crean su esquema con EnsureCreated, no validan toda la cadena de migraciones desde cero.

## Ejecutado

- `docker compose -p gestia -f compose.yaml build backend frontend`: correcto.
- Imagen backend nueva: sha256:69d4c62a0f8310633072369021aafe7f0e42727c8e59f2ebfa37b7406d450983.
- Imagen frontend nueva: sha256:8085a0eb2c2f1628f6f0c0f11f19cf245f2b9793639b3cf3feb66fa545014be3.
- El frontend compilado contiene main-XZ4LICBZ.js y styles-5H5NUO6U.css.
- Script EF idempotente generado desde SupportTimestampPrecision hasta DocumentAuditSnapshots,
  usando Infrastructure como proyecto de inicio y su factoria de diseno. Sin conexion a SQL.
- Script: C:/Users/danie/Desktop/BKT/GestIA/Prototipo/tmp/document-audit-snapshots.sql.
- Script revisado: agrega dos columnas nullable a BusinessDocumentEvents y registra la migracion en
  una transaccion. No elimina datos ni tablas.

## No ejecutado

- Las 15 pruebas SQL no se iniciaron.
- No se creo una base temporal, no se ejecuto respaldo ni se aplico migracion.
- No se reemplazaron backend/frontend; los contenedores anteriores siguen saludables.
- No se modifico gestia-pruebas, SQL Server ni el tunel Cloudflare.

La herramienta rechazo leer MSSQL_SA_PASSWORD desde las variables de gestia-sqlserver-1.
Considero insuficiente la autorizacion general de completar pruebas, respaldo y despliegue, y exige
autorizacion explicita de esa fuente y del uso de la cuenta SA. Se pidio al usuario. No se intento
obtener la credencial de otra fuente ni ejecutar la accion por una via alternativa.

## Secuencia al autorizar

1. Usar la credencial solo en memoria, sin imprimirla ni almacenarla en archivos.
2. Ejecutar OperationalConcurrencyTests con base temporal GUID; la fixture comprueba el nombre antes
   de eliminarla. Corregir cualquier fallo y repetir antes de publicar.
3. Revisar migraciones aplicadas y confirmar la base del ambiente principal.
4. Crear respaldo con nombre unico y verificar su integridad antes de aplicar el script.
5. Aplicar la migracion y verificar columnas e historial.
6. Recrear exclusivamente backend/frontend de gestia, sin recrear SQL ni borrar volumenes.
7. Confirmar health, permisos nuevos, assets del frontend y registro de imagenes desplegadas.

## Alcance real de la maqueta

No se declara implementada al 100%. La comparacion de PANTALLAS-Y-ACCIONES.md con el producto confirma:

- Auditoria general aun usa "Valor anterior no enviado por la API" para modificaciones. Los snapshots
  documentales no equivalen a historial completo antes/despues de todos los modulos.
- Siguen pendientes validacion de flujos reales por rol y provisionamiento desde una base vacia.
- La pantalla Clientes GestIA no se migro deliberadamente: el usuario pidio unificarla con Organizaciones.
- El acceso operativo global sin soporte descrito en la maqueta no se habilito deliberadamente;
  se conserva la restriccion de soporte autorizado por organizacion.

La compilacion de imagenes no equivale a publicacion ni a validacion funcional completa.
