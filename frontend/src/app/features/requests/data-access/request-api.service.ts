import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ChangeOperationalRequestStatus,
  CreateOperationalRequest,
  ExecuteOperationalRequest,
  ExecuteOperationalRequestResult,
  OperationalRequest,
  OperationalRequestInput,
  OperationalRequestStatus,
  OperationalRequestType,
  PagedResult,
} from './request.models';

@Injectable({ providedIn: 'root' })
export class RequestApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/requests';

  listRequests(
    organizationId: string,
    status: OperationalRequestStatus | '' = '',
    requestType: OperationalRequestType | '' = '',
    search = '',
    page = 1,
    pageSize = 20,
  ) {
    let params = new HttpParams()
      .set('organizationId', organizationId)
      .set('page', page)
      .set('pageSize', pageSize);

    if (status) {
      params = params.set('status', status);
    }

    if (requestType) {
      params = params.set('requestType', requestType);
    }

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<PagedResult<OperationalRequest>>(this.baseUrl, { params });
  }

  createRequest(request: CreateOperationalRequest) {
    return this.http.post<OperationalRequest>(this.baseUrl, request);
  }

  updateRequest(idOperationalRequest: string, request: OperationalRequestInput) {
    return this.http.put<OperationalRequest>(`${this.baseUrl}/${idOperationalRequest}`, request);
  }

  changeStatus(idOperationalRequest: string, request: ChangeOperationalRequestStatus) {
    return this.http.patch<OperationalRequest>(`${this.baseUrl}/${idOperationalRequest}/status`, request);
  }

  executeRequest(idOperationalRequest: string, request: ExecuteOperationalRequest) {
    return this.http.post<ExecuteOperationalRequestResult>(`${this.baseUrl}/${idOperationalRequest}/execute`, request);
  }
}
