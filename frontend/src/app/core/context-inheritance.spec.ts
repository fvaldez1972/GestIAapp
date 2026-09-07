import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Las tres reglas transversales del contexto y de la fecha.
 *
 * <p>No prueban una pantalla: prueban que <b>ninguna</b> vuelva a hacer lo que se acaba de quitar.
 * Una regla que sólo vive en un acuerdo se pierde a la tercera pantalla nueva; ésta falla en la
 * primera.</p>
 *
 * <p>Las excepciones se nombran aquí, con su motivo escrito al lado. Agregar una obliga a
 * justificarla en este archivo, que es exactamente lo que se busca.</p>
 *
 * <p><b>Comprobadas por mutación.</b> Cada regla se verificó reintroduciendo a mano el defecto que
 * prohíbe —la copia de la organización, el método con lista, un selector nativo, el día desde UTC,
 * el huso escrito a mano, el reloj del navegador formateado— y confirmando que la prueba falla
 * nombrando el archivo. Una prueba de este tipo que no se comprueba así es una prueba que pasa
 * siempre.</p>
 */

const FEATURES = resolve('src/app/features');

function archivos(extension: string, directorio = FEATURES): readonly string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);

    if (statSync(ruta).isDirectory()) {
      return archivos(extension, ruta);
    }

    return ruta.endsWith(extension) && !ruta.endsWith('.spec.ts') ? [ruta] : [];
  });
}

const relativo = (ruta: string) => ruta.slice(resolve('src/app/features/').length + 1).replace(/\\/g, '/');

const conTexto = (extension: string) =>
  archivos(extension).map((ruta) => ({ ruta: relativo(ruta), texto: readFileSync(ruta, 'utf8') }));

describe('El contexto de organización vive en un solo sitio', () => {
  /**
   * La deriva original: diez pantallas guardaban su propia copia de la organización y la llenaban
   * cada una a su manera. Con la copia fuera, la única forma de saber en qué organización se está
   * es preguntárselo a `AuthService`, que es quien escucha a la barra de contexto.
   */
  it('ninguna pantalla declara su propia señal de organización', () => {
    const culpables = conTexto('.ts')
      .filter(({ texto }) => /selectedOrganizationId\s*=\s*signal\s*\(/.test(texto))
      .map(({ ruta }) => ruta);

    expect(culpables, 'Debe heredarse de auth.operationalOrganizationId').toEqual([]);
  });

  /**
   * El método viejo recibía la lista de organizaciones de cada pantalla y, si la activa no estaba
   * en ella, caía en silencio a la primera. Se borró; esta prueba impide que vuelva por copiar y
   * pegar desde una rama vieja.
   */
  it('nadie resuelve la organización pasando una lista', () => {
    const culpables = conTexto('.ts')
      .filter(({ texto }) => texto.includes('resolveOperationalOrganizationId'))
      .map(({ ruta }) => ruta);

    expect(culpables).toEqual([]);
  });

  /**
   * La organización no se elige con un control nativo en ninguna parte de la aplicación: se elige
   * en la barra de contexto, que usa `GiSelect`.
   *
   * <p><b>Las dos excepciones no son contexto de trabajo.</b> La pantalla de Seguridad administra
   * usuarios <i>de varias organizaciones a la vez</i>: uno de sus desplegables filtra ese listado
   * y el otro captura a qué organización pertenece el usuario que se está dando de alta. Los dos
   * son datos, no el alcance desde el que se opera. Siguen siendo nativos y quedan para la tanda
   * de controles, junto con los otros ciento y pico de la aplicación.</p>
   */
  it('ningún selector nativo elige la organización de trabajo', () => {
    const EXCEPCIONES = new Set(['security/pages/security-page/security-page.html']);

    const culpables = conTexto('.html')
      .filter(({ ruta }) => !EXCEPCIONES.has(ruta))
      .flatMap(({ ruta, texto }) =>
        [...texto.matchAll(/<select\b/g)]
          // Un desplegable es de organización si el marcado que lo introduce lo dice.
          .filter((coincidencia) =>
            /organizaci[óo]n/i.test(texto.slice(Math.max(0, coincidencia.index - 220), coincidencia.index)))
          .map(() => ruta),
      );

    expect([...new Set(culpables)]).toEqual([]);
  });

  it('las dos excepciones de Seguridad siguen existiendo, para que la lista no se quede vieja', () => {
    const seguridad = readFileSync(
      resolve('src/app/features/security/pages/security-page/security-page.html'), 'utf8');

    expect(seguridad).toContain('<select');
  });
});

describe('El día operativo lo dice el servidor', () => {
  /**
   * <b>La regresión del defecto que F3 cerró en el servidor y que seguía vivo en el frontend.</b>
   *
   * <p>`toISOString()` devuelve el instante en UTC, así que `.slice(0, 10)` da el <i>día UTC</i>.
   * A las 19:00 hora de Ciudad de México del 4 de septiembre eso es el 5: cada tarde, de las 18:00
   * en adelante, diez pantallas proponían el día siguiente en sus filtros y sus formularios.</p>
   *
   * <p>El día correcto llega de `/api/v1/system/info`, que lo calcula con el huso operativo. Esta
   * prueba existe para que nadie lo vuelva a calcular en el navegador, que es la única forma de
   * que el defecto regrese.</p>
   */
  it('ninguna pantalla calcula el día desde UTC', () => {
    const culpables = conTexto('.ts')
      .filter(({ texto }) => texto.includes('toISOString().slice(0, 10)'))
      .map(({ ruta }) => ruta);

    expect(culpables, 'Usa systemInfo.operationDate()').toEqual([]);
  });

  /**
   * La otra manera de calcularlo mal: acertar con el día pero con el huso escrito a mano en el
   * navegador. Acierta hoy y deja de acertar el día que el huso operativo se configure distinto,
   * sin que nadie toque este código ni se entere.
   */
  it('ninguna pantalla lleva el huso operativo escrito a mano ni toma el del navegador', () => {
    // Ojo con lo que **no** se busca: `timeZoneId:` a secas es un dato de la sede del cliente,
    // que sí tiene huso propio. Lo que no puede haber es el huso **operativo** decidido aquí.
    const culpables = [...conTexto('.ts'), ...conTexto('.html')]
      .filter(({ texto }) =>
        /timeZone:\s*['\`]America\//.test(texto) || texto.includes('resolvedOptions().timeZone'))
      .map(({ ruta }) => ruta);

    expect(culpables, 'Usa systemInfo.timeZoneId()').toEqual([]);
  });

  /**
   * Y la tercera: formatear "hoy" desde el reloj del navegador para mostrarlo. Da el día del
   * usuario, no el de la operación, y son distintos durante seis horas de cada día.
   */
  it('ninguna pantalla formatea el reloj del navegador como si fuera el día operativo', () => {
    const culpables = conTexto('.ts')
      .filter(({ texto }) => /DateTimeFormat\([\s\S]{0,200}?\)\.format\(new Date\(\)\)/.test(texto))
      .map(({ ruta }) => ruta);

    expect(culpables, 'Usa formatOperationalDate(systemInfo.operationDate())').toEqual([]);
  });

  /**
   * Un solo formato de fecha en toda la aplicación. `DatePipe` no lo produce: sin `LOCALE_ID`
   * escribe en inglés y con `es-MX` escribe `4 sept 2026`, día sin cero y mes de cuatro letras.
   *
   * <p>Es la más floja de las siete, y a propósito: volver a usar `| date:` rompe la compilación
   * con «No pipe found with name 'date'», y declararlo en `imports` sin importarlo rompe con
   * «Cannot find name». El compilador llega antes que esta prueba en los dos casos; ésta cubre el
   * tercero, el de quien importa el pipe completo y lo declara bien.</p>
   */
  it('ninguna pantalla usa DatePipe', () => {
    const culpables = [...conTexto('.ts'), ...conTexto('.html')]
      // Se busca el uso, no la palabra: este archivo y algún comentario la nombran para explicar
      // por qué no se usa.
      .filter(({ texto }) =>
        /imports:\s*\[[^\]]*DatePipe/.test(texto) ||
        /import\s*\{[^}]*DatePipe[^}]*\}\s*from\s*'@angular\/common'/.test(texto) ||
        /\|\s*date\s*[:}]/.test(texto))
      .map(({ ruta }) => ruta);

    expect(culpables, 'Usa formatOperationalDate o formatOperationalInstant').toEqual([]);
  });
});
