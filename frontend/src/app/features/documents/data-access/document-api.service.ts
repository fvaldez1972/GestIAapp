import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BusinessDocument,
  BusinessDocumentInput,
  BusinessDocumentOwnerType,
  BusinessDocumentPage,
  BusinessDocumentStatus,
  FileUploadResponse,
} from './document.models';

@Injectable({ providedIn: 'root' })
export class DocumentApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/documents';

  listDocuments(
    organizationId: string,
    ownerType: BusinessDocumentOwnerType | '' = '',
    ownerId = '',
    status: BusinessDocumentStatus | '' = '',
    search = '',
    page = 1,
    pageSize = 20,
  ) {
    let params = new HttpParams()
      .set('organizationId', organizationId)
      .set('page', page)
      .set('pageSize', pageSize);

    if (ownerType) {
      params = params.set('ownerType', ownerType);
    }

    if (ownerId.trim()) {
      params = params.set('ownerId', ownerId.trim());
    }

    if (status) {
      params = params.set('status', status);
    }

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<BusinessDocumentPage>(this.baseUrl, { params });
  }

  createDocument(request: BusinessDocumentInput) {
    return this.http.post<BusinessDocument>(this.baseUrl, request);
  }

  updateDocument(idBusinessDocument: string, request: BusinessDocumentInput) {
    return this.http.put<BusinessDocument>(`${this.baseUrl}/${idBusinessDocument}`, request);
  }

  deactivateDocument(organizationId: string, idBusinessDocument: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/${idBusinessDocument}`, { params });
  }

  uploadDocumentFile(file: File) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<FileUploadResponse>(`${this.baseUrl}/upload`, formData);
  }

  downloadDocument(organizationId: string, idBusinessDocument: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get(`${this.baseUrl}/${idBusinessDocument}/download`, {
      params,
      observe: 'response',
      responseType: 'blob',
    });
  }
}
