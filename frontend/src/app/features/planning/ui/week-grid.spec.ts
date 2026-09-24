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
      [canProject]="canProject()"
      [busy]="busy()"
      (createPosition)="creaciones.set(creaciones() + 1)"
      (cellSelect)="elegidas.set([...elegidas(), $event.idPosition + '@' + $event.cell.date])"
      (project)="proyecciones.set(proyecciones() + 1)"
    />
  `,
})
class Anfitrion {
  readonly rows = signal<readonly PlanningRow[]>([SEMANA_NORMAL]);
  readonly days = signal<readonly string[]>(DIAS);
  readonly highlightDate = signal('');
  readonly canProject = signal(false);
  readonly busy = signal(false);
  readonly creaciones = signal(0);
  readonly elegidas = signal<string[]>([]);
  readonly proyecciones = signal(0);
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
    notas: () => Array.from(raiz.querySelectorAll('.rejilla__nota')).map((n) => n.textContent?.trim()),
    conteos: () => Array.from(raiz.querySelectorAll('.rejilla__conteo')).map((c) => c.textContent?.trim()),
    proyectar: () => raiz.querySelector<HTMLButtonElement>('.rejilla__accion'),
  };
}

describe('WeekGrid', () => {
  it('dibuja los siete días con su abreviatura y su número', () => {
    const { dias } = montar();

    expect(dias()).toEqual(['LUN 07', 'MAR 08', 'MIÉ 09', 'JUE 10', 'VIE 11', 'SÁB 12', 'DOM 13']);
  });

  /**
   * Con tres posiciones son veintiuna celdas, y saber si hay algo que resolver exigía recorrerlas
   * una por una. Las dos mitades se necesitan: sin la segunda, «no enseña sin declarar» se
   * cumpliría igual si el vistazo no supiera contarlo.
   */
  it('la cabecera cuenta los estados que existen y calla los que no', () => {
    expect(montar().conteos()).toEqual(['4 cubiertos', '1 con falta']);

    const sinDeclarar = montar((h) =>
      h.rows.set([fila(['undeclared', 'undeclared', 'undeclared', 'undeclared', 'undeclared', 'undeclared', 'undeclared'])]),
    );

    expect(sinDeclarar.conteos()).toEqual(['7 sin declarar']);
  });

  /**
   * Proyectar vive en la cabecera de lo que modifica. Antes vivía en un aviso suelto debajo de la
   * rejilla, y al retirarse el texto que lo presentaba quedó un enlace subrayado dentro de un
   * recuadro vacío.
   */
  it('ofrece proyectar sólo cuando la pantalla lo permite, y no dos veces', () => {
    expect(montar().proyectar()).toBeNull();

    const { proyectar, host } = montar((h) => h.canProject.set(true));

    proyectar()!.click();
    expect(host.proyecciones()).toBe(1);

    host.busy.set(true);
    expect(montar((h) => { h.canProject.set(true); h.busy.set(true); }).proyectar()!.disabled).toBe(true);
  });

  it('resume cuántas posiciones y qué rango se está viendo', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.rejilla__range')!.textContent).toBe(
      '1 posición · 07 sep 2026 – 13 sep 2026',
    );
  });

  /**
   * Los estados se distinguen sin color, y por eso la leyenda va dentro de la rejilla y no en un
   * anexo que nadie abre.
   */
  it('la leyenda nombra con palabras los estados que explica', () => {
    const { leyenda } = montar();

    // «Sin declarar» salió de la leyenda el 24 de septiembre de 2026, por petición. La celda lo
    // sigue diciendo —eso se comprueba abajo, en las pruebas de la celda— y lo que se retiró es
    // el renglón que lo explicaba.
    expect(leyenda()).toEqual(['Turno cubierto', 'Falta gente', 'Sin turno']);
  });

  /**
   * Las notas dicen qué significa el estado, no cómo se calcula. «asignados &lt; requeridos» era la
   * fórmula de adentro, y «el patrón no declara segmento ese día» nombraba la causa técnica: las
   * dos salieron el 24 de septiembre de 2026, por petición, y la segunda se cambió por lo que de
   * verdad hay que saber para decidir.
   */
  it('sólo «Sin turno» lleva nota, y dice qué implica', () => {
    const { notas, raiz } = montar();

    expect(notas()).toEqual(['No requiere cobertura']);
    expect(raiz.textContent).not.toContain('asignados <');
    expect(raiz.textContent).not.toContain('declara segmento');
  });

  /**
   * La muestra de cada estado era un cuadrado de 0.9 rem con borde, y a ese tamaño se lee como una
   * casilla de formulario sin marcar. Ahora la muestra es la palabra misma, pintada como la celda.
   * La segunda mitad es el control: sin ella, «no hay muestras» se cumpliría igual si la leyenda
   * hubiera desaparecido entera.
   */
  it('la leyenda no dibuja cuadritos que parezcan casillas', () => {
    const { raiz, leyenda } = montar();

    expect(raiz.querySelector('.rejilla__muestra')).toBeNull();
    expect(leyenda()).toEqual(['Turno cubierto', 'Falta gente', 'Sin turno']);
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

    // La posición viaja con la celda: sin ella, quien escucha tendría que recordar en qué fila
    // estaba, y ese recuerdo se desincroniza en cuanto la pantalla marca otra por su cuenta.
    expect(host.elegidas()).toEqual(['p-1@2026-09-10']);
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
   * <b>Con tres posiciones se ve bien siempre.</b> Un servicio real tiene diez o doce, y es ahí
   * donde una rejilla se rompe: la fila se desalinea, la cabecera se desacopla, o una columna se
   * come a las demás. Se comprueba con doce porque tres no prueban nada.
   */
  it('aguanta con doce posiciones sin desalinearse', () => {
    const doce = Array.from({ length: 12 }, (_, i) => ({
      ...SEMANA_NORMAL,
      idPosition: `p-${i + 1}`,
      codePosition: `P-${String(i + 1).padStart(2, '0')}`,
    }));

    const { raiz, dias, celdas } = montar((h) => h.rows.set(doce));

    // La cabecera sigue siendo de siete, pase lo que pase con el número de filas.
    expect(dias()).toHaveLength(7);
    expect(raiz.querySelectorAll('app-position-week-row')).toHaveLength(12);
    expect(celdas()).toHaveLength(12 * 7);

    // Y cada fila conserva sus siete: si una perdiera una, la rejilla se leería corrida.
    for (const fila of Array.from(raiz.querySelectorAll('app-position-week-row'))) {
      expect(fila.querySelectorAll('.celda')).toHaveLength(7);
    }

    expect(raiz.querySelector('.rejilla__range')!.textContent).toContain('12 posiciones');
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
