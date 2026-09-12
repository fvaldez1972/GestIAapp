import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { PlatformPage } from './platform-page';

const ORGANIZACION = {
  idOrganization: 'org-a',
  codeOrganization: 'ORG-01',
  legalName: 'Seguridad Vanguardia',
  rfc: null,
  active: true,
};

const ROL_ADMIN = {
  idRole: 'rol-1',
  codeRole: 'ORGANIZATION_ADMIN',
  name: 'Admin de organización',
  description: null,
  isSystem: true,
  active: true,
  permissions: [],
};

/**
 * El alta de organización del Super Admin.
 *
 * <p>Lo que se fija aquí es el formulario tal como quedó tras la revisión: <b>el código ya no se
 * pide</b> —lo genera el servidor con la forma <c>ORG-01</c>, como el de cliente—, el nombre va
 * antes que el RFC, y el alta no está abierta de entrada sino detrás de un botón.</p>
 */
describe('Plataforma · alta de organización', () => {
  afterEach(() => TestBed.resetTestingModule());

  function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            operationalOrganizationId: signal('org-a'),
            activeOrganization: () => ORGANIZACION,
            hasPermission: () => true,
            session: () => ({ permissions: [], isPlatformAdmin: true }),
            isPlatformAdmin: () => true,
          },
        },
      ],
    });

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PlatformPage);
    fixture.detectChanges();

    // Las cuatro peticiones que la pantalla lanza al entrar. Se responden por funcion y no por
    // cadena literal: algunas llevan parametros y la comparacion exacta no las encontraria.
    http.match((r) => r.url.endsWith('/organizations')).forEach((r) => r.flush([ORGANIZACION]));
    http.match((r) => r.url.endsWith('/organizations/governance')).forEach((r) =>
      r.flush([{ organization: ORGANIZACION, clients: [], usersCount: 0, adminsCount: 0 }]),
    );
    http.match((r) => r.url.endsWith('/users')).forEach((r) => r.flush([]));
    http.match((r) => r.url.endsWith('/roles')).forEach((r) => r.flush([ROL_ADMIN]));
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const boton = (texto: string) =>
      Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);

    return { fixture, http, raiz, boton };
  }

  /**
   * El formulario ocupaba media pantalla siempre, abierto sobre el directorio. Dar de alta una
   * empresa pasa de vez en cuando; leer el directorio es a lo que se entra.
   *
   * <p>Y el boton vive <b>en la cabecera de la pantalla</b>, con las demas acciones. Dentro de la
   * tarjeta del alta quedaba a media pagina: para dar de alta una organizacion habia que bajar
   * hasta encontrarlo, y quien entraba no veia que se pudiera.</p>
   */
  it('el alta no está abierta de entrada, y el botón que la abre está en la cabecera', () => {
    const { raiz, boton, fixture } = montar();

    expect(raiz.textContent).not.toContain('Nombre de la organización');

    const abrir = boton('Nueva organización');
    expect(abrir).toBeDefined();
    expect(abrir!.closest('.hero-actions')).not.toBeNull();

    abrir!.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Nombre de la organización');
  });

  /**
   * Se apaga en vez de desaparecer. Que se esfume el boton que acabas de pulsar deja dudando si se
   * pulso o si algo fallo; apagado se ve que es el que esta en curso.
   */
  it('con el alta abierta el botón sigue ahí, apagado', () => {
    const { boton, fixture } = montar();

    boton('Nueva organización')!.click();
    fixture.detectChanges();

    const abrir = boton('Nueva organización');
    expect(abrir).toBeDefined();
    expect(abrir!.disabled).toBe(true);
  });

  /**
   * El alta se abre <b>encima</b>, no dentro de la columna.
   *
   * <p>Desplegarla donde vivia dejaba el formulario empujando el directorio y la ficha de la
   * organizacion elegida: se quitaba el desorden de tenerla siempre abierta, pero seguia
   * disputandole el sitio a lo que se estaba consultando.</p>
   */
  it('el alta se abre en una ventana emergente, no dentro de la columna', () => {
    const { raiz, boton, fixture } = montar();

    expect(raiz.querySelector('.modal-backdrop')).toBeNull();

    boton('Nueva organización')!.click();
    fixture.detectChanges();

    const ventana = raiz.querySelector('.modal-backdrop .modal[role="dialog"]');
    expect(ventana).not.toBeNull();
    expect(ventana!.getAttribute('aria-modal')).toBe('true');
    // El formulario vive dentro de la ventana, no en la tarjeta del directorio.
    expect(ventana!.querySelector('form.creation-form')).not.toBeNull();
    expect(raiz.querySelector('.platform-registry form.creation-form')).toBeNull();
  });

  /**
   * La ficha apilaba cinco bloques: datos editables, alta de admin, lista de admins, lista de
   * clientes y una nota. Para leer quien es el responsable habia que pasar por encima de un
   * formulario vacio.
   */
  it('la ficha separa por pestañas lo que se edita de lo que se consulta', () => {
    const { raiz, fixture } = montar();

    const pestanas = Array.from(raiz.querySelectorAll('.detail-tabs [role="tab"]')).map((n) =>
      n.textContent!.trim(),
    );
    expect(pestanas).toEqual(['Datos', 'Responsables', 'Clientes']);

    // Al entrar se ve Datos, que es la regla del sistema para toda ficha.
    expect(raiz.textContent).toContain('Datos de la organización');
    expect(raiz.textContent).not.toContain('Responsables de la organización');

    const responsables = Array.from(
      raiz.querySelectorAll<HTMLButtonElement>('.detail-tabs [role="tab"]'),
    ).find((b) => b.textContent?.trim() === 'Responsables')!;
    responsables.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Responsables de la organización');
    expect(raiz.textContent).not.toContain('Datos de la organización');
  });

  /** Y el alta de admin sigue la misma regla que la de organización: ventana, no incrustada. */
  it('crear admin también abre en ventana, y no estorba a la lista de responsables', () => {
    const { raiz, boton, fixture } = montar();

    const responsables = Array.from(
      raiz.querySelectorAll<HTMLButtonElement>('.detail-tabs [role="tab"]'),
    ).find((b) => b.textContent?.trim() === 'Responsables')!;
    responsables.click();
    fixture.detectChanges();

    // La lista se lee sin un formulario encima.
    expect(raiz.querySelector('.modal-backdrop')).toBeNull();

    boton('Crear admin')!.click();
    fixture.detectChanges();

    const ventana = raiz.querySelector('.modal-backdrop .modal[role="dialog"]');
    expect(ventana).not.toBeNull();
    expect(ventana!.textContent).toContain('Crear admin para esta organización');
  });

  /** El encabezado del alta entra y sale con el formulario: solo, anunciaba algo que no estaba. */
  it('el título del alta no se queda solo cuando el formulario está cerrado', () => {
    const { raiz, boton, fixture } = montar();

    expect(raiz.textContent).not.toContain('Alta de organización');

    boton('Nueva organización')!.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Alta de organización');
  });

  /**
   * El código no se pide. Lo genera el servidor, y pedírselo a quien da de alta una empresa le
   * hacía inventar una convención que el sistema ya tiene.
   */
  it('el primer paso pide el nombre y luego el RFC, y no pide código', () => {
    const { raiz, boton, fixture } = montar();
    boton('Nueva organización')!.click();
    fixture.detectChanges();

    // Acotado a la ventana: la ficha de la derecha tiene su propio formulario de edicion, con
    // Codigo y Nombre legal, y un selector por clase los mezclaria con los del alta.
    const etiquetas = Array.from(
      raiz.querySelectorAll('.modal form.creation-form label span'),
    ).map((n) => n.textContent!.trim());

    expect(etiquetas).toEqual(['Nombre de la organización', 'RFC']);
    expect(raiz.querySelector('input[name="newOrganizationCode"]')).toBeNull();
  });

  /** El paso dos ya se llama «2. Administrador» arriba; repetirlo dentro gastaba una línea. */
  it('el segundo paso no repite un título, y la contraseña no se llama temporal', async () => {
    const { raiz, boton, fixture } = montar();
    boton('Nueva organización')!.click();
    fixture.detectChanges();

    // `ngModel` registra sus controles en un microtask, asi que hay que dejar que se vacie antes de
    // escribir: sin esto el formulario todavia no tiene controles, el valor no llega a la señal y
    // el paso se queda pidiendo los campos obligatorios que si estan llenos.
    await fixture.whenStable();

    const nombre = raiz.querySelector('input[name="newOrganizationLegalName"]') as HTMLInputElement;
    nombre.value = 'Empresa de prueba';
    nombre.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    boton('Continuar')!.click();
    fixture.detectChanges();

    expect(raiz.querySelector('form.creation-form legend')).toBeNull();
    expect(raiz.textContent).toContain('Contraseña');
    expect(raiz.textContent).not.toContain('Contraseña temporal');
  });
});
