import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ClientContact, ClientZone } from '../data-access/client.models';
import { ClientZones, NewZone } from './client-zones';
import { contacto, zona } from './client-fixtures';

@Component({
  imports: [ClientZones],
  template: `
    <app-client-zones
      organizationId="org-a"
      [zones]="lista()"
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
  readonly lista = signal<readonly ClientZone[]>([]);
  readonly contacts = signal<readonly ClientContact[]>([]);
  readonly canWrite = signal(true);
  readonly openAdd = signal(false);
  readonly editing = signal<ClientZone | null>(null);
  readonly cerrados = signal(0);
  readonly creada = signal<NewZone | null>(null);
  readonly editada = signal<{ zone: ClientZone; datos: NewZone } | null>(null);
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
      // Escribir el código postal sale a preguntar por él. Se contesta aquí para que ninguna
      // prueba deje una petición colgando, que es como aparecen los «Unhandled Error».
      surtirGeografia(TestBed.inject(HttpTestingController), fixture);
    },
  };
}

/**
 * La geografía que el selector pide.
 *
 * <p><b>Ya no viene con el catálogo de la organización.</b> Desde el 22 de septiembre de 2026 son
 * tablas compartidas con sus propios endpoints, y la cascada —país, estado, municipio— la resuelve
 * el servidor. Por eso este doble responde por dirección en vez de devolver un árbol entero para
 * que el navegador lo recorra, que es lo que hacía cuando la geografía era un catálogo por
 * empresa.</p>
 */
const PAISES = [{ code: 'MX', name: 'México' }];
const ESTADOS = [{ code: '14', name: 'Jalisco' }, { code: '19', name: 'Nuevo León' }];
const MUNICIPIOS: Record<string, readonly { code: string; name: string }[]> = {
  Jalisco: [{ code: '14098', name: 'Tlaquepaque' }],
  'Nuevo León': [{ code: '19046', name: 'San Nicolás de los Garza' }],
};

/**
 * El padrón de códigos postales, del que la prueba sólo necesita uno.
 *
 * <p>Los demás responden 404, que es lo que responde el servidor cuando el código no está en el
 * padrón. No es un atajo de la prueba: es el caso que mantiene vivos los tres desplegables.</p>
 */
const CODIGOS: Record<string, unknown> = {
  '64000': {
    postalCode: '64000',
    countryCode: 'MX',
    state: { code: '19', name: 'Nuevo León' },
    municipality: { code: '19039', name: 'Monterrey' },
    neighborhoods: [
      { name: 'Monterrey Centro', settlementType: 'Colonia' },
      { name: 'La Finca', settlementType: 'Colonia' },
    ],
  },
};

/** Responde lo que la geografía tenga pendiente, que cambia conforme se elige en la cascada. */
function surtirGeografia(http: HttpTestingController, fixture: { detectChanges(): void }) {
  for (const peticion of http.match((r) => r.url.includes('/geography/'))) {
    const url = peticion.request.url;

    if (url.endsWith('/countries')) {
      peticion.flush(PAISES);
    } else if (url.endsWith('/states')) {
      peticion.flush(ESTADOS);
    } else if (url.includes('/postal-codes/')) {
      const codigo = url.split('/').pop() ?? '';
      const encontrado = CODIGOS[codigo];
      if (encontrado) {
        peticion.flush(encontrado);
      } else {
        peticion.flush(null, { status: 404, statusText: 'Not Found' });
      }
    } else {
      peticion.flush(MUNICIPIOS[peticion.request.params.get('state') ?? ''] ?? []);
    }
  }
  fixture.detectChanges();
}

/** Responde la petición del catálogo de la organización y la de la geografía. */
function surtirCatalogo(http: HttpTestingController, fixture: { detectChanges(): void }) {
  for (const peticion of http.match((r) => r.url.endsWith('/catalogs/options'))) {
    peticion.flush([]);
  }
  surtirGeografia(http, fixture);
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
  // Elegir el estado hace que el municipio pida los suyos: la cascada ahora la resuelve el servidor.
  surtirGeografia(TestBed.inject(HttpTestingController), fixture);
}

/** Escribe el código postal y contesta la consulta que dispara. */
function escribirCp(raiz: HTMLElement, fixture: { detectChanges(): void }, codigo: string) {
  const campo = raiz.querySelector<HTMLInputElement>('#ns-cp')!;
  campo.value = codigo;
  campo.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  surtirGeografia(TestBed.inject(HttpTestingController), fixture);
}

/**
 * El domicilio de la pestaña, para leer lo que el código postal dejó en él.
 *
 * <p>Vive en un servicio provisto por el componente y no en el componente: el mismo comportamiento
 * lo usa el expediente de personal, y duplicarlo habría garantizado que las dos pantallas se
 * separaran.</p>
 */
function obtenerDireccion(fixture: { debugElement: { children: { componentInstance: unknown }[] } }) {
  return (
    fixture.debugElement.children[0].componentInstance as {
      direccion: {
        countryCode(): string;
        state: { (): string; set(v: string): void };
        municipality: { (): string; set(v: string): void };
        onCountry(v: string): void;
      };
    }
  ).direccion;
}

describe('La pestaña de Zonas', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * El punto de la pantalla. Un cliente sin zona no es «no hay nada»: <b>le falta el
   * prerrequisito del paso siguiente</b>, y el vacío tiene que decir eso y ofrecer la salida.
   */
  it('sin zona muestra el vacío de prerrequisito, no el de sin datos', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('Este cliente todavía no tiene zona');
    expect(raiz.textContent).toContain('El servicio se liga a una zona');
    expect(raiz.querySelector('gi-empty-state')).not.toBeNull();
  });

  it('el vacío ofrece agregar la zona, y agregarla es un formulario de verdad', () => {
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
      // El país viaja con la zona desde el 22 de septiembre de 2026. México por omisión: es donde
      // opera todo lo capturado, y así el campo no llega vacío a quien sólo iba a escribir la calle.
      countryCode: 'MX',
    });
  });

  /** Una zona sin contacto funciona, pero nadie responde por ella, y eso se dice. */
  /**
   * El código postal manda en la dirección: cinco dígitos y se resuelve el resto.
   *
   * <p>Es la forma en que se escribe una dirección en México, y es lo que evita encadenar cuatro
   * desplegables para capturar una zona.</p>
   */
  it('el código postal resuelve el estado, el municipio y la lista de colonias', () => {
    const { raiz, fixture } = montar((anfitrion) => anfitrion.openAdd.set(true));

    escribirCp(raiz, fixture, '64000');

    const direccion = obtenerDireccion(fixture);
    expect(direccion.state()).toBe('Nuevo León');
    expect(direccion.municipality()).toBe('Monterrey');

    raiz.querySelector<HTMLButtonElement>('#ns-colonia button[role="combobox"]')!.click();
    fixture.detectChanges();

    const opciones = Array.from(raiz.querySelectorAll('#ns-colonia .gi-select__option'))
      .map((opcion) => opcion.textContent?.trim());

    expect(opciones).toContain('Monterrey Centro');
    expect(opciones).toContain('La Finca');
    // La salida va siempre: el padrón no trae los fraccionamientos nuevos.
    expect(opciones).toContain('Otra: escribirla');
  });

  /**
   * El control de la prueba anterior, y el que justifica que los desplegables se queden.
   *
   * <p>Un código que no está en el padrón no puede dejar la pantalla sin forma de contestar, y
   * tampoco puede borrar lo que alguien ya había elegido por teclear mal un dígito.</p>
   */
  it('un código fuera del padrón conserva la dirección y deja los desplegables', () => {
    const { raiz, fixture } = montar((anfitrion) => anfitrion.openAdd.set(true));

    escribirCp(raiz, fixture, '64000');
    escribirCp(raiz, fixture, '99999');

    const direccion = obtenerDireccion(fixture);
    expect(direccion.state()).toBe('Nuevo León');
    expect(direccion.municipality()).toBe('Monterrey');
    expect(raiz.textContent).toContain('No está en el padrón');

    // Y la colonia vuelve a ser texto libre, porque no hay lista que ofrecer.
    expect(raiz.querySelector('#ns-colonia button[role="combobox"]')).toBeNull();
    expect(raiz.querySelector('input#ns-colonia')).not.toBeNull();
  });

  /** «Otra» no elige una colonia: devuelve el campo de texto. */
  it('«Otra» devuelve el campo de texto de la colonia', () => {
    const { raiz, fixture } = montar((anfitrion) => anfitrion.openAdd.set(true));

    escribirCp(raiz, fixture, '64000');
    expect(raiz.querySelector('input#ns-colonia')).toBeNull();

    raiz.querySelector<HTMLButtonElement>('#ns-colonia button[role="combobox"]')!.click();
    fixture.detectChanges();
    Array.from(raiz.querySelectorAll<HTMLElement>('#ns-colonia .gi-select__option'))
      .find((opcion) => opcion.textContent?.includes('Otra'))!
      .click();
    fixture.detectChanges();

    const campo = raiz.querySelector<HTMLInputElement>('input#ns-colonia');
    expect(campo).not.toBeNull();
    expect(campo!.value).toBe('');
  });

  it('una zona sin contacto lo dice, con palabras y no sólo con color', () => {
    const { raiz } = montar((host) => host.lista.set([zona()]));

    expect(raiz.querySelector('.zone__pill')?.textContent?.trim()).toBe('Sin contacto');
    expect(raiz.textContent).toContain('La zona funciona, pero nadie responde por ella');
  });

  it('con contacto muestra quién responde y su puesto', () => {
    const { raiz } = montar((host) => {
      host.lista.set([zona()]);
      host.contacts.set([contacto()]);
    });

    expect(raiz.textContent).toContain('Mariana Escalante Ruvalcaba');
    expect(raiz.textContent).toContain('Jefa de vigilancia');
    expect(raiz.querySelector('.zone__pill')).toBeNull();
  });

  /**
   * «Agregar zona» está una sola vez.
   *
   * <p>Estaba dos: en la cabecera de la ficha y otra vez sobre la lista, uno encima del otro y
   * siendo el mismo. La de la cabecera es la que se queda, con las acciones de los demás apartados.
   * </p>
   */
  it('no repite «Agregar zona» sobre la lista: vive en la cabecera de la ficha', () => {
    const { raiz } = montar((host) => host.lista.set([zona()]));

    const botones = Array.from(raiz.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Agregar zona',
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
      host.lista.set([zona()]);
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
   * <p>El menú guardaba «Editar zona» detrás de un clic y de un icono que no dice nada: había que
   * abrirlo para descubrir qué se podía hacer con la zona.</p>
   */
  it('cada zona enseña sus acciones, sin menú de tres puntos', () => {
    const { raiz } = montar((host) => host.lista.set([zona()]));

    expect(raiz.querySelector('gi-row-actions')).toBeNull();

    const acciones = Array.from(raiz.querySelectorAll('.zone__accion')).map((n) =>
      n.textContent!.trim(),
    );
    expect(acciones).toEqual(['Editar', 'Desactivar']);
  });

  it('sin permiso de escritura no ofrece ninguna acción sobre la zona', () => {
    const { raiz } = montar((host) => {
      host.lista.set([zona()]);
      host.canWrite.set(false);
    });

    expect(raiz.querySelector('.zone__accion')).toBeNull();
  });

  it('la dirección se arma legible, sin comas sueltas de los campos vacíos', () => {
    const { raiz } = montar((host) =>
      host.lista.set([zona({ neighborhood: null, exteriorNumber: null })]),
    );

    expect(raiz.querySelector('.zone__value')?.textContent?.trim())
      .toBe('Av. Patria 1250, Zapopan, Jalisco, 45110');
  });
  /**
   * El defecto: al guardar, la zona se creaba y el formulario se quedaba abierto con los mismos
   * datos dentro. Pulsar otra vez creaba una zona idéntica y nada lo impedía.
   */
  it('se vacía y se cierra al guardar', () => {
    const { fixture, raiz, escribir, guardar, host } = montar((anfitrion) => anfitrion.openAdd.set(false));

    const abrir = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Agregar zona'));
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
      .find((b) => b.textContent?.includes('Agregar zona'))
      ?.click();
    fixture.detectChanges();

    const campo = raiz.querySelector<HTMLInputElement>('#ns-nombre');
    expect(campo).not.toBeNull();
    expect(campo!.value).toBe('');
  });

  /**
   * El «sin contacto» que mentía.
   *
   * <p>La tarjeta sólo miraba contactos atados a la zona, y en la base viva 23 de 26 contactos son
   * del cliente. Así, casi toda zona decía «nadie responde por ella» mientras la pestaña de
   * Contactos mostraba un número mayor que cero al lado.</p>
   */
  it('un contacto del cliente cubre a la zona que no tiene el suyo', () => {
    const { raiz } = montar((host) => {
      host.lista.set([zona({ idClientZone: 's1', name: 'Planta Norte' })]);
      host.contacts.set([contacto({ idClientZone: null, fullName: 'Laura del cliente' })]);
    });

    expect(raiz.textContent).toContain('Laura del cliente');
    expect(raiz.textContent).toContain('contacto del cliente');
    expect(raiz.textContent).not.toContain('nadie responde por ella');
  });

  it('el contacto propio de la zona gana al del cliente', () => {
    const { raiz } = montar((host) => {
      host.lista.set([zona({ idClientZone: 's1', name: 'Planta Norte' })]);
      host.contacts.set([
        contacto({ idClientZone: null, fullName: 'Laura del cliente' }),
        contacto({ idClientZone: 's1', fullName: 'Mario de la zona' }),
      ]);
    });

    expect(raiz.textContent).toContain('Mario de la zona');
    expect(raiz.textContent).not.toContain('Laura del cliente');
  });

  it('sin ningún contacto sí lo dice', () => {
    const { raiz } = montar((host) => {
      host.lista.set([zona({ idClientZone: 's1', name: 'Planta Norte' })]);
      host.contacts.set([]);
    });

    expect(raiz.textContent).toContain('nadie responde por ella');
  });
});

/**
 * Editar una zona, que es donde el formulario y la página tienen que ponerse de acuerdo.
 *
 * <p>Salió al validar contra el sistema publicado: «Guardar zona» guardaba de verdad —la zona
 * cambiaba en la base y salía el aviso de que había quedado actualizada— y el formulario se
 * quedaba abierto, como si no hubiera pasado nada. El motivo era una carrera: el formulario se
 * cerraba solo, el efecto veía que la página seguía apuntando a esa zona, y lo reabría en el acto.
 * «Cancelar» hacía exactamente lo mismo.</p>
 *
 * <p>Ahora manda la página: ella sabe si el servidor confirmó, y el formulario la sigue.</p>
 */
describe('La pestaña de Zonas · editar', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }));

  afterEach(() => TestBed.resetTestingModule());

  const abierta = (raiz: HTMLElement) => raiz.textContent?.includes('EDITAR ZONA') ?? false;

  it('abre con los datos de la zona que pide la página', async () => {
    const original = zona({ idClientZone: 's-1', name: 'Torre Altavista' });
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
    const original = zona({ idClientZone: 's-1', name: 'Torre Altavista' });
    const { raiz, fixture, host, guardar } = montar((anfitrion) => anfitrion.lista.set([original]));
    host.editing.set(original);
    fixture.detectChanges();

    guardar()!.click();
    fixture.detectChanges();

    expect(host.editada()?.zone.idClientZone).toBe('s-1');
    // Sigue abierto: si el guardado falla, lo escrito no se pierde.
    expect(abierta(raiz)).toBe(true);

    // Y cuando la página confirma soltando la zona, el formulario se cierra de una vez.
    host.editing.set(null);
    fixture.detectChanges();

    expect(abierta(raiz)).toBe(false);
  });

  it('«Cancelar» avisa a la página, y el formulario no se reabre', () => {
    const original = zona({ idClientZone: 's-1', name: 'Torre Altavista' });
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

  /**
   * Cambiar de país invalida el estado y el municipio.
   *
   * <p>Pertenecían al país anterior. Sin esto se puede guardar una zona con un estado de México y
   * un país que no es México, y nada en la pantalla lo dice: los dos desplegables se quedan con lo
   * que tenían y parecen correctos.</p>
   *
   * <p>Es la misma regla que ya tenía estado sobre municipio, un escalón más arriba.</p>
   */
  it('cambiar de país vacía el estado y el municipio', () => {
    const { fixture } = montar();
    const pestana = obtenerDireccion(fixture);

    pestana.state.set('Nuevo León');
    pestana.municipality.set('San Nicolás de los Garza');

    pestana.onCountry('US');

    expect(pestana.countryCode()).toBe('US');
    expect(pestana.state(), 'el estado era de otro país').toBe('');
    expect(pestana.municipality()).toBe('');
  });
});
