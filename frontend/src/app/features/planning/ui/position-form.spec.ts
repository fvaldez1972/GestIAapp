import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PositionDraft, PositionForm } from './position-form';

@Component({
  imports: [PositionForm],
  template: `
    <app-position-form
      [saving]="saving()"
      [usedCodes]="usedCodes()"
      (save)="guardados.set([...guardados(), $event])"
      (cancel)="cancelaciones.set(cancelaciones() + 1)"
    />
  `,
})
class Anfitrion {
  readonly saving = signal(false);
  readonly usedCodes = signal<readonly string[]>(['P-01']);
  readonly guardados = signal<PositionDraft[]>([]);
  readonly cancelaciones = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;
  const inputs = () => Array.from(raiz.querySelectorAll<HTMLInputElement>('input'));

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    escribir: (indice: number, valor: string) => {
      inputs()[indice].value = valor;
      inputs()[indice].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    guardar: () => raiz.querySelector<HTMLButtonElement>('.pos__guardar')!,
    problema: () => raiz.querySelector('.pos__problema')?.textContent?.trim() ?? null,
  };
}

/** El alta mínima válida: código, nombre y un elemento. */
function completar(f: ReturnType<typeof montar>) {
  f.escribir(0, 'P-02');
  f.escribir(1, 'Rondín nocturno');
}

describe('PositionForm', () => {
  /**
   * La posición existe con independencia de quién la ocupe: es el primer principio del proyecto.
   * Preguntar aquí por una persona ataría el puesto a alguien que puede irse mañana.
   */
  it('no pregunta por ninguna persona', () => {
    const { raiz } = montar();

    expect(raiz.textContent).not.toContain('Empleado');
    expect(raiz.textContent).not.toContain('Titular');
    expect(raiz.textContent).not.toContain('Persona');
  });

  /**
   * El código no se propone. Uno sugerido se acepta sin mirarlo, y el código de una posición es lo
   * que la operación va a usar para nombrarla en voz alta.
   */
  it('el código empieza vacío y sin sugerencia', () => {
    const { raiz } = montar();

    const codigo = raiz.querySelector<HTMLInputElement>('input')!;
    expect(codigo.value).toBe('');
  });

  it('guarda el alta con los campos recortados', () => {
    const f = montar();

    f.escribir(0, '  P-02  ');
    f.escribir(1, '  Rondín nocturno  ');
    f.escribir(2, '3');
    f.guardar().click();

    expect(f.host.guardados()).toEqual([
      { codePosition: 'P-02', name: 'Rondín nocturno', requiredWorkerCount: 3, notes: null },
    ]);
  });

  it('dice qué falta, y no un «revisa los campos»', () => {
    const f = montar();

    expect(f.guardar().disabled).toBe(true);
    expect(f.problema()).toContain('Falta el código');

    f.escribir(0, 'P-02');
    expect(f.problema()).toContain('Falta el nombre');

    completar(f);
    expect(f.guardar().disabled).toBe(false);
  });

  /**
   * <b>Una clave única sigue ocupada aunque el registro esté inactivo</b>, porque aquí no se borra.
   * El aviso lo dice con esas palabras: un «ya existe» a secas manda a buscar una posición que no
   * aparece en la lista, porque está dada de baja.
   */
  it('avisa del código repetido mientras se escribe, y explica que las bajas lo conservan', () => {
    const f = montar();

    f.escribir(0, 'P-01');

    expect(f.guardar().disabled).toBe(true);
    expect(f.problema()).toContain('ya está en uso');
    expect(f.problema()).toContain('aunque la posición esté inactiva');
  });

  it('el choque de código no distingue mayúsculas', () => {
    const f = montar();

    f.escribir(0, 'p-01');

    expect(f.problema()).toContain('ya está en uso');
  });

  it('no deja crear una posición que no pide a nadie', () => {
    const f = montar();

    completar(f);
    f.escribir(2, '0');

    expect(f.guardar().disabled).toBe(true);
    expect(f.problema()).toContain('al menos un elemento');
  });

  it('mientras guarda no deja guardar otra vez', () => {
    const f = montar((h) => h.saving.set(true));

    completar(f);

    expect(f.guardar().disabled).toBe(true);
  });

  it('cancelar avisa y no guarda nada', () => {
    const f = montar();

    completar(f);
    f.raiz.querySelector<HTMLButtonElement>('.pos__cancelar')!.click();

    expect(f.host.cancelaciones()).toBe(1);
    expect(f.host.guardados()).toEqual([]);
  });
});
