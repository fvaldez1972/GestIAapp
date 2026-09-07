import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiDetailPanel, GiTab, GiTabContent } from './gi-detail-panel';

const PESTANAS: readonly GiTab[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'sedes', label: 'Sedes', count: 4 },
  { id: 'contactos', label: 'Contactos', count: 0 },
  { id: 'documentos', label: 'Documentos', count: 12 },
];

@Component({
  imports: [GiDetailPanel, GiTabContent],
  template: `
    <gi-detail-panel
      [title]="titulo()"
      [subtitle]="subtitulo()"
      [tabs]="pestanas()"
      [activeTab]="activa()"
      (tabChange)="activa.set($event)"
      (close)="cierres.set(cierres() + 1)"
    >
      <ng-template giTab="datos">Razón social y RFC</ng-template>
      <ng-template giTab="sedes">Peñón de los Baños</ng-template>
      <ng-template giTab="contactos">Sin contactos registrados</ng-template>
      <ng-template giTab="documentos">Acta constitutiva</ng-template>
      <button panelFooter type="button">Guardar cambios</button>
    </gi-detail-panel>
  `,
})
class Anfitrion {
  readonly titulo = signal('Almacenes Reforma, S.A. de C.V.');
  readonly subtitulo = signal('ARE110228ZX1');
  readonly pestanas = signal<readonly GiTab[]>(PESTANAS);
  readonly activa = signal('');
  readonly cierres = signal(0);
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
    tabs: () => Array.from(raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]')),
    cuerpo: () => raiz.querySelector('.gi-panel__body')!,
  };
}

describe('GiDetailPanel', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  /**
   * La decisión que separa este panel de un cajón: es una columna del contenido. La tabla se
   * comprime a su lado, no se tapa, así que no se pierde de vista dónde estabas.
   */
  it('mide 620 px y es una columna, no una capa encima', () => {
    // jsdom no resuelve variables CSS, así que la medida se comprueba donde está escrita: el
    // componente toma el ancho del token y el token vale 620 px.
    const componente = readFileSync(
      resolve('src/app/shared/ui/gi-detail-panel/gi-detail-panel.ts'), 'utf8');
    const hoja = readFileSync(resolve('src/styles.css'), 'utf8');

    const host = componente.slice(componente.indexOf(':host {'), componente.indexOf('.gi-panel {'));

    expect(host).toContain('width: var(--gestia-panel-width)');
    expect(hoja).toContain('--gestia-panel-width: 620px');

    // Y es columna: nada de posicionarlo encima de la tabla.
    expect(host).not.toMatch(/position:\s*(fixed|absolute)/);
    expect(componente).not.toContain('showModal');
  });

  it('se anuncia como región con el nombre del registro abierto', () => {
    const { raiz } = montar();
    const region = raiz.querySelector('[role="region"]')!;

    expect(region.getAttribute('aria-label')).toBe('Almacenes Reforma, S.A. de C.V.');
    expect(raiz.textContent).toContain('ARE110228ZX1');
  });

  it('el botón de cerrar tiene nombre accesible y avisa', () => {
    const { raiz, fixture, host } = montar();
    const cerrar = raiz.querySelector<HTMLButtonElement>('.gi-panel__close')!;

    expect(cerrar.getAttribute('aria-label')).toBe('Cerrar el detalle');

    cerrar.click();
    fixture.detectChanges();

    expect(host.cierres()).toBe(1);
  });

  describe('con pestañas', () => {
    it('la primera está activa por omisión y su cuerpo es el que se ve', () => {
      const { tabs, cuerpo } = montar();

      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
      expect(cuerpo().textContent).toContain('Razón social y RFC');
    });

    it('la activa se marca con aria-selected y con la clase, no sólo con color', () => {
      const { tabs } = montar((host) => host.activa.set('sedes'));

      expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
      expect(tabs()[1].classList.contains('is-active')).toBe(true);
    });

    it('cada pestaña lleva su conteo, incluido el cero', () => {
      const { tabs } = montar();

      expect(tabs()[1].querySelector('.gi-panel__count')?.textContent?.trim()).toBe('4');
      expect(tabs()[2].querySelector('.gi-panel__count')?.textContent?.trim()).toBe('0');
      // La primera no lleva conteo: no es una lista.
      expect(tabs()[0].querySelector('.gi-panel__count')).toBeNull();
    });

    it('el cuerpo está enlazado con su pestaña', () => {
      const { tabs, cuerpo } = montar();

      expect(cuerpo().getAttribute('role')).toBe('tabpanel');
      expect(cuerpo().getAttribute('aria-labelledby')).toBe(tabs()[0].id);
      expect(tabs()[0].getAttribute('aria-controls')).toBe(cuerpo().id);
    });

    it('cambiar de pestaña cambia el cuerpo', () => {
      const { tabs, cuerpo, fixture } = montar();

      tabs()[3].click();
      fixture.detectChanges();

      expect(cuerpo().textContent).toContain('Acta constitutiva');
    });

    it('sólo la activa entra en el orden de tabulación', () => {
      const { tabs } = montar((host) => host.activa.set('contactos'));

      expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1']);
    });

    it('las flechas recorren las pestañas y dan la vuelta', () => {
      const { tabs, host, fixture } = montar();
      const teclear = (elemento: HTMLElement, key: string) => {
        elemento.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        fixture.detectChanges();
      };

      teclear(tabs()[0], 'ArrowRight');
      expect(host.activa()).toBe('sedes');

      teclear(tabs()[1], 'ArrowLeft');
      expect(host.activa()).toBe('datos');

      // Desde la primera, hacia la izquierda, se llega a la última.
      teclear(tabs()[0], 'ArrowLeft');
      expect(host.activa()).toBe('documentos');

      teclear(tabs()[3], 'Home');
      expect(host.activa()).toBe('datos');

      teclear(tabs()[0], 'End');
      expect(host.activa()).toBe('documentos');
    });
  });

  describe('sin pestañas', () => {
    it('no dibuja tablist, y el cuerpo no finge ser un tabpanel', () => {
      const { raiz, cuerpo } = montar((host) => host.pestanas.set([]));

      expect(raiz.querySelector('[role="tablist"]')).toBeNull();
      expect(cuerpo().getAttribute('role')).toBeNull();
      // Con un solo propósito se muestra el contenido que haya.
      expect(cuerpo().textContent).toContain('Razón social y RFC');
    });
  });

  it('el pie recibe las acciones de la pantalla', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.gi-panel__foot')?.textContent).toContain('Guardar cambios');
  });

  describe('lo que rompe en desarrollo', () => {
    it('la primera pestaña que no se llame Datos', () => {
      expect(() =>
        montar((host) =>
          host.pestanas.set([
            { id: 'ficha', label: 'Ficha' },
            { id: 'sedes', label: 'Sedes' },
          ]),
        ),
      ).toThrowError(/debe llamarse "Datos"/);
    });

    /** Dos pestañas donde la segunda es la consecuencia de la primera son una secuencia. */
    it('una sola pestaña, que no es una elección', () => {
      expect(() => montar((host) => host.pestanas.set([{ id: 'datos', label: 'Datos' }])))
        .toThrowError(/una sola pestaña no es una elección/i);
    });
  });
});
