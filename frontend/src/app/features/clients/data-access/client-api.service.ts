import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  Client,
  ClientContact,
  ClientContactInput,
  ClientInput,
  ClientSite,
  ClientSiteInput,
  CreateClient,
  CreateClientSite,
  CreateManagedService,
  CreateServiceContract,
  CreateOrganization,
  ManagedService,
  ManagedServiceInput,
  Organization,
  PagedResult,
  ServiceConfiguration,
  ServiceConfigurationInput,
  ServiceContract,
  ServiceContractInput,
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

  listSites(organizationId: string, idClient: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ClientSite[]>(`${this.baseUrl}/clients/${idClient}/sites`, { params });
  }

  createSite(idClient: string, request: CreateClientSite) {
    return this.http.post<ClientSite>(`${this.baseUrl}/clients/${idClient}/sites`, request);
  }

  updateSite(idClient: string, idClientSite: string, request: ClientSiteInput) {
    return this.http.put<ClientSite>(`${this.baseUrl}/clients/${idClient}/sites/${idClientSite}`, request);
  }

  deactivateSite(organizationId: string, idClient: string, idClientSite: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/clients/${idClient}/sites/${idClientSite}`, { params });
  }

  listContacts(organizationId: string, idClient: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ClientContact[]>(`${this.baseUrl}/clients/${idClient}/contacts`, { params });
  }

  createContact(idClient: string, request: ClientContactInput) {
    return this.http.post<ClientContact>(`${this.baseUrl}/clients/${idClient}/contacts`, request);
  }

  updateContact(idClient: string, idClientContact: string, request: ClientContactInput) {
    return this.http.put<ClientContact>(`${this.baseUrl}/clients/${idClient}/contacts/${idClientContact}`, request);
  }

  deactivateContact(organizationId: string, idClient: string, idClientContact: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/clients/${idClient}/contacts/${idClientContact}`, { params });
  }

  listContracts(organizationId: string, idClient: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ServiceContract[]>(`${this.baseUrl}/clients/${idClient}/contracts`, { params });
  }

  createContract(idClient: string, request: CreateServiceContract) {
    return this.http.post<ServiceContract>(`${this.baseUrl}/clients/${idClient}/contracts`, request);
  }

  updateContract(idClient: string, idServiceContract: string, request: ServiceContractInput) {
    return this.http.put<ServiceContract>(`${this.baseUrl}/clients/${idClient}/contracts/${idServiceContract}`, request);
  }

  deactivateContract(organizationId: string, idClient: string, idServiceContract: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/clients/${idClient}/contracts/${idServiceContract}`, { params });
  }

  listServices(organizationId: string, idClient: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ManagedService[]>(`${this.baseUrl}/clients/${idClient}/services`, { params });
  }

  createService(idClient: string, request: CreateManagedService) {
    return this.http.post<ManagedService>(`${this.baseUrl}/clients/${idClient}/services`, request);
  }

  updateService(idClient: string, idService: string, request: ManagedServiceInput) {
    return this.http.put<ManagedService>(`${this.baseUrl}/clients/${idClient}/services/${idService}`, request);
  }

  deactivateService(organizationId: string, idClient: string, idService: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(`${this.baseUrl}/clients/${idClient}/services/${idService}`, { params });
  }

  listServiceConfigurations(organizationId: string, idClient: string, idService: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ServiceConfiguration[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/configurations`,
      { params },
    );
  }

  createServiceConfiguration(idClient: string, idService: string, request: ServiceConfigurationInput) {
    return this.http.post<ServiceConfiguration>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/configurations`,
      request,
    );
  }

  updateServiceConfiguration(
    idClient: string,
    idService: string,
    idServiceConfiguration: string,
    request: ServiceConfigurationInput,
  ) {
    return this.http.put<ServiceConfiguration>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/configurations/${idServiceConfiguration}`,
      request,
    );
  }

  deactivateServiceConfiguration(
    organizationId: string,
    idClient: string,
    idService: string,
    idServiceConfiguration: string,
  ) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/configurations/${idServiceConfiguration}`,
      { params },
    );
  }
}
