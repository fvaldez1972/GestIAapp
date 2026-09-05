import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GiEmptyState, GiEmptyVariant } from './gi-empty-state';

@Component({
  imports: [GiEmptyState],
  template: `
    <gi-empty-state
      [variant]="variant()"
      [title]="title()"
      [description]="description()"
      [actionLabel]="actionLabel()"
      [link]="link()"
      (action)="acciones.set(acciones() + 1)"
    />
  `,
})
class Anfitrion {
  readonly variant = signal<GiEmptyVariant>('no-data');
  readonly title = signal('');
  readonly description = signal('');
  readonly actionLabel = signal('');
  readonly link = signal<string | null>(null);
  readonly acciones = signal(0);
}

function montar(configurar: (anfitrion: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  return { fixture, raiz: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

describe('GiEmptyState', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));
  afterEach(() => TestBed.resetTestingModule());

  it('se anuncia como estado y no como una región cualquiera', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('[role="status"]')).not.toBeNull();
  });

  describe('las cuatro variantes dicen cosas distintas', () => {
    const esperado: Record<GiEmptyVariant, RegExp> = {
      'no-permission': /No tienes acceso/i,
      'no-data': /Todavía no hay nada/i,
      'no-results': /Ningún resultado con estos filtros/i,
      'missing-prerequisite': /Falta un paso antes/i,
    };

    for (const [variante, texto] of Object.entries(esperado) as [GiEmptyVariant, RegExp][]) {
      it(`${variante} tiene su propio mensaje`, () => {
        const { raiz } = montar((host) => {
          host.variant.set(variante);
          if (variante === 'missing-prerequisite') host.link.set('/catalogos');
        });

        expect(raiz.textContent).toMatch(texto);
      });
    }
  });

  it('la pantalla puede decirlo con sus palabras sin perder la variante', () => {
    const { raiz } = montar((host) => {
      host.variant.set('no-data');
      host.title.set('Todavía no hay clientes');
      host.description.set('Registra el primero para empezar a operar.');
    });

    expect(raiz.textContent).toContain('Todavía no hay clientes');
    expect(raiz.textContent).not.toMatch(/Todavía no hay nada/i);
  });

  /**
   * La variante que justifica el componente: es la única que **no se resuelve donde se ve**, así
   * que lo único que no puede faltarle es el enlace al módulo donde sí se resuelve.
   */
  it('la falta de prerrequisito lleva enlace al módulo donde se obtiene', () => {
    const { raiz } = montar((host) => {
      host.variant.set('missing-prerequisite');
      host.title.set('Necesitas un catálogo de puestos');
      host.link.set('/catalogos');
      host.actionLabel.set('Ir a Catálogos');
    });

    const enlace = raiz.querySelector('a')!;
    expect(enlace.getAttribute('href')).toBe('/catalogos');
    expect(enlace.textContent?.trim()).toBe('Ir a Catálogos');
  });

  it('sin permiso no se ofrece ninguna acción, porque no hay ninguna que sirva', () => {
    const { raiz } = montar((host) => host.variant.set('no-permission'));

    expect(raiz.querySelector('a')).toBeNull();
    expect(raiz.querySelector('button')).toBeNull();
  });

  it('sin resultados ofrece quitar los filtros, y avisa a la pantalla', () => {
    const { fixture, raiz, host } = montar((anfitrion) => {
      anfitrion.variant.set('no-results');
      anfitrion.actionLabel.set('Quitar filtros');
    });

    const boton = raiz.querySelector('button')!;
    expect(boton.textContent?.trim()).toBe('Quitar filtros');

    boton.click();
    fixture.detectChanges();

    expect(host.acciones()).toBe(1);
  });

  describe('lo que rompe en desarrollo', () => {
    it('una falta de prerrequisito sin enlace no se dibuja: sería un callejón sin salida', () => {
      expect(() => montar((host) => host.variant.set('missing-prerequisite')))
        .toThrowError(/missing-prerequisite/);
    });

    it('un vacío sin permiso con acción tampoco: prometería algo que el permiso impide', () => {
      expect(() =>
        montar((host) => {
          host.variant.set('no-permission');
          host.actionLabel.set('Crear el primero');
        }),
      ).toThrowError(/no-permission/);
    });
  });
});
