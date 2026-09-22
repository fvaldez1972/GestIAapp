import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Employee } from '../data-access/workforce.models';
import { EmployeeAddress, EmployeeAddressValue } from './employee-address';

const PAISES = [{ code: 'MX', name: 'México' }];
const ESTADOS = [{ code: '19', name: 'Nuevo León' }];
const MUNICIPIOS = [{ code: '19039', name: 'Monterrey' }];

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

/**
 * Responde lo que la geografía tenga pendiente. Un código fuera del padrón contesta 404.
 *
 * <p>Devuelve <b>cuántas consultas de código postal</b> contestó, y eso no es un adorno: la prueba
 * de que abrir el editor no consulta el código no se puede escribir con <c>expectNone</c> después
 * de surtir, porque surtir ya se habría llevado la petición. Escrita así pasaba con la consulta
 * puesta a propósito.</p>
 */
function surtirGeografia(fixture: { detectChanges(): void }): number {
  const http = TestBed.inject(HttpTestingController);
  let consultasDeCodigo = 0;

  for (const peticion of http.match((r) => r.url.includes('/geography/'))) {
    const url = peticion.request.url;

    if (url.endsWith('/countries')) {
      peticion.flush(PAISES);
    } else if (url.endsWith('/states')) {
      peticion.flush(ESTADOS);
    } else if (url.includes('/postal-codes/')) {
      consultasDeCodigo++;
      const encontrado = CODIGOS[url.split('/').pop() ?? ''];
      if (encontrado) {
        peticion.flush(encontrado);
      } else {
        peticion.flush(null, { status: 404, statusText: 'Not Found' });
      }
    } else {
      peticion.flush(MUNICIPIOS);
    }
  }

  fixture.detectChanges();
  return consultasDeCodigo;
}

@Component({
  imports: [EmployeeAddress],
  template: `
    <app-employee-address
      organizationId="org-a"
      [employee]="expediente()"
      (guardar)="guardado.set($event)"
      (cancelar)="cancelados.set(cancelados() + 1)"
    />
  `,
})
class Anfitrion {
  readonly expediente = signal<Employee | null>(null);
  readonly guardado = signal<EmployeeAddressValue | null>(null);
  readonly cancelados = signal(0);
}

/** Un expediente con domicilio, del que sólo importan los campos de dirección. */
function expedienteCon(direccion: Partial<Employee>): Employee {
  return { street: null, streetNumber: null, neighborhood: null, postalCode: null,
    municipality: null, state: null, countryCode: null, ...direccion } as Employee;
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();
  const consultasAlAbrir = surtirGeografia(fixture);

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    raiz,
    consultasAlAbrir,
    host: fixture.componentInstance,
    escribir: (id: string, valor: string) => {
      const campo = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      surtirGeografia(fixture);
    },
    guardar: () => raiz.querySelector<HTMLButtonElement>('.dir__button--primary')!,
  };
}

describe('El domicilio de una persona', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * Abrir el editor <b>no</b> consulta el código postal.
   *
   * <p>El domicilio ya está guardado; volver a resolverlo podría reescribirlo solo, sin que nadie
   * lo pidiera. Es la misma regla que en las zonas de un cliente, y por eso la comparte la misma
   * pieza. La prueba lo comprueba de la forma que no admite dudas: no hay ninguna petición de
   * código postal pendiente después de abrir.</p>
   */
  it('abre con lo guardado y sin salir a consultar el código postal', async () => {
    const { raiz, fixture, consultasAlAbrir } = montar((host) =>
      host.expediente.set(expedienteCon({
        street: 'Av. Universidad',
        streetNumber: '2340',
        neighborhood: 'Del Valle',
        postalCode: '66450',
        state: 'Nuevo León',
        municipality: 'San Nicolás de los Garza',
      })));

    expect(consultasAlAbrir, 'abrir el editor no consulta el código postal').toBe(0);

    // ngModel escribe el valor inicial en un microtarea, no en la misma pasada de detección.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(raiz.querySelector<HTMLInputElement>('#ea-calle')!.value).toBe('Av. Universidad');
    expect(raiz.querySelector<HTMLInputElement>('#ea-numero')!.value).toBe('2340');
    expect(raiz.querySelector<HTMLInputElement>('#ea-cp')!.value).toBe('66450');
    // La colonia es texto libre porque nadie ha resuelto un código: no hay lista que ofrecer.
    expect(raiz.querySelector<HTMLInputElement>('input#ea-colonia')!.value).toBe('Del Valle');
  });

  /** El código postal resuelve el resto, igual que en las zonas. */
  it('el código postal resuelve estado, municipio y colonias', () => {
    const { raiz, fixture, escribir, guardar, host } = montar();

    escribir('ea-calle', 'Morelos');
    escribir('ea-cp', '64000');

    raiz.querySelector<HTMLButtonElement>('#ea-colonia button[role="combobox"]')!.click();
    fixture.detectChanges();
    Array.from(raiz.querySelectorAll<HTMLElement>('#ea-colonia .gi-select__option'))
      .find((opcion) => opcion.textContent?.trim() === 'La Finca')!
      .click();
    fixture.detectChanges();

    guardar().click();
    fixture.detectChanges();

    expect(host.guardado()).toEqual({
      street: 'Morelos',
      streetNumber: '',
      neighborhood: 'La Finca',
      postalCode: '64000',
      state: 'Nuevo León',
      municipality: 'Monterrey',
      countryCode: 'MX',
    });
  });

  /**
   * El control, y el que justifica que los desplegables se queden.
   *
   * <p>Un código fuera del padrón no puede borrar el domicilio que ya estaba: quien entró a
   * corregir el número de la calle no puede perder el estado por teclear mal un dígito.</p>
   */
  it('un código fuera del padrón conserva lo que ya había', async () => {
    const { raiz, fixture, escribir } = montar((host) =>
      host.expediente.set(expedienteCon({
        state: 'Nuevo León',
        municipality: 'Monterrey',
        neighborhood: 'Centro',
      })));

    await fixture.whenStable();
    fixture.detectChanges();

    escribir('ea-cp', '99999');

    expect(raiz.textContent).toContain('No está en el padrón');
    expect(raiz.querySelector<HTMLInputElement>('input#ea-colonia')!.value).toBe('Centro');
    // Y los desplegables siguen ahí para contestar a mano.
    expect(raiz.querySelector('#ea-estado')).not.toBeNull();
    expect(raiz.querySelector('#ea-municipio')).not.toBeNull();
  });

  /** Un domicilio vacío se puede guardar: vacío es «no se sabe», no un error. */
  it('deja guardar el domicilio en blanco', () => {
    const { fixture, guardar, host } = montar();

    guardar().click();
    fixture.detectChanges();

    expect(host.guardado()).toEqual({
      street: '', streetNumber: '', neighborhood: '',
      postalCode: '', state: '', municipality: '', countryCode: 'MX',
    });
  });
});
