import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule],
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
  protected readonly fromDate = signal(this.firstDayOfMonth());
  protected readonly toDate = signal(this.today());
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');

  protected readonly attendanceRate = computed(() => {
    const summary = this.summary();
    if (!summary || summary.attendanceRecords === 0) {
      return 0;
    }

    return Math.round((summary.presentAttendance / summary.attendanceRecords) * 100);
  });

  protected readonly absenceRate = computed(() => {
    const summary = this.summary();
    if (!summary || summary.attendanceRecords === 0) {
      return 0;
    }

    return Math.round((summary.absentAttendance / summary.attendanceRecords) * 100);
  });

  protected readonly coveredHours = computed(() =>
    Math.round(((this.summary()?.coveredMinutes ?? 0) / 60) * 10) / 10,
  );
  protected readonly eligibleEmployees = computed(
    () => this.workforceEligibility().filter((employee) => employee.isEligible).length,
  );
  protected readonly nonEligibleEmployees = computed(
    () => this.workforceEligibility().filter((employee) => !employee.isEligible).length,
  );
  protected readonly reportTypes: readonly { value: ReportType; label: string; description: string }[] = [
    { value: 'resumen', label: 'Resumen operativo', description: 'Vista ejecutiva del periodo' },
    { value: 'servicios', label: 'Operación por servicio', description: 'Comparativo por cliente y servicio' },
    { value: 'elegibilidad', label: 'Elegibilidad', description: 'Personal elegible y pendientes' },
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
        value: summary?.attendanceRecords ?? 0,
        detail: `${this.attendanceRate()}% presente`,
      },
      {
        label: 'Faltas',
        value: summary?.absentAttendance ?? 0,
        detail: `${this.absenceRate()}% de ausentismo`,
      },
      {
        label: 'Retardos',
        value: summary?.lateAttendance ?? 0,
        detail: 'Registros con llegada tarde',
      },
      {
        label: 'Incidencias abiertas',
        value: summary?.openIncidents ?? 0,
        detail: `${summary?.criticalIncidents ?? 0} críticas`,
      },
      {
        label: 'Coberturas',
        value: summary?.coverageRecords ?? 0,
        detail: `${this.coveredHours()} h cubiertas`,
      },
      {
        label: 'Coberturas cerradas',
        value: summary?.completedCoverages ?? 0,
        detail: `${summary?.confirmedCoverages ?? 0} confirmadas`,
      },
      {
        label: 'Personal elegible',
        value: this.eligibleEmployees(),
        detail: 'Disponible con reglas actuales',
      },
      {
        label: 'Personal no elegible',
        value: this.nonEligibleEmployees(),
        detail: 'Requiere revisión documental',
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
      percentage: total === 0 ? 0 : Math.round((item.value / total) * 100),
    }));
  });
  protected readonly donutStyle = computed(() => {
    const distribution = this.attendanceDistribution();
    const present = distribution.find((item) => item.label === 'Presentes')?.percentage ?? 0;
    const late = distribution.find((item) => item.label === 'Retardos')?.percentage ?? 0;
    const absent = distribution.find((item) => item.label === 'Faltas')?.percentage ?? 0;
    const presentEnd = present;
    const lateEnd = presentEnd + late;
    const absentEnd = lateEnd + absent;

    return `conic-gradient(#20b56b 0 ${presentEnd}%, #f59e0b ${presentEnd}% ${lateEnd}%, #ef4444 ${lateEnd}% ${absentEnd}%, #38bdf8 ${absentEnd}% 100%)`;
  });
  protected readonly executiveNotes = computed(() => {
    const summary = this.summary();

    if (!summary) {
      return ['Selecciona una organización para generar el corte operativo.'];
    }

    const notes = [
      `Asistencia general del ${this.attendanceRate()}% entre ${this.fromDate()} y ${this.toDate()}.`,
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

  protected exportReport(format: 'csv' | 'xlsx' | 'pdf') {
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
        next: (blob) => this.downloadBlob(blob, `gestia-reporte-operativo-${this.fromDate()}-${this.toDate()}.${format}`),
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
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo actualizar el reporte.'),
        complete: () => this.loading.set(false),
      });
  }

  protected serviceAttendanceRate(service: OperationsServiceSummary) {
    if (service.attendanceRecords === 0) {
      return 0;
    }

    return Math.round((service.presentAttendance / service.attendanceRecords) * 100);
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

type ReportType = 'resumen' | 'servicios' | 'elegibilidad' | 'exportacion';
