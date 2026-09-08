import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiRowAction, GiRowActions } from './gi-row-actions';

const ACCIONES: readonly GiRowAction[] = [
  { id: 'editar', label: 'Editar ficha' },
  { id: 'documentos', label: 'Ver documentos' },
  { id: 'desactivar', label: 'Desactivar servicio', destructive: true },
];

@Component({
  imports: [GiRowActions],
  template: `
    <gi-row-actions
      [actions]="acciones()"
      label="Acciones del servicio"
      (select)="elegida.set($event.id)"
    />
  `,
})
class Anfitrion {
  readonly acciones = signal<readonly GiRowAction[]>(ACCIONES);
  readonly elegida = signal('');
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;
  const disparador = () => raiz.querySelector<HTMLButtonElement>('.gi-actions__trigger')!;
  const opciones = () => Array.from(raiz.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  const teclear = (key: string) => {
    raiz.querySelector('gi-row-actions')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  return { fixture, raiz, host: fixture.componentInstance, disparador, opciones, teclear };
}

describe('GiRowActions', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  it('las acciones viven en un menú, no sueltas por la fila', () => {
    const { raiz, disparador, opciones, fixture } = montar();

    expect(opciones()).toHaveLength(0);
    expect(disparador().getAttribute('aria-haspopup')).toBe('menu');
    expect(disparador().getAttribute('aria-expanded')).toBe('false');

    disparador().click();
    fixture.detectChanges();

    expect(raiz.querySelector('[role="menu"]')).not.toBeNull();
    expect(opciones()).toHaveLength(3);
    expect(disparador().getAttribute('aria-expanded')).toBe('true');
  });

  /**
   * El menú se dibujaba por debajo de la fila en Clientes, Personal y Servicios.
   *
   * <p>No era el z-index: el menú ya iba por encima. Era el recorte. La tabla vive en un contenedor
   * con «overflow-x: auto», y en CSS eso obliga al eje vertical a «auto» también, así que el menú
   * quedaba cortado por el borde de la tabla. Ir a la capa superior del navegador es lo que lo saca
   * de cualquier contenedor que recorte, sin depender de que nadie recuerde no poner overflow.</p>
   */
  it('el menú va en la capa superior, fuera del alcance de un contenedor que recorte', () => {
    const { raiz, disparador, fixture } = montar();

    disparador().click();
    fixture.detectChanges();

    const menu = raiz.querySelector('[role="menu"]')!;
    expect(menu.getAttribute('popover')).toBe('manual');
    expect(getComputedStyle(menu).position).not.toBe('absolute');
  });

  it('el botón de sólo icono tiene nombre accesible, y el menú también', () => {
    const { raiz, disparador, fixture } = montar();

    expect(disparador().getAttribute('aria-label')).toBe('Acciones del servicio');
    expect(disparador().textContent?.trim()).toBe('⋯');

    disparador().click();
    fixture.detectChanges();

    expect(raiz.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('Acciones del servicio');
  });

  /** Desactivar algo no puede quedar a un píxel de editarlo. */
  it('la destructiva va la última, separada y en danger', () => {
    const { raiz, disparador, opciones, fixture } = montar();

    disparador().click();
    fixture.detectChanges();

    const ultima = opciones().at(-1)!;
    expect(ultima.textContent).toContain('Desactivar servicio');
    expect(ultima.classList.contains('is-destructive')).toBe(true);
    expect(raiz.querySelector('[role="separator"]')).not.toBeNull();

    // El separador va justo antes de la destructiva, no en cualquier sitio.
    const elementos = Array.from(raiz.querySelectorAll('[role="separator"], [role="none"]'));
    expect(elementos.at(-2)?.getAttribute('role')).toBe('separator');
  });

  it('una acción inhabilitada dice por qué, y no se puede ejecutar', () => {
    const { opciones, disparador, fixture, host } = montar((anfitrion) =>
      anfitrion.acciones.set([
        { id: 'editar', label: 'Editar ficha' },
        {
          id: 'desactivar',
          label: 'Desactivar servicio',
          destructive: true,
          disabled: true,
          disabledReason: 'Tiene turnos programados esta semana',
        },
      ]),
    );

    disparador().click();
    fixture.detectChanges();

    const destructiva = opciones().at(-1)!;
    expect(destructiva.disabled).toBe(true);
    expect(destructiva.textContent).toContain('Tiene turnos programados esta semana');

    destructiva.click();
    fixture.detectChanges();

    expect(host.elegida()).toBe('');
  });

  describe('el teclado', () => {
    it('abre con flecha abajo y elige con Enter', () => {
      const { teclear, host, disparador } = montar();

      disparador().focus();
      teclear('ArrowDown');
      teclear('Enter');

      expect(host.elegida()).toBe('editar');
    });

    it('las flechas dan la vuelta, así que desde la primera se llega a la destructiva', () => {
      const { teclear, host, disparador, fixture } = montar();

      disparador().click();
      fixture.detectChanges();
      teclear('ArrowUp');
      teclear('Enter');

      expect(host.elegida()).toBe('desactivar');
    });

    it('Inicio y Fin van a los extremos', () => {
      const { teclear, host, disparador, fixture } = montar();

      disparador().click();
      fixture.detectChanges();
      teclear('End');
      teclear('Enter');

      expect(host.elegida()).toBe('desactivar');
    });

    it('Escape cierra sin elegir y devuelve el foco al botón', () => {
      const { teclear, host, disparador, opciones, fixture } = montar();

      disparador().click();
      fixture.detectChanges();
      teclear('ArrowDown');
      teclear('Escape');

      expect(host.elegida()).toBe('');
      expect(opciones()).toHaveLength(0);
      expect(document.activeElement).toBe(disparador());
    });

    it('Tab cierra el menú al salir del control', () => {
      const { teclear, opciones, disparador, fixture } = montar();

      disparador().click();
      fixture.detectChanges();
      teclear('Tab');

      expect(opciones()).toHaveLength(0);
    });
  });

  it('elegir con el ratón avisa cuál fue y cierra', () => {
    const { disparador, opciones, fixture, host } = montar();

    disparador().click();
    fixture.detectChanges();
    opciones()[1].click();
    fixture.detectChanges();

    expect(host.elegida()).toBe('documentos');
    expect(opciones()).toHaveLength(0);
  });

  describe('lo que rompe en desarrollo', () => {
    it('una acción inhabilitada sin razón', () => {
      expect(() =>
        montar((host) => host.acciones.set([{ id: 'x', label: 'Editar', disabled: true }])),
      ).toThrowError(/inhabilitada y no dice por qué/);
    });

    it('dos acciones destructivas: la separación dejaría de distinguir cuál es la peligrosa', () => {
      expect(() =>
        montar((host) =>
          host.acciones.set([
            { id: 'a', label: 'Desactivar', destructive: true },
            { id: 'b', label: 'Eliminar', destructive: true },
          ]),
        ),
      ).toThrowError(/una acción destructiva/);
    });
  });
});
