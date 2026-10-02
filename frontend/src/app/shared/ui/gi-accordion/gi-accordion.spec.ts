import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiAccordion } from './gi-accordion';

@Component({
  imports: [GiAccordion],
  template: `
    <gi-accordion
      [label]="rotulo()"
      [count]="cuenta()"
      [summary]="resumen()"
      [open]="abierta()"
      [tone]="tono()"
      [toneLabel]="palabra()"
      (openChange)="cambios.push($event)"
    >
      <p class="dentro">Contenido de la sección</p>
      <button type="button" class="dentro__accion">Editar</button>
    </gi-accordion>
  `,
})
class Anfitrion {
  readonly rotulo = signal('Domicilio');
  readonly cuenta = signal<number | null>(null);
  readonly resumen = signal('Mérida, Yucatán');
  readonly abierta = signal(false);
  readonly tono = signal<'neutral' | 'success' | 'warning' | 'danger'>('neutral');
  readonly palabra = signal('');
  readonly cambios: boolean[] = [];
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    toggle: () => raiz.querySelector<HTMLButtonElement>('.acc__toggle')!,
    cuerpo: () => raiz.querySelector('.dentro'),
    pulsar: () => {
      raiz.querySelector<HTMLButtonElement>('.acc__toggle')!.click();
      fixture.detectChanges();
    },
  };
}

describe('La sección plegable', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  /**
   * El cuerpo **se quita del árbol**, no se esconde con CSS.
   *
   * <p>Es la diferencia que importa para quien navega con teclado o con lector: un bloque oculto
   * con <c>display:none</c> sigue fuera de la vista pero también fuera del orden de tabulación,
   * mientras que uno escondido con opacidad o altura cero se tabula sin verse. Quitarlo del árbol
   * no deja lugar a dudas.</p>
   */
  it('plegada no deja su contenido en el árbol', () => {
    const { cuerpo, pulsar, raiz } = montar();

    expect(cuerpo()).toBeNull();
    expect(raiz.querySelector('.dentro__accion')).toBeNull();

    pulsar();

    expect(cuerpo()).not.toBeNull();
    expect(raiz.querySelector('.dentro__accion')).not.toBeNull();
  });

  /**
   * El resumen es lo que hace que plegar no cueste nada.
   *
   * <p>Una sección cerrada que sólo dice «Domicilio» obliga a abrirla para saber si hay algo
   * dentro, y entonces plegar sólo ha añadido un clic. Abierta se retira, porque repetiría lo que
   * ya se ve debajo.</p>
   */
  it('enseña el resumen cerrada y lo retira abierta', () => {
    const { raiz, pulsar } = montar();

    expect(raiz.querySelector('.acc__summary')!.textContent).toContain('Mérida, Yucatán');

    pulsar();

    expect(raiz.querySelector('.acc__summary')).toBeNull();
  });

  it('avisa del estado a quien lee con lector', () => {
    const { toggle, pulsar } = montar();

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-controls')).toBeTruthy();

    pulsar();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('el rótulo es un botón de verdad, así que responde al teclado', () => {
    const { toggle } = montar();

    // Un `div` con manejador de clic no se enfoca ni se activa con Intro o espacio; un `button` sí,
    // y eso lo da el navegador sin que haya que escribir nada.
    expect(toggle().tagName).toBe('BUTTON');
    expect(toggle().getAttribute('type')).toBe('button');
  });

  /**
   * Lo que el usuario decide manda sobre lo que pida la pantalla.
   *
   * <p>Una sección que se abre sola porque tiene algo urgente se tiene que poder cerrar. Sin esto,
   * el siguiente ciclo de detección de cambios la volvería a abrir y la pantalla pelearía con
   * quien la está usando.</p>
   */
  it('cerrar a mano una sección que nació abierta la deja cerrada', () => {
    const { cuerpo, pulsar, fixture } = montar((host) => host.abierta.set(true));

    expect(cuerpo()).not.toBeNull();

    pulsar();
    expect(cuerpo()).toBeNull();

    // El ciclo de detección no la reabre aunque la entrada siga diciendo que sí.
    fixture.detectChanges();
    expect(cuerpo()).toBeNull();
  });

  it('avisa del cambio hacia fuera', () => {
    const { host, pulsar } = montar();

    pulsar();
    pulsar();

    expect(host.cambios).toEqual([true, false]);
  });

  /** El tono nunca es lo único que lo dice: la palabra va dentro de la píldora. */
  it('el estado lleva palabra, no sólo color', () => {
    const { raiz } = montar((host) => {
      host.tono.set('warning');
      host.palabra.set('Sin capturar');
    });

    const pildora = raiz.querySelector('.acc__pill')!;

    expect(pildora.textContent).toContain('Sin capturar');
    expect(pildora.classList).toContain('acc__pill--warning');
  });

  it('sin contador no dibuja el contador', () => {
    expect(montar().raiz.querySelector('.acc__count')).toBeNull();
    expect(montar((host) => host.cuenta.set(0)).raiz.querySelector('.acc__count')!.textContent).toBe('0');
  });
});
