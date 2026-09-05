import { formatOperationalDate, formatOperationalInstant, SIN_FECHA } from './operational-date';

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
