import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BusinessCatalogItemType,
  CatalogItem,
  CatalogItemInput,
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

  listItems(organizationId: string, type?: BusinessCatalogItemType | '') {
    let params = new HttpParams().set('organizationId', organizationId);

    if (type) {
      params = params.set('type', type);
    }

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
}
