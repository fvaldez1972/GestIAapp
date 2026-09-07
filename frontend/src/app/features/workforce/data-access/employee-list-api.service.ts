import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  EmployeeAssignment,
  EmployeeDocumentFilter,
  EmployeeFilterOptions,
  EmployeeSearchResult,
  EmployeeStatus,
} from './employee-list.models';

/**
 * El acceso que usa la pantalla de Personal.
 *
 * <p>Va aparte del servicio de personal que ya existía porque aquel sirve a otras pantallas como
 * fuente de opciones y su forma no debe cambiar por una tabla.</p>
 */
@Injectable({ providedIn: 'root' })
export class EmployeeListApiService {
  private readonly http = inject(HttpClient);

  /**
   * El listado con el resumen documental resuelto.
   *
   * <p>Los filtros viajan al servidor: uno que sólo mirara la página en pantalla mentiría en
   * cuanto hubiera una segunda.</p>
   */
  searchEmployees(options: {
    organizationId: string;
    search?: string;
    status?: EmployeeStatus | '';
    idJobPositionCatalogItem?: string;
    documents?: EmployeeDocumentFilter;
    municipality?: string;
    page?: number;
    pageSize?: number;
  }) {
    let params = new HttpParams()
      .set('organizationId', options.organizationId)
      .set('page', String(options.page ?? 1))
      .set('pageSize', String(options.pageSize ?? 25));

    if (options.search?.trim()) {
      params = params.set('search', options.search.trim());
    }

    if (options.status) {
      params = params.set('status', options.status);
    }

    if (options.idJobPositionCatalogItem) {
      params = params.set('idJobPositionCatalogItem', options.idJobPositionCatalogItem);
    }

    if (options.documents && options.documents !== 'Any') {
      params = params.set('documents', options.documents);
    }

    if (options.municipality) {
      params = params.set('municipality', options.municipality);
    }

    return this.http.get<EmployeeSearchResult>('/api/v1/employees/search', { params });
  }

  /** Las opciones reales de los filtros, de toda la organización y no sólo de la página. */
  listFilterOptions(organizationId: string) {
    return this.http.get<EmployeeFilterOptions>('/api/v1/employees/filters', {
      params: new HttpParams().set('organizationId', organizationId),
    });
  }

  /** Las asignaciones de una persona, con el turno en curso marcado. */
  listAssignments(organizationId: string, idEmployee: string) {
    return this.http.get<readonly EmployeeAssignment[]>(
      `/api/v1/employees/${idEmployee}/assignments`,
      { params: new HttpParams().set('organizationId', organizationId) },
    );
  }
}
