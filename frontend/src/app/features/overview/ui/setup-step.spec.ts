import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverviewSetupCounts, OverviewSetupStep } from '../data-access/overview.models';
import { CONTEOS, paso } from './overview-fixtures';
import { SetupStep, SetupStepState } from './setup-step';

@Component({
  imports: [SetupStep],
  template: `<ol><app-setup-step [step]="step()" [counts]="counts()" [state]="state()" /></ol>`,
})
class Anfitrion {
  readonly step = signal<OverviewSetupStep>(paso('Clients', false));
  readonly counts = signal<OverviewSetupCounts>(CONTEOS);
  readonly state = signal<SetupStepState>('current');
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    raiz,
    fila: () => raiz.querySelector('.step')!,
    detalle: () => raiz.querySelector('.step__detail')?.textContent?.trim() ?? '',
    accion: () => raiz.querySelector<HTMLAnchorElement>('.step__action'),
  };
}

describe('Un paso del camino', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * Un paso hecho enseña con qué se cerró. «Hecho» sin evidencia es una palomita en la que hay
   * que confiar, y el camino se marca del dato real, no de una casilla que alguien palomea.
   */
  it('el hecho enseña la evidencia que lo cerró', () => {
    const { raiz, detalle } = montar((host) => {
      host.step.set(paso('Catalogs', true));
      host.state.set('done');
    });

    expect(raiz.querySelector('.step__done')?.textContent?.trim()).toBe('Hecho');
    expect(detalle()).toBe('8 puestos · 14 habilidades · 4 zonas · 6 motivos de incidencia · 3 motivos de cobertura');
    expect(raiz.querySelector('.step__badge')?.textContent?.trim()).toBe('✓');
  });

  it('el que se puede empezar ahora lleva el botón, no un enlace más', () => {
    const { accion, fila } = montar();

    expect(fila().classList.contains('step--current')).toBe(true);
    expect(accion()?.classList.contains('step__action--primary')).toBe(true);
    expect(accion()?.getAttribute('href')).toBe('/clientes');
  });

  /**
   * Lo que pediste: **el bloqueado dice de qué depende antes de que el usuario llegue a la pared**,
   * y sigue ofreciendo el destino, porque a veces se entra a mirar.
   */
  it('el bloqueado nombra su dependencia y no la esconde en un color', () => {
    const { raiz, accion } = montar((host) => {
      host.step.set(paso('Assignments', false, { blockedBy: ['Positions', 'Employees'] }));
      host.state.set('blocked');
    });

    const aviso = raiz.querySelector('.step__blocked')?.textContent?.trim();
    expect(aviso).toContain('Posiciones con turno y descanso');
    expect(aviso).toContain('Empleados con expediente mínimo');
    expect(accion()).not.toBeNull();
  });

  it('el disponible no está bloqueado ni destacado, y no dice que dependa de nada', () => {
    const { raiz, fila } = montar((host) => {
      host.step.set(paso('Employees', false));
      host.state.set('available');
    });

    expect(fila().classList.contains('step--available')).toBe(true);
    expect(raiz.querySelector('.step__blocked')).toBeNull();
  });

  /**
   * Sin permiso el paso se sigue viendo —describe a la organización, no a quien mira— pero no se
   * ofrece una puerta que terminaría en 403. Quien decide esto es el servidor: aquí sólo llega sin
   * ruta.
   */
  it('sin destino, el paso se ve pero no ofrece una puerta que terminaría en 403', () => {
    const { raiz, accion } = montar((host) => {
      host.step.set(paso('Clients', false, { route: null }));
      host.state.set('blocked');
    });

    expect(accion()).toBeNull();
    expect(raiz.textContent).toContain('Primer cliente con sede y contacto');
    expect(raiz.querySelector('.step__no-access')).not.toBeNull();
  });

  /** Siete filas con «Revisar» son siete enlaces indistinguibles para quien navega con lector. */
  it('cada destino se nombra con su paso', () => {
    const { accion } = montar((host) => {
      host.step.set(paso('Planning', true));
      host.state.set('done');
    });

    expect(accion()?.getAttribute('aria-label')).toBe('Revisar: Planeación de la semana publicada');
  });

  it('el cliente sin contacto se nombra cuando lo hay', () => {
    const { detalle } = montar((host) => {
      host.step.set(paso('Clients', true, { highlightName: 'Corporativo Anáhuac' }));
      host.state.set('done');
    });

    expect(detalle()).toContain('Corporativo Anáhuac todavía no tiene contacto');
  });
});
