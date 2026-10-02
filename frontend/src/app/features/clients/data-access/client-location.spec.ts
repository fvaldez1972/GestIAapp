import { ClientListItem, clientLocation } from './client.models';
import { cliente } from '../ui/client-fixtures';

/**
 * Qué dice la columna «Estado · Municipio» del listado.
 *
 * <p>La pregunta que abre este archivo: <b>qué enseña para un cliente con dos zonas en sitios
 * distintos</b>. Enseñaba la primera por nombre, a secas, como si fuera la ubicación del cliente.
 * En la base viva pasa de verdad: Almacenes Reforma tiene una zona en Tijuana y otra en León, y la
 * lista decía «Baja California · Tijuana».</p>
 *
 * <p>El modelo <b>no tiene jerarquía entre zonas</b> —`mainZone*` es la primera por nombre,
 * calculada en la consulta—, así que si la ficha deja de destacar una, la lista tampoco puede
 * seguir eligiendo una en silencio.</p>
 */
describe('La ubicación de un cliente en el listado', () => {
  const con = (extra: Partial<ClientListItem>) => cliente(extra);

  it('con una sola ubicación la dice, que es para lo que sirve la columna', () => {
    expect(clientLocation(con({
      mainZoneState: 'Nuevo León',
      mainZoneMunicipality: 'Monterrey',
      zoneLocationCount: 1,
    }))).toBe('Nuevo León · Monterrey');
  });

  /** El caso que motivó el cambio. */
  it('con varias no elige una: dice cuántas', () => {
    expect(clientLocation(con({
      mainZoneState: 'Baja California',
      mainZoneMunicipality: 'Tijuana',
      zoneLocationCount: 2,
    }))).toBe('2 ubicaciones');
  });

  /**
   * Dos zonas en el MISMO sitio siguen siendo un sitio.
   *
   * <p>Es el control que distingue «cuenta ubicaciones» de «cuenta zonas». Sin él, un cliente con
   * dos zonas en Monterrey diría «2 ubicaciones» y la columna perdería la única cosa que sabe
   * decir.</p>
   */
  it('dos zonas en el mismo municipio siguen siendo una ubicación', () => {
    expect(clientLocation(con({
      mainZoneState: 'Nuevo León',
      mainZoneMunicipality: 'Monterrey',
      zoneCount: 2,
      zoneLocationCount: 1,
    }))).toBe('Nuevo León · Monterrey');
  });

  it('sin zona lo dice, y dice por qué importa', () => {
    expect(clientLocation(con({
      mainZoneState: null,
      mainZoneMunicipality: null,
      zoneCount: 0,
      zoneLocationCount: 0,
    }))).toBe('Sin ubicación: no tiene zona');
  });
});
