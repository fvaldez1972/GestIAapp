import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BusinessCatalogItemType,
  CatalogItem,
  CatalogItemInput,
  CatalogDefinition,
  EligibilityCheck,
  EligibilityRequirement,
  EligibilityRequirementInput,
  EmployeeSkill,
  EmployeeSkillInput,
} from './catalog.models';

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/catalogs';

  listDefinitions() {
    return this.http.get<readonly CatalogDefinition[]>(`${this.baseUrl}/definitions`);
  }

  listOptions(organizationId: string) {
    return this.http.get<readonly CatalogItem[]>(`${this.baseUrl}/options`, { params: { organizationId } });
  }

  listItems(organizationId: string, type?: BusinessCatalogItemType | '', includeInactive = false) {
    let params = new HttpParams().set('organizationId', organizationId);

    if (type) {
      params = params.set('type', type);
    }
    if (includeInactive) params = params.set('includeInactive', true);

    return this.http.get<readonly CatalogItem[]>(`${this.baseUrl}/items`, { params });
  }

  createItem(request: CatalogItemInput) {
    return this.http.post<CatalogItem>(`${this.baseUrl}/items`, request);
  }

  updateItem(idCatalogItem: string, request: CatalogItemInput) {
    return this.http.put<CatalogItem>(`${this.baseUrl}/items/${idCatalogItem}`, request);
  }

  deactivateItem(organizationId: string, idCatalogItem: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/items/${idCatalogItem}`, { params });
  }

  listEligibilityRequirements(organizationId: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly EligibilityRequirement[]>(`${this.baseUrl}/eligibility-requirements`, { params });
  }

  createEligibilityRequirement(request: EligibilityRequirementInput) {
    return this.http.post<EligibilityRequirement>(`${this.baseUrl}/eligibility-requirements`, request);
  }

  updateEligibilityRequirement(idEligibilityRequirement: string, request: EligibilityRequirementInput) {
    return this.http.put<EligibilityRequirement>(
      `${this.baseUrl}/eligibility-requirements/${idEligibilityRequirement}`,
      request,
    );
  }

  deactivateEligibilityRequirement(organizationId: string, idEligibilityRequirement: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/eligibility-requirements/${idEligibilityRequirement}`, { params });
  }

  listEmployeeSkills(organizationId: string, idEmployee: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly EmployeeSkill[]>(`${this.baseUrl}/employees/${idEmployee}/skills`, { params });
  }

  createEmployeeSkill(idEmployee: string, request: EmployeeSkillInput) {
    return this.http.post<EmployeeSkill>(`${this.baseUrl}/employees/${idEmployee}/skills`, request);
  }

  updateEmployeeSkill(idEmployee: string, idEmployeeSkill: string, request: EmployeeSkillInput) {
    return this.http.put<EmployeeSkill>(`${this.baseUrl}/employees/${idEmployee}/skills/${idEmployeeSkill}`, request);
  }

  deactivateEmployeeSkill(organizationId: string, idEmployee: string, idEmployeeSkill: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/employees/${idEmployee}/skills/${idEmployeeSkill}`, { params });
  }

  checkEligibility(
    organizationId: string,
    employeeId: string,
    referenceDate: string,
    clientId?: string,
    serviceId?: string,
    positionId?: string,
  ) {
    let params = new HttpParams()
      .set('organizationId', organizationId)
      .set('employeeId', employeeId)
      .set('referenceDate', referenceDate);

    if (clientId) {
      params = params.set('clientId', clientId);
    }

    if (serviceId) {
      params = params.set('serviceId', serviceId);
    }

    if (positionId) {
      params = params.set('positionId', positionId);
    }

    return this.http.get<EligibilityCheck>(`${this.baseUrl}/eligibility/check`, { params });
  }

  /**
   * La misma comprobación para varias personas y un solo contexto.
   *
   * <p>Va por POST aunque no escriba nada: la lista de personas viaja en el cuerpo. En la dirección
   * serían tantos identificadores como candidatos, y ahí se choca con el límite de longitud de la
   * URL justo cuando la lista es larga, que es cuando este endpoint sirve para algo.</p>
   */
  checkEligibilityBatch(request: {
    readonly organizationId: string;
    readonly employeeIds: readonly string[];
    readonly clientId?: string | null;
    readonly serviceId?: string | null;
    readonly positionId?: string | null;
    readonly referenceDate?: string | null;
  }) {
    return this.http.post<readonly EligibilityCheck[]>(
      `${this.baseUrl}/eligibility/check-batch`,
      {
        organizationId: request.organizationId,
        employeeIds: request.employeeIds,
        clientId: request.clientId ?? null,
        serviceId: request.serviceId ?? null,
        positionId: request.positionId ?? null,
        referenceDate: request.referenceDate ?? null,
      },
    );
  }
}
