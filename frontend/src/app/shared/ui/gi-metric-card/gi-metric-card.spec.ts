import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiMetricCard, GiMetricState, GiMetricTone } from './gi-metric-card';

@Component({
  imports: [GiMetricCard],
  template: `
    <gi-metric-card
      [label]="label()"
      [value]="value()"
      [hint]="hint()"
      [state]="state()"
      [tone]="tone()"
      [pillLabel]="pillLabel()"
      [pendingLabel]="pendingLabel()"
      [pendingActionLabel]="pendingActionLabel()"
      (pendingAction)="acciones.set(acciones() + 1)"
    />
  `,
})
class Anfitrion {
  readonly label = signal('Incidencias abiertas');
  readonly value = signal<number | string>(7);
  readonly hint = signal('Requieren seguimiento hoy');
  readonly state = signal<GiMetricState>('ready');
  readonly tone = signal<GiMetricTone>('neutral');
  readonly pillLabel = signal('');
  readonly pendingLabel = signal('Sin datos aún');
  readonly pendingActionLabel = signal('');
  readonly acciones = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    valor: () => raiz.querySelector('.gi-metric__value')?.textContent?.trim() ?? null,
  };
}

describe('GiMetricCard', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  it('con dato muestra la etiqueta, el valor y la línea que lo explica', () => {
    const { raiz, valor } = montar();

    expect(raiz.textContent).toContain('Incidencias abiertas');
    expect(valor()).toBe('7');
    expect(raiz.textContent).toContain('Requieren seguimiento hoy');
  });

  /**
   * El punto del componente. Un cero dice «todo en orden»: no hay incidencias abiertas. Un «sin
   * datos aún» dice que el prerrequisito no existe y que el número no se pudo calcular. Pintar el
   * segundo como cero es decir «todo bien» cuando nadie ha hecho nada.
   */
  describe('el cero real y el sin datos son distintos', () => {
    it('un cero real se pinta cero, no como un hueco', () => {
      const { raiz, valor } = montar((host) => {
        host.value.set(0);
        host.hint.set('Ninguna requiere seguimiento');
      });

      expect(valor()).toBe('0');
      expect(raiz.textContent).not.toMatch(/sin datos/i);
      expect(raiz.querySelector('.gi-metric__pill')).toBeNull();
    });

    it('un sin datos pinta una raya, nunca un cero', () => {
      const { raiz, valor } = montar((host) => {
        host.state.set('pending');
        host.value.set(0);
        host.pendingActionLabel.set('Publicar la planeación');
      });

      expect(valor()).toBe('—');
      expect(raiz.textContent).not.toMatch(/\b0\b/);
    });

    it('el sin datos se lee, no sólo se ve: la píldora lleva el texto dentro', () => {
      const { raiz } = montar((host) => {
        host.state.set('pending');
        host.pendingLabel.set('Falta publicar la planeación');
        host.pendingActionLabel.set('Ir a Planeación');
      });

      expect(raiz.querySelector('.gi-metric__pill')?.textContent?.trim())
        .toBe('Falta publicar la planeación');
    });

    it('y ofrece la acción que lo resuelve', () => {
      const { raiz, fixture, host } = montar((anfitrion) => {
        anfitrion.state.set('pending');
        anfitrion.pendingActionLabel.set('Ir a Planeación');
      });

      const boton = raiz.querySelector<HTMLButtonElement>('.gi-metric__action')!;
      expect(boton.textContent?.trim()).toBe('Ir a Planeación');

      boton.click();
      fixture.detectChanges();

      expect(host.acciones()).toBe(1);
    });
  });

  /**
   * El anexo del bosquejo de Inicio: un cero que vale mostrarse lleva su palabra al lado, y un
   * número que preocupa se lee también sin color.
   */
  describe('el número con su palabra', () => {
    it('un cero real puede llevar la píldora que dice por qué es bueno', () => {
      const { raiz, valor } = montar((host) => {
        host.value.set(0);
        host.tone.set('success');
        host.pillLabel.set('Todo cubierto');
        host.hint.set('03 sep 2026: las 4 incidencias se resolvieron con cubre-descansos');
      });

      expect(valor()).toBe('0');
      expect(raiz.querySelector('.gi-metric__pill')?.textContent?.trim()).toBe('Todo cubierto');
      expect(raiz.querySelector('.gi-metric__pill--success')).not.toBeNull();
    });

    it('el tono nunca es lo único que lo dice: la palabra va dentro de la píldora', () => {
      const { raiz } = montar((host) => {
        host.value.set(3);
        host.tone.set('danger');
        host.pillLabel.set('Vacante');
        host.hint.set('De 38 posiciones, en 2 servicios');
      });

      expect(raiz.querySelector('.gi-metric__value--danger')).not.toBeNull();
      expect(raiz.textContent).toContain('Vacante');
    });

    /**
     * La corrección del anexo. Un dato que todavía no existe **no es una advertencia**: la píldora
     * de «sin datos aún» va en el token neutro, y el ámbar queda para cuando hay un número que sí
     * preocupa.
     */
    it('la píldora de sin datos aún es neutra, no ámbar', () => {
      const { raiz } = montar((host) => {
        host.state.set('pending');
        host.pendingActionLabel.set('Ir a Planeación');
      });

      const pildora = raiz.querySelector('.gi-metric__pill')!;
      expect(pildora.classList.contains('gi-metric__pill--warning')).toBe(false);
      expect(pildora.classList.contains('gi-metric__pill--danger')).toBe(false);
    });
  });

  describe('cargando', () => {
    it('dibuja esqueleto y no deja el valor a la vista', () => {
      const { raiz, valor } = montar((host) => host.state.set('loading'));

      expect(raiz.querySelector('.gi-metric__skeleton')).not.toBeNull();
      expect(valor()).toBeNull();
      expect(raiz.querySelector('article')?.getAttribute('aria-busy')).toBe('true');
    });

    it('se anuncia para quien no ve el esqueleto', () => {
      const { raiz } = montar((host) => host.state.set('loading'));

      expect(raiz.querySelector('[role="status"]')?.textContent).toMatch(/Cargando Incidencias/i);
    });
  });

  it('el valor puede ser texto y sigue leyéndose como métrica', () => {
    const { valor } = montar((host) => {
      host.value.set('N/D');
      host.hint.set('Sin turnos esperados');
    });

    expect(valor()).toBe('N/D');
  });

  describe('lo que rompe en desarrollo', () => {
    it('un sin datos sin la acción que lo resuelve', () => {
      expect(() => montar((host) => host.state.set('pending')))
        .toThrowError(/necesita la acción que lo resuelve/);
    });

    it('un indicador sin la línea que explica el número', () => {
      expect(() => montar((host) => host.hint.set('')))
        .toThrowError(/no lleva la línea que explica el número/);
    });
  });
});
