import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
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
  private readonly auth = inject(AuthService);
  private readonly clientApi = inject(ClientApiService);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly events = signal<readonly AuditEvent[]>([]);
  protected readonly entities = signal<readonly string[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly selectedEntity = signal('');
  protected readonly selectedActor = signal('');
  protected readonly selectedAction = signal('');
  protected readonly selectedResult = signal<AuditResultFilter>('');
  protected readonly selectedEventKey = signal('');
  protected readonly showExportConfig = signal(false);
  protected readonly selectedTimelineFilter = signal<TimelineFilter>('all');
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
  protected readonly visibleEvents = computed(() => {
    const search = this.search().trim().toLowerCase();

    return this.events().filter((event) => {
      const matchesSearch =
        !search ||
        [
          event.entity,
          event.entityName,
          event.recordId,
          event.actorName,
          event.action,
          event.details ?? '',
        ].some((value) => this.translateText(value).toLowerCase().includes(search));
      const matchesActor = !this.selectedActor() || event.actorName === this.selectedActor();
      const matchesAction = !this.selectedAction() || this.actionLabel(event.action) === this.selectedAction();
      const matchesResult = !this.selectedResult() || this.resultStatus(event) === this.selectedResult();

      return matchesSearch && matchesActor && matchesAction && matchesResult;
    });
  });
  protected readonly selectedEvent = computed(
    () => this.events().find((event) => this.eventKey(event) === this.selectedEventKey()) ?? null,
  );
  protected readonly actorOptions = computed(() =>
    [...new Set(this.events().map((event) => event.actorName).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'es-MX')),
  );
  protected readonly actionOptions = computed(() =>
    [...new Set(this.events().map((event) => this.actionLabel(event.action)))].sort((left, right) => left.localeCompare(right, 'es-MX')),
  );
  protected readonly createCount = computed(() =>
    this.visibleEvents().filter((event) => this.actionLabel(event.action) === 'Alta').length,
  );
  protected readonly updateCount = computed(() =>
    this.visibleEvents().filter((event) => this.actionLabel(event.action) === 'Actualización').length,
  );
  protected readonly deactivationCount = computed(() =>
    this.visibleEvents().filter((event) => ['Baja', 'Baja lógica', 'Eliminación'].includes(this.actionLabel(event.action))).length,
  );
  protected readonly failedCount = computed(() =>
    this.visibleEvents().filter((event) => this.resultStatus(event) === 'failed').length,
  );
  protected readonly selectedDiffRows = computed(() => {
    const event = this.selectedEvent();
    return event ? this.diffRows(event) : [];
  });
  protected readonly selectedTimeline = computed(() => {
    const event = this.selectedEvent();

    if (!event) {
      return [];
    }

    return this.events()
      .filter((item) => item.entity === event.entity && item.recordId === event.recordId)
      .filter((item) => {
        switch (this.selectedTimelineFilter()) {
          case 'success':
            return this.resultStatus(item) === 'success';
          case 'failed':
            return this.resultStatus(item) === 'failed';
          case 'status':
            return this.diffRows(item).some((row) => row.field.toLowerCase().includes('estado'));
          default:
            return true;
        }
      })
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  });
  protected readonly selectedOrganizationName = computed(
    () => this.organizations().find((organization) => organization.idOrganization === this.selectedOrganizationId())?.legalName ?? 'Sin organización',
  );
  protected readonly exportingUserName = computed(() => this.auth.displayName() || 'Usuario actual');
  protected readonly exportFileName = computed(() => `gestia-bitacora-${this.selectedEntity() || 'todas'}-${this.today()}.csv`);

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

  protected onActorChange(value: string) {
    this.selectedActor.set(value);
    this.selectedEventKey.set('');
  }

  protected onActionChange(value: string) {
    this.selectedAction.set(value);
    this.selectedEventKey.set('');
  }

  protected onResultChange(value: AuditResultFilter) {
    this.selectedResult.set(value);
    this.selectedEventKey.set('');
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
    this.selectedActor.set('');
    this.selectedAction.set('');
    this.selectedResult.set('');
    this.search.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.selectedEventKey.set('');
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
    this.selectedTimelineFilter.set('all');
  }

  protected closeEventDetail() {
    this.selectedEventKey.set('');
  }

  protected actionClass(action: string) {
    const cleanAction = this.actionLabel(action);

    if (cleanAction === 'Alta') {
      return 'status-created';
    }

    if (['Baja', 'Baja lógica', 'Eliminación'].includes(cleanAction)) {
      return 'status-deactivated';
    }

    return 'status-updated';
  }

  protected actionLabel(action: string) {
    const labels: Record<string, string> = {
      Create: 'Alta',
      Created: 'Alta',
      Insert: 'Alta',
      Add: 'Alta',
      Update: 'Actualización',
      Updated: 'Actualización',
      Edit: 'Actualización',
      Publish: 'Publicación',
      Published: 'Publicación',
      StatusChange: 'Cambio de estado',
      Delete: 'Eliminación',
      Deactivate: 'Baja lógica',
      Deactivated: 'Baja lógica',
      Baja: 'Baja lógica',
    };

    return labels[action] ?? this.translateText(action);
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
    if (!value) {
      value = new Date().toISOString();
    }

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected compactDetails(value: string | null) {
    if (!value) {
      return 'Sin detalle adicional';
    }

    const translated = this.translateText(value);
    return translated.length > 120 ? `${translated.slice(0, 117)}…` : translated;
  }

  protected translateText(value: string | null | undefined) {
    if (!value) {
      return '';
    }

    return String(value)
      .replaceAll('OperationalRequest', 'Solicitud operativa')
      .replaceAll('BusinessDocument', 'Documento')
      .replaceAll('AttendanceRecord', 'Registro de asistencia')
      .replaceAll('CoverageRecord', 'Cobertura')
      .replaceAll('ServiceConfiguration', 'Configuración de servicio')
      .replaceAll('ScheduleVersion', 'Versión de planeación')
      .replaceAll('Created', 'Creado')
      .replaceAll('Create', 'Alta')
      .replaceAll('Updated', 'Actualizado')
      .replaceAll('Update', 'Actualización')
      .replaceAll('Deleted', 'Eliminado')
      .replaceAll('Delete', 'Eliminación')
      .replaceAll('Published', 'Publicado')
      .replaceAll('Draft', 'Borrador')
      .replaceAll('Superseded', 'Reemplazado')
      .replaceAll('Active', 'Activo')
      .replaceAll('Inactive', 'Inactivo')
      .replaceAll('Pending', 'Pendiente')
      .replaceAll('Open', 'Abierto')
      .replaceAll('Closed', 'Cerrado')
      .replaceAll('Resolved', 'Resuelto')
      .replaceAll('Cancelled', 'Cancelado')
      .replaceAll('Canceled', 'Cancelado')
      .replaceAll('Completed', 'Completado')
      .replaceAll('Approved', 'Aprobado')
      .replaceAll('Rejected', 'Rechazado')
      .replaceAll('Critical', 'Crítico')
      .replaceAll('High', 'Alta')
      .replaceAll('Medium', 'Media')
      .replaceAll('Low', 'Baja')
      .replaceAll('Client', 'Cliente')
      .replaceAll('Employee', 'Empleado')
      .replaceAll('Service', 'Servicio')
      .replaceAll('Contract', 'Contrato')
      .replaceAll('Request', 'Solicitud')
      .replaceAll('_', ' ')
      .trim();
  }

  protected diffRows(event: AuditEvent): readonly AuditDiffRow[] {
    const details = this.translateText(event.details);
    const rows: AuditDiffRow[] = [];

    if (this.actionLabel(event.action) === 'Alta') {
      rows.push(
        { field: 'Registro', before: null, after: this.translateText(event.entityName) },
        { field: 'Estado', before: null, after: event.active ? 'Activo' : 'Inactivo' },
      );
    } else if (['Baja', 'Baja lógica', 'Eliminación'].includes(this.actionLabel(event.action))) {
      rows.push(
        { field: 'Estado', before: 'Activo', after: event.active ? 'Activo' : 'Inactivo', deleted: !event.active },
        { field: 'Registro', before: this.translateText(event.entityName), after: event.active ? this.translateText(event.entityName) : 'Baja lógica' },
      );
    } else {
      rows.push(
        { field: 'Actualización', before: 'Valor anterior no enviado por la API', after: details || 'Cambio confirmado' },
        { field: 'Estado actual', before: null, after: event.active ? 'Activo' : 'Inactivo' },
      );
    }

    if (details && !rows.some((row) => row.after === details)) {
      rows.push({ field: 'Detalle auditado', before: null, after: details });
    }

    if (this.resultStatus(event) === 'failed') {
      rows.push({ field: 'Resultado', before: 'Pendiente', after: 'Fallido' });
    }

    return rows;
  }

  protected auditSentence(event: AuditEvent) {
    const action = this.actionLabel(event.action).toLowerCase();
    return `${event.actorName} registró ${action} sobre ${this.entityLabel(event.entity)}: ${event.entityName}.`;
  }

  protected resultLabel(event: AuditEvent) {
    return this.resultStatus(event) === 'failed' ? 'Fallido' : 'Éxito';
  }

  protected resultDescription(event: AuditEvent) {
    if (this.resultStatus(event) === 'failed') {
      return this.compactDetails(event.details) || 'El evento no pudo completarse.';
    }

    return event.active ? 'Confirmado' : 'Registro inactivo después del evento';
  }

  protected resultStatus(event: AuditEvent): AuditResultFilter {
    const text = `${event.action} ${event.details ?? ''}`.toLowerCase();
    return /fall|error|failed|exception|no se pudo|rechaz/.test(text) ? 'failed' : 'success';
  }

  protected resultClass(event: AuditEvent) {
    return this.resultStatus(event) === 'failed' ? 'result-failed' : 'result-success';
  }

  protected originLabel(event: AuditEvent) {
    const text = `${event.details ?? ''} ${event.action}`.toLowerCase();

    if (text.includes('import')) {
      return 'Importación';
    }

    if (text.includes('api')) {
      return 'API';
    }

    if (text.includes('autom')) {
      return 'Proceso automático';
    }

    return 'Interfaz web';
  }

  protected correlationId(event: AuditEvent) {
    let hash = 0;
    const key = this.eventKey(event);

    for (let index = 0; index < key.length; index += 1) {
      hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
    }

    return hash.toString(16).padStart(8, '0');
  }

  protected snapshotReference(event: AuditEvent) {
    return `${this.entityLabel(event.entity).slice(0, 3).toUpperCase()}-${this.compactRecordId(event.recordId)}-${this.correlationId(event)}`;
  }

  protected currentObjectStatus(event: AuditEvent) {
    return event.active ? 'Disponible para consulta' : 'Inactivo o eliminado lógicamente';
  }

  protected setTimelineFilter(filter: TimelineFilter) {
    this.selectedTimelineFilter.set(filter);
  }

  protected openExportConfig() {
    this.showExportConfig.set(true);
  }

  protected closeExportConfig() {
    this.showExportConfig.set(false);
  }

  protected copyReference() {
    const event = this.selectedEvent();
    if (!event) {
      return;
    }

    void navigator.clipboard?.writeText(this.snapshotReference(event));
  }

  protected valueLabel(value: string | null | undefined) {
    if (!value || value === 'null' || value === 'undefined') {
      return 'Sin valor anterior';
    }

    return this.translateText(String(value));
  }

  protected detailLines(value: string | null) {
    if (!value) {
      return ['Sin motivo o detalle adicional registrado.'];
    }

    return value
      .split(/\r?\n|;|\|/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => this.translateText(line))
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
        next: (blob) => {
          this.downloadBlob(blob, this.exportFileName());
          this.showExportConfig.set(false);
        },
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

  private today() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
    }).format(new Date());
  }
}

type AuditResultFilter = '' | 'success' | 'failed';
type TimelineFilter = 'all' | 'success' | 'failed' | 'status';

type AuditDiffRow = {
  readonly field: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly deleted?: boolean;
};
