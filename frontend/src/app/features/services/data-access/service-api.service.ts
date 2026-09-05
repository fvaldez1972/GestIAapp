import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PagedResult } from '../../clients/data-access/client.models';
import { PositionVacancy, ServiceListItem, ServiceStatusFilter } from './service.models';

@Injectable({ providedIn: 'root' })
export class ServiceApiService {
  private readonly http = inject(HttpClient);

  /**
   * El listado de la organización, **sin pasar por el cliente**.
   *
   * <p>Es el endpoint plano de la tanda D, que estaba construido y el frontend nunca había
   * llamado. Sustituye la cascada organización → cliente → servicio, que obligaba a elegir un
   * cliente antes de ver un solo servicio.</p>
   *
   * <p>`coverageDate` decide a qué día se calculan los dos números de cobertura. Se omite a
   * propósito cuando no se sabe el día operativo: el servidor pone el suyo, que es el bueno.</p>
   */
  searchServices(options: {
    organizationId: string;
    search?: string;
    status?: ServiceStatusFilter;
    coverageDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    let params = new HttpParams()
      .set('organizationId', options.organizationId)
      .set('page', String(options.page ?? 1))
      .set('pageSize', String(options.pageSize ?? 20));

    if (options.search?.trim()) {
      params = params.set('search', options.search.trim());
    }

    if (options.status) {
      params = params.set('status', options.status);
    }

    if (options.coverageDate) {
      params = params.set('coverageDate', options.coverageDate);
    }

    return this.http.get<PagedResult<ServiceListItem>>('/api/v1/services', { params });
  }

  /** La cobertura de cada posición del servicio, al día que se pida. */
  listPositionVacancy(organizationId: string, idClient: string, idService: string, date?: string) {
    let params = new HttpParams().set('organizationId', organizationId);

    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<readonly PositionVacancy[]>(
      `/api/v1/clients/${idClient}/services/${idService}/positions/vacancy`,
      { params },
    );
  }
}
