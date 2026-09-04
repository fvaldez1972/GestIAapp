import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Client, OperationsServiceSummary, OperationsSummary } from '../../../clients/data-access/client.models';
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
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly operationsSummary = signal<OperationsSummary | null>(null);
  protected readonly serviceSummaries = signal<readonly OperationsServiceSummary[]>([]);
  protected readonly todayClosuresCount = signal(0);
  protected readonly submittedRequestsCount = signal(0);
  protected readonly reviewRequestsCount = signal(0);
  protected readonly approvedRequestsCount = signal(0);

  protected readonly isPlatformAdmin = computed(() => this.auth.session()?.permissions.includes('PLATFORM.ADMIN') ?? false);
  protected readonly displayName = this.auth.displayName;
  protected readonly organizations = computed(() =>
    this.isPlatformAdmin() ? this.auth.platformOrganizations() : this.auth.organizations(),
  );
  protected readonly activeOrganization = computed(() => this.auth.activeOrganization());
  protected readonly todayIso = new Date().toISOString().slice(0, 10);
  protected readonly todayLabel = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  protected readonly coveredHours = computed(() =>
    Math.round(((this.operationsSummary()?.coveredMinutes ?? 0) / 60) * 10) / 10);

  protected readonly activeClientName = computed(() =>
    this.serviceSummaries()[0]?.clientName ?? this.clients()[0]?.tradeName ?? this.clients()[0]?.legalName ?? 'Cliente operativo',
  );

  protected readonly dashboardKicker = computed(() =>
    this.isPlatformAdmin() ? 'Gobierno de plataforma' : 'Mi organización',
  );

  protected readonly dashboardTitle = computed(() =>
    this.isPlatformAdmin() ? 'Tu plataforma, de un vistazo' : 'Tu operación, bajo control',
  );

  protected readonly dashboardSubtitle = computed(() =>
    this.isPlatformAdmin()
      ? 'Supervisa organizaciones y atiende lo que necesita una decisión.'
      : 'Consulta y resuelve la operación de tus clientes desde un único contexto.',
  );

  protected readonly dashboardStatusLabel = computed(() =>
    this.isPlatformAdmin() ? 'Perfil plataforma' : 'Estado operativo',
  );

  protected readonly dashboardStatusValue = computed(() => {
    if (this.isPlatformAdmin()) {
      return 'Super Admin';
    }

    return this.riskServicesCount() > 0 || this.pendingCoverages() > 0 || (this.operationsSummary()?.openIncidents ?? 0) > 0
      ? 'Requiere atención'
      : 'Sin alertas críticas';
  });

  protected readonly dashboardStatusItems = computed(() =>
    this.isPlatformAdmin()
      ? [
          { label: 'Organizaciones', value: this.organizations().length.toString() },
          { label: 'Clientes operativos', value: this.clientsCount().toString() },
          { label: 'Alertas', value: (this.riskServicesCount() + this.openRequestsCount()).toString() },
        ]
      : [
          { label: 'Incidencias', value: (this.operationsSummary()?.openIncidents ?? 0).toString() },
          { label: 'Coberturas', value: this.pendingCoverages().toString() },
          { label: 'Solicitudes', value: this.openRequestsCount().toString() },
        ],
  );

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

  protected readonly primaryMetrics = computed(() => {
    if (this.isPlatformAdmin()) {
      const selectedOrganization = this.activeOrganization()?.legalName ?? 'Sin contexto';
      return [
        {
          label: 'Organizaciones',
          value: this.organizations().length.toString(),
          detail: 'Entidades que utilizan GestIA',
          route: '/plataforma/organizaciones',
          tone: 'neutral',
        },
        {
          label: 'Solicitudes abiertas',
          value: this.openRequestsCount().toString(),
          detail: `Contexto: ${selectedOrganization}`,
          route: '/solicitudes',
          tone: this.openRequestsCount() > 0 ? 'attention' : 'positive',
        },
        {
          label: 'Incidencias abiertas',
          value: (this.operationsSummary()?.openIncidents ?? 0).toString(),
          detail: `Contexto: ${selectedOrganization}`,
          route: '/monitor',
          tone: (this.operationsSummary()?.openIncidents ?? 0) > 0 ? 'attention' : 'positive',
        },
        {
          label: 'Servicios supervisados',
          value: this.activeServicesCount().toString(),
          detail: `Contexto: ${selectedOrganization}`,
          route: '/monitor',
          tone: 'neutral',
        },
      ];
    }

    return [
      {
        label: 'Turnos hoy',
        value: this.expectedShifts().toString(),
        detail: 'Base operativa del día',
        route: '/operacion/asistencia',
        tone: 'neutral',
      },
      {
        label: 'Asistencia',
        value: this.expectedShifts() > 0 ? `${this.attendanceRate()}%` : 'N/D',
        detail: this.expectedShifts() > 0
          ? `${this.operationsSummary()?.presentAttendance ?? 0} presentes de ${this.expectedShifts()}`
          : 'Sin turnos esperados',
        route: '/operacion/asistencia',
        tone: this.expectedShifts() > 0 && this.attendanceRate() < 90 ? 'attention' : 'positive',
      },
      {
        label: 'Incidencias abiertas',
        value: (this.operationsSummary()?.openIncidents ?? 0).toString(),
        detail: 'Requieren seguimiento',
        route: '/operacion/incidencias',
        tone: (this.operationsSummary()?.openIncidents ?? 0) > 0 ? 'attention' : 'positive',
      },
      {
        label: 'Coberturas pendientes',
        value: this.pendingCoverages().toString(),
        detail: 'Solicitadas, sin completar',
        route: '/operacion/cobertura',
        tone: this.pendingCoverages() > 0 ? 'attention' : 'positive',
      },
    ];
  });

  protected readonly moduleFlow = computed(() => [
    {
      title: 'Principal',
      route: '/',
      items: this.isPlatformAdmin() ? ['Inicio plataforma', 'Organizaciones'] : ['Inicio', 'Cliente activo'],
    },
    {
      title: 'Operación',
      route: '/operacion/asistencia',
      items: this.isPlatformAdmin()
        ? ['Monitor global', 'Soporte auditado']
        : ['Planeación', 'Asistencia', 'Incidencias', 'Cobertura'],
    },
    {
      title: 'Control',
      route: '/solicitudes',
      items: ['Solicitudes', 'Reportes', 'Auditoría', 'Seguridad'],
    },
    {
      title: 'Configuración',
      route: this.isPlatformAdmin() ? '/plataforma/organizaciones' : '/clientes',
      items: this.isPlatformAdmin()
        ? ['Organizaciones', 'Admins org.']
        : ['Clientes', 'Servicios', 'Personal', 'Documentos'],
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

  protected readonly quickActions = computed(() => {
    const platformActions = [
      {
        label: 'Revisar seguridad',
        route: '/seguridad',
        detail: 'Roles, usuarios y permisos.',
        permission: 'PLATFORM.ADMIN',
      },
      {
        label: 'Auditoría global',
        route: '/auditoria',
        detail: 'Actividad sensible y soporte.',
        permission: 'AUDIT.READ',
      },
      {
        label: 'Reporte global',
        route: '/reportes',
        detail: 'Indicadores por organización.',
        permission: 'REPORTS.READ',
      },
      {
        label: 'Organizaciones',
        route: '/plataforma/organizaciones',
        detail: 'Alta de organizaciones y admins.',
        permission: 'PLATFORM.ADMIN',
      },
    ];

    const adminActions = [
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
        label: 'Documentos',
        route: '/documentos',
        detail: 'Expedientes por entidad.',
        permission: 'DOCUMENTS.READ',
      },
    ];

    return (this.isPlatformAdmin() ? platformActions : adminActions).filter((action) =>
      this.auth.hasPermission(action.permission),
    );
  });

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
          this.clients.set(clients.items);
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

  protected servicesForClient(idClient: string) {
    return this.serviceSummaries().filter((service) => service.idClient === idClient).length;
  }

  private countLabel(value: number, singular: string, plural: string) {
    return value > 0 ? `${value} ${value === 1 ? singular : plural}` : null;
  }

  private riskScore(service: OperationsServiceSummary) {
    return service.criticalIncidents * 5 + service.openIncidents * 3 + service.absentAttendance * 2 + service.lateAttendance;
  }
}
