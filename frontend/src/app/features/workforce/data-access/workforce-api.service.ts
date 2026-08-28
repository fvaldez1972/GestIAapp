import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateEmployee,
  Employee,
  EmployeeDetail,
  EmployeeDocument,
  EmployeeDocumentInput,
  EmployeeEvaluation,
  EmployeeEvaluationInput,
  EmployeeInput,
  EmployeeStatus,
  PagedResult,
} from './workforce.models';

@Injectable({ providedIn: 'root' })
export class WorkforceApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/employees';

  listEmployees(organizationId: string, search = '', status: EmployeeStatus | '' = '', page = 1, pageSize = 20) {
    let params = new HttpParams()
      .set('organizationId', organizationId)
      .set('page', page)
      .set('pageSize', pageSize);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PagedResult<Employee>>(this.baseUrl, { params });
  }

  getEmployee(organizationId: string, idEmployee: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<EmployeeDetail>(`${this.baseUrl}/${idEmployee}`, { params });
  }

  createEmployee(request: CreateEmployee) {
    return this.http.post<Employee>(this.baseUrl, request);
  }

  updateEmployee(idEmployee: string, request: EmployeeInput) {
    return this.http.put<Employee>(`${this.baseUrl}/${idEmployee}`, request);
  }

  changeStatus(idEmployee: string, organizationId: string, status: EmployeeStatus) {
    return this.http.patch<Employee>(`${this.baseUrl}/${idEmployee}/status`, { idOrganization: organizationId, status });
  }

  deactivateEmployee(organizationId: string, idEmployee: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/${idEmployee}`, { params });
  }

  createDocument(idEmployee: string, request: EmployeeDocumentInput) {
    return this.http.post<EmployeeDocument>(`${this.baseUrl}/${idEmployee}/documents`, request);
  }

  updateDocument(idEmployee: string, idEmployeeDocument: string, request: EmployeeDocumentInput) {
    return this.http.put<EmployeeDocument>(`${this.baseUrl}/${idEmployee}/documents/${idEmployeeDocument}`, request);
  }

  deactivateDocument(organizationId: string, idEmployee: string, idEmployeeDocument: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/${idEmployee}/documents/${idEmployeeDocument}`, { params });
  }

  createEvaluation(idEmployee: string, request: EmployeeEvaluationInput) {
    return this.http.post<EmployeeEvaluation>(`${this.baseUrl}/${idEmployee}/evaluations`, request);
  }

  updateEvaluation(idEmployee: string, idEmployeeEvaluation: string, request: EmployeeEvaluationInput) {
    return this.http.put<EmployeeEvaluation>(
      `${this.baseUrl}/${idEmployee}/evaluations/${idEmployeeEvaluation}`,
      request,
    );
  }

  deactivateEvaluation(organizationId: string, idEmployee: string, idEmployeeEvaluation: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/${idEmployee}/evaluations/${idEmployeeEvaluation}`, { params });
  }
}
