import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlanningCell, PlanningRow } from '../data-access/planning.models';
import { PositionWeekRow } from './position-week-row';

const DIAS = [
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
];

const celda = (date: string, kind: PlanningCell['kind'], extra: Partial<PlanningCell> = {}): PlanningCell => ({
  date,
  kind,
  requiredWorkerCount: kind === 'noShift' || kind === 'undeclared' ? 0 : 4,
  assignedWorkerCount: kind === 'covered' ? 4 : kind === 'short' ? 2 : 0,
  timeRange: kind === 'noShift' || kind === 'undeclared' ? '' : '07–19',
  people:
    kind === 'covered'
      ? ['Laura', 'Óscar', 'Ismael', 'Yolanda']
      : kind === 'short'
        ? ['Laura', 'Óscar']
        : [],
  ...extra,
});

const fila = (kinds: readonly PlanningCell['kind'][]): PlanningRow => ({
  idPosition: 'p-1',
  codePosition: 'P-01',
  name: 'Acceso principal',
  requiredWorkerCount: 4,
  cells: kinds.map((kind, i) => celda(DIAS[i], kind)),
});

@Component({
  imports: [PositionWeekRow],
  template: `
    <app-position-week-row
      [row]="row()"
      [highlightDate]="highlightDate()"
      (cellSelect)="elegidas.set([...elegidas(), $event.kind])"
    />
  `,
})
class Anfitrion {
  readonly row = signal<PlanningRow>(
    fila(['covered', 'short', 'noShift', 'undeclared', 'covered', 'covered', 'noShift']),
  );
  readonly highlightDate = signal('');
  readonly elegidas = signal<string[]>([]);
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
    celdas: () => Array.from(raiz.querySelectorAll<HTMLButtonElement>('.celda')),
    textos: () =>
      Array.from(raiz.querySelectorAll('.celda')).map((c) => c.textContent!.replace(/\s+/g, ' ').trim()),
  };
}

describe('PositionWeekRow', () => {
  it('nombra la posición con su código y su meta', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.fila__code')!.textContent!.trim()).toBe('P-01');
    expect(raiz.querySelector('.fila__name')!.textContent!.trim()).toBe('Acceso principal');
    expect(raiz.querySelector('.fila__meta')!.textContent!.trim()).toBe('4 elementos');
  });

  /**
   * El número es lo que decide si hay que ir a Cobertura. Esconderlo detrás de un color obliga a
   * pasar el ratón por catorce celdas para saber cuál mirar.
   */
  it('un hueco enseña la cuenta, no un icono', () => {
    const { textos } = montar();

    expect(textos()[1]).toContain('2 de 4');
    expect(textos()[1]).toContain('Falta gente');
  });

  it('un turno cubierto con varias personas dice cuántas son', () => {
    const { textos } = montar();

    expect(textos()[0]).toContain('4 elementos');
    expect(textos()[0]).toContain('07–19');
  });

  it('un turno cubierto por una sola persona la nombra', () => {
    const { textos } = montar((h) =>
      h.row.set({
        ...fila(['covered', 'covered', 'covered', 'covered', 'covered', 'covered', 'covered']),
        cells: fila(['covered', 'covered', 'covered', 'covered', 'covered', 'covered', 'covered']).cells.map(
          (c) => ({ ...c, requiredWorkerCount: 1, assignedWorkerCount: 1, people: ['Laura Menchaca'] }),
        ),
      }),
    );

    expect(textos()[0]).toContain('Laura Menchaca');
  });

  /** El modelo no puede afirmar un descanso, así que la celda no lo dice. */
  it('un día sin segmento dice «Sin turno» y no «Descanso»', () => {
    const { textos } = montar();

    expect(textos()[2]).toBe('Sin turno');
    expect(textos()[2]).not.toContain('Descanso');
  });

  it('una posición sin nada declarado deja la duda a la vista', () => {
    const { textos } = montar();

    expect(textos()[3]).toContain('Sin declarar');
    expect(textos()[3]).toContain('Turno o descanso');
  });

  it('un día sin turno no inventa horario', () => {
    const { textos } = montar();

    expect(textos()[2]).not.toContain('07–19');
  });

  /**
   * Una celda de calendario sin nombre accesible es un botón que dice «botón». Sin la posición, el
   * día y el estado, recorrer la rejilla con lector de pantalla no dice nada.
   */
  it('cada celda dice en voz alta dónde está y qué pasa ahí', () => {
    const { celdas } = montar();

    expect(celdas()[0].getAttribute('aria-label')).toBe('P-01, 2026-09-07: cubierto, 4 elementos, 07–19');
    expect(celdas()[1].getAttribute('aria-label')).toBe('P-01, 2026-09-08: falta gente, 2 de 4, 07–19');
    expect(celdas()[2].getAttribute('aria-label')).toBe('P-01, 2026-09-09: sin turno');
    expect(celdas()[3].getAttribute('aria-label')).toBe(
      'P-01, 2026-09-10: sin declarar, no se sabe si es turno o descanso',
    );
  });

  it('avisa qué celda se eligió', () => {
    const { celdas, host } = montar();

    celdas()[1].click();

    expect(host.elegidas()).toEqual(['short']);
  });

  it('marca el día que la pantalla está mirando', () => {
    const { celdas } = montar((h) => h.highlightDate.set('2026-09-09'));

    expect(celdas()[2].classList.contains('celda--marcada')).toBe(true);
    expect(celdas()[0].classList.contains('celda--marcada')).toBe(false);
  });

  /**
   * Con otra cantidad de celdas la rejilla se desalinea de la cabecera sin fallar, y quien la lee
   * cree estar viendo el miércoles cuando está viendo el jueves.
   */
  it('rompe en desarrollo si la fila no lleva siete celdas', () => {
    expect(() =>
      montar((h) => h.row.set({ ...h.row(), cells: h.row().cells.slice(0, 5) })),
    ).toThrowError(/siete celdas/);
  });

  it('rompe en desarrollo si una celda cubierta no tiene a nadie', () => {
    expect(() =>
      montar((h) =>
        h.row.set({
          ...h.row(),
          cells: h.row().cells.map((c, i) => (i === 0 ? { ...c, people: [] } : c)),
        }),
      ),
    ).toThrowError(/cubierta sin nadie/);
  });
});
