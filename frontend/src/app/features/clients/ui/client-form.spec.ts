import { Component, signal } from '@angular/core';
import { ServerProblem } from '../../../shared/util/server-problem';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ClientForm, ClientFormValue } from './client-form';

@Component({
  imports: [ClientForm],
  template: `
    <app-client-form organizationId="org-a" [problem]="problema()" (save)="guardado.set($event)" />
  `,
})
class Anfitrion {
  readonly guardado = signal<{ value: ClientFormValue; withZone: boolean } | null>(null);
  readonly problema = signal<ServerProblem | null>(null);
}

function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === texto,
    )!;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    boton,
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
 * que el navegador lo recorra.</p>
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
 * padrón. No es un atajo: es el caso que mantiene vivos los tres desplegables, y el que hay que
 * comprobar de verdad.</p>
 */
const CODIGOS: Record<string, unknown> = {
  '64000': {
    postalCode: '64000',
    countryCode: 'MX',
    state: { code: '19', name: 'Nuevo León' },
    municipality: { code: '19046', name: 'San Nicolás de los Garza' },
    neighborhoods: [
      { name: 'Centro', settlementType: 'Colonia' },
      { name: 'La Finca', settlementType: 'Colonia' },
    ],
  },
};

/** Responde lo que la geografía tenga pendiente, que cambia conforme se elige en la cascada. */
function surtirGeografia(http: HttpTestingController, fixture: { detectChanges(): void }) {
  for (const peticion of http.match((r) => r.url.includes('/geography/'))) {
    // Una consulta cancelada no se contesta: al escribir otro codigo se cancela la anterior, y
    // responderle revienta con «Cannot flush a cancelled request».
    if (peticion.cancelled) {
      continue;
    }

    const url = peticion.request.url;

    if (url.endsWith('/countries')) {
      peticion.flush(PAISES);
    } else if (url.endsWith('/states')) {
      peticion.flush(ESTADOS);
    } else if (url.includes('/postal-codes/')) {
      const encontrado = CODIGOS[url.split('/').pop() ?? ''];
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

/** El domicilio del alta, para leer lo que el código postal dejó en él. */
function obtenerDireccion(fixture: { debugElement: { children: { componentInstance: unknown }[] } }) {
  return (
    fixture.debugElement.children[0].componentInstance as {
      direccion: { state(): string; municipality(): string };
    }
  ).direccion;
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

describe('El alta de cliente', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }));
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Lo que la pantalla existe para hacer: <b>decir que la zona es obligatoria antes de guardar</b>,
   * no al fallar el alta del servicio dos pantallas después.
   */
  /**
   * El bloque se llama «Zona», no «Zona principal».
   *
   * <p>El modelo no tiene jerarquía entre zonas —lo que el listado llamaba principal es la primera
   * por nombre—, así que ponerlo en el título del alta inventaría el concepto justo en la pantalla
   * donde se captura.</p>
   *
   * <p><b>Lo que esta prueba defendía antes y ya no puede:</b> que el bloque dijera que puedes
   * saltártelo y qué pierdes. Ese aviso se retiró el 23 de septiembre de 2026 por densidad, a
   * petición expresa. Lo que queda diciéndolo son los dos botones —«Guardar sin zona» y «Guardar
   * cliente y zona»—, que tienen su propia prueba.</p>
   */
  it('el bloque se llama Zona, sin inventar una jerarquía que no existe', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('Zona');
    expect(raiz.textContent).not.toContain('Zona principal');
  });

  it('son dos salidas y cada una dice exactamente qué hace', () => {
    const { boton } = montar();

    expect(boton('Guardar sin zona')).toBeDefined();
    expect(boton('Guardar cliente y zona')).toBeDefined();
  });

  /** El expediente sin zona es válido: sólo pide lo del cliente. */
  it('guardar sin zona no exige los campos de zona', () => {
    const { boton, escribir, fixture, host } = montar();

    escribir('cf-razon', 'Textiles La Concepción, S.A. de C.V.');
    escribir('cf-rfc', 'TLC180423K72');
    fixture.detectChanges();

    expect(boton('Guardar sin zona').disabled).toBe(false);
    expect(boton('Guardar cliente y zona').disabled).toBe(true);

    boton('Guardar sin zona').click();
    fixture.detectChanges();

    expect(host.guardado()?.withZone).toBe(false);
    expect(host.guardado()?.value.legalName).toBe('Textiles La Concepción, S.A. de C.V.');
  });

  it('guardar con zona exige la dirección completa, y dice cuál falta', () => {
    const { raiz, boton, escribir } = montar();

    escribir('cf-razon', 'Distribuidora Peñasco del Norte, S.A. de C.V.');
    escribir('cf-rfc', 'DPN180423K72');
    escribir('cf-zona', 'Planta San Nicolás');

    const guardar = boton('Guardar cliente y zona');
    expect(guardar.disabled).toBe(true);

    const razon = raiz.querySelector(`#${guardar.getAttribute('aria-describedby')}`)!;
    expect(razon.textContent).toContain('su nombre, calle, municipio, estado y código postal');
  });

  /** El código postal resuelve estado, municipio y colonias, igual que en las zonas. */
  it('el código postal resuelve la dirección de la zona', () => {
    const { raiz, fixture, escribir } = montar();

    escribir('cf-cp', '64000');

    const alta = obtenerDireccion(fixture);
    expect(alta.state()).toBe('Nuevo León');
    expect(alta.municipality()).toBe('San Nicolás de los Garza');

    raiz.querySelector<HTMLButtonElement>('#cf-colonia button[role="combobox"]')!.click();
    fixture.detectChanges();
    const colonias = Array.from(raiz.querySelectorAll('#cf-colonia .gi-select__option'))
      .map((o) => o.textContent?.trim());
    expect(colonias).toContain('La Finca');
    expect(colonias).toContain('Otra: escribirla');
  });

  /**
   * <b>El caso que de verdad importa: un código que no está en el padrón.</b>
   *
   * <p>El padrón de SEPOMEX se publica cada tanto y los fraccionamientos nuevos tardan en entrar,
   * así que esto no es raro. Lo que no puede pasar es que teclear un código desconocido borre la
   * dirección que ya estaba escrita, ni que deje la pantalla sin forma de contestar.</p>
   *
   * <p>Es el comportamiento que costó pensarlo en la tanda de zonas y el que se pierde más fácil al
   * reusar, así que se comprueba aquí también y no sólo allá.</p>
   */
  it('un código fuera del padrón no borra lo escrito y deja los desplegables', () => {
    const { raiz, fixture, escribir } = montar();

    escribir('cf-cp', '64000');
    const alta = obtenerDireccion(fixture);
    expect(alta.state()).toBe('Nuevo León');

    escribir('cf-cp', '99999');

    // Ni el estado ni el municipio se perdieron.
    expect(alta.state()).toBe('Nuevo León');
    expect(alta.municipality()).toBe('San Nicolás de los Garza');
    expect(raiz.textContent).toContain('No está en el padrón');

    // Los desplegables siguen ahí, y la colonia vuelve a ser texto libre porque no hay lista.
    expect(raiz.querySelector('#cf-estado')).not.toBeNull();
    expect(raiz.querySelector('#cf-municipio')).not.toBeNull();
    expect(raiz.querySelector('input#cf-colonia')).not.toBeNull();
  });

  it('con todo completo emite el cliente, la zona y el contacto', () => {
    const { boton, escribir, fixture, host, raiz } = montar();

    escribir('cf-razon', 'Distribuidora Peñasco del Norte, S.A. de C.V.');
    escribir('cf-corto', 'Peñasco');
    escribir('cf-rfc', 'dpn180423k72');
    escribir('cf-zona', 'Planta San Nicolás');
    escribir('cf-calle', 'Av. Universidad 2340');
    escribir('cf-cp', '66450');

    // Estado y municipio se eligen del catálogo: escribirlos a mano se lo rechaza el servidor.
    surtirCatalogo(TestBed.inject(HttpTestingController), fixture);
    elegir(raiz, 'cf-estado', 'Nuevo León', fixture);
    elegir(raiz, 'cf-municipio', 'San Nicolás de los Garza', fixture);

    escribir('cf-cnombre', 'Aurora Ibáñez Zúñiga');
    escribir('cf-ctel', '81 2264 7710');
    fixture.detectChanges();

    boton('Guardar cliente y zona').click();
    fixture.detectChanges();

    const guardado = host.guardado()!;
    expect(guardado.withZone).toBe(true);
    // El RFC se normaliza: se compara en mayúsculas para la unicidad del servidor.
    expect(guardado.value.rfc).toBe('DPN180423K72');
    expect(guardado.value.zone.state).toBe('Nuevo León');
    expect(guardado.value.zone.municipality).toBe('San Nicolás de los Garza');
    expect(guardado.value.contact.fullName).toBe('Aurora Ibáñez Zúñiga');
  });

  /**
   * El bosquejo pedía el RFC opcional. No lo es: el servidor lo usa para la unicidad del cliente,
   * así que sin él no se puede guardar ni el expediente.
   */
  it('sin RFC no se puede guardar ni el expediente', () => {
    const { boton, escribir } = montar();

    escribir('cf-razon', 'Sólo razón social');

    expect(boton('Guardar sin zona').disabled).toBe(true);
  });

  /** El código y la fecha los pone el sistema: pedirlos sería pedirle al usuario que los invente. */
  it('no pide código de cliente ni fecha de alta', () => {
    const { raiz } = montar();

    expect(raiz.textContent).not.toMatch(/código de cliente/i);
    expect(raiz.querySelector('input[type="date"]')).toBeNull();
  });

  it('cada campo tiene su etiqueta asociada', () => {
    const { raiz } = montar();

    const campos = Array.from(raiz.querySelectorAll('input'));
    expect(campos.length).toBeGreaterThan(8);

    for (const campo of campos) {
      expect(raiz.querySelector(`label[for="${campo.id}"]`), `${campo.id} sin etiqueta`).not.toBeNull();
    }
  });

  /**
   * Cambiar de estado borra el municipio: el que estaba elegido pertenecía al estado anterior, y
   * dejarlo puesto manda al servidor una pareja que no existe.
   */
  it('cambiar de estado limpia el municipio elegido', () => {
    const { fixture, raiz } = montar();

    surtirCatalogo(TestBed.inject(HttpTestingController), fixture);
    elegir(raiz, 'cf-estado', 'Nuevo León', fixture);
    elegir(raiz, 'cf-municipio', 'San Nicolás de los Garza', fixture);
    elegir(raiz, 'cf-estado', 'Jalisco', fixture);

    const municipio = raiz.querySelector<HTMLSelectElement>('#cf-municipio select')!;
    expect(municipio.value).toBe('');
  });
});

describe('El rechazo del servidor, en el campo que falló', () => {
  /**
   * Antes el alta decía «La solicitud contiene datos inválidos» arriba y nada más. El servidor
   * mandaba el detalle por campo y el frontend lo tiraba: el usuario veía un rechazo sin saber
   * qué corregir.
   */
  it('pinta el mensaje junto al campo, no sólo arriba', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();

    fixture.componentInstance.problema.set({
      message: 'El RFC no tiene el formato del SAT.',
      fieldErrors: { Rfc: 'El RFC no tiene el formato del SAT.' },
    });
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const rfc = raiz.querySelector<HTMLInputElement>('#cf-rfc')!;

    expect(rfc.classList).toContain('is-invalid');
    expect(rfc.getAttribute('aria-invalid')).toBe('true');
    expect(raiz.querySelector('.field__error')?.textContent).toContain('formato del SAT');

    // Y el campo que no falló no se marca.
    expect(raiz.querySelector<HTMLInputElement>('#cf-razon')!.classList).not.toContain('is-invalid');
  });
});
