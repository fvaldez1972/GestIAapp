import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  Client,
  ClientInput,
  CreateClient,
  CreateOrganization,
  Organization,
  PagedResult,
} from './client.models';

@Injectable({ providedIn: 'root' })
export class ClientApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  listOrganizations() {
    return this.http.get<readonly Organization[]>(`${this.baseUrl}/organizations`);
  }

  createOrganization(request: CreateOrganization) {
    return this.http.post<Organization>(`${this.baseUrl}/organizations`, request);
  }

  listClients(organizationId: string, search = '', page = 1, pageSize = 20) {
    let params = new HttpParams()
      .set('organizationId', organizationId)
      .set('page', page)
      .set('pageSize', pageSize);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<PagedResult<Client>>(`${this.baseUrl}/clients`, { params });
  }

  createClient(request: CreateClient) {
    return this.http.post<Client>(`${this.baseUrl}/clients`, request);
  }

  updateClient(idClient: string, request: ClientInput) {
    return this.http.put<Client>(`${this.baseUrl}/clients/${idClient}`, request);
  }

  deactivateClient(organizationId: string, idClient: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/clients/${idClient}`, { params });
  }
}
