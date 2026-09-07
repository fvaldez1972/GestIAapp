import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiCandidate, GiCandidatePicker } from './gi-candidate-picker';

const ELEGIBLE: GiCandidate = {
  id: 'e-1',
  name: 'Ismael Trujano Bermúdez',
  role: 'Guardia de acceso',
  availability: 'Sin turno el jueves 10',
  standing: 'eligible',
};

const SIN_PUESTO: GiCandidate = {
  id: 'e-2',
  name: 'Efraín Solórzano',
  role: 'Sin puesto registrado',
  availability: 'Sin turno el jueves 10',
  standing: 'review',
  consequence: 'P-01 pide «Guardia de acceso» y de él no sabemos el puesto. Conviene completar su ficha en Personal.',
};

const CON_TRASLAPE: GiCandidate = {
  id: 'e-3',
  name: 'Rubén Darío Ortiz',
  role: 'Guardia de acceso',
  availability: 'Cubre P-04 el jueves 10, 07–15',
  standing: 'overlap',
  consequence: 'Al elegirlo, P-04 queda con un elemento menos ese jueves: el hueco se mueve, no desaparece.',
};

@Component({
  imports: [GiCandidatePicker],
  template: `
    <gi-candidate-picker
      [candidates]="candidates()"
      [emptyActionLabel]="emptyActionLabel()"
      (choose)="elegidos.set([...elegidos(), $event.id])"
      (resolveEmpty)="resoluciones.set(resoluciones() + 1)"
    />
  `,
})
class Anfitrion {
  readonly candidates = signal<readonly GiCandidate[]>([ELEGIBLE, SIN_PUESTO, CON_TRASLAPE]);
  readonly emptyActionLabel = signal('Asignar personal al servicio');
  readonly elegidos = signal<string[]>([]);
  readonly resoluciones = signal(0);
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
    filas: () => Array.from(raiz.querySelectorAll('.gi-cand__item')),
    pildoras: () =>
      Array.from(raiz.querySelectorAll('.gi-cand__pill')).map((p) => p.textContent?.trim()),
    elegir: (indice: number) =>
      (raiz.querySelectorAll<HTMLButtonElement>('.gi-cand__choose')[indice]).click(),
  };
}

describe('GiCandidatePicker', () => {
  /**
   * La decisión de negocio, hecha comportamiento: nadie queda fuera de la lista. El supervisor a
   * las 07:20 con un turno descubierto va a mover a alguien de todos modos; si el sistema no lo
   * deja, lo mueve por teléfono y el sistema queda mintiendo sobre dónde está la gente.
   */
  it('los tres se pueden elegir: ni el traslape ni el puesto desconocido bloquean', () => {
    const { filas, elegir, host } = montar();

    expect(filas()).toHaveLength(3);

    elegir(0);
    elegir(1);
    elegir(2);

    expect(host.elegidos()).toEqual(['e-1', 'e-2', 'e-3']);
  });

  it('nombra el estado de cada candidato con palabras', () => {
    const { pildoras } = montar();

    expect(pildoras()).toEqual(['Elegible', 'Revisar puesto', 'Traslape']);
  });

  /**
   * La condición que acompaña a la decisión: el aviso nombra qué queda corto. «Hay traslape» a
   * secas es un botón de continuar con otra redacción.
   */
  it('el traslape dice qué posición queda corta y en qué turno', () => {
    const { filas } = montar();

    const traslape = filas()[2].textContent!;
    expect(traslape).toContain('P-04 queda con un elemento menos');
    expect(traslape).toContain('el hueco se mueve, no desaparece');
  });

  /** F1 cerró la comparación por texto libre. Un puesto nulo ya no es un veto, es un aviso. */
  it('el puesto desconocido se explica en vez de descartar a la persona', () => {
    const { filas } = montar();

    const revisar = filas()[1].textContent!;
    expect(revisar).toContain('Sin puesto registrado');
    expect(revisar).toContain('no sabemos el puesto');
  });

  it('el resumen dice cuántos vienen sin aviso', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.gi-cand__count')!.textContent!.trim()).toBe('3 · 1 sin aviso');
  });

  /**
   * Una lista vacía no se dibuja vacía: dice qué falta y ofrece la salida. Sin candidatos la única
   * salida real es declarar el turno sin cubrir, y eso hay que decirlo.
   */
  it('sin candidatos dice qué falta y cómo resolverlo', () => {
    const { raiz, host } = montar((h) => h.candidates.set([]));

    expect(raiz.querySelector('.gi-cand__list')).toBeNull();
    expect(raiz.querySelector('.gi-cand__empty-title')!.textContent).toContain('Nadie puede tomar');
    expect(raiz.querySelector('.gi-cand__empty-body')!.textContent).toContain('sin cubrir');

    raiz.querySelector<HTMLButtonElement>('.gi-cand__link')!.click();
    expect(host.resoluciones()).toBe(1);
  });

  it('rompe en desarrollo si un traslape no nombra la consecuencia', () => {
    expect(() =>
      montar((h) => h.candidates.set([{ ...CON_TRASLAPE, consequence: '' }])),
    ).toThrowError(/nombre la consecuencia/);
  });

  it('rompe en desarrollo si un candidato a revisar no dice qué revisar', () => {
    expect(() =>
      montar((h) => h.candidates.set([{ ...SIN_PUESTO, consequence: undefined }])),
    ).toThrowError(/qué le falta al expediente/);
  });

  it('rompe en desarrollo si la lista vacía no ofrece salida', () => {
    expect(() =>
      montar((h) => {
        h.candidates.set([]);
        h.emptyActionLabel.set('');
      }),
    ).toThrowError(/sin salida/);
  });
});
