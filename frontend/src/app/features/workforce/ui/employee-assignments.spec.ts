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
      [canWrite]="canWrite()"
    />
  `,
})
class Anfitrion {
  readonly assignments = signal<readonly EmployeeAssignment[]>([assignmentFixture()]);
  readonly loading = signal(false);
  readonly canWrite = signal(true);
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

  /** Sin asignaciones se explica qué es una y se ofrece la salida, no un hueco. */
  it('sin asignaciones explica qué es una asignación y ofrece asignar', () => {
    const { raiz } = montar((host) => host.assignments.set([]));

    const vacio = raiz.querySelector('gi-empty-state')!;

    expect(vacio.textContent).toContain('no tiene asignaciones');
    expect(vacio.textContent).toContain('Asignar a una posición');
  });

  /** Sin permiso de escritura no se ofrece una salida que el servidor rechazaría. */
  it('sin permiso de escritura el vacío no ofrece asignar', () => {
    const { raiz } = montar((host) => {
      host.assignments.set([]);
      host.canWrite.set(false);
    });

    expect(raiz.querySelector('gi-empty-state')?.textContent).not.toContain('Asignar a una posición');
  });
});
