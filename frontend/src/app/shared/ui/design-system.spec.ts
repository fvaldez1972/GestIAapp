import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Las reglas del sistema cerrado, aplicadas a los componentes compartidos **y a las pantallas ya
 * rehechas**.
 *
 * <p>El documento dice que estas decisiones «ya no se discuten en cada pantalla: se aplican». Una
 * regla que sólo vive en un documento se discute igual, porque nadie lo relee al escribir el
 * componente número ocho. Estas fallan.</p>
 *
 * <p>La excepción se nombra aquí con su motivo. Agregar otra obliga a justificarla en este
 * archivo, que es exactamente lo que se busca.</p>
 */

/**
 * Hasta dónde llega la regla.
 *
 * <p>`shared/ui` son las piezas del sistema. Junto a ellas van **las pantallas ya rehechas**, una
 * a una: el sistema no sirve de nada si la pantalla que lo usa se inventa un color al lado.</p>
 *
 * <p>El resto de las features **queda fuera a propósito, y hoy fallarían**: hay hex a mano en
 * catorce hojas de estilo y tamaños fuera de la escala. Convertirlas es su propia tanda. Esta
 * lista crece con cada pantalla que se rehace, y esa es justamente la señal de avance.</p>
 */
const RAICES = [
  resolve('src/app/shared/ui'),
  resolve('src/app/features/overview'),
  resolve('src/app/features/clients'),
  resolve('src/app/features/workforce'),
  resolve('src/app/features/planning'),
  // Sólo lo rehecho de Operación: la pantalla vieja sigue ahí hasta que Incidencias y Cobertura se
  // rehagan, y hoy fallaría con sus hex a mano.
  resolve('src/app/features/operations/ui'),
  resolve('src/app/features/operations/data-access'),
  resolve('src/app/features/operations/pages/attendance-page'),
];

/** Los siete tamaños de la escala. Ni uno más; el 13.5 px está prohibido por nombre. */
const ESCALA = ['22px', '13px', '12.5px', '12px', '11.5px', '11px', '10.5px'];

/**
 * `catalog-select` es de la tanda de controles: sigue siendo un `<select>` nativo, como los otros
 * ciento y pico de la aplicación, y se convierte con su caso. No es contexto de trabajo ni una
 * pieza del sistema cerrado.
 */
const EXCEPCIONES_DE_SELECT_NATIVO = new Set(['shared/ui/catalog-select/catalog-select.ts']);

function archivos(directorio: string): readonly string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);

    if (statSync(ruta).isDirectory()) {
      return archivos(ruta);
    }

    // También `.html` y `.scss`: una pantalla puede sacar su plantilla a un archivo aparte, y la
    // regla dejaría de valer justo donde más estilo se escribe.
    return /\.(ts|html|scss)$/.test(ruta) && !ruta.endsWith('.spec.ts') ? [ruta] : [];
  });
}

const APP = resolve('src/app');
const relativo = (ruta: string) => ruta.slice(APP.length + 1).replace(/\\/g, '/');

const piezas = RAICES.flatMap((raiz) => archivos(raiz)).map((ruta) => ({
  ruta: relativo(ruta),
  texto: readFileSync(ruta, 'utf8'),
}));

/**
 * Sólo la parte de estilos: el resto del archivo puede nombrar un color al explicarlo. En un
 * `.scss` el archivo entero es estilo, así que se toma completo.
 */
const estilosDe = (texto: string, ruta = '') => {
  if (ruta.endsWith('.scss')) {
    return texto;
  }

  const inicio = texto.indexOf('styles: `');
  return inicio === -1 ? '' : texto.slice(inicio, texto.indexOf('`,', inicio));
};

/**
 * Sólo el marcado. Se busca el uso, no la palabra: varios componentes explican en un comentario
 * por qué **no** usan un `<select>` nativo, y eso no es usarlo.
 */
const plantillaDe = (texto: string, ruta = '') => {
  if (ruta.endsWith('.html')) {
    return texto;
  }

  const inicio = texto.indexOf('template: `');
  return inicio === -1 ? '' : texto.slice(inicio, texto.indexOf('`,', inicio));
};

describe('El sistema se aplica en shared/ui y en las pantallas ya rehechas', () => {
  /**
   * Los cinco bosquejos de diseño usan quince colores y los quince son los quince tokens. Un hex
   * en un componente significa que alguien decidió un color nuevo por su cuenta.
   */
  it('ningún color se escribe a mano: todos salen de un token', () => {
    const culpables = piezas
      .map(({ ruta, texto }) => ({ ruta, hex: estilosDe(texto, ruta).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [] }))
      .filter(({ hex }) => hex.length)
      .map(({ ruta, hex }) => `${ruta}: ${hex.join(', ')}`);

    expect(culpables, 'Usa var(--gestia-*)').toEqual([]);
  });

  /**
   * Siete tamaños, ni uno más. El documento prohíbe el 13.5 px por nombre: está tan cerca del 13
   * que sólo difumina la escala sin aportar jerarquía.
   */
  it('ningún tamaño de letra sale de la escala de siete', () => {
    const culpables = piezas
      .map(({ ruta, texto }) => ({
        ruta,
        fuera: (estilosDe(texto, ruta).match(/font-size:\s*[^;]+;/g) ?? [])
          .map((declaracion) => declaracion.replace(/font-size:\s*|;/g, '').trim())
          .filter((valor) => !ESCALA.includes(valor) && !valor.startsWith('inherit')),
      }))
      .filter(({ fuera }) => fuera.length)
      .map(({ ruta, fuera }) => `${ruta}: ${fuera.join(', ')}`);

    expect(culpables, `La escala es ${ESCALA.join(' · ')}`).toEqual([]);
  });

  it('el 13.5 px prohibido no aparece en ninguna parte', () => {
    expect(piezas.filter(({ texto }) => texto.includes('13.5px')).map(({ ruta }) => ruta)).toEqual([]);
  });

  /** Radio general 6 px, píldoras 3 px, y el círculo de avatares y puntos. Nada más. */
  it('ningún radio sale de los del sistema', () => {
    const permitidos = ['var(--gestia-radius)', 'var(--gestia-radius-pill)', '50%', '0'];

    const culpables = piezas
      .map(({ ruta, texto }) => ({
        ruta,
        fuera: (estilosDe(texto, ruta).match(/border-radius:\s*[^;]+;/g) ?? [])
          .map((declaracion) => declaracion.replace(/border-radius:\s*|;/g, '').trim())
          .filter((valor) => !permitidos.includes(valor)),
      }))
      .filter(({ fuera }) => fuera.length)
      .map(({ ruta, fuera }) => `${ruta}: ${fuera.join(', ')}`);

    expect(culpables, 'Usa --gestia-radius o --gestia-radius-pill').toEqual([]);
  });

  it('ningún selector nativo, salvo la excepción nombrada', () => {
    const culpables = piezas
      .filter(({ ruta }) => !EXCEPCIONES_DE_SELECT_NATIVO.has(ruta))
      .filter(({ ruta, texto }) => /<select\b/.test(plantillaDe(texto, ruta)))
      .map(({ ruta }) => ruta);

    expect(culpables, 'Usa gi-select').toEqual([]);
  });

  it('la excepción sigue existiendo, para que la lista no se quede vieja', () => {
    for (const excepcion of EXCEPCIONES_DE_SELECT_NATIVO) {
      expect(piezas.some(({ ruta }) => ruta === excepcion), `Ya no existe ${excepcion}`).toBe(true);
    }
  });

  /**
   * El foco visible es una regla transversal del sistema, y en un componente que reemplaza un
   * control nativo es además lo único que queda: el navegador ya no lo pone.
   */
  it('todo componente que se enfoca marca el foco en cian', () => {
    const conFoco = piezas.filter(({ ruta, texto }) => /:focus-visible/.test(estilosDe(texto, ruta)));
    const sinCian = conFoco
      .filter(({ ruta, texto }) => !/outline:\s*2px solid var\(--gestia-cyan\)/.test(estilosDe(texto, ruta)))
      .map(({ ruta }) => ruta);

    expect(conFoco.length).toBeGreaterThan(4);
    expect(sinCian, 'El foco va en --gestia-cyan').toEqual([]);
  });
});
