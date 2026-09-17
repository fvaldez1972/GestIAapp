import {
  eligibilityDetail,
  employeeDocumentTypeOptions,
  employeeJobPositionLabel,
} from './employee-list.models';
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

describe('Los tipos de documento que se ofrecen al capturar', () => {
  /**
   * La lista es del sistema y la marca es de la organizacion.
   *
   * <p>Los catorce tipos salen del enum que el servidor reconoce: una categoria escrita a mano no
   * cumple ningun requisito, porque las reglas de elegibilidad apuntan al enum y no a un texto.</p>
   */
  it('ofrece los catorce tipos aunque la organizacion no exija ninguno', () => {
    const tipos = employeeDocumentTypeOptions([]);

    expect(tipos).toHaveLength(14);
    expect(tipos.every((tipo) => !tipo.isRequired)).toBe(true);
    expect(tipos.map((tipo) => tipo.label)).toContain('Antecedentes no penales');
  });

  /** Los exigidos van primero, porque son los que destraban una asignacion. */
  it('marca los exigidos y los pone al principio', () => {
    const tipos = employeeDocumentTypeOptions([
      { requiredDocumentType: 'ProofOfAddress', isBlocking: true },
      { requiredDocumentType: 'Curp', isBlocking: true },
    ]);

    expect(tipos.slice(0, 2).map((tipo) => tipo.code)).toEqual(['Curp', 'ProofOfAddress']);
    expect(tipos.slice(0, 2).every((tipo) => tipo.isRequired)).toBe(true);
    expect(tipos[2].isRequired).toBe(false);
  });

  /**
   * Una regla que no bloquea se pide igual, pero no se marca como obligatoria.
   *
   * <p>Marcarla seria decirle al usuario que sin ese documento no puede asignar, y si puede. La
   * pestaña de requisitos ya la lista aparte, diciendo que no bloquea.</p>
   */
  it('no marca como obligatoria una regla informativa', () => {
    const tipos = employeeDocumentTypeOptions([
      { requiredDocumentType: 'DriverLicense', isBlocking: false },
    ]);

    expect(tipos.find((tipo) => tipo.code === 'DriverLicense')?.isRequired).toBe(false);
  });

  /** Y una regla que no es de documento no tiene tipo: no debe marcar nada. */
  it('ignora las reglas sin tipo de documento', () => {
    const tipos = employeeDocumentTypeOptions([{ requiredDocumentType: null, isBlocking: true }]);

    expect(tipos.every((tipo) => !tipo.isRequired)).toBe(true);
  });
});
