import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlanningCell, PlanningRow } from '../data-access/planning.models';
import { WeekGrid } from './week-grid';

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
  requiredWorkerCount: kind === 'noShift' || kind === 'undeclared' ? 0 : 2,
  assignedWorkerCount: kind === 'covered' ? 2 : kind === 'short' ? 1 : 0,
  timeRange: kind === 'noShift' || kind === 'undeclared' ? '' : '07–19',
  people: kind === 'covered' ? ['Laura Menchaca', 'Óscar Zúñiga'] : kind === 'short' ? ['Laura Menchaca'] : [],
  ...extra,
});

const fila = (kinds: readonly PlanningCell['kind'][]): PlanningRow => ({
  idPosition: 'p-1',
  codePosition: 'P-01',
  name: 'Acceso principal',
  requiredWorkerCount: 2,
  cells: kinds.map((kind, i) => celda(DIAS[i], kind)),
});

const SEMANA_NORMAL = fila([
  'covered',
  'covered',
  'short',
  'covered',
  'covered',
  'noShift',
  'noShift',
]);

@Component({
  imports: [WeekGrid],
  template: `
    <app-week-grid
      [rows]="rows()"
      [days]="days()"
      [highlightDate]="highlightDate()"
      (createPosition)="creaciones.set(creaciones() + 1)"
      (cellSelect)="elegidas.set([...elegidas(), $event.date])"
    />
  `,
})
class Anfitrion {
  readonly rows = signal<readonly PlanningRow[]>([SEMANA_NORMAL]);
  readonly days = signal<readonly string[]>(DIAS);
  readonly highlightDate = signal('');
  readonly creaciones = signal(0);
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
    dias: () => Array.from(raiz.querySelectorAll('.rejilla__dia')).map((d) => d.textContent?.trim()),
    celdas: () => Array.from(raiz.querySelectorAll<HTMLButtonElement>('.celda')),
    leyenda: () => Array.from(raiz.querySelectorAll('.rejilla__texto')).map((t) => t.textContent?.trim()),
  };
}

describe('WeekGrid', () => {
  it('dibuja los siete días con su abreviatura y su número', () => {
    const { dias } = montar();

    expect(dias()).toEqual(['LUN 07', 'MAR 08', 'MIÉ 09', 'JUE 10', 'VIE 11', 'SÁB 12', 'DOM 13']);
  });

  it('resume cuántas posiciones y qué rango se está viendo', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.rejilla__range')!.textContent).toBe(
      '1 posición · 07 sep 2026 – 13 sep 2026',
    );
  });

  /**
   * Los cuatro estados se distinguen sin color, y por eso la leyenda va dentro de la rejilla y no
   * en un anexo que nadie abre.
   */
  it('la leyenda nombra los cuatro estados con palabras', () => {
    const { leyenda } = montar();

    expect(leyenda()).toEqual(['Turno cubierto', 'Falta gente', 'Sin turno', 'Sin declarar']);
  });

  /**
   * <b>Esta prueba está pensada para fallar algún día, y ese día no es un defecto.</b>
   *
   * <p>Hoy el modelo no distingue un descanso de un día sin configurar, así que escribir
   * «Descanso» afirmaría algo que el sistema no sabe. Cuando exista el patrón con ancla y un día
   * del ciclo pueda declararse descanso, esta prueba va a romper: es lo que obliga a decidir la
   * palabra a propósito en vez de que se cuele. Si estás leyendo esto porque falló, la pregunta no
   * es cómo hacerla pasar sino si el modelo ya puede afirmar lo que la palabra dice.</p>
   */
  it('ninguna parte de la rejilla dice «Descanso», que es lo que el modelo no puede afirmar', () => {
    const { raiz } = montar((h) => h.rows.set([fila(['undeclared', 'noShift', 'covered', 'covered', 'covered', 'noShift', 'noShift'])]));

    expect(raiz.textContent).not.toContain('Descanso');
    expect(raiz.textContent).toContain('Sin turno');
    expect(raiz.textContent).toContain('Sin declarar');
  });

  it('marca la columna del día que la pantalla está mirando', () => {
    const { raiz } = montar((h) => h.highlightDate.set('2026-09-10'));

    const marcados = Array.from(raiz.querySelectorAll('.rejilla__dia--marcado')).map((d) =>
      d.textContent?.trim(),
    );

    expect(marcados).toEqual(['JUE 10']);
    expect(raiz.querySelectorAll('.celda--marcada')).toHaveLength(1);
  });

  it('avisa qué celda se eligió', () => {
    const { celdas, host } = montar();

    celdas()[3].click();

    expect(host.elegidas()).toEqual(['2026-09-10']);
  });

  /**
   * Sin posiciones no se dibuja una rejilla vacía: se dice qué falta y se ofrece resolverlo. Una
   * semana en blanco no distingue «no hay posiciones» de «no hay turnos esta semana».
   */
  it('sin posiciones ofrece crear la primera en vez de una rejilla en blanco', () => {
    const { raiz, host } = montar((h) => h.rows.set([]));

    expect(raiz.querySelector('.rejilla__dias')).toBeNull();
    expect(raiz.textContent).toContain('Este servicio no tiene posiciones');

    raiz.querySelector<HTMLButtonElement>('button')!.click();
    expect(host.creaciones()).toBe(1);
  });

  /**
   * Fase 1 proyecta semanas porque un segmento guarda día de la semana. Un rango de otro largo no
   * se puede proyectar con este modelo, y fingirlo daría días que nadie declaró.
   */
  it('rompe en desarrollo si el rango no es de siete días', () => {
    expect(() => montar((h) => h.days.set(DIAS.slice(0, 5)))).toThrowError(/siete días/);
  });

  it('rompe en desarrollo si una fila no tiene tantas celdas como días', () => {
    expect(() =>
      montar((h) => h.rows.set([{ ...SEMANA_NORMAL, cells: SEMANA_NORMAL.cells.slice(0, 6) }])),
    ).toThrowError(/siete celdas|desalinea/);
  });
});
