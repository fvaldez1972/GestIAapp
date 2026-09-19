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
      [editing]="editing()"
      (create)="creada.set($event)"
      (edit)="editada.set($event)"
      (closeEdit)="editing.set(null)"
      (closeAdd)="cerrados.set(cerrados() + 1); openAdd.set(false)"
    />
  `,
})
class Anfitrion {
  readonly lista = signal<readonly ClientSite[]>([]);
  readonly contacts = signal<readonly ClientContact[]>([]);
  readonly canWrite = signal(true);
  readonly openAdd = signal(false);
  readonly editing = signal<ClientSite | null>(null);
  readonly cerrados = signal(0);
  readonly creada = signal<NewSite | null>(null);
  readonly editada = signal<{ site: ClientSite; datos: NewSite } | null>(null);
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

  /**
   * «Agregar sede» está una sola vez.
   *
   * <p>Estaba dos: en la cabecera de la ficha y otra vez sobre la lista, uno encima del otro y
   * siendo el mismo. La de la cabecera es la que se queda, con las acciones de los demás apartados.
   * </p>
   */
  it('no repite «Agregar sede» sobre la lista: vive en la cabecera de la ficha', () => {
    const { raiz } = montar((host) => host.lista.set([sede()]));

    const botones = Array.from(raiz.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Agregar sede',
    );
    expect(botones).toHaveLength(0);
  });

  /**
   * Y cancelar cierra de verdad.
   *
   * <p>Desde que el alta se abre desde la cabecera, la bandera la tiene la página. Cancelar apagaba
   * la de aquí dentro y no la de allá, así que el formulario se quedaba abierto y no había forma de
   * cerrarlo.</p>
   */
  it('al cancelar avisa que el alta se cerró', () => {
    const { raiz, fixture, host } = montar((host) => {
      host.lista.set([sede()]);
      host.openAdd.set(true);
    });

    const cancelar = Array.from(raiz.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancelar',
    );
    expect(cancelar).toBeDefined();

    cancelar!.click();
    fixture.detectChanges();

    expect(host.cerrados()).toBe(1);
  });

  /**
   * Las acciones se ven, no se esconden tras tres puntos.
   *
   * <p>El menú guardaba «Editar sede» detrás de un clic y de un icono que no dice nada: había que
   * abrirlo para descubrir qué se podía hacer con la sede.</p>
   */
  it('cada sede enseña sus acciones, sin menú de tres puntos', () => {
    const { raiz } = montar((host) => host.lista.set([sede()]));

    expect(raiz.querySelector('gi-row-actions')).toBeNull();

    const acciones = Array.from(raiz.querySelectorAll('.site__accion')).map((n) =>
      n.textContent!.trim(),
    );
    expect(acciones).toEqual(['Editar', 'Desactivar']);
  });

  it('sin permiso de escritura no ofrece ninguna acción sobre la sede', () => {
    const { raiz } = montar((host) => {
      host.lista.set([sede()]);
      host.canWrite.set(false);
    });

    expect(raiz.querySelector('.site__accion')).toBeNull();
  });

  it('la dirección se arma legible, sin comas sueltas de los campos vacíos', () => {
    const { raiz } = montar((host) =>
      host.lista.set([sede({ neighborhood: null, exteriorNumber: null })]),
    );

    expect(raiz.querySelector('.site__value')?.textContent?.trim())
      .toBe('Av. Patria 1250, Zapopan, Jalisco, 45110');
  });
  /**
   * El defecto: al guardar, la sede se creaba y el formulario se quedaba abierto con los mismos
   * datos dentro. Pulsar otra vez creaba una sede idéntica y nada lo impedía.
   */
  it('se vacía y se cierra al guardar', () => {
    const { fixture, raiz, escribir, guardar, host } = montar((anfitrion) => anfitrion.openAdd.set(false));

    const abrir = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Agregar sede'));
    abrir?.click();
    fixture.detectChanges();

    escribir('ns-nombre', 'Planta Norte');
    escribir('ns-calle', 'Av. Central 100');
    escribir('ns-cp', '45010');
    surtirCatalogo(TestBed.inject(HttpTestingController), fixture);
    elegir(raiz, 'ns-estado', 'Nuevo León', fixture);
    elegir(raiz, 'ns-municipio', 'San Nicolás de los Garza', fixture);
    fixture.detectChanges();

    guardar()?.click();
    fixture.detectChanges();

    expect(host.creada()?.name).toBe('Planta Norte');
    // Cerrado: el formulario ya no está en pantalla.
    expect(raiz.querySelector('#ns-nombre')).toBeNull();

    // Se vuelve a buscar el botón: el anterior quedó fuera del DOM al cerrarse el formulario.
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Agregar sede'))
      ?.click();
    fixture.detectChanges();

    const campo = raiz.querySelector<HTMLInputElement>('#ns-nombre');
    expect(campo).not.toBeNull();
    expect(campo!.value).toBe('');
  });

  /**
   * El «sin contacto» que mentía.
   *
   * <p>La tarjeta sólo miraba contactos atados a la sede, y en la base viva 23 de 26 contactos son
   * del cliente. Así, casi toda sede decía «nadie responde por ella» mientras la pestaña de
   * Contactos mostraba un número mayor que cero al lado.</p>
   */
  it('un contacto del cliente cubre a la sede que no tiene el suyo', () => {
    const { raiz } = montar((host) => {
      host.lista.set([sede({ idClientSite: 's1', name: 'Planta Norte' })]);
      host.contacts.set([contacto({ idClientSite: null, fullName: 'Laura del cliente' })]);
    });

    expect(raiz.textContent).toContain('Laura del cliente');
    expect(raiz.textContent).toContain('contacto del cliente');
    expect(raiz.textContent).not.toContain('nadie responde por ella');
  });

  it('el contacto propio de la sede gana al del cliente', () => {
    const { raiz } = montar((host) => {
      host.lista.set([sede({ idClientSite: 's1', name: 'Planta Norte' })]);
      host.contacts.set([
        contacto({ idClientSite: null, fullName: 'Laura del cliente' }),
        contacto({ idClientSite: 's1', fullName: 'Mario de la sede' }),
      ]);
    });

    expect(raiz.textContent).toContain('Mario de la sede');
    expect(raiz.textContent).not.toContain('Laura del cliente');
  });

  it('sin ningún contacto sí lo dice', () => {
    const { raiz } = montar((host) => {
      host.lista.set([sede({ idClientSite: 's1', name: 'Planta Norte' })]);
      host.contacts.set([]);
    });

    expect(raiz.textContent).toContain('nadie responde por ella');
  });
});

/**
 * Editar una sede, que es donde el formulario y la página tienen que ponerse de acuerdo.
 *
 * <p>Salió al validar contra el sistema publicado: «Guardar sede» guardaba de verdad —la sede
 * cambiaba en la base y salía el aviso de que había quedado actualizada— y el formulario se
 * quedaba abierto, como si no hubiera pasado nada. El motivo era una carrera: el formulario se
 * cerraba solo, el efecto veía que la página seguía apuntando a esa sede, y lo reabría en el acto.
 * «Cancelar» hacía exactamente lo mismo.</p>
 *
 * <p>Ahora manda la página: ella sabe si el servidor confirmó, y el formulario la sigue.</p>
 */
describe('La pestaña de Sedes · editar', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }));

  afterEach(() => TestBed.resetTestingModule());

  const abierta = (raiz: HTMLElement) => raiz.textContent?.includes('EDITAR SEDE') ?? false;

  it('abre con los datos de la sede que pide la página', async () => {
    const original = sede({ idClientSite: 's-1', name: 'Torre Altavista' });
    const { raiz, fixture, host } = montar((anfitrion) => anfitrion.lista.set([original]));
    host.editing.set(original);
    fixture.detectChanges();
    // `ngModel` escribe en el campo en el ciclo siguiente, no en el mismo.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(abierta(raiz)).toBe(true);
    expect(raiz.querySelector<HTMLInputElement>('#ns-nombre')?.value).toBe('Torre Altavista');
  });

  it('al guardar emite el cambio y NO se cierra solo: espera a la página', () => {
    const original = sede({ idClientSite: 's-1', name: 'Torre Altavista' });
    const { raiz, fixture, host, guardar } = montar((anfitrion) => anfitrion.lista.set([original]));
    host.editing.set(original);
    fixture.detectChanges();

    guardar()!.click();
    fixture.detectChanges();

    expect(host.editada()?.site.idClientSite).toBe('s-1');
    // Sigue abierto: si el guardado falla, lo escrito no se pierde.
    expect(abierta(raiz)).toBe(true);

    // Y cuando la página confirma soltando la sede, el formulario se cierra de una vez.
    host.editing.set(null);
    fixture.detectChanges();

    expect(abierta(raiz)).toBe(false);
  });

  it('«Cancelar» avisa a la página, y el formulario no se reabre', () => {
    const original = sede({ idClientSite: 's-1', name: 'Torre Altavista' });
    const { raiz, fixture, host } = montar((anfitrion) => anfitrion.lista.set([original]));
    host.editing.set(original);
    fixture.detectChanges();

    const cancelar = Array.from(raiz.querySelectorAll('button')).find(
      (boton) => boton.textContent?.trim() === 'Cancelar',
    );
    expect(cancelar).toBeDefined();
    cancelar!.click();
    fixture.detectChanges();

    expect(host.editing()).toBeNull();
    expect(abierta(raiz)).toBe(false);
  });
});
