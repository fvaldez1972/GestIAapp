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

  it('scopes evidence uploads to the organization', () => {
    service.uploadOperationEvidenceFile(new File(['proof'], 'proof.txt'), 'organization-1').subscribe();
    const request = http.expectOne('/api/v1/files/operation-evidence?organizationId=organization-1');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.get('file').name).toBe('proof.txt');
    request.flush({});
  });

  it('downloads evidence by its authorized record rather than a storage path', () => {
    service.downloadOperationEvidenceFile('organization-1', 'client-1', 'service-1', 'evidence-1').subscribe();
    const request = http.expectOne(candidate => candidate.url === '/api/v1/files/operation-evidence/download');
    expect(request.request.params.get('organizationId')).toBe('organization-1');
    expect(request.request.params.get('clientId')).toBe('client-1');
    expect(request.request.params.get('serviceId')).toBe('service-1');
    expect(request.request.params.get('evidenceId')).toBe('evidence-1');
    expect(request.request.params.has('storageReference')).toBe(false);
    request.flush(new Blob());
  });

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
