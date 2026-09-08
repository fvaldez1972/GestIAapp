import { eligibilityDetail, employeeJobPositionLabel } from './employee-list.models';
import { EmployeeListItem } from './employee-list.models';

const empleado = (extra: Partial<EmployeeListItem>) => ({ jobTitle: null, jobPositionName: null, ...extra } as EmployeeListItem);

describe('Ningún nulo llega escrito a la pantalla', () => {
  /**
   * El defecto que se vio al desactivar un puesto: la pantalla mostraba el texto «NULL».
   *
   * <p>Un nulo interpolado en una plantilla de cadena escribe la palabra. En una plantilla de
   * Angular no pasa —pinta vacío—, y por eso es fácil no verlo venir: el mismo dato es inofensivo
   * en un sitio y aparece en crudo en el otro.</p>
   */
  it('el detalle de elegibilidad no escribe «null» cuando falta el puesto', () => {
    const bloqueado = eligibilityDetail('blocked', null, 'Guardia de acceso');
    const elegible = eligibilityDetail('eligible', null, null);

    for (const texto of [bloqueado, elegible]) {
      expect(texto.toLowerCase()).not.toContain('null');
      expect(texto.toLowerCase()).not.toContain('undefined');
    }

    expect(bloqueado).toContain('sin puesto');
    expect(bloqueado).toContain('Guardia de acceso');
  });

  it('con los dos puestos presentes, los dice tal cual', () => {
    const texto = eligibilityDetail('blocked', 'Escolta', 'Guardia de acceso');

    expect(texto).toContain('«Escolta»');
    expect(texto).toContain('«Guardia de acceso»');
  });

  /** El puesto de catálogo manda; el texto libre es lo heredado, y la ausencia se dice. */
  it('la etiqueta del puesto distingue catálogo, texto libre y ausencia', () => {
    expect(employeeJobPositionLabel(empleado({ jobPositionName: 'Escolta' }))).toBe('Escolta');
    expect(employeeJobPositionLabel(empleado({ jobTitle: 'Guardia' }))).toBe('Guardia · sin catalogar');
    expect(employeeJobPositionLabel(empleado({}))).toBe('Sin puesto');
  });
});
