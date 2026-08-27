import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ClientApiService } from './client-api.service';

describe('ClientApiService', () => {
  let service: ClientApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClientApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests clients scoped to the selected organization', () => {
    service.listClients('organization-1', 'acme', 2, 20).subscribe();

    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/clients' &&
        candidate.params.get('organizationId') === 'organization-1' &&
        candidate.params.get('search') === 'acme' &&
        candidate.params.get('page') === '2',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], totalCount: 0, page: 2, pageSize: 20, totalPages: 0 });
  });
});
