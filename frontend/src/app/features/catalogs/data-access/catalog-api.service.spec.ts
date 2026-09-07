import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CatalogApiService } from './catalog-api.service';

describe('CatalogApiService', () => {
  let api: CatalogApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(CatalogApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the catalog inventory from the backend', () => {
    api.listDefinitions().subscribe(values => expect(values).toEqual([]));
    http.expectOne('/api/v1/catalogs/definitions').flush([]);
  });

  it('keeps operational dropdowns active-only and requests inactive values only for management', () => {
    api.listItems('org', 'Skill').subscribe();
    const active = http.expectOne(request => request.url.endsWith('/items'));
    expect(active.request.params.get('includeInactive')).toBeNull();
    expect(active.request.params.get('organizationId')).toBe('org');
    active.flush([]);
    api.listItems('org', 'Skill', true).subscribe();
    const all = http.expectOne(request => request.url.endsWith('/items'));
    expect(all.request.params.get('includeInactive')).toBe('true');
    expect(all.request.params.get('type')).toBe('Skill');
    all.flush([]);
  });

  it('sends metadata and reactivation without dropping fields', () => {
    const input = { idOrganization: 'org', type: 'Zone' as const, code: 'N', name: 'Norte', description: null,
      group: 'Operativo', order: 8, synonyms: ['Norte industrial'], active: true };
    api.updateItem('value', input).subscribe();
    const update = http.expectOne('/api/v1/catalogs/items/value');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(input);
    update.flush({ ...input, idCatalogItem: 'value' });
  });
});
