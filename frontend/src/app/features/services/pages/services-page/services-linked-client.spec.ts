import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { ServicesPage } from './services-page';

const ORGANIZACION = { idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Seguridad Vanguardia' };
const DIA = '2026-09-04';
const CLIENTE = 'client-7';

const PERMISOS = ['CLIENTS.READ', 'CLIENTS.WRITE', 'PLANNING.READ', 'WORKFORCE.READ'];

/**
 * Llegar desde Clientes con «Crear servicio de este cliente».
 *
 * <p>Se reportó que ese botón llevaba a Servicios y ahí «Nuevo servicio» respondía que el cliente
 * no tenía ninguna sede activa, mientras Clientes le mostraba dos. La causa no estaba en el
 * servidor —la API devolvía las dos sedes activas— sino en que <b>por este camino nadie las
 * pedía</b>: la única rutina que llenaba la lista se llamaba al abrir un servicio que ya existía, y
 * un cliente sin servicios nunca llega ahí.</p>
 *
 * <p>La lista vacía no significaba «no tiene»: significaba «nadie las pidió». Es la misma confusión
 * que ya se había corregido para el caso de «todavía están cargando», y por eso conviene que quede
 * fijada y no explicada.</p>
 */
describe('Servicios · llegando con un cliente enlazado', () => {
  let http: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<ServicesPage>>;

  beforeEach(() => {
    const params = new BehaviorSubject(convertToParamMap({ clientId: CLIENTE }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            session: () => ({ permissions: PERMISOS }),
            hasPermission: (permiso: string) => PERMISOS.includes(permiso),
            operationalOrganizationId: () => 'org-a',
            activeOrganization: () => ORGANIZACION,
            availableOrganizations: () => [ORGANIZACION],
          },
        },
        {
          provide: SystemInfoService,
          useValue: { operationDate: () => DIA, timeZoneId: () => 'America/Mexico_City', info: () => null },
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServicesPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    // El reinicio va primero: si `verify` lanza, saltarselo dejaria el modulo instanciado y las
    // pruebas siguientes fallarian por un motivo que no es el suyo.
    try {
      http.verify({ ignoreCancelled: true });
    } finally {
      TestBed.resetTestingModule();
    }
  });

  const raiz = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(raiz().querySelectorAll('button')).find((item) => item.textContent?.trim() === texto);

  /** Responde a todo lo que la pantalla pide al llegar con un cliente en la dirección. */
  function llegar(sites: readonly { idClientSite: string; name: string; active: boolean }[]) {
    http.match((request) => request.url === '/api/v1/services')
      .forEach((request) => request.flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 1 }));

    // Por URL con una funcion, no con la cadena: las peticiones llevan `?organizationId=` y la
    // comparacion literal no las encuentra.
    http.expectOne((request) => request.url === `/api/v1/clients/${CLIENTE}`)
      .flush({ idClient: CLIENTE, idOrganization: 'org-a', legalName: 'Cliente con sedes', tradeName: 'awddaw' });
    fixture.detectChanges();

    http.match((request) => request.url === '/api/v1/services')
      .forEach((request) => request.flush({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 1 }));

    http.expectOne((request) => request.url === `/api/v1/clients/${CLIENTE}/sites`).flush(sites);
    http.expectOne((request) => request.url === `/api/v1/clients/${CLIENTE}/contracts`).flush([]);
    http.expectOne((request) => request.url === `/api/v1/clients/${CLIENTE}/contacts`).flush([]);
    fixture.detectChanges();
  }

  it('pide las sedes del cliente, aunque todavía no tenga ni un servicio', () => {
    llegar([{ idClientSite: 'site-1', name: 'Sede de prueba', active: true }]);

    // La comprobación de verdad la hace `http.verify()` en el afterEach: si la petición de sedes no
    // se hubiera hecho, el `expectOne` de arriba habría fallado.
    expect(raiz().textContent).not.toContain('no tiene ninguna sede activa');
  });

  it('con una sede activa, «Nuevo servicio» abre el alta en vez de negarla', () => {
    llegar([{ idClientSite: 'site-1', name: 'Sede de prueba', active: true }]);

    // Sin esto la prueba pasaria sola si el boton no existiera: `?.click()` no haria nada y el
    // aviso tampoco apareceria.
    const nuevo = boton('Nuevo servicio');
    expect(nuevo).toBeDefined();
    nuevo!.click();
    fixture.detectChanges();

    expect(raiz().textContent).not.toContain('no tiene ninguna sede activa');
  });

  /** Y cuando de verdad no hay sede activa, el aviso sigue siendo el correcto. */
  it('sin ninguna sede activa, sí lo dice', () => {
    llegar([{ idClientSite: 'site-1', name: 'Sede dada de baja', active: false }]);

    const nuevo = boton('Nuevo servicio');
    expect(nuevo).toBeDefined();
    nuevo!.click();
    fixture.detectChanges();

    expect(raiz().textContent).toContain('no tiene ninguna sede activa');
  });
});
