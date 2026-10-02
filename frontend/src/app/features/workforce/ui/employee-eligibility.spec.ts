import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmployeeEligibilityBand } from './employee-eligibility';

@Component({
  imports: [EmployeeEligibilityBand],
  template: `
    <app-employee-eligibility
      [employeeJobPositionId]="employeeId()"
      [employeeJobPosition]="employeeName()"
      [positionJobPositionId]="positionId()"
      [positionJobPosition]="positionName()"
    />
  `,
})
class Anfitrion {
  readonly employeeId = signal<string | null>('jp-1');
  readonly employeeName = signal<string | null>('Guardia intramuros');
  readonly positionId = signal<string | null>('jp-1');
  readonly positionName = signal<string | null>('Guardia intramuros');
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    raiz,
    banda: () => raiz.querySelector<HTMLElement>('.band')!,
    titulo: () => raiz.querySelector('.band__badge')!.textContent!.trim(),
    detalle: () => raiz.querySelector('.band__detail')!.textContent!.trim(),
  };
}

describe('La franja de elegibilidad', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  it('con los dos puestos iguales dice que es elegible', () => {
    const { titulo, banda } = montar();

    expect(titulo()).toBe('Elegible para esta posición');
    expect(banda().classList.contains('band--eligible')).toBe(true);
  });

  /**
   * <b>El hallazgo de la revisión.</b> Un nulo no bloquea: quien no tiene puesto de catálogo se
   * puede asignar igual. Lo que hoy nadie ve es que su expediente queda sin comprobar, y por eso
   * la franja tiene que decirlo con esas dos ideas juntas.
   */
  it('sin puesto de catálogo dice que es elegible y que el expediente está incompleto', () => {
    const { titulo, detalle, banda } = montar((host) => {
      host.employeeId.set(null);
      host.employeeName.set(null);
    });

    expect(titulo()).toBe('Elegible, con el expediente incompleto');
    expect(banda().classList.contains('band--incomplete')).toBe(true);
    expect(detalle()).toContain('no impide asignarla');
    expect(detalle()).toContain('expediente queda incompleto');
  });

  /** Y el hueco se nombra donde se ve el dato, no sólo en el texto de abajo. */
  it('sin puesto de catálogo lo dice también en el campo', () => {
    const { raiz } = montar((host) => {
      host.employeeId.set(null);
      host.employeeName.set(null);
    });

    expect(raiz.querySelector('.band__missing')?.textContent?.trim()).toBe('Sin puesto del catálogo');
  });

  /**
   * El bosquejo dibujaba el bloqueo como una diferencia de redacción. Desde F1 se compara por
   * identificador, así que dos nombres iguales con identificadores distintos sí bloquean.
   */
  it('con identificadores distintos bloquea, aunque los nombres se parezcan', () => {
    const { titulo, detalle } = montar((host) => {
      host.positionId.set('jp-2');
      host.positionName.set('Guardia intramuros');
    });

    expect(titulo()).toBe('No elegible para esta posición');
    expect(detalle()).toContain('identificador de catálogo');
    expect(detalle()).toContain('no una diferencia de redacción');
  });

  /** Sin posición contra la que comparar no hay nada que bloquear. */
  it('sin posición de referencia, quien tiene puesto es elegible', () => {
    const { titulo } = montar((host) => {
      host.positionId.set(null);
      host.positionName.set(null);
    });

    expect(titulo()).toBe('Elegible para esta posición');
  });

  /**
   * Se pinta como texto, no como Markdown.
   *
   * <p>La redacción llevaba asteriscos para dar énfasis y en pantalla se leían literales:
   * «**Eso no impide asignarla**». Sólo se vio con la pantalla montada, así que queda una prueba.</p>
   */
  it('el texto no lleva marcas de Markdown, que se leerían literales', () => {
    const { detalle } = montar((host) => {
      host.employeeId.set(null);
      host.employeeName.set(null);
    });

    expect(detalle()).not.toContain('**');
    expect(detalle()).not.toContain('__');
  });

  /** Cuando no está en orden, la franja ofrece la salida en lugar de dejar un aviso sin destino. */
  it('cuando no es elegible ofrece corregir el puesto', () => {
    const { raiz } = montar((host) => {
      host.employeeId.set(null);
      host.employeeName.set(null);
    });

    const acciones = Array.from(raiz.querySelectorAll('.band__action')).map((n) =>
      n.textContent!.trim(),
    );

    expect(acciones).toContain('Asignar un puesto del catálogo');
    expect(acciones).toContain('Ver el catálogo de puestos');
  });
});
