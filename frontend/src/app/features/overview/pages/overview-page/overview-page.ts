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
  protected readonly partialErrors = signal<readonly string[]>([]);
  protected readonly clientsCount = signal(0);
  protected readonly activeEmployeesCount = signal(0);
  protected readonly activeServicesCount = signal(0);
  protected readonly openRequestsCount = signal(0);
  protected readonly riskServicesCount = signal(0);
  protected readonly operationsSummary = signal<OperationsSummary | null>(null);
  protected readonly serviceSummaries = signal<readonly OperationsServiceSummary[]>([]);
  protected readonly todayClosuresCount = signal(0);
  protected readonly submittedRequestsCount = signal(0);
  protected readonly reviewRequestsCount = signal(0);
  protected readonly approvedRequestsCount = signal(0);

  protected readonly displayName = this.auth.displayName;
  protected readonly activeOrganization = this.auth.activeOrganization;
  protected readonly todayIso = new Date().toISOString().slice(0, 10);
  protected readonly todayLabel = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  protected readonly coveredHours = computed(() =>
    Math.round(((this.operationsSummary()?.coveredMinutes ?? 0) / 60) * 10) / 10);

  protected readonly pendingCoverages = computed(() => {
    const summary = this.operationsSummary();
    return Math.max((summary?.coverageRecords ?? 0) - (summary?.completedCoverages ?? 0), 0);
  });

  protected readonly expectedShifts = computed(() =>
    Math.max(
      this.operationsSummary()?.attendanceRecords ?? 0,
      this.operationsSummary()?.presentAttendance ?? 0,
      this.operationsSummary()?.lateAttendance ?? 0,
      this.operationsSummary()?.absentAttendance ?? 0,
      this.operationsSummary()?.excusedAttendance ?? 0,
    ));

  protected readonly attendanceTotal = computed(() =>
    Math.max(
      this.operationsSummary()?.attendanceRecords ?? 0,
      (this.operationsSummary()?.presentAttendance ?? 0) +
        (this.operationsSummary()?.lateAttendance ?? 0) +
        (this.operationsSummary()?.absentAttendance ?? 0) +
        (this.operationsSummary()?.excusedAttendance ?? 0),
    ));

  protected readonly attendancePending = computed(() =>
    Math.max(this.expectedShifts() - this.attendanceTotal(), 0));

  protected readonly attendanceRate = computed(() => {
    const total = this.attendanceTotal() + this.attendancePending();
    return total > 0 ? Math.round(((this.operationsSummary()?.presentAttendance ?? 0) / total) * 1000) / 10 : 0;
  });

  protected readonly donutStyle = computed(() => {
    const summary = this.operationsSummary();
    const total = this.attendanceTotal() + this.attendancePending();

    if (!summary || total === 0) {
      return 'conic-gradient(#d8e1ec 0deg 360deg)';
    }

    const present = ((summary.presentAttendance ?? 0) / total) * 360;
    const absent = present + ((summary.absentAttendance ?? 0) / total) * 360;
    const late = absent + ((summary.lateAttendance ?? 0) / total) * 360;
    const excused = late + ((summary.excusedAttendance ?? 0) / total) * 360;

    return `conic-gradient(
      #20b56b 0deg ${present}deg,
      #ef4444 ${present}deg ${absent}deg,
      #f59e0b ${absent}deg ${late}deg,
      #38bdf8 ${late}deg ${excused}deg,
      #d8e1ec ${excused}deg 360deg
    )`;
  });

  protected readonly primaryMetrics = computed(() => [
    {
      label: 'Solicitudes',
      value: this.openRequestsCount().toString(),
      detail: 'Abiertas o listas para ejecutar',
      route: '/solicitudes',
      tone: this.openRequestsCount() > 0 ? 'attention' : 'neutral',
    },
    {
      label: 'Servicios activos',
      value: this.activeServicesCount().toString(),
      detail: 'Configurados para operar',
      route: '/clientes',
      tone: 'neutral',
    },
    {
      label: 'Personal activo',
      value: this.activeEmployeesCount().toString(),
      detail: 'Disponible para asignación',
      route: '/personal',
      tone: 'neutral',
    },
    {
      label: 'Incidencias de hoy',
      value: (this.operationsSummary()?.openIncidents ?? 0).toString(),
      detail: 'Requieren seguimiento',
      route: '/operacion/incidencias',
      tone: (this.operationsSummary()?.openIncidents ?? 0) > 0 ? 'attention' : 'positive',
    },
    {
      label: 'Coberturas pendientes',
      value: this.pendingCoverages().toString(),
      detail: 'Sustituciones por cerrar',
      route: '/operacion/cobertura',
      tone: this.pendingCoverages() > 0 ? 'attention' : 'positive',
    },
  ]);

  protected readonly todaySummary = computed(() => [
    {
      label: 'Turnos esperados',
      value: this.expectedShifts().toString(),
      detail: this.expectedShifts() ? 'Base operativa del día' : 'Sin turnos capturados',
      tone: 'neutral',
    },
    {
      label: 'Presentes',
      value: (this.operationsSummary()?.presentAttendance ?? 0).toString(),
      detail: `${this.attendanceRate()}% de asistencia`,
      tone: 'positive',
    },
    {
      label: 'Faltas',
      value: (this.operationsSummary()?.absentAttendance ?? 0).toString(),
      detail: 'Ausencias registradas',
      tone: (this.operationsSummary()?.absentAttendance ?? 0) > 0 ? 'attention' : 'neutral',
    },
    {
      label: 'Retardos',
      value: (this.operationsSummary()?.lateAttendance ?? 0).toString(),
      detail: 'Llegadas fuera de horario',
      tone: (this.operationsSummary()?.lateAttendance ?? 0) > 0 ? 'attention' : 'neutral',
    },
    {
      label: 'Coberturas',
      value: (this.operationsSummary()?.coverageRecords ?? 0).toString(),
      detail: `${this.coveredHours()} h cubiertas`,
      tone: this.pendingCoverages() > 0 ? 'attention' : 'neutral',
    },
  ]);

  protected readonly attendanceBreakdown = computed(() => [
    { label: 'Presentes', value: this.operationsSummary()?.presentAttendance ?? 0, tone: 'present' },
    { label: 'Faltas', value: this.operationsSummary()?.absentAttendance ?? 0, tone: 'absent' },
    { label: 'Retardos', value: this.operationsSummary()?.lateAttendance ?? 0, tone: 'late' },
    { label: 'Sin novedad', value: (this.operationsSummary()?.excusedAttendance ?? 0) + this.attendancePending(), tone: 'pending' },
  ]);

  protected readonly highestRiskServices = computed(() =>
    [...this.serviceSummaries()]
      .filter((service) => service.openIncidents > 0 || service.absentAttendance > 0 || service.lateAttendance > 0)
      .sort((left, right) => this.riskScore(right) - this.riskScore(left))
      .slice(0, 4),
  );

  protected readonly quickActions = computed(() => [
    {
      label: 'Nueva solicitud',
      route: '/solicitudes',
      detail: 'Alta, cambio o cobertura.',
      permission: 'REQUESTS.WRITE',
    },
    {
      label: 'Nuevo cliente',
      route: '/clientes',
      detail: 'Crear expediente comercial.',
      permission: 'CLIENTS.WRITE',
    },
    {
      label: 'Planeación semanal',
      route: '/planeacion',
      detail: 'Revisar turnos publicados.',
      permission: 'PLANNING.READ',
    },
    {
      label: 'Registrar incidencia',
      route: '/operacion/incidencias',
      detail: 'Capturar excepción operativa.',
      permission: 'OPERATIONS.WRITE',
    },
    {
      label: 'Cierre del día',
      route: '/operacion/asistencia',
      detail: 'Validar y cerrar operación.',
      permission: 'OPERATIONS.WRITE',
    },
    {
      label: 'Reportes',
      route: '/reportes',
      detail: 'Consultar indicadores.',
      permission: 'REPORTS.READ',
    },
  ].filter((action) => this.auth.hasPermission(action.permission)));

  protected readonly recentActivity = computed(() => {
    const summary = this.operationsSummary();
    const activities: { icon: string; title: string; context: string; when: string; route: string }[] = [];

    if (this.approvedRequestsCount() > 0) {
      activities.push({
        icon: '✓',
        title: 'Solicitud aprobada',
        context: `${this.approvedRequestsCount()} solicitud(es) listas para ejecución`,
        when: 'Hoy',
        route: '/solicitudes',
      });
    }

    if ((summary?.openIncidents ?? 0) > 0) {
      activities.push({
        icon: '!',
        title: 'Incidencia registrada',
        context: `${summary?.openIncidents ?? 0} incidencia(s) abiertas`,
        when: 'Hoy',
        route: '/operacion/incidencias',
      });
    }

    if ((summary?.coverageRecords ?? 0) > 0) {
      activities.push({
        icon: '↔',
        title: 'Cobertura registrada',
        context: `${summary?.coverageRecords ?? 0} cobertura(s) en operación`,
        when: 'Hoy',
        route: '/operacion/cobertura',
      });
    }

    if (this.riskServicesCount() > 0) {
      activities.push({
        icon: '•',
        title: 'Servicio requiere seguimiento',
        context: `${this.riskServicesCount()} servicio(s) con señales de riesgo`,
        when: 'Hoy',
        route: '/reportes',
      });
    }

    if (this.todayClosuresCount() > 0) {
      activities.push({
        icon: '□',
        title: 'Cierre diario registrado',
        context: `${this.todayClosuresCount()} cierre(s) de operación`,
        when: 'Hoy',
        route: '/operacion/asistencia',
      });
    }

    return activities.slice(0, 5);
  });

  ngOnInit() {
    this.loadDashboard();
  }

  private loadDashboard() {
    const organizationId = this.auth.activeOrganization()?.idOrganization;

    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.partialErrors.set([]);

    forkJoin({
      clients: this.clientApi.listClients(organizationId, '', 1, 50),
      employees: this.workforceApi.listEmployees(organizationId, '', 'Active', 1, 1),
      summary: this.clientApi.getOperationsSummary(organizationId, undefined, undefined, this.todayIso, this.todayIso),
      services: this.clientApi.getOperationsByService(organizationId, undefined, undefined, this.todayIso, this.todayIso),
      closures: this.clientApi.listOperationDayClosures(organizationId, '', this.todayIso, this.todayIso),
      submittedRequests: this.requestApi.listRequests(organizationId, 'Submitted', '', '', 1, 1),
      reviewRequests: this.requestApi.listRequests(organizationId, 'InReview', '', '', 1, 1),
      approvedRequests: this.requestApi.listRequests(organizationId, 'Approved', '', '', 1, 1),
    })
      .subscribe({
        next: ({ clients, employees, summary, services, closures, submittedRequests, reviewRequests, approvedRequests }) => {
          this.clientsCount.set(clients.totalCount);
          this.activeEmployeesCount.set(employees.totalCount);
          this.operationsSummary.set(summary);
          this.serviceSummaries.set(services);
          this.activeServicesCount.set(services.length);
          this.todayClosuresCount.set(closures.length);
          this.submittedRequestsCount.set(submittedRequests.totalCount);
          this.reviewRequestsCount.set(reviewRequests.totalCount);
          this.approvedRequestsCount.set(approvedRequests.totalCount);
          this.openRequestsCount.set(
            submittedRequests.totalCount + reviewRequests.totalCount + approvedRequests.totalCount,
          );
          this.riskServicesCount.set(
            services.filter((service) => service.openIncidents > 0 || service.absentAttendance > 0 || service.lateAttendance > 0).length,
          );
        },
        error: () => {
          this.error.set('No se pudieron cargar todas las métricas del inicio. Puedes seguir usando los módulos desde el menú.');
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  protected serviceRiskSummary(service: OperationsServiceSummary) {
    const signals = [
      this.countLabel(service.openIncidents, 'incidencia', 'incidencias'),
      this.countLabel(service.absentAttendance, 'falta', 'faltas'),
      this.countLabel(service.lateAttendance, 'retardo', 'retardos'),
    ].filter((signal): signal is string => Boolean(signal));

    return signals.join(' · ');
  }

  private countLabel(value: number, singular: string, plural: string) {
    return value > 0 ? `${value} ${value === 1 ? singular : plural}` : null;
  }

  private riskScore(service: OperationsServiceSummary) {
    return service.criticalIncidents * 5 + service.openIncidents * 3 + service.absentAttendance * 2 + service.lateAttendance;
  }
}
