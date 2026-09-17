import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ClientContact, ClientSite } from '../data-access/client.models';
import { ClientContacts, NewContact } from './client-contacts';
import { contacto, sede } from './client-fixtures';

@Component({
  imports: [ClientContacts],
  template: `
    <app-client-contacts
      [contacts]="lista()"
      [sites]="sites()"
      [jobPositions]="puestos()"
      [canWrite]="canWrite()"
      (create)="creado.set($event)"
    />
  `,
})
class Anfitrion {
  readonly lista = signal<readonly ClientContact[]>([]);
  readonly sites = signal<readonly ClientSite[]>([]);
  readonly canWrite = signal(true);
  readonly puestos = signal<readonly { idCatalogItem: string; name: string }[]>([]);
  readonly creado = signal<NewContact | null>(null);
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
    abrir: () => {
      const boton = Array.from(raiz.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Agregar contacto'))!;
      boton.click();
      fixture.detectChanges();
    },
    escribir: (id: string, valor: string) => {
      const campo = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
  };
}

describe('Contactos del cliente', () => {
  afterEach(() => TestBed.resetTestingModule());

  /**
   * El defecto que cierra esta pieza.
   *
   * <p>El botón existía desde el principio y emitía una señal que la página no escuchaba, y detrás
   * no había formulario. Desde fuera se veía como un botón que no responde, que es de los defectos
   * que nadie diagnostica.</p>
   */
  it('el botón abre un formulario, no emite al vacío', () => {
    const { raiz, abrir } = montar();

    expect(raiz.querySelector('.new')).toBeNull();
    abrir();
    expect(raiz.querySelector('.new')).not.toBeNull();
    expect(raiz.textContent).toContain('NUEVO CONTACTO');
  });

  /**
   * Un contacto al que no se puede llamar no sirve para lo que existe, y la lista ya dice «Sin
   * teléfono ni correo registrados» de los que llegaron así. No tiene sentido crear más.
   */
  it('no deja guardar sin nombre ni forma de contacto', () => {
    const { abrir, escribir, guardar } = montar();
    abrir();

    expect(guardar()?.disabled).toBe(true);

    escribir('nc-nombre', 'Laura Méndez');
    expect(guardar()?.disabled).toBe(true);

    escribir('nc-correo', 'laura@cliente.mx');
    expect(guardar()?.disabled).toBe(false);
  });

  it('emite lo que se capturó, con la sede en nulo cuando es del cliente', () => {
    const { abrir, escribir, guardar, host, fixture } = montar();
    abrir();
    escribir('nc-nombre', '  Laura Méndez  ');
    escribir('nc-telefono', '3312345678');
    guardar()!.click();
    fixture.detectChanges();

    expect(host.creado()).toEqual({
      fullName: 'Laura Méndez',
      purpose: 'Operational',
      idClientSite: null,
      // Sin puesto elegido va vacío. El puesto sale del catálogo, no de texto libre: el servidor
      // lo valida contra el catálogo de puestos y rechaza con 409 cualquier cosa escrita a mano.
      jobTitle: '',
      email: '',
      phone: '3312345678',
      isPrimary: false,
    });
  });

  /**
   * Se vacía al cerrar, que es justo lo que falta en el alta de sedes y por lo que ahí se pueden
   * crear duplicados sin darse cuenta: basta con volver a abrir y guardar.
   */
  it('se vacía al cancelar, para que no se guarde dos veces lo mismo', () => {
    const { raiz, abrir, escribir, fixture } = montar();
    abrir();
    escribir('nc-nombre', 'Laura Méndez');

    raiz.querySelector<HTMLButtonElement>('.button:not(.button--primary)')!.click();
    fixture.detectChanges();
    abrir();

    expect(raiz.querySelector<HTMLInputElement>('#nc-nombre')!.value).toBe('');
  });

  it('sin permiso de escritura no ofrece agregar', () => {
    const { raiz } = montar((host) => {
      host.canWrite.set(false);
      host.lista.set([contacto()]);
    });

    expect(raiz.textContent).not.toContain('Agregar contacto');
  });

  /** Sólo las sedes activas: ofrecer una dada de baja sería ofrecer un destino que ya no existe. */
  it('ofrece las sedes activas y la opción de no tener sede', () => {
    const { raiz, abrir, fixture } = montar((host) => {
      host.sites.set([
        sede({ idClientSite: 's1', name: 'Planta Norte', active: true }),
        sede({ idClientSite: 's2', name: 'Bodega vieja', active: false }),
      ]);
    });
    abrir();

    const disparadores = Array.from(raiz.querySelectorAll('gi-select button[role="combobox"]'));
    const sedes = disparadores[1] as HTMLButtonElement;
    sedes.click();
    fixture.detectChanges();
    const opciones = Array.from(raiz.querySelectorAll('gi-select .gi-select__option'))
      .map((o) => o.textContent?.trim());

    expect(opciones).toContain('Del cliente, no de una sede');
    expect(opciones).toContain('Planta Norte');
    expect(opciones).not.toContain('Bodega vieja');
  });

  /**
   * El puesto NO es texto libre, y costó un viaje entero descubrirlo.
   *
   * <p>El servidor valida el puesto del contacto contra el catálogo de puestos y devuelve 409
   * «Selecciona un valor activo del catálogo correspondiente» con cualquier cosa escrita a mano.
   * La primera versión de este formulario puso una caja de texto y el guardado fallaba siempre.</p>
   */
  it('el puesto sale del catálogo, no de una caja de texto', () => {
    const { raiz, abrir } = montar((host) => {
      host.puestos.set([{ idCatalogItem: 'p1', name: 'Jefa de seguridad' }]);
    });
    abrir();

    // El campo existe, pero es el combobox del selector de catálogo, no una caja libre: por eso
    // se comprueba el rol y no la mera presencia de un input.
    expect(raiz.querySelector('gi-catalog-picker')).not.toBeNull();
    expect(raiz.querySelector('#nc-puesto')?.getAttribute('role')).toBe('combobox');
  });

  it('manda el nombre del puesto que corresponde al identificador elegido', () => {
    const { raiz, abrir, escribir, guardar, host, fixture } = montar((anfitrion) => {
      anfitrion.puestos.set([{ idCatalogItem: 'p1', name: 'Jefa de seguridad' }]);
    });
    abrir();
    escribir('nc-nombre', 'Laura Méndez');
    escribir('nc-telefono', '3312345678');

    // Se elige por identificador, que es lo que el selector entrega.
    const contactos = fixture.debugElement.children[0].componentInstance as { idJobPosition: { set(v: string): void } };
    contactos.idJobPosition.set('p1');
    fixture.detectChanges();

    guardar()!.click();
    fixture.detectChanges();

    // Y lo que viaja al servidor es el nombre del catálogo, no lo que alguien escribiera.
    expect(host.creado()?.jobTitle).toBe('Jefa de seguridad');
    expect(raiz).toBeTruthy();
  });
});
