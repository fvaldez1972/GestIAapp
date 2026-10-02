import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RequestApiService } from './request-api.service';

describe('RequestApiService board pagination', () => {
  let service: RequestApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RequestApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads every page within the API limit and preserves organization scope', () => {
    let count = 0;
    service.listBoardRequests('org-1').subscribe(items => count = items.length);
    for (const page of [1, 2]) {
      const request = http.expectOne(candidate => candidate.url === '/api/v1/requests' && candidate.params.get('page') === String(page));
      expect(request.request.params.get('pageSize')).toBe('100');
      expect(request.request.params.get('organizationId')).toBe('org-1');
      request.flush({ items: Array.from({ length: page === 1 ? 100 : 1 }, () => ({})), totalCount: 101, page, pageSize: 100 });
    }
    expect(count).toBe(101);
  });

  it('stops after an empty page', () => {
    service.listBoardRequests('org-1').subscribe(items => expect(items).toEqual([]));
    http.expectOne(candidate => candidate.url === '/api/v1/requests').flush({ items: [], totalCount: 0, page: 1, pageSize: 100 });
  });
});
