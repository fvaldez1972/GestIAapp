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
  readonly guardado = signal<{ value: ClientFormValue; withSite: boolean } | null>(null);
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

describe('El alta de cliente', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }));
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Lo que la pantalla existe para hacer: <b>decir que la sede es obligatoria antes de guardar</b>,
   * no al fallar el alta del servicio dos pantallas después.
   */
  it('el bloque de sede dice para qué es, antes de guardar', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('SEDE · OBLIGATORIA PARA CREAR SERVICIOS');
    expect(raiz.textContent).toContain('Sin sede el cliente queda como expediente');
  });

  it('son dos salidas y cada una dice exactamente qué hace', () => {
    const { boton } = montar();

    expect(boton('Guardar sin sede')).toBeDefined();
    expect(boton('Guardar cliente y sede')).toBeDefined();
  });

  /** El expediente sin sede es válido: sólo pide lo del cliente. */
  it('guardar sin sede no exige los campos de sede', () => {
    const { boton, escribir, fixture, host } = montar();

    escribir('cf-razon', 'Textiles La Concepción, S.A. de C.V.');
    escribir('cf-rfc', 'TLC180423K72');
    fixture.detectChanges();

    expect(boton('Guardar sin sede').disabled).toBe(false);
    expect(boton('Guardar cliente y sede').disabled).toBe(true);

    boton('Guardar sin sede').click();
    fixture.detectChanges();

    expect(host.guardado()?.withSite).toBe(false);
    expect(host.guardado()?.value.legalName).toBe('Textiles La Concepción, S.A. de C.V.');
  });

  it('guardar con sede exige la dirección completa, y dice cuál falta', () => {
    const { raiz, boton, escribir } = montar();

    escribir('cf-razon', 'Distribuidora Peñasco del Norte, S.A. de C.V.');
    escribir('cf-rfc', 'DPN180423K72');
    escribir('cf-sede', 'Planta San Nicolás');

    const guardar = boton('Guardar cliente y sede');
    expect(guardar.disabled).toBe(true);

    const razon = raiz.querySelector(`#${guardar.getAttribute('aria-describedby')}`)!;
    expect(razon.textContent).toContain('su nombre, calle, municipio, estado y código postal');
  });

  it('con todo completo emite el cliente, la sede y el contacto', () => {
    const { boton, escribir, fixture, host, raiz } = montar();

    escribir('cf-razon', 'Distribuidora Peñasco del Norte, S.A. de C.V.');
    escribir('cf-corto', 'Peñasco');
    escribir('cf-rfc', 'dpn180423k72');
    escribir('cf-sede', 'Planta San Nicolás');
    escribir('cf-calle', 'Av. Universidad 2340');
    escribir('cf-cp', '66450');

    // Estado y municipio se eligen del catálogo: escribirlos a mano se lo rechaza el servidor.
    surtirCatalogo(TestBed.inject(HttpTestingController), fixture);
    elegir(raiz, 'cf-estado', 'Nuevo León', fixture);
    elegir(raiz, 'cf-municipio', 'San Nicolás de los Garza', fixture);

    escribir('cf-cnombre', 'Aurora Ibáñez Zúñiga');
    escribir('cf-ctel', '81 2264 7710');
    fixture.detectChanges();

    boton('Guardar cliente y sede').click();
    fixture.detectChanges();

    const guardado = host.guardado()!;
    expect(guardado.withSite).toBe(true);
    // El RFC se normaliza: se compara en mayúsculas para la unicidad del servidor.
    expect(guardado.value.rfc).toBe('DPN180423K72');
    expect(guardado.value.site.state).toBe('Nuevo León');
    expect(guardado.value.site.municipality).toBe('San Nicolás de los Garza');
    expect(guardado.value.contact.fullName).toBe('Aurora Ibáñez Zúñiga');
  });

  /**
   * El bosquejo pedía el RFC opcional. No lo es: el servidor lo usa para la unicidad del cliente,
   * así que sin él no se puede guardar ni el expediente.
   */
  it('sin RFC no se puede guardar ni el expediente', () => {
    const { boton, escribir } = montar();

    escribir('cf-razon', 'Sólo razón social');

    expect(boton('Guardar sin sede').disabled).toBe(true);
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
