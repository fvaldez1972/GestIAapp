import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Client, ClientInput } from '../data-access/client.models';
import { ClientEditForm } from './client-edit-form';

const CLIENTE: Client = {
  idClient: 'cli-1',
  idOrganization: 'org-a',
  organizationName: 'Empresa de prueba',
  codeClient: 'CLI-01',
  legalName: 'Muebles Modernos S.A. de C.V.',
  tradeName: 'Muebles Modernos',
  rfc: 'MODN890913LN8',
  nationality: 'Mexicana',
  taxActivity: 'Comercio al por mayor',
  taxAddress: 'Av. Constitucion 123',
  publicRegistryDate: '2019-04-01',
  commercialRegistryFolio: 'FOLIO-9911',
  employerRegistrationNumber: 'B5512345678',
  incorporationDate: '2018-02-15',
  incorporationDeedNumber: 'ESC-4410',
  legalRepresentativeInstrumentNumber: 'INST-771',
  active: true,
  createdAt: '2026-09-12T05:09:50Z',
  updatedAt: null,
};

@Component({
  imports: [ClientEditForm],
  template: `
    <app-client-edit-form [client]="client()" (save)="guardado.set($event)" (cancel)="cancelado.set(true)" />
  `,
})
class Anfitrion {
  readonly client = signal<Client>(CLIENTE);
  readonly guardado = signal<ClientInput | null>(null);
  readonly cancelado = signal(false);
}

describe('Editar cliente', () => {
  afterEach(() => TestBed.resetTestingModule());

  function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const campo = (name: string) => raiz.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

    return { fixture, raiz, host: fixture.componentInstance, campo };
  }

  /**
   * <b>Están los doce campos, no los tres visibles.</b>
   *
   * <p>El `PUT` del servidor reemplaza el perfil entero. Un formulario con razón social, nombre
   * corto y RFC mandaría vacíos los otros nueve y los borraría sin decir nada. Esta prueba es la
   * que impide que alguien «simplifique» el formulario y se lleve por delante los datos fiscales.
   * </p>
   */
  it('trae los doce campos del perfil, no sólo los visibles en la ficha', () => {
    const { raiz } = montar();

    const nombres = Array.from(raiz.querySelectorAll('input')).map((i) => i.getAttribute('name'));

    expect(nombres).toEqual([
      'legalName',
      'tradeName',
      'rfc',
      'nationality',
      'taxActivity',
      'taxAddress',
      'employerRegistrationNumber',
      'incorporationDate',
      'incorporationDeedNumber',
      'publicRegistryDate',
      'commercialRegistryFolio',
      'legalRepresentativeInstrumentNumber',
    ]);
  });

  it('se prellena con lo que hay, incluidos los datos fiscales', async () => {
    const { fixture, campo } = montar();
    // `ngModel` escribe el valor en el input en un microtask, no en el mismo ciclo de deteccion.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(campo('legalName').value).toBe('Muebles Modernos S.A. de C.V.');
    expect(campo('rfc').value).toBe('MODN890913LN8');
    expect(campo('nationality').value).toBe('Mexicana');
    expect(campo('employerRegistrationNumber').value).toBe('B5512345678');
    expect(campo('incorporationDate').value).toBe('2018-02-15');
  });

  /** Cambiar el nombre no puede vaciar lo demás: eso es exactamente lo que el `PUT` haría. */
  it('al guardar devuelve los nueve campos que no se tocaron', async () => {
    const { fixture, host, campo } = montar();
    await fixture.whenStable();
    fixture.detectChanges();

    const nombre = campo('legalName');
    nombre.value = 'Muebles Modernos del Norte S.A. de C.V.';
    nombre.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form.edit')!
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const enviado = host.guardado()!;
    expect(enviado).not.toBeNull();
    expect(enviado.legalName).toBe('Muebles Modernos del Norte S.A. de C.V.');
    expect(enviado.nationality).toBe('Mexicana');
    expect(enviado.taxActivity).toBe('Comercio al por mayor');
    expect(enviado.taxAddress).toBe('Av. Constitucion 123');
    expect(enviado.commercialRegistryFolio).toBe('FOLIO-9911');
    expect(enviado.employerRegistrationNumber).toBe('B5512345678');
    expect(enviado.incorporationDeedNumber).toBe('ESC-4410');
    expect(enviado.legalRepresentativeInstrumentNumber).toBe('INST-771');
    expect(enviado.publicRegistryDate).toBe('2019-04-01');
    expect(enviado.incorporationDate).toBe('2018-02-15');
  });

  /** El código no se edita: lo pone el servidor y no es un dato que se decida. */
  it('no ofrece editar el código', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('input[name="codeClient"]')).toBeNull();
    expect(raiz.textContent).toContain('CLI-01');
  });
});
