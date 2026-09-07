import {
  firstDayOfOperationalMonth,
  formatOperationalDate,
  formatOperationalInstant,
  operationalDatesBetween,
  shiftOperationalDate,
  SIN_FECHA,
} from './operational-date';

describe('formatOperationalDate', () => {
  it('escribe el día con cero, el mes de tres letras y el año completo', () => {
    expect(formatOperationalDate('2026-09-04')).toBe('04 sep 2026');
  });

  it('conserva el cero del día de un dígito', () => {
    expect(formatOperationalDate('2026-01-01')).toBe('01 ene 2026');
  });

  it('resuelve diciembre, que es el último del arreglo de meses', () => {
    expect(formatOperationalDate('2026-12-31')).toBe('31 dic 2026');
  });

  /**
   * La regresión que justifica que esta función analice el texto a mano. `new Date('2026-09-05')`
   * se interpreta como medianoche UTC, y leída con los métodos locales devuelve el día anterior en
   * cualquier huso al oeste de Greenwich: el mismo corrimiento de día que el reloj operativo cerró
   * en el servidor, reintroducido en el navegador.
   */
  it('no corre el día hacia atrás como lo haría new Date sobre la misma cadena', () => {
    const conDateNativo = new Date('2026-09-05');
    const diaLocal = String(conDateNativo.getDate()).padStart(2, '0');

    // En un navegador al oeste de Greenwich esto vale '04'; el formateador debe decir '05' igual.
    expect(formatOperationalDate('2026-09-05')).toBe('05 sep 2026');
    expect(formatOperationalDate('2026-09-05').startsWith(diaLocal)).toBe(
      diaLocal === '05',
    );
  });

  it('devuelve el texto de ausencia y no una fecha inventada cuando la entrada no sirve', () => {
    expect(formatOperationalDate(null)).toBe(SIN_FECHA);
    expect(formatOperationalDate(undefined)).toBe(SIN_FECHA);
    expect(formatOperationalDate('')).toBe(SIN_FECHA);
    expect(formatOperationalDate('05/09/2026')).toBe(SIN_FECHA);
    expect(formatOperationalDate('2026-09-05T14:00:00Z')).toBe(SIN_FECHA);
    expect(formatOperationalDate('2026-13-01')).toBe(SIN_FECHA);
    expect(formatOperationalDate('2026-00-10')).toBe(SIN_FECHA);
  });

  it('tolera espacios alrededor, que es lo que llega de un campo copiado a mano', () => {
    expect(formatOperationalDate('  2026-09-04  ')).toBe('04 sep 2026');
  });
});

describe('formatOperationalInstant', () => {
  it('agrega la hora al mismo formato de fecha', () => {
    const local = new Date(2026, 8, 4, 16, 5);

    expect(formatOperationalInstant(local.toISOString())).toBe('04 sep 2026 16:05');
  });

  it('devuelve el texto de ausencia ante un instante ilegible', () => {
    expect(formatOperationalInstant('no es una fecha')).toBe(SIN_FECHA);
    expect(formatOperationalInstant(null)).toBe(SIN_FECHA);
  });
});

describe('shiftOperationalDate', () => {
  it('suma y resta días', () => {
    expect(shiftOperationalDate('2026-09-04', 1)).toBe('2026-09-05');
    expect(shiftOperationalDate('2026-09-04', -1)).toBe('2026-09-03');
    expect(shiftOperationalDate('2026-09-04', 0)).toBe('2026-09-04');
  });

  it('cruza fin de mes y fin de año', () => {
    expect(shiftOperationalDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftOperationalDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftOperationalDate('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('resuelve el 29 de febrero de un año bisiesto', () => {
    expect(shiftOperationalDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftOperationalDate('2027-02-28', 1)).toBe('2027-03-01');
  });

  /**
   * La razón de que la aritmética sea toda UTC. Construir un `Date` con la hora local y volver a
   * leerlo con `toISOString()` corre el resultado un día en cuanto el huso del navegador tiene el
   * signo contrario al que se supuso. Aquí no interviene el navegador.
   */
  it('no depende del huso del navegador', () => {
    const comoSeHaciaAntes = (dias: number) => {
      const fecha = new Date('2026-09-04T00:00:00');
      fecha.setDate(fecha.getDate() + dias);
      return fecha.toISOString().slice(0, 10);
    };

    // En un navegador al este de Greenwich la forma vieja se adelanta; ésta no cambia nunca.
    expect(shiftOperationalDate('2026-09-04', 6)).toBe('2026-09-10');
    expect(['2026-09-09', '2026-09-10']).toContain(comoSeHaciaAntes(6));
  });

  it('sin día de partida no hay día siguiente', () => {
    expect(shiftOperationalDate('', 1)).toBe('');
    expect(shiftOperationalDate(null, 1)).toBe('');
    expect(shiftOperationalDate('2026-09-04T10:00:00Z', 1)).toBe('');
  });
});

describe('firstDayOfOperationalMonth', () => {
  it('devuelve el primero del mes', () => {
    expect(firstDayOfOperationalMonth('2026-09-30')).toBe('2026-09-01');
    expect(firstDayOfOperationalMonth('2026-01-01')).toBe('2026-01-01');
  });

  it('sin día no hay mes', () => {
    expect(firstDayOfOperationalMonth('')).toBe('');
    expect(firstDayOfOperationalMonth(undefined)).toBe('');
  });
});

describe('operationalDatesBetween', () => {
  it('incluye los dos extremos', () => {
    expect(operationalDatesBetween('2026-09-03', '2026-09-06')).toEqual([
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });

  it('un solo día devuelve ese día', () => {
    expect(operationalDatesBetween('2026-09-04', '2026-09-04')).toEqual(['2026-09-04']);
  });

  it('un rango invertido devuelve vacío, no un ciclo infinito', () => {
    expect(operationalDatesBetween('2026-09-06', '2026-09-03')).toEqual([]);
  });

  it('cruza el fin de mes', () => {
    expect(operationalDatesBetween('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('sin extremos válidos devuelve vacío', () => {
    expect(operationalDatesBetween('', '2026-09-04')).toEqual([]);
    expect(operationalDatesBetween('2026-09-04', 'ayer')).toEqual([]);
  });
});
