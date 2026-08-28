import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { OperationsServiceSummary, OperationsSummary } from '../../../clients/data-access/client.models';
import { RequestApiService } from '../../../requests/data-access/request-api.service';
import { WorkforceApiService } from '../../../workforce/data-access/workforce-api.service';

@Component({
  selector: 'app-overview-page',
  imports: [RouterLink],
  templateUrl: './overview-page.html',
  styleUrl: './overview-page.scss',
})
export class OverviewPage {
  private readonly auth = inject(AuthService);
  private readonly clientApi = inject(ClientApiService);
  private readonly requestApi = inject(RequestApiService);
  private readonly workforceApi = inject(WorkforceApiService);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly clientsCount = signal(0);
  protected readonly activeEmployeesCount = signal(0);
  protected readonly activeServicesCount = signal(0);
  protected readonly openRequestsCount = signal(0);
  protected readonly riskServicesCount = signal(0);
  protected readonly operationsSummary = signal<OperationsSummary | null>(null);
  protected readonly serviceSummaries = signal<readonly OperationsServiceSummary[]>([]);

  protected readonly operationalAreas = computed(() => [
    {
      label: 'Clientes',
      value: this.clientsCount().toString(),
      detail: 'Clientes registrados en la organización activa',
    },
    {
      label: 'Servicios activos',
      value: this.activeServicesCount().toString(),
      detail: 'Servicios configurados para operación',
    },
    {
      label: 'Solicitudes abiertas',
      value: this.openRequestsCount().toString(),
      detail: 'Altas/cambios pendientes de seguimiento',
    },
    {
      label: 'Personal activo',
      value: this.activeEmployeesCount().toString(),
      detail: 'Empleados disponibles para asignación',
    },
    {
      label: 'Servicios con riesgo',
      value: this.riskServicesCount().toString(),
      detail: 'Con faltas, retardos o incidencias abiertas',
    },
    {
      label: 'Incidencias abiertas',
      value: (this.operationsSummary()?.openIncidents ?? 0).toString(),
      detail: 'Excepciones que requieren seguimiento',
    },
    {
      label: 'Asistencias capturadas',
      value: (this.operationsSummary()?.attendanceRecords ?? 0).toString(),
      detail: 'Registros reales de operación',
    },
    {
      label: 'Horas cubiertas',
      value: this.coveredHours().toString(),
      detail: 'Tiempo cubierto por sustituciones',
    },
  ]);

  protected readonly coveredHours = computed(() =>
    Math.round(((this.operationsSummary()?.coveredMinutes ?? 0) / 60) * 10) / 10);
  protected readonly highestRiskServices = computed(() =>
    [...this.serviceSummaries()]
      .filter((service) => service.openIncidents > 0 || service.absentAttendance > 0 || service.lateAttendance > 0)
      .sort((left, right) => this.riskScore(right) - this.riskScore(left))
      .slice(0, 4),
  );

  protected readonly quickActions = [
    {
      label: 'Gestionar clientes',
      route: '/clientes',
      detail: 'Sedes, contactos, contratos y servicios.',
    },
    {
      label: 'Solicitudes',
      route: '/solicitudes',
      detail: 'Altas, cambios y apoyos operativos.',
    },
    {
      label: 'Revisar personal',
      route: '/personal',
      detail: 'Expediente laboral, documentos y evaluaciones.',
    },
    {
      label: 'Planear turnos',
      route: '/planeacion',
      detail: 'Posiciones, asignaciones y generación automática.',
    },
    {
      label: 'Operación diaria',
      route: '/operacion/asistencia',
      detail: 'Asistencia, incidencias y coberturas.',
    },
    {
      label: 'Auditoría',
      route: '/auditoria',
      detail: 'Trazabilidad de altas, cambios y bajas.',
    },
  ];

  ngOnInit() {
    this.loadDashboard();
  }

  private loadDashboard() {
    const organizationId = this.auth.session()?.organizations[0]?.idOrganization;

    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    forkJoin({
      clients: this.clientApi.listClients(organizationId, '', 1, 50),
      employees: this.workforceApi.listEmployees(organizationId, '', 'Active', 1, 1),
      summary: this.clientApi.getOperationsSummary(organizationId),
      services: this.clientApi.getOperationsByService(organizationId),
      submittedRequests: this.requestApi.listRequests(organizationId, 'Submitted', '', '', 1, 1),
      reviewRequests: this.requestApi.listRequests(organizationId, 'InReview', '', '', 1, 1),
      approvedRequests: this.requestApi.listRequests(organizationId, 'Approved', '', '', 1, 1),
    })
      .subscribe({
        next: ({ clients, employees, summary, services, submittedRequests, reviewRequests, approvedRequests }) => {
          this.clientsCount.set(clients.totalCount);
          this.activeEmployeesCount.set(employees.totalCount);
          this.operationsSummary.set(summary);
          this.serviceSummaries.set(services);
          this.activeServicesCount.set(services.length);
          this.openRequestsCount.set(
            submittedRequests.totalCount + reviewRequests.totalCount + approvedRequests.totalCount,
          );
          this.riskServicesCount.set(
            services.filter((service) => service.openIncidents > 0 || service.absentAttendance > 0 || service.lateAttendance > 0).length,
          );
        },
        error: () => {
          this.error.set('No se pudieron cargar las métricas del inicio.');
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  protected serviceRiskSummary(service: OperationsServiceSummary) {
    return `${service.openIncidents} incidencia(s) · ${service.absentAttendance} falta(s) · ${service.lateAttendance} retardo(s)`;
  }

  private riskScore(service: OperationsServiceSummary) {
    return service.criticalIncidents * 5 + service.openIncidents * 3 + service.absentAttendance * 2 + service.lateAttendance;
  }
}
