import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverviewMetric } from '../data-access/overview.models';
import { indicador } from './overview-fixtures';
import { OverviewMetrics } from './overview-metrics';

@Component({
  imports: [OverviewMetrics],
  template: `<app-overview-metrics [metrics]="metrics()" />`,
})
class Anfitrion {
  readonly metrics = signal<readonly OverviewMetric[]>([indicador()]);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    raiz,
    tarjetas: () => Array.from(raiz.querySelectorAll('gi-metric-card')),
    valores: () =>
      Array.from(raiz.querySelectorAll('.gi-metric__value')).map((n) => n.textContent!.trim()),
    nota: () => raiz.querySelector('.metrics__note')?.textContent?.trim() ?? '',
  };
}

describe('La franja de indicadores', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * El problema que la pantalla viene a resolver: **un tablero vacío enseña a ignorar el tablero**.
   * Sin indicadores no se dibuja la franja, en lugar de dibujar cuatro tarjetas en cero.
   */
  it('sin indicadores no se dibuja nada, en vez de cuatro ceros', () => {
    const { raiz } = montar((host) => host.metrics.set([]));

    expect(raiz.querySelector('.metrics')).toBeNull();
  });

  describe('cero real y sin datos aún', () => {
    it('un cero calculado se pinta cero, con la palabra que dice por qué es bueno', () => {
      const { valores, raiz } = montar((host) =>
        host.metrics.set([
          indicador({
            key: 'UncoveredShiftsYesterday',
            value: 0,
            tone: 'Success',
            total: 24,
            asOfDate: '2026-09-08',
          }),
        ]),
      );

      expect(valores()).toEqual(['0']);
      expect(raiz.textContent).toContain('Todo cubierto');
      expect(raiz.textContent).toContain('08 sep 2026');
      expect(raiz.textContent).not.toMatch(/sin datos/i);
    });

    it('un sin datos pinta una raya y dice exactamente qué falta', () => {
      const { valores, raiz } = montar((host) =>
        host.metrics.set([
          indicador({ key: 'UncoveredShiftsYesterday', state: 'Pending', value: 0, tone: 'Neutral' }),
        ]),
      );

      expect(valores()).toEqual(['—']);
      expect(raiz.textContent).toContain('Sin planeación de ayer');
      expect(raiz.textContent).not.toMatch(/\b0\b/);
    });

    /**
     * Cada uno dice **su** carencia, no un «sin datos aún» genérico repetido cuatro veces: lo que
     * falta para tener turnos planeados no es lo que falta para tener vacantes.
     */
    it('cada indicador dice su propia carencia y su propia salida', () => {
      const { raiz } = montar((host) =>
        host.metrics.set([
          indicador({ key: 'PlannedShifts', state: 'Pending', route: '/planeacion' }),
          indicador({ key: 'PositionsWithoutPrimary', state: 'Pending', route: '/servicios' }),
        ]),
      );

      expect(raiz.textContent).toContain('Sin planeación publicada');
      expect(raiz.textContent).toContain('Sin posiciones definidas');
      expect(raiz.textContent).toContain('Ir a Planeación');
      expect(raiz.textContent).toContain('Definir posiciones');
    });

    it('los dos conviven en la misma franja sin confundirse', () => {
      const { valores } = montar((host) =>
        host.metrics.set([
          indicador({ key: 'UncoveredShiftsYesterday', value: 0, tone: 'Success', total: 24, asOfDate: '2026-09-08' }),
          indicador({ key: 'PlannedShifts', state: 'Pending' }),
        ]),
      );

      expect(valores()).toEqual(['0', '—']);
    });
  });

  it('el número lleva su alcance: 3 no dice lo mismo que 3 de 38 en 2 servicios', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('De 38 posiciones, en 2 servicios');
    expect(raiz.querySelector('.gi-metric__pill--danger')?.textContent?.trim()).toBe('Vacante');
  });

  /**
   * Salió al mirar la pantalla con datos reales: la demo tiene la planeación publicada hasta el
   * 31 de agosto, así que la semana en curso está planeada **sólo su primer día**. El indicador
   * decía «27 turnos» como si la semana entera estuviera cubierta.
   */
  it('una semana planeada a medias lo dice, en vez de parecer completa', () => {
    const { raiz } = montar((host) =>
      host.metrics.set([
        indicador({ key: 'PlannedShifts', value: 27, tone: 'Neutral', total: 12, serviceCount: 6, coveredDays: 1 }),
      ]),
    );

    expect(raiz.textContent).toContain('Sólo 1 día de los 7 con turnos publicados');
  });

  it('una semana planeada entera no agrega la advertencia', () => {
    const { raiz } = montar((host) =>
      host.metrics.set([
        indicador({ key: 'PlannedShifts', value: 412, tone: 'Neutral', total: 38, serviceCount: 14, coveredDays: 7 }),
      ]),
    );

    expect(raiz.textContent).not.toContain('de los 7 con turnos publicados');
  });

  it('la nota de arriba dice cuántos no se pueden calcular todavía', () => {
    const { nota } = montar((host) =>
      host.metrics.set([indicador(), indicador({ key: 'PlannedShifts', state: 'Pending' })]),
    );

    expect(nota()).toContain('1 de 2 todavía no se pueden calcular');
  });

  it('con todos pendientes lo dice de una vez, no cuatro veces', () => {
    const { nota } = montar((host) =>
      host.metrics.set([
        indicador({ state: 'Pending' }),
        indicador({ key: 'PlannedShifts', state: 'Pending' }),
      ]),
    );

    expect(nota()).toContain('Ninguno tiene información todavía');
  });
});
