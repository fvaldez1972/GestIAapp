import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Organization } from '../../../clients/data-access/client.models';
import { AuditApiService } from '../../data-access/audit-api.service';
import { AuditEvent, AuditResult } from '../../data-access/audit.models';

@Component({
  selector: 'app-audit-page',
  imports: [FormsModule],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage implements OnInit {
  private readonly api = inject(AuditApiService);
  private readonly clientApi = inject(ClientApiService);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly events = signal<readonly AuditEvent[]>([]);
  protected readonly entities = signal<readonly string[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedEntity = signal('');
  protected readonly selectedEventKey = signal('');
  protected readonly search = signal('');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(30);
  protected readonly totalCount = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');

  protected readonly latestEvent = computed(() => this.events()[0] ?? null);
  protected readonly selectedEvent = computed(
    () => this.events().find((event) => this.eventKey(event) === this.selectedEventKey()) ?? null,
  );
  protected readonly updateCount = computed(
    () => this.events().filter((event) => event.action === 'Actualización').length,
  );
  protected readonly deactivationCount = computed(
    () => this.events().filter((event) => event.action === 'Baja lógica').length,
  );

  ngOnInit() {
    this.loadOrganizations();
  }

  protected onOrganizationChange(value: string) {
    this.selectedOrganizationId.set(value);
    this.page.set(1);
    this.loadEvents();
  }

  protected onEntityChange(value: string) {
    this.selectedEntity.set(value);
    this.page.set(1);
    this.loadEvents();
  }

  protected onSearchChange(value: string) {
    this.search.set(value);
  }

  protected onFromDateChange(value: string) {
    this.fromDate.set(value);
    this.page.set(1);
    this.loadEvents();
  }

  protected onToDateChange(value: string) {
    this.toDate.set(value);
    this.page.set(1);
    this.loadEvents();
  }

  protected applySearch() {
    this.page.set(1);
    this.loadEvents();
  }

  protected clearFilters() {
    this.selectedEntity.set('');
    this.search.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.page.set(1);
    this.loadEvents();
  }

  protected goToPage(page: number) {
    if (page < 1 || page > Math.max(this.totalPages(), 1)) {
      return;
    }

    this.page.set(page);
    this.loadEvents();
  }

  protected selectEvent(event: AuditEvent) {
    this.selectedEventKey.set(this.eventKey(event));
  }

  protected closeEventDetail() {
    this.selectedEventKey.set('');
  }

  protected actionClass(action: string) {
    if (action === 'Alta') {
      return 'status-created';
    }

    if (action === 'Baja lógica') {
      return 'status-deactivated';
    }

    return 'status-updated';
  }

  protected entityLabel(entity: string) {
    const labels: Record<string, string> = {
      ApprovalRequests: 'Autorizaciones',
      BusinessCatalogItems: 'Catálogos',
      BusinessDocuments: 'Documentos',
      Clients: 'Clientes',
      ClientContacts: 'Contactos',
      ClientSites: 'Sedes',
      EligibilityRequirements: 'Reglas de elegibilidad',
      EmployeeDocuments: 'Documentos de personal',
      EmployeeEvaluations: 'Evaluaciones',
      Employees: 'Personal',
      EmployeeSkills: 'Habilidades del personal',
      OperationDayClosures: 'Cierres diarios',
      Organizations: 'Organizaciones',
      ServiceAssignments: 'Asignaciones',
      ServiceConfigurations: 'Configuraciones de servicio',
      ServiceContracts: 'Contratos',
      Services: 'Servicios',
    };

    return labels[entity] ?? this.humanizeToken(entity);
  }

  protected compactRecordId(recordId: string) {
    if (!recordId) {
      return '';
    }

    return recordId.length > 12 ? `${recordId.slice(0, 8)}…` : recordId;
  }

  protected formatDateTime(value: string) {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected compactDetails(value: string | null) {
    if (!value) {
      return 'Sin detalle adicional';
    }

    return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  }

  protected auditSentence(event: AuditEvent) {
    return `${event.actorName} registró ${event.action.toLowerCase()} en ${this.entityLabel(event.entity)}.`;
  }

  protected resultLabel(event: AuditEvent) {
    return event.active ? 'Registro activo después del movimiento' : 'Registro inactivo después del movimiento';
  }

  protected detailLines(value: string | null) {
    if (!value) {
      return ['Sin motivo o detalle adicional registrado.'];
    }

    return value
      .split(/\r?\n|;|\|/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  protected eventKey(event: AuditEvent) {
    return `${event.entity}|${event.recordId}|${event.action}|${event.occurredAt}`;
  }

  protected exportCsv() {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.error.set('');

    this.api
      .exportEvents(
        organizationId,
        this.selectedEntity(),
        this.search(),
        this.fromDate(),
        this.toDate(),
      )
      .subscribe({
        next: (blob) => this.downloadBlob(blob, `gestia-auditoria-${this.selectedEntity() || 'todas'}.csv`),
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo exportar la auditoría.'),
        complete: () => this.exporting.set(false),
      });
  }

  private loadOrganizations() {
    this.loading.set(true);
    this.error.set('');

    this.clientApi.listOrganizations().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.selectedOrganizationId.set(organizations[0]?.idOrganization ?? '');
        this.loadEvents();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudieron cargar las organizaciones.'),
      complete: () => this.loading.set(false),
    });
  }

  protected loadEvents() {
    const organizationId = this.selectedOrganizationId();

    if (!organizationId) {
      this.events.set([]);
      this.totalCount.set(0);
      this.totalPages.set(0);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api
      .listEvents(
        organizationId,
        this.selectedEntity(),
        this.search(),
        this.fromDate(),
        this.toDate(),
        this.page(),
        this.pageSize(),
      )
      .subscribe({
        next: (result: AuditResult) => {
          this.events.set(result.events.items);
          this.entities.set([...result.availableEntities].sort((left, right) => this.entityLabel(left).localeCompare(this.entityLabel(right), 'es-MX')));
          this.totalCount.set(result.events.totalCount);
          this.totalPages.set(result.events.totalPages);
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar la auditoría.'),
        complete: () => this.loading.set(false),
      });
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

  private humanizeToken(value: string) {
    if (!value) {
      return 'Sin categoría';
    }

    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replaceAll('_', ' ')
      .trim();
  }
}
