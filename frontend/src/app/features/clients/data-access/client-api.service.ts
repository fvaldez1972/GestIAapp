import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AttendanceRecord,
  CoverageInput,
  CoverageRecord,
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
  CreateServicePosition,
  CreateServiceAssignment,
  CreateShiftPattern,
  GenerateScheduledShiftsRequest,
  GenerateScheduledShiftsResponse,
  Incident,
  IncidentInput,
  ManagedService,
  ManagedServiceInput,
  OperationsSummary,
  OperationsServiceSummary,
  OperationEvidence,
  OperationEvidenceInput,
  Organization,
  PagedResult,
  ServiceAssignment,
  ServiceAssignmentInput,
  ScheduledShift,
  ScheduledShiftInput,
  ScheduleVersion,
  ScheduleVersionInput,
  ServiceConfiguration,
  ServiceConfigurationInput,
  ServiceContract,
  ServiceContractInput,
  ServicePosition,
  ServicePositionInput,
  ShiftPattern,
  ShiftPatternInput,
  ShiftSegment,
  ShiftSegmentInput,
  UpsertAttendanceRecord,
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

  listPositions(organizationId: string, idClient: string, idService: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ServicePosition[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions`,
      { params },
    );
  }

  createPosition(idClient: string, idService: string, request: CreateServicePosition) {
    return this.http.post<ServicePosition>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions`,
      request,
    );
  }

  updatePosition(idClient: string, idService: string, idPosition: string, request: ServicePositionInput) {
    return this.http.put<ServicePosition>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}`,
      request,
    );
  }

  deactivatePosition(organizationId: string, idClient: string, idService: string, idPosition: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}`,
      { params },
    );
  }

  listShiftPatterns(organizationId: string, idClient: string, idService: string, idPosition: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ShiftPattern[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}/shift-patterns`,
      { params },
    );
  }

  createShiftPattern(idClient: string, idService: string, idPosition: string, request: CreateShiftPattern) {
    return this.http.post<ShiftPattern>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}/shift-patterns`,
      request,
    );
  }

  updateShiftPattern(
    idClient: string,
    idService: string,
    idPosition: string,
    idShiftPattern: string,
    request: ShiftPatternInput,
  ) {
    return this.http.put<ShiftPattern>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}/shift-patterns/${idShiftPattern}`,
      request,
    );
  }

  deactivateShiftPattern(
    organizationId: string,
    idClient: string,
    idService: string,
    idPosition: string,
    idShiftPattern: string,
  ) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}/shift-patterns/${idShiftPattern}`,
      { params },
    );
  }

  listShiftSegments(
    organizationId: string,
    idClient: string,
    idService: string,
    idPosition: string,
    idShiftPattern: string,
  ) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ShiftSegment[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}/shift-patterns/${idShiftPattern}/segments`,
      { params },
    );
  }

  createShiftSegment(
    idClient: string,
    idService: string,
    idPosition: string,
    idShiftPattern: string,
    request: ShiftSegmentInput,
  ) {
    return this.http.post<ShiftSegment>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}/shift-patterns/${idShiftPattern}/segments`,
      request,
    );
  }

  updateShiftSegment(
    idClient: string,
    idService: string,
    idPosition: string,
    idShiftPattern: string,
    idShiftSegment: string,
    request: ShiftSegmentInput,
  ) {
    return this.http.put<ShiftSegment>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}/shift-patterns/${idShiftPattern}/segments/${idShiftSegment}`,
      request,
    );
  }

  deactivateShiftSegment(
    organizationId: string,
    idClient: string,
    idService: string,
    idPosition: string,
    idShiftPattern: string,
    idShiftSegment: string,
  ) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/positions/${idPosition}/shift-patterns/${idShiftPattern}/segments/${idShiftSegment}`,
      { params },
    );
  }

  listAssignments(organizationId: string, idClient: string, idService: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ServiceAssignment[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/assignments`,
      { params },
    );
  }

  createAssignment(idClient: string, idService: string, request: CreateServiceAssignment) {
    return this.http.post<ServiceAssignment>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/assignments`,
      request,
    );
  }

  updateAssignment(
    idClient: string,
    idService: string,
    idServiceAssignment: string,
    request: ServiceAssignmentInput,
  ) {
    return this.http.put<ServiceAssignment>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/assignments/${idServiceAssignment}`,
      request,
    );
  }

  deactivateAssignment(organizationId: string, idClient: string, idService: string, idServiceAssignment: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/assignments/${idServiceAssignment}`,
      { params },
    );
  }

  listScheduleVersions(organizationId: string, idClient: string, idService: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ScheduleVersion[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions`,
      { params },
    );
  }

  createScheduleVersion(idClient: string, idService: string, request: ScheduleVersionInput) {
    return this.http.post<ScheduleVersion>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions`,
      request,
    );
  }

  updateScheduleVersion(
    idClient: string,
    idService: string,
    idScheduleVersion: string,
    request: ScheduleVersionInput,
  ) {
    return this.http.put<ScheduleVersion>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions/${idScheduleVersion}`,
      request,
    );
  }

  publishScheduleVersion(organizationId: string, idClient: string, idService: string, idScheduleVersion: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.post<ScheduleVersion>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions/${idScheduleVersion}/publish`,
      null,
      { params },
    );
  }

  generateScheduledShifts(
    idClient: string,
    idService: string,
    idScheduleVersion: string,
    request: GenerateScheduledShiftsRequest,
  ) {
    return this.http.post<GenerateScheduledShiftsResponse>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions/${idScheduleVersion}/generate-from-patterns`,
      request,
    );
  }

  listScheduledShifts(organizationId: string, idClient: string, idService: string, idScheduleVersion: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly ScheduledShift[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions/${idScheduleVersion}/shifts`,
      { params },
    );
  }

  createScheduledShift(idClient: string, idService: string, idScheduleVersion: string, request: ScheduledShiftInput) {
    return this.http.post<ScheduledShift>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions/${idScheduleVersion}/shifts`,
      request,
    );
  }

  updateScheduledShift(
    idClient: string,
    idService: string,
    idScheduleVersion: string,
    idScheduledShift: string,
    request: ScheduledShiftInput,
  ) {
    return this.http.put<ScheduledShift>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions/${idScheduleVersion}/shifts/${idScheduledShift}`,
      request,
    );
  }

  deactivateScheduledShift(
    organizationId: string,
    idClient: string,
    idService: string,
    idScheduleVersion: string,
    idScheduledShift: string,
  ) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/schedule-versions/${idScheduleVersion}/shifts/${idScheduledShift}`,
      { params },
    );
  }

  listAttendanceRecords(organizationId: string, idClient: string, idService: string, date?: string) {
    let params = new HttpParams().set('organizationId', organizationId);

    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<readonly AttendanceRecord[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/attendance`,
      { params },
    );
  }

  upsertAttendanceRecord(idClient: string, idService: string, request: UpsertAttendanceRecord) {
    return this.http.post<AttendanceRecord>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/attendance`,
      request,
    );
  }

  listIncidents(organizationId: string, idClient: string, idService: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly Incident[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/incidents`,
      { params },
    );
  }

  createIncident(idClient: string, idService: string, request: IncidentInput) {
    return this.http.post<Incident>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/incidents`,
      request,
    );
  }

  updateIncident(idClient: string, idService: string, idIncident: string, request: IncidentInput) {
    return this.http.put<Incident>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/incidents/${idIncident}`,
      request,
    );
  }

  listCoverageRecords(organizationId: string, idClient: string, idService: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.get<readonly CoverageRecord[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/coverages`,
      { params },
    );
  }

  createCoverageRecord(idClient: string, idService: string, request: CoverageInput) {
    return this.http.post<CoverageRecord>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/coverages`,
      request,
    );
  }

  updateCoverageRecord(idClient: string, idService: string, idCoverageRecord: string, request: CoverageInput) {
    return this.http.put<CoverageRecord>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/coverages/${idCoverageRecord}`,
      request,
    );
  }

  listOperationEvidences(organizationId: string, idClient: string, idService: string, relatedRecordId?: string) {
    let params = new HttpParams().set('organizationId', organizationId);

    if (relatedRecordId) {
      params = params.set('relatedRecordId', relatedRecordId);
    }

    return this.http.get<readonly OperationEvidence[]>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/evidences`,
      { params },
    );
  }

  createOperationEvidence(idClient: string, idService: string, request: OperationEvidenceInput) {
    return this.http.post<OperationEvidence>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/evidences`,
      request,
    );
  }

  updateOperationEvidence(
    idClient: string,
    idService: string,
    idOperationEvidence: string,
    request: OperationEvidenceInput,
  ) {
    return this.http.put<OperationEvidence>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/evidences/${idOperationEvidence}`,
      request,
    );
  }

  deactivateOperationEvidence(organizationId: string, idClient: string, idService: string, idOperationEvidence: string) {
    const params = new HttpParams().set('organizationId', organizationId);
    return this.http.delete<void>(
      `${this.baseUrl}/clients/${idClient}/services/${idService}/operations/evidences/${idOperationEvidence}`,
      { params },
    );
  }

  getOperationsSummary(
    organizationId: string,
    clientId?: string,
    serviceId?: string,
    fromDate?: string,
    toDate?: string,
  ) {
    let params = new HttpParams().set('organizationId', organizationId);

    if (clientId) {
      params = params.set('clientId', clientId);
    }

    if (serviceId) {
      params = params.set('serviceId', serviceId);
    }

    if (fromDate) {
      params = params.set('fromDate', fromDate);
    }

    if (toDate) {
      params = params.set('toDate', toDate);
    }

    return this.http.get<OperationsSummary>(`${this.baseUrl}/reports/operations-summary`, { params });
  }

  getOperationsByService(
    organizationId: string,
    clientId?: string,
    serviceId?: string,
    fromDate?: string,
    toDate?: string,
  ) {
    let params = new HttpParams().set('organizationId', organizationId);

    if (clientId) {
      params = params.set('clientId', clientId);
    }

    if (serviceId) {
      params = params.set('serviceId', serviceId);
    }

    if (fromDate) {
      params = params.set('fromDate', fromDate);
    }

    if (toDate) {
      params = params.set('toDate', toDate);
    }

    return this.http.get<readonly OperationsServiceSummary[]>(`${this.baseUrl}/reports/operations-by-service`, { params });
  }
}
