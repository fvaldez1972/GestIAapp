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
  protected readonly search = signal('');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(30);
  protected readonly totalCount = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly latestEvent = computed(() => this.events()[0] ?? null);
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

  protected actionClass(action: string) {
    if (action === 'Alta') {
      return 'status-created';
    }

    if (action === 'Baja lógica') {
      return 'status-deactivated';
    }

    return 'status-updated';
  }

  protected exportCsv() {
    const rows = [
      ['Fecha', 'Entidad', 'Registro', 'IdRegistro', 'Acción', 'Usuario', 'Detalle', 'Estado'],
      ...this.events().map((event) => [
        event.occurredAt,
        event.entity,
        event.entityName,
        event.recordId,
        event.action,
        event.actorName,
        event.details ?? '',
        event.active ? 'Activo' : 'Inactivo',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const entity = this.selectedEntity() || 'todas';
    link.href = url;
    link.download = `gestia-auditoria-${entity}-${this.page()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
          this.entities.set(result.availableEntities);
          this.totalCount.set(result.events.totalCount);
          this.totalPages.set(result.events.totalPages);
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo cargar la auditoría.'),
        complete: () => this.loading.set(false),
      });
  }

  private setError(error: HttpErrorResponse, fallback: string) {
    this.loading.set(false);
    this.error.set(error.error?.detail ?? error.error?.message ?? fallback);
  }
}
