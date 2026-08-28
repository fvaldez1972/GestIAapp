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
  protected readonly fromDate = signal(this.firstDayOfMonth());
  protected readonly toDate = signal(this.today());
  protected readonly loading = signal(false);
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
    ];
  });

  protected readonly highestRiskServices = computed(() =>
    [...this.serviceSummaries()]
      .filter((service) => service.openIncidents > 0 || service.absentAttendance > 0 || service.lateAttendance > 0)
      .sort((left, right) => this.riskScore(right) - this.riskScore(left))
      .slice(0, 5),
  );

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

  protected exportCsv() {
    const summary = this.summary();
    if (!summary) {
      return;
    }

    const rows = [
      ['Métrica', 'Valor'],
      ['Asistencias capturadas', summary.attendanceRecords],
      ['Presentes', summary.presentAttendance],
      ['Retardos', summary.lateAttendance],
      ['Faltas', summary.absentAttendance],
      ['Justificadas', summary.excusedAttendance],
      ['Incidencias', summary.incidents],
      ['Incidencias abiertas', summary.openIncidents],
      ['Incidencias críticas', summary.criticalIncidents],
      ['Coberturas', summary.coverageRecords],
      ['Coberturas confirmadas', summary.confirmedCoverages],
      ['Coberturas completadas', summary.completedCoverages],
      ['Minutos cubiertos', summary.coveredMinutes],
      ['Personal elegible', this.eligibleEmployees()],
      ['Personal no elegible', this.nonEligibleEmployees()],
      [],
      ['Servicio', 'Cliente', 'Asistencias', 'Presentes', 'Retardos', 'Faltas', 'Incidencias abiertas', 'Críticas', 'Coberturas', 'Horas cubiertas'],
      ...this.serviceSummaries().map((service) => [
        `${service.codeService} · ${service.serviceName}`,
        service.clientName,
        service.attendanceRecords,
        service.presentAttendance,
        service.lateAttendance,
        service.absentAttendance,
        service.openIncidents,
        service.criticalIncidents,
        service.coverageRecords,
        Math.round((service.coveredMinutes / 60) * 10) / 10,
      ]),
      [],
      ['Empleado', 'Puesto', 'Elegible', 'Razones'],
      ...this.workforceEligibility().map((employee) => [
        `${employee.codeEmployee} · ${employee.fullName}`,
        employee.jobTitle ?? '',
        employee.isEligible ? 'Sí' : 'No',
        employee.reasons.join(' | '),
      ]),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gestia-reporte-operativo-${this.fromDate()}-${this.toDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
    this.error.set(error.error?.detail ?? error.error?.message ?? fallback);
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
