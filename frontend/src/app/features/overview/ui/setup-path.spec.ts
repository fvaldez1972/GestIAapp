import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Overview } from '../data-access/overview.models';
import { overview } from './overview-fixtures';
import { SetupPath } from './setup-path';

@Component({
  imports: [SetupPath],
  template: `<app-setup-path [overview]="data()" [organizationId]="organizationId()" />`,
})
class Anfitrion {
  readonly data = signal<Overview>(overview(0));
  readonly organizationId = signal('org-a');
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
    contenedor: () => raiz.querySelector('.path')!,
    filas: () => Array.from(raiz.querySelectorAll('.step')),
    // Sólo el nombre del paso: la píldora «Hecho» sí cambia entre densidades, y debe cambiar.
    titulos: () => Array.from(raiz.querySelectorAll('.step__name')).map((n) => n.textContent!.trim()),
    lista: () => raiz.querySelector<HTMLElement>('.path__steps')!,
    interruptor: () => raiz.querySelector<HTMLButtonElement>('.path__toggle'),
  };
}

describe('El camino de configuración', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] });
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('las tres proporciones', () => {
    it('recién creada, el camino ocupa el cuerpo', () => {
      const { contenedor, filas } = montar();

      expect(contenedor().classList.contains('path--full')).toBe(true);
      expect(filas()).toHaveLength(7);
    });

    it('a medias, el camino se encoge', () => {
      const { contenedor, raiz } = montar((host) => host.data.set(overview(3)));

      expect(contenedor().classList.contains('path--compact')).toBe(true);
      expect(raiz.textContent).toContain('3 de 7 pasos');
    });

    it('completa, el camino queda en una línea', () => {
      const { contenedor, raiz, interruptor } = montar((host) => host.data.set(overview(7)));

      expect(contenedor().classList.contains('path--line')).toBe(true);
      expect(raiz.textContent).toContain('Configuración completa');
      expect(interruptor()?.textContent?.trim()).toBe('Revisar configuración');
    });
  });

  /**
   * El punto del diseño: **es una estructura que cambia de proporción, no tres pantallas**. Si los
   * siete pasos se reconstruyeran en cada densidad, serían tres listas que se pueden desincronizar
   * y esta prueba es la que lo impide.
   */
  it('los mismos siete pasos, con los mismos textos, existen en las tres densidades', () => {
    const { host, fixture, titulos } = montar();
    const enCero = titulos();

    host.data.set(overview(3));
    fixture.detectChanges();
    const aMedias = titulos();

    host.data.set(overview(7));
    fixture.detectChanges();
    const completa = titulos();

    expect(enCero).toHaveLength(7);
    expect(aMedias).toEqual(enCero);
    expect(completa).toEqual(enCero);
  });

  describe('se cierra, no se borra', () => {
    it('con el camino cerrado los pasos siguen en el marcado, sólo escondidos', () => {
      const { lista, filas } = montar((host) => host.data.set(overview(7)));

      expect(filas()).toHaveLength(7);
      expect(lista().hidden).toBe(true);
    });

    it('la línea se vuelve a abrir, y el botón dice lo contrario', () => {
      const { fixture, lista, interruptor } = montar((host) => host.data.set(overview(7)));

      interruptor()!.click();
      fixture.detectChanges();

      expect(lista().hidden).toBe(false);
      expect(interruptor()!.textContent!.trim()).toBe('Ocultar configuración');
      expect(interruptor()!.getAttribute('aria-expanded')).toBe('true');
    });

    it('lo que se abrió a mano se recuerda por organización', () => {
      const primera = montar((host) => host.data.set(overview(7)));
      primera.interruptor()!.click();
      primera.fixture.detectChanges();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] });

      const segunda = montar((host) => host.data.set(overview(7)));
      expect(segunda.lista().hidden).toBe(false);

      // Y no se contagia a otra organización: cada una recuerda la suya.
      segunda.host.organizationId.set('org-b');
      segunda.fixture.detectChanges();
      expect(segunda.lista().hidden).toBe(true);
    });
  });

  /**
   * La densidad sale del conteo, no de la preferencia. Si alguien desactiva su único servicio, un
   * paso deja de estar hecho y el camino vuelve a crecer solo, aunque el usuario lo hubiera
   * cerrado.
   */
  it('la densidad se recalcula del conteo, no de lo que el usuario cerró', () => {
    const { host, fixture, contenedor } = montar((anfitrion) => anfitrion.data.set(overview(7)));

    expect(contenedor().classList.contains('path--line')).toBe(true);

    host.data.set(overview(5));
    fixture.detectChanges();

    expect(contenedor().classList.contains('path--compact')).toBe(true);
    expect(contenedor().classList.contains('path--line')).toBe(false);
  });

  /**
   * Sólo un paso se destaca: el primero pendiente que no depende de nada. Destacar cuatro es no
   * destacar ninguno, y quien entra por primera vez necesita saber por dónde empezar.
   */
  it('destaca un solo paso: el que se puede empezar ahora', () => {
    const { raiz } = montar((host) => host.data.set(overview(2)));

    const destacados = raiz.querySelectorAll('.step--current');
    expect(destacados).toHaveLength(1);
    expect(destacados[0].textContent).toContain('Servicio con su configuración');
  });

  it('el avance no depende sólo de las barras: el conteo va en palabras', () => {
    const { raiz } = montar((host) => host.data.set(overview(3)));

    expect(raiz.querySelector('.path__bars')?.getAttribute('aria-hidden')).toBe('true');
    expect(raiz.querySelector('.path__count')?.textContent?.trim()).toBe('3 de 7 pasos');
  });
});
