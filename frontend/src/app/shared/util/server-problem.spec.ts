import { HttpErrorResponse } from '@angular/common/http';
import { fieldError, readServerProblem } from './server-problem';

const problema = (cuerpo: unknown) =>
  readServerProblem(new HttpErrorResponse({ status: 400, error: cuerpo }));

describe('El problema que manda el servidor', () => {
  /**
   * El defecto exacto que se corrige.
   *
   * <p>Una validación siempre trae `detail` con el mismo texto genérico. Leerlo primero dejaba el
   * detalle por campo sin alcanzar, y el usuario sin saber qué corregir.</p>
   */
  it('el detalle por campo manda sobre el texto genérico', () => {
    const resultado = problema({
      title: 'Solicitud inválida',
      detail: 'La solicitud contiene datos inválidos.',
      errors: { Rfc: ['El RFC no tiene el formato del SAT.'] },
    });

    expect(resultado.message).toBe('El RFC no tiene el formato del SAT.');
    expect(resultado.fieldErrors).toEqual({ Rfc: 'El RFC no tiene el formato del SAT.' });
  });

  it('sin detalle por campo, se dice lo que el servidor explique', () => {
    expect(problema({ detail: 'El cliente ya existe.' }).message).toBe('El cliente ya existe.');
    expect(problema({ message: 'Conflicto de concurrencia.' }).message).toBe('Conflicto de concurrencia.');
    expect(problema({ title: 'No autorizado' }).message).toBe('No autorizado');
  });

  it('sin nada que leer, usa lo que la pantalla proponga', () => {
    const sinCuerpo = readServerProblem(new HttpErrorResponse({ status: 500 }), 'No se pudo guardar el cliente.');
    expect(sinCuerpo.message).toBe('No se pudo guardar el cliente.');
    expect(sinCuerpo.fieldErrors).toEqual({});
  });

  it('no se rompe con lo que no es un error de HTTP', () => {
    expect(readServerProblem(new Error('cualquier cosa')).message).toBe('No se pudo completar la operación.');
    expect(readServerProblem(null).message).toBe('No se pudo completar la operación.');
  });

  /**
   * El servidor nombra los campos como su contrato y el formulario como sus controles. Comparar en
   * crudo dejaría el mensaje en el aire justo cuando existe.
   */
  it('encuentra el campo aunque el servidor y el formulario lo escriban distinto', () => {
    const resultado = problema({ errors: { LegalName: ['La razón social es obligatoria.'] } });

    expect(fieldError(resultado, 'legalName')).toBe('La razón social es obligatoria.');
    expect(fieldError(resultado, 'LEGALNAME')).toBe('La razón social es obligatoria.');
    expect(fieldError(resultado, 'rfc')).toBe('');
  });

  it('de varios mensajes por campo se muestra el primero útil', () => {
    const resultado = problema({ errors: { Rfc: ['', '  ', 'El RFC ya está registrado.'] } });
    expect(fieldError(resultado, 'Rfc')).toBe('El RFC ya está registrado.');
  });

  it('descarta campos sin mensaje, para no pintar un error vacío', () => {
    const resultado = problema({ errors: { Rfc: [], LegalName: ['Obligatoria.'] } });
    expect(resultado.fieldErrors).toEqual({ LegalName: 'Obligatoria.' });
  });
});
