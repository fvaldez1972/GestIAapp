import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { CatalogSelect } from './catalog-select';
import { CatalogApiService } from '../../../features/catalogs/data-access/catalog-api.service';
import { CatalogItem } from '../../../features/catalogs/data-access/catalog.models';

const values: CatalogItem[] = [
  { idCatalogItem: 'country', idOrganization: 'org', type: 'Country', code: 'MX', name: 'Mexico', active: true, description: null },
  { idCatalogItem: 'state', idOrganization: 'org', type: 'State', code: 'NL', name: 'Nuevo Leon', active: true, description: null, idParentCatalogItem: 'country' },
  { idCatalogItem: 'city', idOrganization: 'org', type: 'City', code: 'MTY', name: 'Monterrey', active: true, description: null, idParentCatalogItem: 'state' },
  { idCatalogItem: 'inactive', idOrganization: 'org', type: 'City', code: 'OLD', name: 'Inactivo', active: false, description: null, idParentCatalogItem: 'state' },
];
describe('CatalogSelect', () => {
  let component: CatalogSelect;
  let api: { listOptions: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    api = { listOptions: vi.fn(() => of(values)) };
    TestBed.configureTestingModule({ providers: [{ provide: CatalogApiService, useValue: api }] });
    component = TestBed.runInInjectionContext(() => new CatalogSelect());
    component.organizationId = 'org';
  });
  it('filters a city by active status, country and state', () => {
    component.type = 'City'; component.country = 'MX'; component.state = 'Nuevo Leon'; component.ngOnChanges();
    expect(component.options().map(item => item.name)).toEqual(['Monterrey']);
    component.country = 'US'; component.ngOnChanges();
    expect(component.options()).toEqual([]);
  });
  it('preserves the previous value but never includes it as an available option', () => {
    const change = vi.fn(); component.registerOnChange(change);
    component.type = 'City'; component.writeValue('Inactivo'); component.ngOnChanges();
    expect(component.value()).toBe('Inactivo'); expect(component.hasCurrent()).toBe(false);
    expect(change).not.toHaveBeenCalled();
  });
  it('cancels requests when the organization changes', () => {
    const old = new Subject<readonly CatalogItem[]>();
    api.listOptions.mockReturnValueOnce(old);
    component.ngOnChanges(); component.organizationId = 'other'; component.ngOnChanges();
    old.next([]);
    expect(component.values()).toEqual(values);
    expect(old.observed).toBe(false);
  });
  it('emits the catalog identity when a form stores a reference', () => {
    const change = vi.fn(); component.registerOnChange(change);
    component.type = 'Country'; component.useId = true; component.ngOnChanges();
    expect(component.optionValue(values[0])).toBe('country');
    component.select(component.optionValue(values[0]));
    expect(change).toHaveBeenCalledWith('country');
    expect(component.hasCurrent()).toBe(true);
  });
  it('excludes cities whose country is inactive even if their state is active', () => {
    api.listOptions.mockReturnValue(of(values.map(item => item.type === 'Country' ? { ...item, active: false } : item)));
    component.type = 'City'; component.country = 'MX'; component.state = 'Nuevo Leon'; component.ngOnChanges();
    expect(component.options()).toEqual([]);
  });
});
