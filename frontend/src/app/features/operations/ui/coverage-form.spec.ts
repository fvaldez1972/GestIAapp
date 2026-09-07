import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiCandidate, GiSelectOption } from '../../../shared/ui/gi-ui';
import { CoverageDraft, CoverageForm, CoverageTarget } from './coverage-form';

const TURNO: CoverageTarget = {
  idScheduledShift: 't-1',
  positionCode: 'P-01',
  positionName: 'Acceso principal',
  originalEmployeeName: 'Laura Menchaca',
  startTime: '07:00',
  endTime: '19:00',
  isOvernight: false,
};

const LIBRE: GiCandidate = {
  id: 'e-1',
  name: 'Ismael Trujano',
  role: 'Guardia de acceso',
  availability: 'Sin turno ese día',
  standing: 'eligible',
};

const CON_TRASLAPE: GiCandidate = {
  id: 'e-2',
  name: 'Rubén Darío Ortiz',
  role: 'Guardia de acceso',
  availability: 'Cubre P-04 ese día, 07:00–15:00',
  standing: 'overlap',
  consequence: 'Al elegirlo, P-04 queda con un elemento menos ese día: el hueco se mueve, no desaparece.',
};

const MOTIVOS: readonly GiSelectOption[] = [
  { value: 'cat-1', label: 'Falta sin aviso' },
  { value: 'cat-2', label: 'Incapacidad médica' },
];

@Component({
  imports: [CoverageForm],
  template: `
    <app-coverage-form
      [target]="target()"
      [candidates]="candidates()"
      [reasons]="reasons()"
      [canWrite]="true"
      [isCorrection]="isCorrection()"
      [dayClosed]="dayClosed()"
      [saving]="saving()"
      (save)="guardados.set([...guardados(), $event])"
      (cancel)="cancelaciones.set(cancelaciones() + 1)"
      (resolveEmpty)="asignaciones.set(asignaciones() + 1)"
    />
  `,
})
class Anfitrion {
  readonly target = signal<CoverageTarget>(TURNO);
  readonly candidates = signal<readonly GiCandidate[]>([LIBRE, CON_TRASLAPE]);
  readonly reasons = signal<readonly GiSelectOption[]>(MOTIVOS);
  readonly isCorrection = signal(false);
  readonly dayClosed = signal(false);
  readonly saving = signal(false);
  readonly guardados = signal<CoverageDraft[]>([]);
  readonly cancelaciones = signal(0);
  readonly asignaciones = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;
  const inputs = () => Array.from(raiz.querySelectorAll<HTMLInputElement>('.cob__campo input'));

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    guardar: () => raiz.querySelector<HTMLButtonElement>('.cob__guardar')!,
    problema: () => raiz.querySelector('.cob__problema')?.textContent?.trim() ?? null,
    elegirCandidato: (indice: number) => {
      raiz.querySelectorAll<HTMLButtonElement>('.gi-cand__choose')[indice].click();
      fixture.detectChanges();
    },
    // El motivo salio del gi-select y pasa por el buscador del catalogo: se escribe y se elige,
    // que es lo mismo que hace el supervisor.
    elegirMotivo: (texto: string) => {
      const campo = raiz.querySelector<HTMLInputElement>('#cob-motivo')!;
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      raiz.querySelector<HTMLButtonElement>('.pick__elegir')!.click();
      fixture.detectChanges();
    },
    escribirHora: (indice: number, valor: string) => {
      inputs()[indice].value = valor;
      inputs()[indice].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    escribir: (indice: number, valor: string) => {
      const areas = Array.from(raiz.querySelectorAll<HTMLTextAreaElement>('textarea'));
      areas[indice].value = valor;
      areas[indice].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    inputs,
  };
}

/** Deja el formulario listo para guardar: alguien que cubre y un motivo. */
function completar(f: ReturnType<typeof montar>, indiceCandidato = 0) {
  f.elegirCandidato(indiceCandidato);
  f.elegirMotivo('Falta sin aviso');
}

describe('CoverageForm', () => {
  it('dice qué turno se está cubriendo y quién lo dejó descubierto', () => {
    const { raiz } = montar();

    const turno = raiz.querySelector('.cob__turno')!.textContent!;
    expect(turno).toContain('P-01');
    expect(turno).toContain('07:00 – 19:00');
    expect(turno).toContain('Laura Menchaca');
  });

  describe('el traslape', () => {
    /**
     * La decisión: se permite y se advierte. Bloquearlo expulsa el dato, porque el supervisor mueve
     * a alguien de todos modos y lo hace fuera del sistema.
     */
    it('quien ya tiene turno aparece en la lista y se puede elegir', () => {
      const f = montar();

      expect(f.raiz.querySelectorAll('.gi-cand__item')).toHaveLength(2);

      completar(f, 1);
      f.guardar().click();

      expect(f.host.guardados()[0].idReplacementEmployee).toBe('e-2');
    });

    /** La condición que acompaña a la decisión: el aviso nombra qué queda descubierto. */
    it('el aviso dice qué posición queda corta', () => {
      const { raiz } = montar();

      expect(raiz.textContent).toContain('P-04 queda con un elemento menos');
      expect(raiz.textContent).toContain('el hueco se mueve, no desaparece');
    });
  });

  describe('el horario', () => {
    /**
     * Arranca en el del turno, y eso no contradice la regla de no proponer valores: lo que no se
     * propone es lo que nadie eligió. El horario del turno ES lo que se está cubriendo.
     */
    it('arranca con el del turno, y se puede acortar', () => {
      const f = montar();

      expect(f.inputs()[0].value).toBe('07:00');
      expect(f.inputs()[1].value).toBe('19:00');
      expect(f.raiz.textContent).toContain('Si sólo se cubre una parte, acórtalo');

      completar(f);
      f.escribirHora(1, '15:00');
      f.guardar().click();

      expect(f.host.guardados()[0].coverageEndTime).toBe('15:00');
    });

    it('no deja terminar antes de empezar si el turno no cruza la medianoche', () => {
      const f = montar();

      completar(f);
      f.escribirHora(0, '19:00');
      f.escribirHora(1, '07:00');

      expect(f.guardar().disabled).toBe(true);
      expect(f.problema()).toContain('no cruza la medianoche');
    });

    /** Que cruce la medianoche lo hereda del turno, en vez de volver a preguntarlo. */
    it('un turno nocturno hereda que cruza la medianoche', () => {
      const f = montar((h) =>
        h.target.set({ ...TURNO, startTime: '19:00', endTime: '07:00', isOvernight: true }),
      );

      completar(f);

      expect(f.guardar().disabled).toBe(false);
      f.guardar().click();
      expect(f.host.guardados()[0].isOvernight).toBe(true);
    });
  });

  describe('los dos motivos', () => {
    it('el del hecho sale del catálogo y es obligatorio', () => {
      const f = montar();

      f.elegirCandidato(0);
      expect(f.guardar().disabled).toBe(true);
      expect(f.problema()).toContain('por qué hizo falta cubrir');

      f.elegirMotivo('Incapacidad médica');
      expect(f.guardar().disabled).toBe(false);
      f.guardar().click();
      expect(f.host.guardados()[0].idCoverageReason).toBe('cat-2');
    });

    it('un día abierto no pide motivo de corrección', () => {
      const { raiz } = montar((h) => h.isCorrection.set(true));

      expect(raiz.querySelector('.cob__bloque--motivo')).toBeNull();
    });

    it('corregir un día cerrado pide el de la corrección, aparte del del hecho', () => {
      const f = montar((h) => {
        h.isCorrection.set(true);
        h.dayClosed.set(true);
      });

      const motivo = f.raiz.querySelector('.cob__bloque--motivo')!.textContent!;
      expect(motivo).toContain('no por qué hizo falta cubrir');

      f.elegirMotivo('Falta sin aviso');
      f.escribir(1, 'Se corrigió el horario con el reporte del supervisor.');
      f.guardar().click();

      const guardado = f.host.guardados()[0];
      expect(guardado.idCoverageReason).toBe('cat-1');
      expect(guardado.correctionReason).toBe('Se corrigió el horario con el reporte del supervisor.');
    });
  });

  /** Al corregir ya hay suplente: volver a elegirlo sería cambiar quién cubrió, que es otra cosa. */
  it('al corregir no vuelve a preguntar quién cubre', () => {
    const { raiz } = montar((h) => h.isCorrection.set(true));

    expect(raiz.querySelector('gi-candidate-picker')).toBeNull();
  });

  it('sin candidatos lo dice y ofrece asignar personal', () => {
    const f = montar((h) => h.candidates.set([]));

    expect(f.problema()).toContain('No hay nadie asignado al servicio');
    f.raiz.querySelector<HTMLButtonElement>('.gi-cand__link')!.click();
    expect(f.host.asignaciones()).toBe(1);
  });

  it('sin motivos en el catálogo lo dice', () => {
    const f = montar((h) => h.reasons.set([]));

    f.elegirCandidato(0);

    expect(f.problema()).toContain('catálogo de motivos de cobertura está vacío');
  });

  it('cancelar avisa y no guarda nada', () => {
    const f = montar();

    f.raiz.querySelector<HTMLButtonElement>('.cob__cancelar')!.click();

    expect(f.host.cancelaciones()).toBe(1);
    expect(f.host.guardados()).toEqual([]);
  });
});
