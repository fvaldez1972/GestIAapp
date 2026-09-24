import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmployeeAssignment } from '../data-access/employee-list.models';
import { EmployeeAssignments } from './employee-assignments';
import { assignmentFixture } from './employee-fixtures';

@Component({
  imports: [EmployeeAssignments],
  template: `
    <app-employee-assignments
      [assignments]="assignments()"
      [loading]="loading()"
    />
  `,
})
class Anfitrion {
  readonly assignments = signal<readonly EmployeeAssignment[]>([assignmentFixture()]);
  readonly loading = signal(false);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    raiz,
    filas: () => Array.from(raiz.querySelectorAll<HTMLElement>('.row')),
    estados: () =>
      Array.from(raiz.querySelectorAll('.row__state')).map((n) => n.textContent!.trim()),
  };
}

describe('La pestaña de asignaciones', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * La zona, que es RF-HIS-005 y lo único que le faltaba al historial.
   *
   * <p>Sin ella, dos servicios homónimos de un cliente grande no se distinguen en la trayectoria
   * de una persona: «Vigilancia nocturna» en la matriz y «Vigilancia nocturna» en la planta se leen
   * igual.</p>
   */
  it('cada fila dice el cliente, la zona y el servicio', () => {
    const { raiz } = montar((host) =>
      host.assignments.set([
        assignmentFixture({ clientName: 'Meridian Cines', zoneName: 'Matriz', serviceName: 'Acceso' }),
      ]),
    );

    expect(raiz.textContent).toContain('Meridian Cines · Matriz · Acceso');
  });

  it('una asignación vigente sin turno abierto se lee como vigente', () => {
    const { estados } = montar();

    expect(estados()).toEqual(['Vigente']);
  });

  /**
   * El turno nocturno que empezó ayer a las 19:00 y todavía no cierra. Sin este estado se leería
   * como turno terminado o como ausencia, que es exactamente lo contrario de lo que pasa.
   */
  it('con entrada y sin salida dice «En curso», y gana a «Vigente»', () => {
    const { estados, raiz } = montar((host) =>
      host.assignments.set([
        assignmentFixture({ hasShiftInProgress: true, shiftInProgressDate: '2026-09-05' }),
      ]),
    );

    expect(estados()).toEqual(['En curso']);
    expect(raiz.querySelector('.assign__live')?.textContent).toContain('05 sep 2026');
    expect(raiz.querySelector('.assign__live')?.textContent).toContain('todavía no hay');
  });

  /** El aviso de arriba es para el turno abierto; sin ninguno no aparece. */
  it('sin turno abierto no muestra el aviso de turno en curso', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.assign__live')).toBeNull();
  });

  it('una asignación terminada se dice terminada y muestra su periodo cerrado', () => {
    const { estados, filas } = montar((host) =>
      host.assignments.set([assignmentFixture({ inForce: false, endDate: '2026-08-31' })]),
    );

    expect(estados()).toEqual(['Terminada']);
    expect(filas()[0].textContent).toContain('01 ago 2026 a 31 ago 2026');
  });

  /**
   * Sin asignaciones se explica qué es una, y <b>no se ofrece asignar</b>.
   *
   * <p>Esta pestaña es historial. El botón de asignar se retiró de Personal el 23 de septiembre de
   * 2026 por petición, y cuando la pestaña volvió el 24 no volvió con él: lo que hacía falta era
   * ver dónde ha estado la persona. Asignar se hace desde Servicios, que es donde existe la
   * posición que se va a cubrir.</p>
   *
   * <p>Las dos afirmaciones se necesitan: sin la primera, «no ofrece asignar» se cumpliría igual
   * si el vacío hubiera dejado de dibujarse entero.</p>
   */
  it('sin asignaciones explica qué es una asignación, y no ofrece asignar', () => {
    const { raiz } = montar((host) => host.assignments.set([]));

    const vacio = raiz.querySelector('gi-empty-state')!;

    expect(vacio.textContent).toContain('no tiene asignaciones');
    expect(vacio.textContent).not.toContain('Asignar a una posición');
  });
});
