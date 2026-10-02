import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Client } from '../../clients/data-access/client.models';

@Injectable({ providedIn: 'root' })
export class ServiceContextApi {
  private readonly http = inject(HttpClient);

  getClient(organizationId: string, clientId: string) {
    return this.http.get<Client>('/api/v1/clients/' + encodeURIComponent(clientId), {
      params: new HttpParams().set('organizationId', organizationId),
    });
  }
}
