#!/usr/bin/env bash
#
# Corre las pruebas de integración contra un SQL Server efímero.
#
# Las pruebas de integración necesitan un SQL Server con permiso de CREATE DATABASE: cada clase
# crea su propia base temporal y la borra al terminar.
#
# Este guion levanta uno **sólo para la corrida** y lo desecha después. Sin volumen, así que no
# deja nada en disco, y en un puerto distinto del que usa el stack que sirve el dominio.
#
# La razón de que exista, y conviene no perderla: la regla del proyecto es que las pruebas nunca
# compartan instancia con la base de trabajo. Desde el 6 de septiembre de 2026 esa base es
# `db-gestia-dev`, que sirve dev.gestia-demo.com. Un error del molde de pruebas ocurriendo en el
# mismo motor sería un problema en producción, no en pruebas.
#
# Uso:
#   ./pruebas-integracion.sh
#   ./pruebas-integracion.sh --filter "FullyQualifiedName~DemoSeeder"
#   PUERTO=1436 ./pruebas-integracion.sh
#
set -euo pipefail

PUERTO="${PUERTO:-1435}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTENEDOR="gestia-pruebas-efimero-$(date +%s)"
CLAVE="Efimero.$(date +%s).2026!"

FILTRO=""
if [ "${1:-}" = "--filter" ] && [ -n "${2:-}" ]; then
  FILTRO="$2"
fi

limpiar() {
  echo
  echo "== Limpieza =="
  docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
  echo "  contenedor $CONTENEDOR retirado"
}
trap limpiar EXIT

echo
echo "== SQL Server efimero en el puerto $PUERTO =="

# CLAVE_SQL viaja al contenedor para que la comprobación de abajo no lleve la contraseña
# incrustada en la línea de comando.
docker run -d --rm \
  --name "$CONTENEDOR" \
  -e ACCEPT_EULA=Y \
  -e MSSQL_PID=Developer \
  -e "MSSQL_SA_PASSWORD=$CLAVE" \
  -e "CLAVE_SQL=$CLAVE" \
  -p "${PUERTO}:1433" \
  mcr.microsoft.com/mssql/server:2025-latest >/dev/null

echo "  contenedor $CONTENEDOR levantado"

# SQL Server tarda entre 20 y 40 segundos en aceptar conexiones.
#
# MSYS_NO_PATHCONV apaga la conversión de rutas de Git Bash. Sin ella el /opt/... del argumento
# llega al contenedor convertido en C:/Program Files/Git/opt/..., y el error que sale no menciona
# la conversión, así que cuesta reconocerlo. En Linux y macOS la variable no existe y no estorba.
LISTO=0
for INTENTO in $(seq 1 60); do
  sleep 2
  if MSYS_NO_PATHCONV=1 docker exec "$CONTENEDOR" bash -lc \
       '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$CLAVE_SQL" -C -b -Q "SELECT 1"' \
       >/dev/null 2>&1; then
    LISTO=1
    echo "  acepta conexiones tras $((INTENTO * 2)) s"
    break
  fi
done

if [ "$LISTO" -ne 1 ]; then
  echo "  El SQL Server efimero no acepto conexiones. Revisa que Docker este corriendo." >&2
  exit 1
fi

echo
echo "== Pruebas =="

# La variable sólo vive en este proceso: no queda apuntando a nada cuando el guion termina.
export GESTIA_OPERATIONAL_TEST_SQLSERVER="Server=localhost,${PUERTO};Database=master;User Id=sa;Password=${CLAVE};Encrypt=True;TrustServerCertificate=True"

if [ -n "$FILTRO" ]; then
  dotnet test "$RAIZ/GestIA.sln" --nologo --filter "$FILTRO"
else
  dotnet test "$RAIZ/GestIA.sln" --nologo
fi
