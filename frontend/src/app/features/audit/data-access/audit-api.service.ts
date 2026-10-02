import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuditResult } from './audit.models';

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/audit/events';

  listEvents(
    organizationId: string,
    entity = '',
    search = '',
    fromDate = '',
    toDate = '',
    page = 1,
    pageSize = 30,
  ) {
    let params = new HttpParams()
      .set('organizationId', organizationId)
      .set('page', page)
      .set('pageSize', pageSize);

    if (entity) {
      params = params.set('entity', entity);
    }

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (fromDate) {
      params = params.set('fromDate', fromDate);
    }

    if (toDate) {
      params = params.set('toDate', toDate);
    }

    return this.http.get<AuditResult>(this.baseUrl, { params });
  }

  exportEvents(organizationId: string, entity = '', search = '', fromDate = '', toDate = '') {
    let params = new HttpParams().set('organizationId', organizationId);

    if (entity) {
      params = params.set('entity', entity);
    }

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (fromDate) {
      params = params.set('fromDate', fromDate);
    }

    if (toDate) {
      params = params.set('toDate', toDate);
    }

    return this.http.get(`${this.baseUrl}/export`, {
      params,
      responseType: 'blob',
    });
  }
}
