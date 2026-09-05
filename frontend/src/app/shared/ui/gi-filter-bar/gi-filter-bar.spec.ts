import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiFilterBar, GiFilterGroup } from './gi-filter-bar';

const GRUPOS: readonly GiFilterGroup[] = [
  {
    id: 'estado',
    label: 'Estado',
    options: [
      { value: 'activo', label: 'Activos' },
      { value: 'inactivo', label: 'Inactivos' },
    ],
  },
  {
    id: 'sede',
    label: 'Sede',
    options: [
      { value: 'centro', label: 'Centro histórico' },
      { value: 'penon', label: 'Peñón de los Baños' },
      { value: 'nuble', label: 'Ñuble Poniente' },
    ],
  },
];

@Component({
  imports: [GiFilterBar],
  template: `
    <gi-filter-bar
      [search]="search()"
      [groups]="grupos()"
      [resultCount]="resultCount()"
      (searchChange)="search.set($event)"
      (filterChange)="cambiar($event)"
      (clearAll)="limpiar()"
    />
  `,
})
class Anfitrion {
  readonly search = signal('');
  readonly grupos = signal<readonly GiFilterGroup[]>(GRUPOS);
  readonly resultCount = signal<number | null>(15);
  readonly limpiezas = signal(0);

  cambiar({ groupId, value }: { groupId: string; value: string }) {
    this.grupos.set(this.grupos().map((g) => (g.id === groupId ? { ...g, value } : g)));
  }

  limpiar() {
    this.limpiezas.set(this.limpiezas() + 1);
    this.grupos.set(this.grupos().map((g) => ({ ...g, value: '' })));
  }
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
    toggle: () => raiz.querySelector<HTMLButtonElement>('.gi-filters__toggle')!,
    chips: () => Array.from(raiz.querySelectorAll('.gi-filters__chip')),
    botones: () => Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? ''),
  };
}

describe('GiFilterBar', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  it('el buscador está siempre visible, con el contador al lado', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('input[type="search"]')).not.toBeNull();
    expect(raiz.querySelector('.gi-filters__count')?.textContent?.trim()).toBe('15 resultados');
  });

  it('el contador dice uno en singular', () => {
    const { raiz } = montar((host) => host.resultCount.set(1));

    expect(raiz.querySelector('.gi-filters__count')?.textContent?.trim()).toBe('1 resultado');
  });

  it('el resto de filtros llega cerrado, y el botón lo dice', () => {
    const { raiz, toggle, fixture } = montar();

    expect(raiz.querySelector('.gi-filters__panel')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    toggle().click();
    fixture.detectChanges();

    expect(raiz.querySelector('.gi-filters__panel')).not.toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(raiz.querySelector('.gi-filters__panel')?.id).toBe(toggle().getAttribute('aria-controls'));
  });

  /**
   * Las dos prohibiciones son la mitad de la definición del componente, así que van con prueba.
   * Un «Filtrar» convierte un cambio en dos pasos; un «Limpiar» separado duplica lo que ya hacen
   * los chips.
   */
  it('no existe botón Filtrar ni botón Limpiar', () => {
    const { botones, toggle, fixture } = montar();

    toggle().click();
    fixture.detectChanges();

    expect(botones().some((texto) => /^filtrar$/i.test(texto))).toBe(false);
    expect(botones().some((texto) => /^limpiar$/i.test(texto))).toBe(false);
  });

  it('los filtros se aplican al cambiar, sin confirmar', () => {
    const { raiz, toggle, fixture, host } = montar();

    toggle().click();
    fixture.detectChanges();

    raiz.querySelector<HTMLButtonElement>('gi-select button')!.click();
    fixture.detectChanges();
    raiz.querySelectorAll<HTMLElement>('[role="option"]')[1].click();
    fixture.detectChanges();

    expect(host.grupos()[0].value).toBe('activo');
  });

  describe('los chips', () => {
    it('no hay ninguno cuando no hay filtros aplicados, y tampoco Quitar todos', () => {
      const { chips, botones } = montar();

      expect(chips()).toHaveLength(0);
      expect(botones().some((texto) => /quitar todos/i.test(texto))).toBe(false);
    });

    it('cada filtro aplicado se ve como chip aunque el panel esté cerrado', () => {
      const { chips, raiz } = montar((host) =>
        host.grupos.set([{ ...GRUPOS[0], value: 'activo' }, GRUPOS[1]]),
      );

      // El panel sigue cerrado: el chip es lo que evita jurar que faltan registros.
      expect(raiz.querySelector('.gi-filters__panel')).toBeNull();
      expect(chips()).toHaveLength(1);
      expect(chips()[0].textContent).toContain('Estado: Activos');
    });

    it('la equis de cada chip dice qué quita', () => {
      const { raiz } = montar((host) => host.grupos.set([{ ...GRUPOS[0], value: 'activo' }, GRUPOS[1]]));

      expect(raiz.querySelector('.gi-filters__chip-remove')?.getAttribute('aria-label'))
        .toBe('Quitar filtro Estado');
    });

    it('quitar un chip deja los demás', () => {
      const { raiz, fixture, host } = montar((anfitrion) =>
        anfitrion.grupos.set([
          { ...GRUPOS[0], value: 'activo' },
          { ...GRUPOS[1], value: 'nuble' },
        ]),
      );

      raiz.querySelector<HTMLButtonElement>('.gi-filters__chip-remove')!.click();
      fixture.detectChanges();

      expect(host.grupos()[0].value).toBe('');
      expect(host.grupos()[1].value).toBe('nuble');
    });

    it('Quitar todos aparece sólo cuando hay alguno', () => {
      const { botones, fixture, host } = montar((anfitrion) =>
        anfitrion.grupos.set([{ ...GRUPOS[0], value: 'activo' }, GRUPOS[1]]),
      );

      expect(botones().some((texto) => /quitar todos/i.test(texto))).toBe(true);

      host.limpiar();
      fixture.detectChanges();

      expect(host.limpiezas()).toBe(1);
      expect(botones().some((texto) => /quitar todos/i.test(texto))).toBe(false);
    });

    it('el botón de filtros lleva cuántos hay aplicados', () => {
      const { toggle } = montar((host) =>
        host.grupos.set([
          { ...GRUPOS[0], value: 'activo' },
          { ...GRUPOS[1], value: 'centro' },
        ]),
      );

      expect(toggle().querySelector('.gi-filters__badge')?.textContent?.trim()).toBe('2');
    });
  });

  it('los filtros usan el selector propio, nunca el nativo', () => {
    const { raiz, toggle, fixture } = montar();

    toggle().click();
    fixture.detectChanges();

    expect(raiz.querySelector('select')).toBeNull();
    expect(raiz.querySelectorAll('gi-select')).toHaveLength(GRUPOS.length);
  });

  it('rompe en desarrollo un filtro con una sola opción real', () => {
    expect(() =>
      montar((host) =>
        host.grupos.set([{ id: 'tipo', label: 'Tipo', options: [{ value: 'unico', label: 'Único' }] }]),
      ),
    ).toThrowError(/una opción reales|1 opción\(es\) reales/);
  });
});
