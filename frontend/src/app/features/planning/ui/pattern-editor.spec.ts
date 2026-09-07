import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ShiftSegment } from '../../clients/data-access/client.models';
import { PatternEditor, SegmentDraft } from './pattern-editor';

const segmento = (dayOfWeek: string, extra: Partial<ShiftSegment> = {}): ShiftSegment => ({
  idShiftSegment: `seg-${dayOfWeek}`,
  idShiftPattern: 'pat-1',
  dayOfWeek,
  startTime: '07:00:00',
  endTime: '19:00:00',
  isOvernight: false,
  requiredWorkerCount: 4,
  durationMinutes: 720,
  notes: null,
  active: true,
  ...extra,
});

@Component({
  imports: [PatternEditor],
  template: `
    <app-pattern-editor
      [positionCode]="positionCode()"
      [segments]="segments()"
      [hasPattern]="hasPattern()"
      [canWrite]="canWrite()"
      (createPattern)="creaciones.set(creaciones() + 1)"
      (edit)="editados.set([...editados(), $event])"
      (removeSegment)="quitados.set([...quitados(), $event.dayOfWeek])"
    />
  `,
})
class Anfitrion {
  readonly positionCode = signal('P-01');
  readonly segments = signal<readonly ShiftSegment[]>([
    segmento('Monday'),
    segmento('Tuesday'),
    segmento('Wednesday'),
    segmento('Thursday'),
    segmento('Friday'),
  ]);
  readonly hasPattern = signal(true);
  readonly canWrite = signal(true);
  readonly creaciones = signal(0);
  readonly editados = signal<SegmentDraft[]>([]);
  readonly quitados = signal<string[]>([]);
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
    dias: () => Array.from(raiz.querySelectorAll('.patron__dia')),
    nombres: () => Array.from(raiz.querySelectorAll('.patron__nombre')).map((n) => n.textContent?.trim()),
    boton: (dentro: Element, texto: string) =>
      (Array.from(dentro.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === texto,
      ) as HTMLButtonElement | undefined) ?? null,
  };
}

describe('PatternEditor', () => {
  /**
   * Los siete se enseñan siempre. Enseñar sólo los declarados escondería lo que hay que revisar:
   * una semana de cinco días y una a la que se le olvidó el sábado se ven igual si el sábado no
   * está.
   */
  it('enseña los siete días, declarados o no', () => {
    const { nombres } = montar();

    expect(nombres()).toEqual([
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ]);
  });

  it('resume cuántos días están declarados', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.patron__resumen')!.textContent!.trim()).toBe('5 de 7 días declarados');
  });

  it('un día declarado dice su horario sin segundos y cuánta gente pide', () => {
    const { dias } = montar();

    const lunes = dias()[0].textContent!.replace(/\s+/g, ' ');
    expect(lunes).toContain('07:00 – 19:00');
    expect(lunes).toContain('4 elementos');
  });

  /**
   * El modelo no puede afirmar un descanso, así que la palabra no se usa como <b>etiqueta</b>.
   *
   * <p>La comprobación se acota a la lista de días a propósito, y no al componente entero: la nota
   * de abajo sí menciona la palabra, porque explica precisamente por qué no se usa. Prohibirla en
   * la prosa habría obligado a quitar la explicación para que pasara la prueba, que es al revés de
   * lo que se quiere.</p>
   */
  it('un día sin segmento dice «Sin turno», y la palabra «Descanso» no se usa de etiqueta', () => {
    const { dias, raiz } = montar();

    expect(dias()[5].textContent).toContain('Sin turno');
    expect(raiz.querySelector('.patron__dias')!.textContent).not.toContain('Descanso');
  });

  it('marca que un turno cruza la medianoche, que cambia a qué día pertenece', () => {
    const { dias } = montar((h) =>
      h.segments.set([segmento('Monday', { startTime: '19:00:00', endTime: '07:00:00', isOvernight: true })]),
    );

    expect(dias()[0].textContent).toContain('Cruza la medianoche');
  });

  /**
   * Un día nuevo empieza sin horario. Proponer «07:00 – 19:00» porque es lo común haría que se
   * aceptara sin mirar, y el turno quedaría con un horario que nadie eligió.
   */
  it('declarar un día nuevo no propone horario', () => {
    const { dias, boton, host } = montar();

    boton(dias()[5], 'Declarar turno')!.click();

    expect(host.editados()).toEqual([
      {
        idShiftSegment: null,
        dayOfWeek: 'Saturday',
        startTime: '',
        endTime: '',
        isOvernight: false,
        requiredWorkerCount: 1,
      },
    ]);
  });

  it('corregir un día declarado lleva lo que ya tenía', () => {
    const { dias, boton, host } = montar();

    boton(dias()[0], 'Corregir')!.click();

    expect(host.editados()[0]).toEqual({
      idShiftSegment: 'seg-Monday',
      dayOfWeek: 'Monday',
      startTime: '07:00',
      endTime: '19:00',
      isOvernight: false,
      requiredWorkerCount: 4,
    });
  });

  it('quitar un día avisa cuál', () => {
    const { dias, boton, host } = montar();

    boton(dias()[1], 'Quitar')!.click();

    expect(host.quitados()).toEqual(['Tuesday']);
  });

  it('sin permiso de escritura enseña el patrón pero no ofrece cambiarlo', () => {
    const { raiz, nombres } = montar((h) => h.canWrite.set(false));

    expect(nombres()).toHaveLength(7);
    expect(raiz.querySelectorAll('.patron__link')).toHaveLength(0);
  });

  /**
   * Sin patrón la posición no proyecta nada y la semana publicada no la incluye, así que el vacío
   * dice qué falta y ofrece resolverlo.
   */
  it('sin patrón dice qué falta y ofrece crearlo', () => {
    const { raiz, host } = montar((h) => {
      h.hasPattern.set(false);
      h.segments.set([]);
    });

    expect(raiz.querySelector('.patron__dias')).toBeNull();
    expect(raiz.textContent).toContain('Esta posición no tiene patrón');

    raiz.querySelector<HTMLButtonElement>('button')!.click();
    expect(host.creaciones()).toBe(1);
  });

  it('un segmento desactivado no cuenta como día declarado', () => {
    const { raiz, dias } = montar((h) =>
      h.segments.set([segmento('Monday'), segmento('Tuesday', { active: false })]),
    );

    expect(raiz.querySelector('.patron__resumen')!.textContent!.trim()).toBe('1 de 7 días declarados');
    expect(dias()[1].textContent).toContain('Sin turno');
  });

  /** Los ciclos quedan fuera de fase 1, y la razón se dice en vez de dejar un control apagado. */
  it('explica por qué no hay patrones cíclicos, en lugar de callarlo', () => {
    const { raiz } = montar();

    const notas = raiz.querySelector('.patron__nota')!.textContent!.replace(/\s+/g, ' ');
    expect(notas).toContain('patrones semanales');
    expect(notas).toContain('24×48');
    expect(notas).toContain('el modelo no lo puede expresar');
  });
});
