import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GiCell, GiColumn, GiDataTable, GiTableState } from './gi-data-table';

type Servicio = {
  readonly idService: string;
  readonly name: string;
  readonly client: string;
  readonly vigencia: string;
  readonly posiciones: number;
};

/**
 * Datos verosímiles, como pide el sistema: español con acentos y eñes, un nombre largo y uno
 * corto, y un caso incompleto. Los nombres son inventados.
 */
const SERVICIOS: readonly Servicio[] = [
  {
    idService: 'srv-1',
    name: 'Vigilancia perimetral y control de accesos nocturno',
    client: 'Almacenes Reforma',
    vigencia: '01 ene 2026 — 31 dic 2026',
    posiciones: 12,
  },
  { idService: 'srv-2', name: 'Monitoreo CCTV', client: 'Grupo Peña Muñoz', vigencia: 'Sin vigencia', posiciones: 3 },
  { idService: 'srv-3', name: 'Custodia de traslado', client: 'Ñuble Logística', vigencia: '15 mar 2026 —', posiciones: 0 },
];

const COLUMNAS: readonly GiColumn[] = [
  { key: 'name', label: 'Servicio', width: '220px', kind: 'name' },
  { key: 'client', label: 'Cliente', width: '190px' },
  { key: 'vigencia', label: 'Vigencia', width: '150px', kind: 'meta' },
  { key: 'posiciones', label: 'Posiciones', width: '130px', align: 'end' },
];

@Component({
  imports: [GiDataTable, GiCell],
  template: `
    <gi-data-table
      label="Servicios"
      [columns]="columnas"
      [rows]="filas()"
      [rowId]="porId"
      [state]="state()"
      [selectedId]="selectedId()"
      [errorMessage]="errorMessage()"
      [skeletonRows]="skeletonRows()"
      (rowSelect)="elegido.set($event.idService)"
      (retry)="reintentos.set(reintentos() + 1)"
    >
      @if (conPlantilla()) {
        <ng-template giCell="posiciones" let-row>
          <span class="pildora">{{ row.posiciones }} activas</span>
        </ng-template>
      }
    </gi-data-table>
  `,
})
class Anfitrion {
  readonly columnas = COLUMNAS;
  readonly filas = signal<readonly Servicio[]>(SERVICIOS);
  readonly state = signal<GiTableState>('ready');
  readonly selectedId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly skeletonRows = signal(5);
  readonly conPlantilla = signal(false);
  readonly elegido = signal('');
  readonly reintentos = signal(0);
  readonly porId = (servicio: Servicio) => servicio.idService;
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;
  const filas = () => Array.from(raiz.querySelectorAll<HTMLTableRowElement>('tbody tr'));

  return { fixture, raiz, host: fixture.componentInstance, filas };
}

describe('GiDataTable', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));
  afterEach(() => TestBed.resetTestingModule());

  describe('los cinco estados', () => {
    it('cargando dibuja esqueleto, no un girador', () => {
      const { raiz, filas } = montar((host) => {
        host.state.set('loading');
        host.skeletonRows.set(4);
      });

      expect(filas()).toHaveLength(4);
      expect(raiz.querySelectorAll('.gi-table__skeleton')).toHaveLength(4 * COLUMNAS.length);
      expect(raiz.querySelector('table')?.getAttribute('aria-busy')).toBe('true');
      // Ni la palabra ni la forma de un girador.
      expect(raiz.innerHTML).not.toMatch(/spinner|girador/i);
      // El esqueleto conserva las columnas: la tabla no salta cuando llegan los datos.
      expect(raiz.querySelectorAll('thead th')).toHaveLength(COLUMNAS.length);
    });

    it('cargando se anuncia para quien no ve el esqueleto', () => {
      const { raiz } = montar((host) => host.state.set('loading'));

      expect(raiz.querySelector('[role="status"]')?.textContent).toMatch(/Cargando/i);
    });

    it('con datos pinta una fila por registro', () => {
      const { filas } = montar();

      expect(filas()).toHaveLength(SERVICIOS.length);
      expect(filas()[0].textContent).toContain('Vigilancia perimetral');
      expect(filas()[2].textContent).toContain('Ñuble Logística');
    });

    it('vacío sin datos ofrece crear el primero', () => {
      const { raiz } = montar((host) => {
        host.filas.set([]);
        host.state.set('empty');
      });

      expect(raiz.textContent).toMatch(/Todavía no hay nada/i);
      expect(raiz.textContent).not.toMatch(/estos filtros/i);
    });

    /** Vacío por filtro y vacío sin datos no son lo mismo y no pueden decir lo mismo. */
    it('vacío por filtro dice que el filtro es el problema', () => {
      const { raiz } = montar((host) => {
        host.filas.set([]);
        host.state.set('empty-filtered');
      });

      expect(raiz.textContent).toMatch(/Ningún resultado con estos filtros/i);
      expect(raiz.textContent).not.toMatch(/Todavía no hay nada/i);
    });

    it('el error se anuncia y ofrece reintentar', () => {
      const { raiz, fixture, host } = montar((anfitrion) => {
        anfitrion.state.set('error');
        anfitrion.errorMessage.set('No se pudieron cargar los servicios.');
      });

      const alerta = raiz.querySelector('[role="alert"]')!;
      expect(alerta.textContent).toContain('No se pudieron cargar los servicios.');

      raiz.querySelector<HTMLButtonElement>('.gi-table__retry')!.click();
      fixture.detectChanges();

      expect(host.reintentos()).toBe(1);
    });
  });

  describe('la selección', () => {
    it('se marca con aria-selected y con color, nunca sólo con color', () => {
      const { filas } = montar((host) => host.selectedId.set('srv-2'));

      expect(filas()[1].getAttribute('aria-selected')).toBe('true');
      expect(filas()[1].classList.contains('is-selected')).toBe(true);
      expect(filas()[0].getAttribute('aria-selected')).toBe('false');
    });

    it('la tabla se anuncia como rejilla cuando sus filas se pueden elegir', () => {
      const { raiz } = montar();

      expect(raiz.querySelector('table')?.getAttribute('role')).toBe('grid');
    });

    it('al hacer clic avisa cuál se eligió', () => {
      const { filas, fixture, host } = montar();

      filas()[2].click();
      fixture.detectChanges();

      expect(host.elegido()).toBe('srv-3');
    });
  });

  describe('el teclado, que un ratón no necesita y un teclado sí', () => {
    const teclear = (fila: HTMLElement, key: string) =>
      fila.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    it('sólo una fila entra en el orden de tabulación', () => {
      const { filas } = montar();

      expect(filas().map((f) => f.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    });

    it('las flechas mueven el foco y Enter elige', () => {
      const { filas, fixture, host } = montar();

      teclear(filas()[0], 'ArrowDown');
      fixture.detectChanges();
      expect(filas().map((f) => f.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

      teclear(filas()[1], 'Enter');
      fixture.detectChanges();
      expect(host.elegido()).toBe('srv-2');
    });

    it('Inicio y Fin van a los extremos y no se salen', () => {
      const { filas, fixture } = montar();

      teclear(filas()[0], 'End');
      fixture.detectChanges();
      expect(filas()[2].getAttribute('tabindex')).toBe('0');

      teclear(filas()[2], 'ArrowDown');
      fixture.detectChanges();
      expect(filas()[2].getAttribute('tabindex')).toBe('0');

      teclear(filas()[2], 'Home');
      fixture.detectChanges();
      expect(filas()[0].getAttribute('tabindex')).toBe('0');
    });

    it('una tabla que no se elige no entra en el orden de tabulación', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter([])] });

      @Component({
        imports: [GiDataTable],
        template: `<gi-data-table [columns]="columnas" [rows]="filas" [selectable]="false" />`,
      })
      class SoloLectura {
        readonly columnas = COLUMNAS;
        readonly filas = SERVICIOS;
      }

      const fixture = TestBed.createComponent(SoloLectura);
      fixture.detectChanges();
      const raiz: HTMLElement = fixture.nativeElement;

      expect(raiz.querySelector('table')?.getAttribute('role')).toBeNull();
      expect(raiz.querySelector('tbody tr')?.getAttribute('tabindex')).toBeNull();
    });
  });

  describe('las columnas', () => {
    it('cada tipo usa su tamaño de la escala, y no otro', () => {
      const { filas } = montar();
      const celdas = filas()[0].querySelectorAll('td');

      expect(celdas[0].className).toContain('is-name');
      expect(celdas[1].className).toContain('is-data');
      expect(celdas[2].className).toContain('is-meta');
    });

    it('respeta los anchos de referencia', () => {
      const { raiz } = montar();
      const anchos = Array.from(raiz.querySelectorAll('col')).map((c) => c.style.width);

      expect(anchos).toEqual(['220px', '190px', '150px', '130px']);
    });

    it('sin plantilla pinta el valor tal cual, incluido el cero', () => {
      const { filas } = montar();

      expect(filas()[2].querySelectorAll('td')[3].textContent?.trim()).toBe('0');
    });

    it('con plantilla la pantalla decide cómo se ve la celda', () => {
      const { filas } = montar((host) => host.conPlantilla.set(true));

      expect(filas()[0].querySelector('.pildora')?.textContent?.trim()).toBe('12 activas');
    });
  });
});
