import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ClientListItem } from '../data-access/client.models';
import { ClientTable } from './client-table';
import { cliente, sinSede } from './client-fixtures';

@Component({
  imports: [ClientTable],
  template: `
    <app-client-table
      [clients]="clients()"
      [canWrite]="canWrite()"
      [compact]="compact()"
      (open)="abierto.set($event)"
      (action)="ultima.set($event.id)"
    />
  `,
})
class Anfitrion {
  readonly clients = signal<readonly ClientListItem[]>([cliente(), sinSede()]);
  readonly canWrite = signal(true);
  readonly compact = signal(false);
  readonly abierto = signal<ClientListItem | null>(null);
  readonly ultima = signal('');
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
    filas: () => Array.from(raiz.querySelectorAll<HTMLElement>('tbody tr')),
    encabezados: () =>
      Array.from(raiz.querySelectorAll('thead th')).map((n) => n.textContent!.trim()).filter(Boolean),
  };
}

describe('El listado de clientes', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * El menú depende de la fila, y esto es lo que antes no pasaba.
   *
   * <p>El menú era idéntico para todos, así que a un cliente ya desactivado se le seguía ofreciendo
   * «Desactivar cliente» —una acción sin efecto— y <b>a ninguno se le ofrecía volver</b>. El diálogo
   * de desactivar promete que «se puede reactivar»: si el menú no lo ofrece nunca, la promesa es
   * falsa aunque el servidor sepa hacerlo.</p>
   */
  it('a un cliente desactivado le ofrece reactivarlo, no desactivarlo otra vez', () => {
    const { filas, fixture, host } = montar();
    host.clients.set([cliente({ active: false })]);
    fixture.detectChanges();

    const fila = filas()[0];
    fila.querySelector<HTMLElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    const opciones = Array.from(fila.querySelectorAll('[role="menuitem"]')).map((n) =>
      n.textContent!.trim(),
    );

    expect(opciones.some((texto) => texto.includes('Reactivar cliente'))).toBe(true);
    expect(opciones.some((texto) => texto.includes('Desactivar cliente'))).toBe(false);
  });

  it('a un cliente activo le ofrece desactivarlo, no reactivarlo', () => {
    const { filas, fixture } = montar();
    const fila = filas()[0];
    fila.querySelector<HTMLElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    const opciones = Array.from(fila.querySelectorAll('[role="menuitem"]')).map((n) =>
      n.textContent!.trim(),
    );

    expect(opciones.some((texto) => texto.includes('Desactivar cliente'))).toBe(true);
    expect(opciones.some((texto) => texto.includes('Reactivar cliente'))).toBe(false);
  });

  /**
   * <b>Cero sedes no se muestra como cero.</b> Un cero diría que el cliente está en orden; lo que
   * dice de verdad es que no se le puede crear un servicio.
   */
  it('cero sedes se pinta como raya con la palabra, nunca como cero', () => {
    const { filas } = montar();
    const fila = filas()[1];

    expect(fila.querySelector('.cell__count')?.textContent?.trim()).toBe('—');
    expect(fila.querySelector('.pill')?.textContent?.trim()).toBe('Sin sede');
    expect(fila.textContent).not.toMatch(/(^|\s)0 sedes/);
  });

  it('con sedes muestra el número, y avisa si alguna no tiene contacto', () => {
    const { filas } = montar((host) => host.clients.set([cliente({ sitesWithoutContact: 1 })]));
    const fila = filas()[0];

    expect(fila.querySelector('.cell__count')?.textContent?.trim()).toBe('3');
    expect(fila.querySelector('.pill')?.textContent?.trim()).toBe('1 sin contacto');
  });

  it('la ubicación sale de la sede, y sin sede lo dice en vez de quedarse vacía', () => {
    const { filas } = montar();

    expect(filas()[0].textContent).toContain('Jalisco · Zapopan');
    expect(filas()[1].textContent).toContain('Sin ubicación: no tiene sede');
  });

  /**
   * Antes había dos acciones que hacían lo mismo, «Editar cliente» y «Editar ficha». Dos nombres
   * para una acción obligan a elegir entre opciones que no se distinguen.
   */
  it('el menú tiene una sola acción de editar, y la destructiva al final', () => {
    const { raiz, filas, fixture } = montar();

    filas()[0].querySelector<HTMLButtonElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    const opciones = Array.from(raiz.querySelectorAll('[role="menuitem"] > span')).map((n) =>
      n.textContent?.trim(),
    );

    expect(opciones).toEqual(['Editar cliente', 'Ver sedes', 'Documentos', 'Desactivar cliente']);
    expect(opciones.filter((o) => o?.startsWith('Editar'))).toHaveLength(1);
  });

  /**
   * Nueve menús «Acciones» idénticos no le sirven a quien navega con lector, y el nombre solo
   * tampoco basta: **dos clientes pueden compartir nombre comercial**. El código los separa.
   */
  it('cada menú se nombra con su cliente, y el nombre es único', () => {
    const { filas } = montar((host) =>
      host.clients.set([cliente(), cliente({ idClient: 'cli-9', codeClient: 'CLI-09' })]),
    );

    const nombres = filas().map((f) => f.querySelector('gi-row-actions button')?.getAttribute('aria-label'));

    expect(nombres[0]).toBe('Acciones de Corporativo Altavista, CLI-01');
    expect(new Set(nombres).size).toBe(2);
  });

  it('abrir el menú no abre la ficha', () => {
    const { filas, fixture, host } = montar();

    filas()[0].querySelector<HTMLButtonElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    expect(host.abierto()).toBeNull();
  });

  it('sin permiso de escritura, editar y desactivar dicen por qué no se pueden', () => {
    const { raiz, filas, fixture } = montar((host) => host.canWrite.set(false));

    filas()[0].querySelector<HTMLButtonElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Necesitas permiso de escritura sobre clientes');
  });

  /** Comprimirse no es cortar seis columnas dentro de su propio scroll. */
  it('con la ficha abierta la tabla se reduce a lo esencial', () => {
    const { encabezados, host, fixture } = montar();

    expect(encabezados()).toEqual(['Cliente', 'Estado · Municipio', 'Sedes', 'Servicios', 'Estado']);

    host.compact.set(true);
    fixture.detectChanges();

    expect(encabezados()).toEqual(['Cliente', 'Sedes']);
  });

  it('el estado no depende del punto: la palabra va al lado', () => {
    const { filas } = montar((host) => host.clients.set([cliente({ active: false })]));

    expect(filas()[0].querySelector('.cell__status')?.textContent?.trim()).toBe('Inactivo');
    expect(filas()[0].querySelector('.cell__dot')?.getAttribute('aria-hidden')).toBe('true');
  });
});
