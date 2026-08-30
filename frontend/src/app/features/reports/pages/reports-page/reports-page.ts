import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import {
  Client,
  ManagedService,
  OperationsServiceSummary,
  OperationsSummary,
  Organization,
  WorkforceEligibilityReport,
} from '../../../clients/data-access/client.models';

@Component({
  selector: 'app-reports-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage implements OnInit {
  private readonly api = inject(ClientApiService);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly clients = signal<readonly Client[]>([]);
  protected readonly services = signal<readonly ManagedService[]>([]);
  protected readonly summary = signal<OperationsSummary | null>(null);
  protected readonly serviceSummaries = signal<readonly OperationsServiceSummary[]>([]);
  protected readonly workforceEligibility = signal<readonly WorkforceEligibilityReport[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedClientId = signal('');
  protected readonly selectedServiceId = signal('');
  protected readonly selectedReportType = signal<ReportType>('resumen');
  protected readonly selectedExportFormat = signal<ReportExportFormat>('xlsx');
  protected readonly showDefinitions = signal(false);
  protected readonly fromDate = signal(this.firstDayOfMonth());
  protected readonly toDate = signal(this.today());
  protected readonly lastUpdatedAt = signal('');
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');

  protected readonly attendanceRate = computed(() => {
    const summary = this.summary();
    if (!summary || !this.hasTurnDenominator()) {
      return null;
    }

    return Math.round((summary.presentAttendance / summary.attendanceRecords) * 100);
  });

  protected readonly absenceRate = computed(() => {
    const summary = this.summary();
    if (!summary || !this.hasTurnDenominator()) {
      return null;
    }

    return Math.round((summary.absentAttendance / summary.attendanceRecords) * 100);
  });

  protected readonly tardinessRate = computed(() => {
    const summary = this.summary();
    if (!summary || !this.hasTurnDenominator()) {
      return null;
    }

    return Math.round((summary.lateAttendance / summary.attendanceRecords) * 100);
  });

  protected readonly hasTurnDenominator = computed(() => (this.summary()?.attendanceRecords ?? 0) > 0);
  protected readonly turnDenominatorLabel = computed(() =>
    this.hasTurnDenominator() ? `${this.summary()?.attendanceRecords ?? 0} turnos esperados` : 'Sin turnos esperados',
  );
  protected readonly coveredHours = computed(() =>
    Math.round(((this.summary()?.coveredMinutes ?? 0) / 60) * 10) / 10,
  );
  protected readonly pendingCoverages = computed(() => {
    const summary = this.summary();
    if (!summary) {
      return 0;
    }

    return Math.max(summary.coverageRecords - summary.confirmedCoverages - summary.completedCoverages, 0);
  });
  protected readonly eligibleEmployees = computed(
    () => this.eligibilityRows().filter((employee) => employee.status === 'Elegible').length,
  );
  protected readonly nonEligibleEmployees = computed(
    () => this.eligibilityRows().filter((employee) => employee.status === 'No elegible').length,
  );
  protected readonly insufficientRulesEmployees = computed(
    () => this.eligibilityRows().filter((employee) => employee.status === 'Sin reglas suficientes').length,
  );
  protected readonly reportTypes: readonly { value: ReportType; label: string; description: string }[] = [
    { value: 'resumen', label: 'Resumen ejecutivo', description: 'Vista ejecutiva del periodo' },
    { value: 'servicios', label: 'Operación por servicio', description: 'Comparativo por cliente y servicio' },
    { value: 'elegibilidad', label: 'Elegibilidad', description: 'Personal elegible y pendientes' },
    { value: 'alertas', label: 'Alertas y distribución', description: 'Riesgos y severidades del periodo' },
    { value: 'exportacion', label: 'Exportación operativa', description: 'Salida para dirección o administración' },
  ];
  protected readonly selectedReport = computed(
    () => this.reportTypes.find((report) => report.value === this.selectedReportType()) ?? this.reportTypes[0],
  );

  protected readonly reportCards = computed(() => {
    const summary = this.summary();

    return [
      {
        label: 'Asistencia',
        value: this.rateDisplay(this.attendanceRate()),
        detail: this.hasTurnDenominator() ? `${summary?.presentAttendance ?? 0} presentes` : 'Sin turnos esperados',
      },
      {
        label: 'Ausentismo',
        value: this.rateDisplay(this.absenceRate()),
        detail: this.hasTurnDenominator() ? `${summary?.absentAttendance ?? 0} faltas` : 'Sin turnos esperados',
      },
      {
        label: 'Retardos',
        value: this.rateDisplay(this.tardinessRate()),
        detail: this.hasTurnDenominator() ? `${summary?.lateAttendance ?? 0} registros tarde` : 'Sin turnos esperados',
      },
      {
        label: 'Coberturas',
        value: summary?.coverageRecords ?? 0,
        detail: `${this.coveredHours()} h cubiertas`,
      },
      {
        label: 'Incidencias abiertas',
        value: summary?.openIncidents ?? 0,
        detail: `${summary?.criticalIncidents ?? 0} críticas`,
      },
      {
        label: 'Coberturas pendientes',
        value: this.pendingCoverages(),
        detail: 'Sin confirmar o completar',
      },
      {
        label: 'Servicios activos',
        value: this.services().filter((service) => service.active).length,
        detail: 'Con operación en el alcance',
      },
      {
        label: 'Autorizaciones pendientes',
        value: summary?.pendingApprovals ?? 0,
        detail: 'Requieren supervisor',
      },
      {
        label: 'Días cerrados',
        value: summary?.closedOperationDays ?? 0,
        detail: 'Cierres operativos del periodo',
      },
    ];
  });

  protected readonly highestRiskServices = computed(() =>
    [...this.serviceSummaries()]
      .filter((service) => service.openIncidents > 0 || service.absentAttendance > 0 || service.lateAttendance > 0)
      .sort((left, right) => this.riskScore(right) - this.riskScore(left))
      .slice(0, 5),
  );
  protected readonly attendanceDistribution = computed(() => {
    const summary = this.summary();
    const total = summary?.attendanceRecords ?? 0;

    return [
      { label: 'Presentes', value: summary?.presentAttendance ?? 0, className: 'is-ok' },
      { label: 'Retardos', value: summary?.lateAttendance ?? 0, className: 'is-warning' },
      { label: 'Faltas', value: summary?.absentAttendance ?? 0, className: 'is-danger' },
      { label: 'Justificadas', value: summary?.excusedAttendance ?? 0, className: 'is-info' },
    ].map((item) => ({
      ...item,
      percentage: total === 0 ? null : Math.round((item.value / total) * 100),
    }));
  });
  protected readonly donutStyle = computed(() => {
    if (!this.hasTurnDenominator()) {
      return 'conic-gradient(#e7edf7 0 100%)';
    }

    const distribution = this.attendanceDistribution();
    const present = distribution.find((item) => item.label === 'Presentes')?.percentage ?? 0;
    const late = distribution.find((item) => item.label === 'Retardos')?.percentage ?? 0;
    const absent = distribution.find((item) => item.label === 'Faltas')?.percentage ?? 0;
    const presentEnd = present;
    const lateEnd = presentEnd + late;
    const absentEnd = lateEnd + absent;

    return `conic-gradient(#20b56b 0 ${presentEnd}%, #f59e0b ${presentEnd}% ${lateEnd}%, #ef4444 ${lateEnd}% ${absentEnd}%, #38bdf8 ${absentEnd}% 100%)`;
  });
  protected readonly alertSeverityCards = computed(() => {
    const summary = this.summary();
    return [
      { label: 'Críticas', value: summary?.criticalIncidents ?? 0, detail: 'Requiere acción inmediata', className: 'is-critical' },
      { label: 'Altas', value: Math.max((summary?.openIncidents ?? 0) - (summary?.criticalIncidents ?? 0), 0), detail: 'Atención prioritaria', className: 'is-high' },
      { label: 'Medias', value: summary?.lateAttendance ?? 0, detail: 'Monitoreo recomendado', className: 'is-medium' },
      { label: 'Bajas', value: summary?.excusedAttendance ?? 0, detail: 'Sin impacto crítico', className: 'is-low' },
    ];
  });
  protected readonly eligibilityRows = computed(() =>
    this.workforceEligibility().map((employee) => {
      const reasons = employee.reasons.length ? employee.reasons : employee.isEligible ? ['Cumple requisitos actuales'] : ['Requiere revisión'];
      const hasInsufficientRules = reasons.some((reason) => /regla|suficiente|configur/i.test(reason));

      return {
        ...employee,
        status: hasInsufficientRules ? 'Sin reglas suficientes' : employee.isEligible ? 'Elegible' : 'No elegible',
        fileStatus: employee.rejectedDocuments || employee.expiredDocuments ? 'Incompleto' : 'Completo',
        documentStatus: employee.rejectedDocuments || employee.expiredDocuments ? 'Pendiente' : 'Completo',
        skillStatus: reasons.some((reason) => /habilidad/i.test(reason)) ? 'Faltante' : 'Completo',
        reasons,
      } satisfies EligibilityReportRow;
    }),
  );
  protected readonly metricDefinitions: readonly MetricDefinition[] = [
    { label: 'Asistencia', formula: 'Presentes / turnos esperados' },
    { label: 'Ausentismo', formula: 'Faltas / turnos esperados' },
    { label: 'Retardos', formula: 'Registros de retardo / turnos esperados' },
    { label: 'Cobertura', formula: 'Turnos cubiertos / turnos requeridos' },
    { label: 'N/D', formula: 'No existe denominador suficiente para calcular la métrica' },
  ];
  protected readonly exportOptions: readonly string[] = [
    'Incluir alcance de filtros',
    'Incluir fecha de actualización',
    'Incluir zona horaria',
    'Incluir definiciones de métricas',
    'Incluir datos N/D',
    'Incluir auditoría de generación',
  ];
  protected readonly exportFormats: readonly ReportExportFormat[] = ['csv', 'xlsx', 'pdf'];
  protected readonly suggestedFileName = computed(
    () => `reporte-operativo-${this.toDate()}.${this.selectedExportFormat() === 'xlsx' ? 'xlsx' : this.selectedExportFormat()}`,
  );
  protected readonly filterScopeLabel = computed(() => {
    const organization = this.organizations().find((item) => item.idOrganization === this.selectedOrganizationId())?.legalName ?? 'Sin organización';
    const client = this.clients().find((item) => item.idClient === this.selectedClientId());
    const service = this.services().find((item) => item.idService === this.selectedServiceId());
    return [
      `Organización: ${organization}`,
      `Cliente: ${client ? client.tradeName || client.legalName : 'Todos los clientes'}`,
      `Servicio: ${service ? service.name : 'Todos los servicios'}`,
    ].join(' · ');
  });
  protected readonly periodLabel = computed(() => `${this.fromDate()} - ${this.toDate()}`);
  protected readonly timezoneLabel = computed(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City');
  protected readonly lastUpdatedLabel = computed(() =>
    this.lastUpdatedAt() ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(this.lastUpdatedAt())) : 'Sin actualizar',
  );
  protected readonly executiveNotes = computed(() => {
    const summary = this.summary();

    if (!summary) {
      return ['Selecciona una organización para generar el corte operativo.'];
    }

    const notes = [
      this.hasTurnDenominator()
        ? `Asistencia general del ${this.rateDisplay(this.attendanceRate())} entre ${this.fromDate()} y ${this.toDate()}.`
        : 'No hay turnos esperados en el periodo seleccionado. Las métricas se muestran como N/D para evitar interpretaciones erróneas.',
      `${summary.openIncidents} incidencia(s) abierta(s), ${summary.criticalIncidents} crítica(s) y ${summary.pendingApprovals} autorización(es) pendiente(s).`,
      `${this.coveredHours()} hora(s) cubiertas en sustituciones registradas.`,
    ];

    if (this.nonEligibleEmployees() > 0) {
      notes.push(`${this.nonEligibleEmployees()} empleado(s) requieren revisión de elegibilidad.`);
    }

    return notes;
  });

  ngOnInit() {
    this.loadOrganizations();
  }

  protected onOrganizationChange(value: string) {
    this.selectedOrganizationId.set(value);
    this.selectedClientId.set('');
    this.selectedServiceId.set('');
    this.clients.set([]);
    this.services.set([]);
    this.loadClients();
  }

  protected onClientChange(value: string) {
    this.selectedClientId.set(value);
    this.selectedServiceId.set('');
    this.services.set([]);
    this.loadServices();
  }

  protected onServiceChange(value: string) {
    this.selectedServiceId.set(value);
    this.loadReport();
  }

  protected onFromDateChange(value: string) {
    this.fromDate.set(value);
    this.loadReport();
  }

  protected onToDateChange(value: string) {
    this.toDate.set(value);
    this.loadReport();
  }

  protected clearScope() {
    this.selectedClientId.set('');
    this.selectedServiceId.set('');
    this.services.set([]);
    this.loadReport();
  }

  protected refresh() {
    this.loadReport();
  }

  protected selectReportType(type: ReportType) {
    this.selectedReportType.set(type);
  }

  protected selectExportFormat(format: ReportExportFormat) {
    this.selectedExportFormat.set(format);
  }

  protected toggleDefinitions() {
    this.showDefinitions.update((value) => !value);
  }

  protected exportReport(format: ReportExportFormat = this.selectedExportFormat()) {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.error.set('');

    this.api
      .exportOperationsReport(
        organizationId,
        this.selectedClientId() || undefined,
        this.selectedServiceId() || undefined,
        this.fromDate(),
        this.toDate(),
        format,
      )
      .subscribe({
        next: (blob) => this.downloadBlob(blob, this.suggestedFileName()),
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo exportar el reporte.'),
        complete: () => this.exporting.set(false),
      });
  }

  protected exportCsv() {
    this.exportReport('csv');
  }

  private loadOrganizations() {
    this.loading.set(true);
    this.error.set('');

    this.api.listOrganizations().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.selectedOrganizationId.set(organizations[0]?.idOrganization ?? '');
        this.loadClients();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar las organizaciones.'),
      complete: () => this.loading.set(false),
    });
  }

  private loadClients() {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api
      .listClients(organizationId, '', 1, 100)
      .pipe(
        switchMap((clients) => {
          this.clients.set(clients.items);
          const serviceRequests = clients.items.map((client) => this.api.listServices(organizationId, client.idClient));

          return forkJoin({
            report: this.api.getOperationsSummary(
              organizationId,
              this.selectedClientId() || undefined,
              this.selectedServiceId() || undefined,
              this.fromDate(),
              this.toDate(),
            ),
            serviceSummaries: this.api.getOperationsByService(
              organizationId,
              this.selectedClientId() || undefined,
              this.selectedServiceId() || undefined,
              this.fromDate(),
              this.toDate(),
            ),
            workforceEligibility: this.api.getWorkforceEligibility(organizationId, this.toDate()),
            services: serviceRequests.length > 0 ? forkJoin(serviceRequests) : of([] as readonly ManagedService[][]),
          });
        }),
      )
      .subscribe({
        next: ({ report, serviceSummaries, workforceEligibility, services }) => {
          this.summary.set(report);
          this.serviceSummaries.set(serviceSummaries);
          this.workforceEligibility.set(workforceEligibility);
          this.services.set(services.flat());
          this.lastUpdatedAt.set(new Date().toISOString());
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar el reporte operativo.'),
        complete: () => this.loading.set(false),
      });
  }

  private loadServices() {
    const organizationId = this.selectedOrganizationId();
    const clientId = this.selectedClientId();

    if (!organizationId || !clientId) {
      this.services.set([]);
      this.loadReport();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api.listServices(organizationId, clientId).subscribe({
      next: (services) => {
        this.services.set(services);
        this.loadReport();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar los servicios.'),
      complete: () => this.loading.set(false),
    });
  }

  private loadReport() {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api
      .getOperationsSummary(
        organizationId,
        this.selectedClientId() || undefined,
        this.selectedServiceId() || undefined,
        this.fromDate(),
        this.toDate(),
      )
      .pipe(
        switchMap((summary) =>
          forkJoin({
            summary: of(summary),
            serviceSummaries: this.api.getOperationsByService(
              organizationId,
              this.selectedClientId() || undefined,
              this.selectedServiceId() || undefined,
              this.fromDate(),
              this.toDate(),
            ),
            workforceEligibility: this.api.getWorkforceEligibility(organizationId, this.toDate()),
          }),
        ),
      )
      .subscribe({
        next: ({ summary, serviceSummaries, workforceEligibility }) => {
          this.summary.set(summary);
          this.serviceSummaries.set(serviceSummaries);
          this.workforceEligibility.set(workforceEligibility);
          this.lastUpdatedAt.set(new Date().toISOString());
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo actualizar el reporte.'),
        complete: () => this.loading.set(false),
      });
  }

  protected serviceAttendanceRate(service: OperationsServiceSummary) {
    if (service.attendanceRecords === 0) {
      return 'N/D';
    }

    return `${Math.round((service.presentAttendance / service.attendanceRecords) * 100)}%`;
  }

  protected serviceAbsenceRate(service: OperationsServiceSummary) {
    if (service.attendanceRecords === 0) {
      return 'N/D';
    }

    return `${Math.round((service.absentAttendance / service.attendanceRecords) * 100)}%`;
  }

  protected serviceTardinessRate(service: OperationsServiceSummary) {
    if (service.attendanceRecords === 0) {
      return 'N/D';
    }

    return `${Math.round((service.lateAttendance / service.attendanceRecords) * 100)}%`;
  }

  protected serviceOperationalStatus(service: OperationsServiceSummary) {
    if (service.attendanceRecords === 0) {
      return 'Sin datos';
    }

    if (service.criticalIncidents > 0 || service.openIncidents > 1) {
      return 'Riesgo';
    }

    if (service.openIncidents > 0 || service.absentAttendance > 0 || service.pendingApprovals > 0) {
      return 'Revisar';
    }

    return 'Estable';
  }

  protected rateDisplay(value: number | null) {
    return value === null ? 'N/D' : `${value}%`;
  }

  protected barWidth(percentage: number | null) {
    return percentage ?? 0;
  }

  protected eligibilityStatusClass(status: EligibilityStatus) {
    switch (status) {
      case 'Elegible':
        return 'ok';
      case 'Sin reglas suficientes':
        return 'neutral';
      default:
        return 'warning';
    }
  }

  protected exportFormatLabel(format: ReportExportFormat) {
    switch (format) {
      case 'csv':
        return 'CSV';
      case 'pdf':
        return 'PDF';
      default:
        return 'Excel';
    }
  }

  protected serviceCoveredHours(service: OperationsServiceSummary) {
    return Math.round((service.coveredMinutes / 60) * 10) / 10;
  }

  private riskScore(service: OperationsServiceSummary) {
    return service.criticalIncidents * 5 + service.openIncidents * 3 + service.absentAttendance * 2 + service.lateAttendance;
  }

  private setError(error: HttpErrorResponse, fallback: string) {
    this.loading.set(false);
    this.exporting.set(false);
    this.error.set(error.error?.detail ?? error.error?.message ?? fallback);
  }

  private downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private firstDayOfMonth() {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  }
}

type ReportExportFormat = 'csv' | 'xlsx' | 'pdf';

type ReportType = 'resumen' | 'servicios' | 'elegibilidad' | 'alertas' | 'exportacion';

type MetricDefinition = {
  readonly label: string;
  readonly formula: string;
};

type EligibilityStatus = 'Elegible' | 'No elegible' | 'Sin reglas suficientes';

type EligibilityReportRow = WorkforceEligibilityReport & {
  readonly status: EligibilityStatus;
  readonly fileStatus: string;
  readonly documentStatus: string;
  readonly skillStatus: string;
  readonly reasons: readonly string[];
};
