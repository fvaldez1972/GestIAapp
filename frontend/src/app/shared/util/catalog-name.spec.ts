import { catalogNameDistance, normalizeCatalogName } from './catalog-name';

/**
 * El plegado tiene que dar lo mismo que `CatalogName.Normalize` del servidor.
 *
 * <p>Si las dos se separaran, el alta al vuelo diría «puedes crearlo» y la base respondería 409.
 * Estos casos son los mismos que prueba `CatalogNameTests` en el backend, a propósito: si alguien
 * cambia una de las dos reglas, la otra suite lo dice.</p>
 */
describe('normalizeCatalogName', () => {
  it.each([
    ['Guardia', 'guardia'],
    ['Guardia', 'GUARDIA'],
    ['Guardia', '  Guardia  '],
    ['Guardia de acceso', 'guardia  de  acceso'],
    ['Guardia de acceso', 'GUARDIA\tDE\nACCESO'],
  ])('«%s» y «%s» colapsan al mismo valor', (left, right) => {
    expect(normalizeCatalogName(left)).toBe(normalizeCatalogName(right));
  });

  it.each([
    ['Recepción', 'Recepcion'],
    ['Supervisión', 'SUPERVISION'],
    ['Peña', 'PENA'],
    ['México', 'mexico'],
  ])('los acentos se pliegan: «%s» y «%s»', (left, right) => {
    expect(normalizeCatalogName(left)).toBe(normalizeCatalogName(right));
  });

  it.each([
    ['Guardia', 'Guardias'],
    ['Guardia de acceso', 'Guardia de acceso B'],
    ['Supervisor', 'Supervisora'],
  ])('lo que de verdad es distinto se queda distinto: «%s» y «%s»', (left, right) => {
    expect(normalizeCatalogName(left)).not.toBe(normalizeCatalogName(right));
  });

  it('produce la forma esperada', () => {
    expect(normalizeCatalogName('  Guardia de acceso  ')).toBe('GUARDIA DE ACCESO');
    expect(normalizeCatalogName('Recepción')).toBe('RECEPCION');
  });

  it.each([null, undefined, '', '   '])('vacío se queda vacío: %s', (entrada) => {
    expect(normalizeCatalogName(entrada)).toBe('');
  });
});

describe('catalogNameDistance', () => {
  it('cuenta las ediciones que hacen falta', () => {
    expect(catalogNameDistance('GUARDIA', 'GUARDIA')).toBe(0);
    expect(catalogNameDistance('GUARDIA', 'GUARDIAS')).toBe(1);
    expect(catalogNameDistance('GUARDIA', 'GUARDIAN')).toBe(1);
  });

  /** Se corta en cuanto pasa del máximo: no hace falta el número exacto para decidir si preguntar. */
  it('deja de contar en cuanto se pasa del máximo', () => {
    expect(catalogNameDistance('GUARDIA', 'RECEPCIONISTA')).toBeGreaterThan(2);
    expect(catalogNameDistance('A', 'BBBBBBBBBB')).toBeGreaterThan(2);
  });
});
