import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AppIcon } from '../../../shared/ui/app-icon/app-icon';
import { ClientApiService } from '../../clients/data-access/client-api.service';
import { OperationsServiceSummary, OperationsSummary, OrganizationGovernanceSummary } from '../../clients/data-access/client.models';

@Component({
  selector: 'app-monitor-page',
  imports: [FormsModule, RouterLink, AppIcon],
  templateUrl: './monitor-page.html',
  styleUrl: './monitor-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitorPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ClientApiService);
  protected readonly organizations = signal<readonly OrganizationGovernanceSummary[]>([]);
  protected readonly search = signal('');
  protected readonly state = signal('all');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly summary = signal<OperationsSummary | null>(null);
  protected readonly services = signal<readonly OperationsServiceSummary[]>([]);
  protected readonly operationsLoading = signal(false);
  protected readonly operationsError = signal('');
  protected readonly operationDate = signal(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()));
  protected readonly refreshVersion = signal(0);
  protected readonly increment = (value: number) => value + 1;
  protected readonly visibleOrganizations = computed(() => this.organizations().filter(item => {
    const text = `${item.organization.legalName} ${item.organization.codeOrganization}`.toLowerCase();
    return text.includes(this.search().trim().toLowerCase()) &&
      (this.state() === 'all' || (this.state() === 'active' ? item.organization.active : !item.organization.active));
  }));
  protected readonly activeCount = computed(() => this.organizations().filter(item => item.organization.active).length);
  protected readonly withoutAdminCount = computed(() => this.organizations().filter(item => item.organization.active && !item.adminsCount).length);

  constructor() {
    this.reload();
    effect(onCleanup => {
      const organization = this.auth.activeOrganization();
      const date = this.operationDate();
      this.refreshVersion();
      this.summary.set(null);
      this.services.set([]);
      this.operationsError.set('');
      this.operationsLoading.set(false);
      if (!organization || !date) return;
      this.operationsLoading.set(true);
      const request = forkJoin({
        summary: this.api.getOperationsSummary(organization.idOrganization, undefined, undefined, date, date),
        services: this.api.getOperationsByService(organization.idOrganization, undefined, undefined, date, date),
      }).subscribe({
        next: result => { this.summary.set(result.summary); this.services.set(result.services); this.operationsLoading.set(false); },
        error: () => { this.operationsError.set('No se pudo consultar la operacion de la organizacion seleccionada.'); this.operationsLoading.set(false); },
      });
      onCleanup(() => request.unsubscribe());
    });
  }

  protected reload() {
    this.loading.set(true);
    this.error.set('');
    this.api.listOrganizationGovernance().subscribe({
      next: result => { this.organizations.set(result); this.loading.set(false); },
      error: () => { this.error.set('No se pudo cargar el monitor de organizaciones.'); this.loading.set(false); },
    });
  }
}
