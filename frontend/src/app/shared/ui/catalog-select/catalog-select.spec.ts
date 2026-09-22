import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { CatalogSelect } from './catalog-select';
import { CatalogApiService } from '../../../features/catalogs/data-access/catalog-api.service';
import { GeoPlace, GeographyApiService } from '../../../features/catalogs/data-access/geography-api.service';
import { CatalogItem } from '../../../features/catalogs/data-access/catalog.models';

const values: CatalogItem[] = [
  { idCatalogItem: 'puesto', idOrganization: 'org', type: 'JobPosition', name: 'Guardia', active: true, description: null },
  { idCatalogItem: 'otro', idOrganization: 'org', type: 'JobPosition', name: 'Supervisor', active: true, description: null },
  { idCatalogItem: 'inactivo', idOrganization: 'org', type: 'JobPosition', name: 'Inactivo', active: false, description: null },
  { idCatalogItem: 'ajeno', idOrganization: 'org', type: 'CoverageReason', name: 'Falta', active: true, description: null },
];

const paises: GeoPlace[] = [{ code: 'MX', name: 'México' }];
const estados: GeoPlace[] = [{ code: '19', name: 'Nuevo León' }];
const municipios: GeoPlace[] = [{ code: '19039', name: 'Monterrey' }];

describe('CatalogSelect', () => {
  let component: CatalogSelect;
  let api: { listOptions: ReturnType<typeof vi.fn> };
  let geografia: {
    listCountries: ReturnType<typeof vi.fn>;
    listStates: ReturnType<typeof vi.fn>;
    listMunicipalities: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = { listOptions: vi.fn(() => of(values)) };
    geografia = {
      listCountries: vi.fn(() => of(paises)),
      listStates: vi.fn(() => of(estados)),
      listMunicipalities: vi.fn(() => of(municipios)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogApiService, useValue: api },
        { provide: GeographyApiService, useValue: geografia },
      ],
    });
    component = TestBed.runInInjectionContext(() => new CatalogSelect());
    component.organizationId = 'org';
  });

  it('shows only the active values of its own type', () => {
    component.type = 'JobPosition';
    component.ngOnChanges();
    expect(component.options().map(option => option.label)).toEqual(['Guardia', 'Supervisor']);
  });

  it('preserves the previous value but never includes it as an available option', () => {
    const change = vi.fn();
    component.registerOnChange(change);
    component.type = 'JobPosition';
    component.writeValue('Inactivo');
    component.ngOnChanges();
    expect(component.value()).toBe('Inactivo');
    expect(component.hasCurrent()).toBe(false);
    expect(change).not.toHaveBeenCalled();
  });

  it('cancels requests when the organization changes', () => {
    const old = new Subject<readonly CatalogItem[]>();
    api.listOptions.mockReturnValueOnce(old);
    component.type = 'JobPosition';
    component.ngOnChanges();
    component.organizationId = 'other';
    component.ngOnChanges();
    old.next([]);
    expect(component.values()).toEqual(values);
    expect(old.observed).toBe(false);
  });

  it('emits the catalog identity when a form stores a reference', () => {
    const change = vi.fn();
    component.registerOnChange(change);
    component.type = 'JobPosition';
    component.useId = true;
    component.ngOnChanges();
    expect(component.options()[0].value).toBe('puesto');
    component.select('puesto');
    expect(change).toHaveBeenCalledWith('puesto');
    expect(component.hasCurrent()).toBe(true);
  });

  /**
   * La geografía no sale del catálogo de la organización, así que no se le pide.
   *
   * <p>El control es la otra mitad de la prueba: un tipo que no es geografía tiene que seguir
   * pidiendo el catálogo y no la geografía. Sin él, «pide la geografía» podría significar que la
   * pide para todo.</p>
   */
  it('asks the shared geography and never the organization catalog', () => {
    component.type = 'State';
    component.country = 'MX';
    component.ngOnChanges();
    expect(geografia.listStates).toHaveBeenCalledWith('MX');
    expect(api.listOptions).not.toHaveBeenCalled();

    component.type = 'JobPosition';
    component.ngOnChanges();
    expect(api.listOptions).toHaveBeenCalledWith('org');
  });

  /**
   * El país se guarda por clave, no por nombre.
   *
   * <p>La columna CountryCode es de dos caracteres. Mientras la geografía vivía en el catálogo,
   * este desplegable ofrecía el nombre —«México»— como valor a guardar, y el guardado fallaba en
   * el servidor al no caber. Lo que se ve sigue siendo el nombre.</p>
   */
  it('stores the country by its two-letter code and the rest by name', () => {
    component.type = 'Country';
    component.ngOnChanges();
    expect(component.options()).toEqual([{ value: 'MX', label: 'México' }]);

    component.type = 'State';
    component.country = 'MX';
    component.ngOnChanges();
    expect(component.options()).toEqual([{ value: 'Nuevo León', label: 'Nuevo León' }]);
  });

  /**
   * Cambiar de país vuelve a pedir los estados.
   *
   * <p>Antes la cascada se resolvía en el navegador sobre un paquete que ya estaba cargado, así
   * que bastaba con recalcular. Ahora la resuelve el servidor, y si el componente no volviera a
   * pedir, el desplegable seguiría mostrando los estados del país anterior.</p>
   */
  it('asks again when the place above it changes', () => {
    component.type = 'City';
    component.country = 'MX';
    component.state = 'Nuevo León';
    component.ngOnChanges();
    expect(geografia.listMunicipalities).toHaveBeenCalledWith('MX', 'Nuevo León');

    geografia.listMunicipalities.mockReturnValue(of([{ code: '31050', name: 'Mérida' }]));
    component.state = 'Yucatán';
    component.ngOnChanges();
    expect(geografia.listMunicipalities).toHaveBeenLastCalledWith('MX', 'Yucatán');
    expect(component.options().map(option => option.label)).toEqual(['Mérida']);
  });

  /** Sin el lugar de arriba no hay nada que pedir: la lista se queda vacía en vez de pedir todo. */
  it('does not ask for municipalities before a state is chosen', () => {
    component.type = 'City';
    component.country = 'MX';
    component.state = '';
    component.ngOnChanges();
    expect(geografia.listMunicipalities).not.toHaveBeenCalled();
    expect(component.options()).toEqual([]);
  });
});
