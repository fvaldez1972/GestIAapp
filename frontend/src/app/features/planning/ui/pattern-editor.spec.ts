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
      (save)="guardados.set([...guardados(), $event])"
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
  readonly guardados = signal<SegmentDraft[]>([]);
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
    campos: () => {
      const inputs = Array.from(raiz.querySelectorAll<HTMLInputElement>('.patron__form input'));

      return { entrada: inputs[0], salida: inputs[1], elementos: inputs[2], nocturno: inputs[3] };
    },
    escribir: (campo: 'entrada' | 'salida' | 'elementos', valor: string) => {
      const inputs = Array.from(raiz.querySelectorAll<HTMLInputElement>('.patron__form input'));
      const indice = { entrada: 0, salida: 1, elementos: 2 }[campo];

      inputs[indice].value = valor;
      inputs[indice].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    guardar: () =>
      Array.from(raiz.querySelectorAll<HTMLButtonElement>('.patron__form button')).find(
        (b) => b.textContent?.trim() === 'Guardar',
      )!,
  };
}

/** Marca la casilla de turno nocturno y deja el árbol al día. */
function marcarNocturno(raiz: HTMLElement, fixture: { detectChanges(): void }) {
  const casilla = Array.from(raiz.querySelectorAll<HTMLInputElement>('.patron__form input')).at(-1)!;

  casilla.checked = true;
  casilla.dispatchEvent(new Event('change'));
  fixture.detectChanges();
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
  it('declarar un día nuevo abre el formulario vacío, debajo de ese día', () => {
    const { dias, boton, campos, fixture } = montar();

    boton(dias()[5], 'Declarar turno')!.click();
    fixture.detectChanges();

    expect(campos().entrada.value).toBe('');
    expect(campos().salida.value).toBe('');
    expect(campos().elementos.value).toBe('1');
  });

  it('corregir un día declarado abre el formulario con lo que ya tenía', () => {
    const { dias, boton, campos, fixture } = montar();

    boton(dias()[0], 'Corregir')!.click();
    fixture.detectChanges();

    expect(campos().entrada.value).toBe('07:00');
    expect(campos().salida.value).toBe('19:00');
    expect(campos().elementos.value).toBe('4');
  });

  it('guardar avisa el borrador completo y cierra el formulario', () => {
    const { dias, boton, escribir, guardar, fixture, host, raiz } = montar();

    boton(dias()[5], 'Declarar turno')!.click();
    fixture.detectChanges();

    escribir('entrada', '06:00');
    escribir('salida', '14:00');
    escribir('elementos', '3');
    guardar().click();
    fixture.detectChanges();

    expect(host.guardados()).toEqual([
      {
        idShiftSegment: null,
        dayOfWeek: 'Saturday',
        startTime: '06:00',
        endTime: '14:00',
        isOvernight: false,
        requiredWorkerCount: 3,
      },
    ]);
    expect(raiz.querySelector('.patron__form')).toBeNull();
  });

  /**
   * Se dice QUÉ falta, no un «revisa los campos»: quien lo lee necesita saber cuál, y el botón
   * apagado va amarrado a esa explicación.
   */
  it('no deja guardar sin horario, y dice qué falta', () => {
    const { dias, boton, guardar, fixture, raiz } = montar();

    boton(dias()[5], 'Declarar turno')!.click();
    fixture.detectChanges();

    expect(guardar().disabled).toBe(true);
    const problema = raiz.querySelector('.patron__problema')!;
    expect(problema.textContent).toContain('Falta la hora de entrada o la de salida');
    expect(guardar().getAttribute('aria-describedby')).toBe(problema.id);
  });

  /**
   * Un turno que termina antes de empezar sólo tiene sentido si cruza la medianoche, y eso se
   * declara. Sin la marca, el servidor lo rechazaría con un mensaje que no explica esto.
   */
  it('una salida anterior a la entrada pide declarar que cruza la medianoche', () => {
    const { dias, boton, escribir, guardar, fixture, raiz } = montar();

    boton(dias()[5], 'Declarar turno')!.click();
    fixture.detectChanges();

    escribir('entrada', '19:00');
    escribir('salida', '07:00');

    expect(guardar().disabled).toBe(true);
    expect(raiz.querySelector('.patron__problema')!.textContent).toContain('cruza la medianoche');

    marcarNocturno(raiz, fixture);
    expect(guardar().disabled).toBe(false);
  });

  it('no deja guardar un turno de cero elementos', () => {
    const { dias, boton, escribir, guardar, fixture, raiz } = montar();

    boton(dias()[5], 'Declarar turno')!.click();
    fixture.detectChanges();

    escribir('entrada', '07:00');
    escribir('salida', '19:00');
    escribir('elementos', '0');

    expect(guardar().disabled).toBe(true);
    expect(raiz.querySelector('.patron__problema')!.textContent).toContain('al menos un elemento');
  });

  it('cancelar cierra el formulario sin avisar nada', () => {
    const { dias, boton, fixture, host, raiz } = montar();

    boton(dias()[5], 'Declarar turno')!.click();
    fixture.detectChanges();
    (Array.from(raiz.querySelectorAll('.patron__form button')).find(
      (b) => b.textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(raiz.querySelector('.patron__form')).toBeNull();
    expect(host.guardados()).toEqual([]);
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
