import { wholePercentage } from './percentage';

/**
 * Lo que se fija aquí es el borde, no la aritmética. En medio del rango cualquier redondeo sirve;
 * en los extremos el redondeo cambia lo que el reporte afirma.
 */
describe('wholePercentage', () => {
  it('sin denominador devuelve null, que la pantalla lee como N/D', () => {
    expect(wholePercentage(0, 0)).toBeNull();
    expect(wholePercentage(3, 0)).toBeNull();
    expect(wholePercentage(1, -2)).toBeNull();
  });

  it('el 100% se reserva para cuando de verdad no faltó ninguno', () => {
    expect(wholePercentage(300, 300)).toBe(100);
    // 99.67 redondea a 100 y diría que no faltó nadie el día que faltó alguien.
    expect(wholePercentage(299, 300)).toBe(99);
    expect(wholePercentage(9999, 10000)).toBe(99);
  });

  it('el 0% se reserva para cuando de verdad no hubo ninguno', () => {
    expect(wholePercentage(0, 500)).toBe(0);
    // 0.2 redondea a 0 y diría que no hubo ninguna falta el periodo en que hubo una.
    expect(wholePercentage(1, 500)).toBe(1);
  });

  it('en medio del rango redondea como se espera', () => {
    expect(wholePercentage(1, 2)).toBe(50);
    expect(wholePercentage(2, 3)).toBe(67);
    expect(wholePercentage(1, 3)).toBe(33);
  });
});
