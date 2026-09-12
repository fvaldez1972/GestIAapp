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
    http.match((r) => r.url.endsWith('/organizations/governance')).forEach((r) => r.flush([]));
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
   */
  it('el alta no está abierta de entrada: hay un botón que la abre', () => {
    const { raiz, boton, fixture } = montar();

    expect(raiz.textContent).not.toContain('Nombre de la organización');
    const abrir = boton('Nueva organización');
    expect(abrir).toBeDefined();

    abrir!.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Nombre de la organización');
  });

  /**
   * El código no se pide. Lo genera el servidor, y pedírselo a quien da de alta una empresa le
   * hacía inventar una convención que el sistema ya tiene.
   */
  it('el primer paso pide el nombre y luego el RFC, y no pide código', () => {
    const { raiz, boton, fixture } = montar();
    boton('Nueva organización')!.click();
    fixture.detectChanges();

    const etiquetas = Array.from(raiz.querySelectorAll('form.creation-form label span')).map((n) =>
      n.textContent!.trim(),
    );

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
