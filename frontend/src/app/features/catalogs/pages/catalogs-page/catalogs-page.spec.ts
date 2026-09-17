import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { CatalogItem, EligibilityRequirement } from '../../data-access/catalog.models';
import { CatalogsPage } from './catalogs-page';

const ORGANIZACION = { idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Seguridad Vanguardia' };

const valor = (parcial: Partial<CatalogItem>): CatalogItem => ({
  idCatalogItem: 'v1',
  idOrganization: 'org-a',
  type: 'Skill',
  name: 'Manejo de arma corta',
  description: null,
  active: true,
  ...parcial,
});

const regla = (parcial: Partial<EligibilityRequirement>): EligibilityRequirement => ({
  idEligibilityRequirement: 'r1',
  idOrganization: 'org-a',
  targetType: 'Organization',
  idClient: null,
  clientName: null,
  idService: null,
  serviceName: null,
  idPosition: null,
  positionName: null,
  requirementType: 'Skill',
  idRequiredCatalogItem: null,
  requiredCatalogItemName: null,
  requiredDocumentType: null,
  requiredEvaluationType: null,
  name: 'Requiere arma corta',
  description: null,
  isBlocking: true,
  active: true,
  ...parcial,
});

type Datos = {
  readonly items?: readonly CatalogItem[];
  readonly requirements?: readonly EligibilityRequirement[];
  readonly employees?: readonly unknown[];
  readonly definitions?: readonly unknown[];
};

describe('Catálogos', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    // Sin esto, un espía sobre `window` sobrevive a la prueba que lo puso: `vi.spyOn` devuelve el
    // mismo espía si ya estaba, con su cuenta de llamadas incluida, y la prueba siguiente hereda
    // llamadas que no hizo.
    vi.restoreAllMocks();
  });

  function montar(datos: Datos = {}) {
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
            session: () => ({ permissions: [] }),
          },
        },
        { provide: SystemInfoService, useValue: { operationDate: () => '2026-09-07' } },
      ],
    });

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CatalogsPage);
    fixture.detectChanges();

    http.expectOne('/api/v1/catalogs/definitions').flush(datos.definitions ?? []);
    http.expectOne((r) => r.url === '/api/v1/catalogs/items').flush(datos.items ?? []);
    http.expectOne((r) => r.url === '/api/v1/catalogs/eligibility-requirements').flush(datos.requirements ?? []);
    http.expectOne((r) => r.url === '/api/v1/clients').flush({ items: [], totalCount: 0, page: 1, pageSize: 100 });
    http.expectOne((r) => r.url === '/api/v1/employees')
      .flush({ items: datos.employees ?? [], totalCount: (datos.employees ?? []).length, page: 1, pageSize: 100 });
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as Record<string, never>;
    return { fixture, http, componente, raiz: fixture.nativeElement as HTMLElement };
  }

  /**
   * La pantalla anterior abría un diálogo modal al entrar: había que elegir un catálogo antes de
   * ver nada. Un cuadro modal como primera pantalla es una puerta cerrada, no una portada.
   */
  it('no recibe con un diálogo: los catálogos se ven al entrar', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('dialog[open]')).toBeNull();
    expect(raiz.textContent).toContain('Puestos');
    expect(raiz.textContent).toContain('Motivos de incidencia');
  });

  /**
   * «Quién lo usa» es la razón de ser de la zona de arriba, y la distinción entre identificador y
   * nombre cambia lo que pasa al renombrar un valor.
   */
  it('cada catálogo dice quién lo usa y si lo guarda por identificador o por nombre', () => {
    const { raiz } = montar();
    const texto = raiz.textContent ?? '';

    expect(texto).toContain('Personal · Servicios · Planeación');
    expect(texto).toContain('Por identificador');
    expect(texto).toContain('Por nombre');
    expect(texto).toContain('renombrar un motivo no cambia las incidencias ya registradas');
  });

  /** La geografía sale de la vista principal: son doce mil filas que nadie configura. */
  it('deja la geografía plegada y fuera de la lista principal', () => {
    const { raiz } = montar();

    const plegado = Array.from(raiz.querySelectorAll('details')).find(
      (elemento) => elemento.querySelector('summary')?.textContent?.includes('Geografía'),
    );

    expect(plegado).toBeTruthy();
    expect(plegado?.open).toBe(false);
  });

  /**
   * El nombre se compara con la misma regla que el servidor. Antes comparaba sólo en minúsculas, y
   * un acento distinto pasaba aquí para que el servidor lo rechazara con un 409 sin explicación.
   */
  it('detecta el nombre repetido aunque cambien acentos, mayúsculas y espacios', () => {
    const { fixture, componente } = montar({ items: [valor({ name: 'Vigilancia Interná' })] });
    const pagina = fixture.componentInstance as unknown as {
      openCatalogType: { set(v: string): void };
      catalogForm: { patchValue(v: object): void };
      catalogNameExists(): boolean;
    };

    pagina.openCatalogType.set('Skill');
    pagina.catalogForm.patchValue({ name: '  vigilancia   interna  ' });
    fixture.detectChanges();

    expect(pagina.catalogNameExists()).toBe(true);
    expect(componente).toBeTruthy();
  });

  /** Un valor inactivo sigue ocupando su nombre: aquí los registros no se borran. */
  it('cuenta como repetido un valor desactivado', () => {
    const { fixture } = montar({ items: [valor({ name: 'Escolta', active: false })] });
    const pagina = fixture.componentInstance as unknown as {
      openCatalogType: { set(v: string): void };
      catalogForm: { patchValue(v: object): void };
      catalogNameExists(): boolean;
    };

    pagina.openCatalogType.set('Skill');
    pagina.catalogForm.patchValue({ name: 'Escolta' });
    fixture.detectChanges();

    expect(pagina.catalogNameExists()).toBe(true);
  });

  /**
   * El uso por valor sólo se afirma donde se puede comprobar por identificador. La pantalla
   * anterior lo adivinaba comparando el nombre con textos de otros módulos.
   */
  it('cuenta el uso de una habilidad por identificador, no por nombre', () => {
    const { fixture } = montar({
      items: [valor({ idCatalogItem: 'hab-1', name: 'Manejo de arma corta' })],
      requirements: [regla({ idRequiredCatalogItem: 'hab-1' }), regla({ idEligibilityRequirement: 'r2', idRequiredCatalogItem: 'otra' })],
    });
    const pagina = fixture.componentInstance as unknown as { itemUsage(item: CatalogItem): string };

    expect(pagina.itemUsage(valor({ idCatalogItem: 'hab-1' }))).toBe('1 regla la exige');
    expect(pagina.itemUsage(valor({ idCatalogItem: 'hab-9' }))).toBe('Ninguna regla la exige');
  });

  /**
   * La trampa: una regla de habilidad bloqueante no se puede cumplir porque no hay pantalla para
   * otorgar habilidades. La pantalla lo dice donde se crean las reglas, no en un documento.
   */
  it('avisa de las reglas de habilidad bloqueantes que hoy nadie puede cumplir', () => {
    const { raiz } = montar({ requirements: [regla({ isBlocking: true, requirementType: 'Skill' })] });

    expect(raiz.textContent).toContain('todavía no existe pantalla');
    expect(raiz.textContent).toContain('detiene la publicación de la planeación');
  });

  it('no avisa cuando la regla de habilidad es sólo informativa', () => {
    const { raiz } = montar({ requirements: [regla({ isBlocking: false })] });

    expect(raiz.textContent).not.toContain('todavía no existe pantalla');
  });

  /**
   * Sin reglas activas, «elegible» significaría que no se comprobó nada. La ausencia de reglas no
   * se presenta como cumplimiento.
   */
  it('no concluye elegibilidad cuando no hay reglas activas', () => {
    const { fixture } = montar({ requirements: [] });
    const pagina = fixture.componentInstance as unknown as {
      eligibilityState(r: unknown): string;
      eligibilityLabel(r: unknown): string;
    };
    const resultado = { idEmployee: 'e1', employeeCode: 'E1', employeeName: 'Ana', isEligible: true, reasons: [] };

    expect(pagina.eligibilityState(resultado)).toBe('insufficient');
    expect(pagina.eligibilityLabel(resultado)).toBe('Sin reglas suficientes');
  });

  /**
   * El defecto que dejó la pantalla anterior sin poder guardar nada.
   *
   * <p>Al retirar el campo de código de la plantilla quedó su control de formulario, con
   * `Validators.required` sobre un valor vacío que ya nadie llenaba. El formulario quedaba
   * <b>inválido para siempre</b> y `saveCatalogItem` salía por la primera guarda sin decir nada:
   * desde fuera parecía que el botón no respondía. Esta prueba fija lo mínimo —un nombre— y
   * comprueba que con eso basta, para que un control huérfano vuelva a romper aquí y no en el uso.</p>
   */
  it('con sólo el nombre, el formulario ya es válido y se puede guardar', () => {
    const { fixture } = montar();
    const pagina = fixture.componentInstance as unknown as {
      openCatalogType: { set(v: string): void };
      catalogForm: { patchValue(v: object): void; valid: boolean; controls: Record<string, unknown> };
    };

    pagina.openCatalogType.set('JobPosition');
    pagina.catalogForm.patchValue({ name: 'Guardia de acceso' });
    fixture.detectChanges();

    expect(pagina.catalogForm.valid).toBe(true);

    // Y ningún control obligatorio que la plantilla no dibuje: ésa fue exactamente la trampa.
    const dibujados = ['name', 'status', 'order', 'description', 'idParentCatalogItem'];
    expect(Object.keys(pagina.catalogForm.controls).sort()).toEqual([...dibujados].sort());
  });

  it('filtra los valores del catálogo abierto por estado y por texto', () => {
    const { fixture } = montar({
      items: [
        valor({ idCatalogItem: 'a', name: 'Escolta', order: 2 }),
        valor({ idCatalogItem: 'b', name: 'Vigilancia', order: 1 }),
        valor({ idCatalogItem: 'c', name: 'Retirada', order: 3, active: false }),
      ],
    });
    const pagina = fixture.componentInstance as unknown as {
      openCatalogType: { set(v: string): void };
      valueState: { set(v: string): void };
      valueSearch: { set(v: string): void };
      openCatalogItems(): readonly CatalogItem[];
    };

    pagina.openCatalogType.set('Skill');
    expect(pagina.openCatalogItems().map((item) => item.name)).toEqual(['Vigilancia', 'Escolta', 'Retirada']);

    pagina.valueState.set('inactive');
    expect(pagina.openCatalogItems().map((item) => item.name)).toEqual(['Retirada']);

    pagina.valueState.set('');
    pagina.valueSearch.set('vigiláncia');
    expect(pagina.openCatalogItems().map((item) => item.name)).toEqual(['Vigilancia']);
  });

  /**
   * Abrir un catálogo no puede mover la pantalla.
   *
   * <p>Sólo uno queda abierto a la vez, así que al pulsar otro el anterior se cierra y la lista
   * cambia de alto por encima del que se pulsó. El navegador conserva el desplazamiento en
   * píxeles, no el contenido, y la tarjeta se iba del punto donde estaba el cursor: se abría un
   * catálogo y había que ir a buscarlo.</p>
   *
   * <p>La prueba simula el encogimiento moviendo la cabecera entre la pulsación y el pintado, y
   * exige que la corrección sea exactamente la diferencia.</p>
   */
  it('abrir un catálogo deja la cabecera pulsada en el mismo punto de la pantalla', async () => {
    const { fixture, componente } = montar();
    const pagina = componente as unknown as { toggleCatalog(type: string, event?: Event): void };
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);

    // La cabecera estaba a 420 px del borde superior y, al cerrarse el catálogo de arriba, el
    // acordeón la sube a 160 px.
    let top = 420;
    const cabecera = document.createElement('button');
    cabecera.getBoundingClientRect = () => ({ top }) as DOMRect;

    pagina.toggleCatalog('JobPosition', { currentTarget: cabecera } as unknown as Event);
    top = 160;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scrollBy, 'se corrige el desplazamiento por lo que se movió la cabecera')
      .toHaveBeenCalledWith({ top: -260, behavior: 'instant' });
  });

  /** Y si nada se movió, no se toca el desplazamiento: corregir cero es un salto gratis. */
  it('no toca el desplazamiento cuando la cabecera no se movió', async () => {
    const { fixture, componente } = montar();
    const pagina = componente as unknown as { toggleCatalog(type: string, event?: Event): void };
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);

    const cabecera = document.createElement('button');
    cabecera.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;

    pagina.toggleCatalog('JobPosition', { currentTarget: cabecera } as unknown as Event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scrollBy).not.toHaveBeenCalled();
  });
});
