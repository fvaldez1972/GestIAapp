import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ClientContact, ClientSite } from '../data-access/client.models';
import { ClientSites, NewSite } from './client-sites';
import { contacto, sede } from './client-fixtures';

@Component({
  imports: [ClientSites],
  template: `
    <app-client-sites
      organizationId="org-a"
      [sites]="lista()"
      [contacts]="contacts()"
      [canWrite]="canWrite()"
      [openAdd]="openAdd()"
      (create)="creada.set($event)"
    />
  `,
})
class Anfitrion {
  readonly lista = signal<readonly ClientSite[]>([]);
  readonly contacts = signal<readonly ClientContact[]>([]);
  readonly canWrite = signal(true);
  readonly openAdd = signal(false);
  readonly creada = signal<NewSite | null>(null);
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
    guardar: () => raiz.querySelector<HTMLButtonElement>('.button--primary'),
    escribir: (id: string, valor: string) => {
      const campo = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
  };
}

/**
 * El catálogo geográfico que el selector pide.
 *
 * <p>Estado y municipio no son texto libre: el servidor los valida contra `State` y `City`, y la
 * ciudad cuelga del estado, que cuelga del país. La prueba monta esa jerarquía porque es la que
 * hace que el municipio aparezca sólo cuando su estado está elegido.</p>
 */
const GEOGRAFIA = [
  { idCatalogItem: 'mx', type: 'Country', name: 'México', active: true, idParentCatalogItem: null },
  { idCatalogItem: 'jal', type: 'State', name: 'Jalisco', active: true, idParentCatalogItem: 'mx' },
  { idCatalogItem: 'nl', type: 'State', name: 'Nuevo León', active: true, idParentCatalogItem: 'mx' },
  { idCatalogItem: 'tlaq', type: 'City', name: 'Tlaquepaque', active: true, idParentCatalogItem: 'jal' },
  { idCatalogItem: 'snic', type: 'City', name: 'San Nicolás de los Garza', active: true, idParentCatalogItem: 'nl' },
];

/** Responde la única petición del catálogo y deja los selectores con sus opciones. */
function surtirCatalogo(http: HttpTestingController, fixture: { detectChanges(): void }) {
  for (const peticion of http.match((r) => r.url.endsWith('/catalogs/options'))) {
    peticion.flush(GEOGRAFIA);
  }
  fixture.detectChanges();
}

/** Elige un valor en un `app-catalog-select`, que por dentro es el `<select>` de la excepción. */
function elegir(raiz: HTMLElement, id: string, valor: string, fixture: { detectChanges(): void }) {
  const select = raiz.querySelector<HTMLSelectElement>(`#${id} select`);
  if (!select) {
    throw new Error(`no hay selector en #${id}`);
  }
  select.value = valor;
  select.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

describe('La pestaña de Sedes', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * El punto de la pantalla. Un cliente sin sede no es «no hay nada»: <b>le falta el
   * prerrequisito del paso siguiente</b>, y el vacío tiene que decir eso y ofrecer la salida.
   */
  it('sin sede muestra el vacío de prerrequisito, no el de sin datos', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('Este cliente todavía no tiene sede');
    expect(raiz.textContent).toContain('El servicio se liga a una sede');
    expect(raiz.querySelector('gi-empty-state')).not.toBeNull();
  });

  it('el vacío ofrece agregar la sede, y agregarla es un formulario de verdad', () => {
    const { raiz, fixture } = montar();

    raiz.querySelector<HTMLButtonElement>('gi-empty-state button')!.click();
    fixture.detectChanges();

    expect(raiz.querySelector('#ns-nombre')).not.toBeNull();
    expect(raiz.querySelector('#ns-calle')).not.toBeNull();
    expect(raiz.querySelector('#ns-municipio')).not.toBeNull();
  });

  it('sin permiso de escritura no se ofrece agregar nada', () => {
    const { raiz } = montar((host) => host.canWrite.set(false));

    expect(raiz.querySelector('gi-empty-state button')).toBeNull();
  });

  /**
   * El botón bloqueado <b>dice por qué</b>. Un botón gris sin explicación obliga a adivinar, y
   * quien adivina mal vuelve a intentarlo igual.
   */
  it('el guardado bloqueado nombra lo que falta, y lo nombra de forma leíble', () => {
    const { raiz, guardar } = montar((host) => host.openAdd.set(true));

    expect(guardar()!.disabled).toBe(true);

    const razonId = guardar()!.getAttribute('aria-describedby')!;
    const razon = raiz.querySelector(`#${razonId}`)!;
    expect(razon.textContent).toContain('el nombre, la calle, el municipio, el estado y el código postal');
  });

  it('con la dirección completa se habilita y emite lo que se escribió', () => {
    const { fixture, guardar, escribir, host, raiz } = montar((anfitrion) => anfitrion.openAdd.set(true));

    escribir('ns-nombre', 'Planta San Nicolás');
    escribir('ns-calle', 'Av. Universidad 2340');
    escribir('ns-cp', '66450');

    // Estado y municipio salen del catálogo geográfico, no de texto libre.
    surtirCatalogo(TestBed.inject(HttpTestingController), fixture);
    elegir(raiz, 'ns-estado', 'Nuevo León', fixture);
    elegir(raiz, 'ns-municipio', 'San Nicolás de los Garza', fixture);
    fixture.detectChanges();

    expect(guardar()!.disabled).toBe(false);

    guardar()!.click();
    fixture.detectChanges();

    expect(host.creada()).toEqual({
      name: 'Planta San Nicolás',
      street: 'Av. Universidad 2340',
      neighborhood: '',
      municipality: 'San Nicolás de los Garza',
      state: 'Nuevo León',
      postalCode: '66450',
    });
  });

  /** Una sede sin contacto funciona, pero nadie responde por ella, y eso se dice. */
  it('una sede sin contacto lo dice, con palabras y no sólo con color', () => {
    const { raiz } = montar((host) => host.lista.set([sede()]));

    expect(raiz.querySelector('.site__pill')?.textContent?.trim()).toBe('Sin contacto');
    expect(raiz.textContent).toContain('La sede funciona, pero nadie responde por ella');
  });

  it('con contacto muestra quién responde y su puesto', () => {
    const { raiz } = montar((host) => {
      host.lista.set([sede()]);
      host.contacts.set([contacto()]);
    });

    expect(raiz.textContent).toContain('Mariana Escalante Ruvalcaba');
    expect(raiz.textContent).toContain('Jefa de vigilancia');
    expect(raiz.querySelector('.site__pill')).toBeNull();
  });

  /** Seis menús idénticos no sirven a quien navega con lector: cada uno nombra su sede. */
  it('el menú de cada sede se nombra con su sede', () => {
    const { raiz } = montar((host) => host.lista.set([sede()]));

    expect(raiz.querySelector('gi-row-actions button')?.getAttribute('aria-label'))
      .toBe('Acciones de la sede Torre Altavista');
  });

  it('la dirección se arma legible, sin comas sueltas de los campos vacíos', () => {
    const { raiz } = montar((host) =>
      host.lista.set([sede({ neighborhood: null, exteriorNumber: null })]),
    );

    expect(raiz.querySelector('.site__value')?.textContent?.trim())
      .toBe('Av. Patria 1250, Zapopan, Jalisco, 45110');
  });
});
