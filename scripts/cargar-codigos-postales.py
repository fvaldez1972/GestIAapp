#!/usr/bin/env python3
"""Carga el padron de codigos postales y colonias de SEPOMEX en GeoPostalCodes.

QUE HACE
--------
Lee el archivo de SEPOMEX de una copia guardada FUERA del repositorio, lo cruza con
GeoMunicipalities por la clave del INEGI y escribe lo que falte en GeoPostalCodes. Es idempotente:
correrlo dos veces no duplica nada, porque solo inserta las filas que no estan.

POR QUE LEE DE UNA COPIA Y NO DE INTERNET
-----------------------------------------
El archivo no esta en Git, y eso es a proposito: trae un aviso que prohibe "su comercializacion,
total o parcial, ni su distribucion a terceros bajo ningun concepto". Pero tampoco se baja en cada
despliegue: una fuente externa viva es una dependencia que nadie del equipo controla, y si el sitio
de Correos de Mexico se cae o cambia el formato, se caeria el despliegue.

La copia y su procedencia viven en C:\\Users\\danie\\Backups\\gestia\\fuentes\\. Este guion EXIGE
que el archivo de procedencia este al lado y que el SHA-256 que declara coincida con el archivo:
sin eso no carga nada. Un archivo cambiado en silencio es justo lo que no se quiere descubrir
despues, con las colonias ya escritas.

DONDE SE PUEDE CARGAR
---------------------
Solo en db-gestia-dev, que es desarrollo, y por eso es el valor por omision. Cargarlo en un
ambiente que use un cliente de pago depende de una pregunta que no es tecnica --si mostrar este
catalogo dentro de un producto que se vende cuenta como "comercializacion" en el sentido del
aviso-- y esa la resuelve BKT, no el equipo tecnico. Por eso apuntar a otra base exige --si-se-que-
no-es-dev y deja constancia en la salida.

COMO SE USA
-----------
    python scripts/cargar-codigos-postales.py                      # db-gestia-dev, puerto 1433
    python scripts/cargar-codigos-postales.py --solo-medir         # no escribe nada
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
import uuid

# El mismo espacio de nombres que uso la migracion 20260922131723_SharedGeographyTables. Los
# identificadores son deterministas para que el mismo codigo postal tenga el mismo identificador en
# cualquier ambiente y dos bases se puedan comparar fila a fila.
ESPACIO = uuid.UUID("7b3a0e2c-6f1d-4d5a-9c2b-0a1f3e5d7c90")

FUENTE_POR_OMISION = r"C:\Users\danie\Backups\gestia\fuentes\sepomex-cpdescarga-20260922.txt"
BASE_POR_OMISION = "db-gestia-dev"
CONTENEDOR_POR_OMISION = "gestia-sqlserver-1"

# Los limites de las columnas, de GeoPostalCodeConfiguration. Se recortan aqui y no en la base para
# que un nombre largo no tumbe la carga entera a la mitad.
LARGO_COLONIA = 180
LARGO_TIPO = 60


def procedencia(ruta_fuente: str) -> dict[str, str]:
    """El archivo de procedencia que tiene que estar al lado, y lo que declara."""
    ruta = os.path.splitext(ruta_fuente)[0] + ".PROCEDENCIA.txt"
    if not os.path.exists(ruta):
        raise SystemExit(
            f"Falta el archivo de procedencia: {ruta}\n"
            "Sin el no se carga: un catalogo externo sin origen, fecha ni aviso de uso anotados es\n"
            "exactamente lo que no queremos dentro de la base."
        )

    texto = io.open(ruta, encoding="utf-8").read()
    declarado = re.search(r"SHA-256\s+([0-9a-f]{64})", texto)
    if not declarado:
        raise SystemExit(f"El archivo de procedencia no declara un SHA-256: {ruta}")

    real = hashlib.sha256(open(ruta_fuente, "rb").read()).hexdigest()
    if real != declarado.group(1):
        raise SystemExit(
            "El archivo no es el que dice la procedencia.\n"
            f"  declarado: {declarado.group(1)}\n"
            f"  real:      {real}\n"
            "Si el archivo se actualizo a proposito, actualiza tambien su procedencia."
        )

    return {"ruta": ruta, "sha256": real}


def plegar(valor: str) -> str:
    """Sin acentos, sin espacios de sobra y en mayusculas: solo para construir la clave estable."""
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFD", valor) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", sin_acentos).strip().upper()


def limpiar(valor: str, largo: int) -> str:
    """Un solo renglon, sin tabuladores: el archivo intermedio los usa de separador."""
    return re.sub(r"[\t\r\n]+", " ", valor).strip()[:largo]


def leer(ruta_fuente: str) -> tuple[list[tuple[str, str, str, str]], dict[str, int]]:
    texto = io.open(ruta_fuente, encoding="cp1252").read()
    renglones = texto.splitlines()

    # Renglon 1: el aviso de uso. Renglon 2: el encabezado. De ahi para abajo, datos.
    columnas = {nombre: i for i, nombre in enumerate(renglones[1].split("|"))}
    faltantes = [c for c in ("d_codigo", "d_asenta", "d_tipo_asenta", "c_estado", "c_mnpio")
                 if c not in columnas]
    if faltantes:
        raise SystemExit(
            f"El archivo no trae las columnas {faltantes}. Cambio el formato de SEPOMEX; "
            "hay que revisar el guion antes de cargar nada."
        )

    vistas: set[tuple[str, str, str]] = set()
    filas: list[tuple[str, str, str, str]] = []
    conteo = {"renglones": 0, "repetidas": 0, "sin_codigo": 0}

    for renglon in renglones[2:]:
        campos = renglon.split("|")
        if len(campos) <= columnas["c_mnpio"]:
            continue

        conteo["renglones"] += 1

        cp = campos[columnas["d_codigo"]].strip()
        colonia = limpiar(campos[columnas["d_asenta"]], LARGO_COLONIA)
        tipo = limpiar(campos[columnas["d_tipo_asenta"]], LARGO_TIPO)
        municipio = (campos[columnas["c_estado"]].strip().zfill(2)
                     + campos[columnas["c_mnpio"]].strip().zfill(3))

        if len(cp) != 5 or not cp.isdigit() or not colonia:
            conteo["sin_codigo"] += 1
            continue

        # La fila del modelo es municipio + codigo postal + colonia, y esos tres juntos son lo unico
        # que no puede repetirse: un CP tiene varias colonias y una colonia se repite entre
        # municipios. SEPOMEX trae la misma terna mas de una vez cuando cambia algun campo que aqui
        # no se guarda, asi que se pliega para comparar.
        clave = (municipio, cp, plegar(colonia))
        if clave in vistas:
            conteo["repetidas"] += 1
            continue

        vistas.add(clave)
        identificador = str(uuid.uuid5(ESPACIO, f"GEO:P:MX:{municipio}:{cp}:{plegar(colonia)}")).upper()
        filas.append((identificador, municipio, cp, colonia, tipo))

    return filas, conteo


def sqlcmd(contenedor: str, base: str, clave: str, consulta: str) -> str:
    entorno = dict(os.environ, MSYS_NO_PATHCONV="1")
    salida = subprocess.run(
        ["docker", "exec", "-i", contenedor, "/opt/mssql-tools18/bin/sqlcmd",
         "-S", "localhost", "-U", "sa", "-P", clave, "-C", "-d", base, "-b", "-h", "-1", "-W",
         "-Q", consulta],
        capture_output=True, text=True, env=entorno, encoding="utf-8", errors="replace")
    if salida.returncode != 0:
        raise SystemExit(f"sqlcmd fallo:\n{salida.stdout}\n{salida.stderr}")
    return salida.stdout


def clave_sql() -> str:
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for renglon in io.open(os.path.join(raiz, ".env"), encoding="utf-8"):
        if renglon.startswith("GESTIA_SQL_PASSWORD="):
            return renglon.split("=", 1)[1].strip()
    raise SystemExit("No encontre GESTIA_SQL_PASSWORD en .env")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fuente", default=FUENTE_POR_OMISION)
    parser.add_argument("--base", default=BASE_POR_OMISION)
    parser.add_argument("--contenedor", default=CONTENEDOR_POR_OMISION)
    parser.add_argument("--solo-medir", action="store_true",
                        help="Lee y reporta, pero no escribe nada en la base.")
    parser.add_argument("--si-se-que-no-es-dev", action="store_true",
                        help="Exigido para apuntar a una base que no sea db-gestia-dev.")
    args = parser.parse_args()

    if args.base != BASE_POR_OMISION and not args.si_se_que_no_es_dev:
        raise SystemExit(
            f"Te estas apuntando a {args.base}, que no es {BASE_POR_OMISION}.\n"
            "Este catalogo solo esta autorizado en desarrollo mientras BKT no resuelva si mostrarlo\n"
            "dentro de un producto que se vende cuenta como comercializacion. Si ya se resolvio,\n"
            "vuelve a correrlo con --si-se-que-no-es-dev."
        )

    origen = procedencia(args.fuente)
    print(f"Fuente      {args.fuente}")
    print(f"Procedencia {origen['ruta']}")
    print(f"SHA-256     {origen['sha256']} (coincide con lo declarado)")

    filas, conteo = leer(args.fuente)
    print(f"\nRenglones leidos          {conteo['renglones']:>8}")
    print(f"  descartados sin CP      {conteo['sin_codigo']:>8}")
    print(f"  repetidos en el origen  {conteo['repetidas']:>8}")
    print(f"  filas a cargar          {len(filas):>8}")
    print(f"  codigos postales        {len({f[2] for f in filas}):>8}")
    print(f"  municipios              {len({f[1] for f in filas}):>8}")

    if args.solo_medir:
        print("\n--solo-medir: no se escribio nada.")
        return 0

    clave = clave_sql()

    antes = int(sqlcmd(args.contenedor, args.base, clave,
                       "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.GeoPostalCodes;").strip())

    with tempfile.TemporaryDirectory() as carpeta:
        local = os.path.join(carpeta, "codigos-postales.tsv")
        # UTF-16 CON marca de orden, no UTF-8. Dos cosas obligan a esto, y las dos costaron un
        # intento: en SQL Server para Linux la opcion CODEPAGE de BULK INSERT no existe --"Keyword
        # or statement option 'CODEPAGE' is not supported on the 'Linux' platform"--, asi que para
        # los acentos hay que usar widechar; y widechar sin marca de orden al principio del archivo
        # se ignora en silencio --"DataFileType will be assumed to be char because the data file
        # does not have a Unicode signature"-- y entonces falla renglon por renglon.
        with io.open(local, "w", encoding="utf-16", newline="\n") as salida:
            for fila in filas:
                salida.write("\t".join(fila) + "\n")

        dentro = "/var/opt/mssql/codigos-postales.tsv"
        entorno = dict(os.environ, MSYS_NO_PATHCONV="1")
        subprocess.run(["docker", "cp", local, f"{args.contenedor}:{dentro}"],
                       check=True, env=entorno)
        # docker cp deja el archivo como root y el servidor corre como mssql. El chmod va como root
        # y sin check: en la mayoria de las imagenes el archivo ya nace legible, y si no lo fuera,
        # quien lo dice de verdad es el BULK INSERT de abajo, con un error que se entiende.
        subprocess.run(["docker", "exec", "-u", "root", args.contenedor, "chmod", "644", dentro],
                       capture_output=True, env=entorno)

        # Todo en una sola invocacion para que la tabla temporal siga viva entre sentencias. El
        # cruce contra GeoMunicipalities es por la clave del INEGI, que cubre el 100% del archivo:
        # lo comprobe antes de escribir esto, no hay un solo renglon sin municipio.
        consulta = f"""
            SET NOCOUNT ON;
            CREATE TABLE #cp (
                IdGeoPostalCode uniqueidentifier NOT NULL,
                CodeMunicipality varchar(5) NOT NULL,
                PostalCode varchar(5) NOT NULL,
                Neighborhood nvarchar(180) NOT NULL,
                SettlementType nvarchar(60) NULL);

            BULK INSERT #cp FROM '{dentro}'
            WITH (DATAFILETYPE='widechar', FIELDTERMINATOR='\\t', ROWTERMINATOR='\\n', TABLOCK);

            SELECT 'leidas', COUNT(*) FROM #cp;
            SELECT 'sin municipio', COUNT(*) FROM #cp c
                WHERE NOT EXISTS (SELECT 1 FROM dbo.GeoMunicipalities m WHERE m.Code = c.CodeMunicipality);

            INSERT INTO dbo.GeoPostalCodes
                (IdGeoPostalCode, IdGeoMunicipality, PostalCode, Neighborhood, SettlementType, Active)
            SELECT c.IdGeoPostalCode, m.IdGeoMunicipality, c.PostalCode, c.Neighborhood,
                   NULLIF(c.SettlementType, ''), 1
            FROM #cp c
            INNER JOIN dbo.GeoMunicipalities m ON m.Code = c.CodeMunicipality
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.GeoPostalCodes p
                WHERE p.IdGeoMunicipality = m.IdGeoMunicipality
                  AND p.PostalCode = c.PostalCode
                  AND p.Neighborhood = c.Neighborhood);

            SELECT 'insertadas', @@ROWCOUNT;
            DROP TABLE #cp;
        """
        print("\n" + sqlcmd(args.contenedor, args.base, clave, consulta).strip())
        subprocess.run(["docker", "exec", args.contenedor, "rm", "-f", dentro],
                       check=True, env=entorno)

    despues = int(sqlcmd(args.contenedor, args.base, clave,
                         "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.GeoPostalCodes;").strip())
    print(f"\nGeoPostalCodes antes {antes} -> despues {despues}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
