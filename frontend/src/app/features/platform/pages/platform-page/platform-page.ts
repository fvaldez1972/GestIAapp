import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Organization, OrganizationClientSummary } from '../../../clients/data-access/client.models';
import { SecurityApiService } from '../../../security/data-access/security-api.service';
import { SecurityRole, SecurityUser } from '../../../security/data-access/security.models';

type OrganizationPlatformSummary = {
  readonly organization: Organization;
  readonly clients: readonly OrganizationClientSummary[];
  readonly usersCount: number;
  readonly adminsCount: number;
};

@Component({
  selector: 'app-platform-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './platform-page.html',
  styleUrl: './platform-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformPage implements OnInit {
  private readonly clientApi = inject(ClientApiService);
  private readonly securityApi = inject(SecurityApiService);

  protected readonly loading = signal(false);
  protected readonly savingOrganization = signal(false);
  protected readonly savingAdmin = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly users = signal<readonly SecurityUser[]>([]);
  protected readonly roles = signal<readonly SecurityRole[]>([]);
  protected readonly summaries = signal<readonly OrganizationPlatformSummary[]>([]);
  protected readonly selectedOrganizationId = signal('');

  protected readonly newOrganizationCode = signal('');
  protected readonly newOrganizationLegalName = signal('');
  protected readonly newOrganizationRfc = signal('');
  protected readonly initialAdminName = signal('');
  protected readonly initialAdminEmail = signal('');
  protected readonly initialAdminPassword = signal('');
  protected readonly organizationStep = signal(1);
  protected readonly organizationStepError = signal('');

  protected readonly selectedAdminName = signal('');
  protected readonly selectedAdminEmail = signal('');
  protected readonly selectedAdminPassword = signal('');
  protected readonly editOrganizationCode = signal('');
  protected readonly editOrganizationLegalName = signal('');
  protected readonly editOrganizationRfc = signal('');

  protected readonly selectedSummary = computed(
    () => this.summaries().find((summary) => summary.organization.idOrganization === this.selectedOrganizationId()) ?? this.summaries()[0] ?? null,
  );
  protected readonly activeOrganizationsCount = computed(() =>
    this.summaries().filter((summary) => summary.organization.active).length,
  );
  protected readonly inactiveOrganizationsCount = computed(() =>
    this.summaries().filter((summary) => !summary.organization.active).length,
  );
  protected readonly activeClientsCount = computed(() =>
    this.summaries().reduce((total, summary) => total + summary.clients.filter((client) => client.active).length, 0),
  );
  protected readonly inactiveClientsCount = computed(() =>
    this.summaries().reduce((total, summary) => total + summary.clients.filter((client) => !client.active).length, 0),
  );
  protected readonly organizationAdminsCount = computed(() =>
    this.summaries().reduce((total, summary) => total + summary.adminsCount, 0),
  );
  protected readonly totalClientsCount = computed(() =>
    this.summaries().reduce((total, summary) => total + summary.clients.length, 0),
  );
  protected readonly adminRole = computed(
    () =>
      this.roles().find((role) => role.active && role.codeRole === 'ORGANIZATION_ADMIN') ??
      null,
  );
  protected readonly initialAdminReady = computed(() =>
    Boolean(
      this.adminRole() &&
        this.initialAdminName().trim() &&
        this.initialAdminEmail().trim() &&
        this.initialAdminPassword().trim().length >= 12,
    ),
  );
  protected readonly canCreateOrganization = computed(() =>
    Boolean(
      !this.savingOrganization() &&
        this.newOrganizationCode().trim() &&
        this.newOrganizationLegalName().trim() &&
        this.initialAdminReady(),
    ),
  );
  protected readonly canCreateAdminForSelected = computed(() =>
    Boolean(
      !this.savingAdmin() &&
        this.selectedSummary() &&
        this.adminRole() &&
        this.selectedAdminName().trim() &&
        this.selectedAdminEmail().trim() &&
        this.selectedAdminPassword().trim().length >= 12,
    ),
  );
  protected readonly canUpdateSelectedOrganization = computed(() =>
    Boolean(
      !this.savingOrganization() &&
        this.selectedSummary() &&
        this.editOrganizationCode().trim() &&
        this.editOrganizationLegalName().trim(),
    ),
  );

  ngOnInit() {
    this.loadPlatform();
  }

  protected selectOrganization(idOrganization: string) {
    this.selectedOrganizationId.set(idOrganization);
    const organization = this.organizations().find((item) => item.idOrganization === idOrganization);
    if (organization) {
      this.syncOrganizationEditor(organization);
    }
    this.success.set('');
    this.error.set('');
  }

  protected activeLabel(active: boolean) {
    return active ? 'Activo' : 'Inactivo';
  }

  protected organizationUsers(summary: OrganizationPlatformSummary) {
    const organizationId = summary.organization.idOrganization;
    return this.users().filter((user) =>
      user.organizations.some((organization) => organization.idOrganization === organizationId),
    );
  }

  protected organizationAdmins(summary: OrganizationPlatformSummary) {
    return this.organizationUsers(summary).filter((user) =>
      user.roles.some((role) => role.idOrganization === summary.organization.idOrganization && this.isAdminRole(role.codeRole, role.name)),
    );
  }

  protected topClients(summary: OrganizationPlatformSummary) {
    return summary.clients.slice(0, 4);
  }

  protected createOrganizationWithAdmin() {
    if (!this.canCreateOrganization()) {
      return;
    }

    this.savingOrganization.set(true);
    this.error.set('');
    this.success.set('');

    this.clientApi
      .createOrganizationWithAdmin({
        codeOrganization: this.newOrganizationCode().trim(),
        legalName: this.newOrganizationLegalName().trim(),
        rfc: this.normalizeOptional(this.newOrganizationRfc()),
        admin: {
          displayName: this.initialAdminName().trim(),
          email: this.initialAdminEmail().trim(),
          password: this.initialAdminPassword(),
        },
      })
      .subscribe({
        next: (result) => {
          this.selectedOrganizationId.set(result.organization.idOrganization);
          this.clearOrganizationForm();
          this.organizationStep.set(1);
          this.success.set('Organización creada con su admin inicial.');
          this.loadPlatform();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(this.extractError(error));
          this.savingOrganization.set(false);
        },
      });
  }

  protected submitOrganizationStep(form: NgForm) {
    this.organizationStepError.set('');
    if (this.organizationStep() < 3) {
      form.control.markAllAsTouched();
      if (form.invalid || (this.organizationStep() === 1 && (!this.newOrganizationCode().trim() || !this.newOrganizationLegalName().trim())) ||
        (this.organizationStep() === 2 && !this.initialAdminReady())) {
        this.organizationStepError.set('Revisa los campos obligatorios y su formato antes de continuar.');
        return;
      }
      this.organizationStep.update(step => step + 1);
      return;
    }
    this.createOrganizationWithAdmin();
  }

  protected cancelOrganizationCreation() {
    if (this.savingOrganization()) { return; }
    this.clearOrganizationForm();
    this.organizationStep.set(1);
    this.organizationStepError.set('');
  }

  protected createAdminForSelected() {
    const summary = this.selectedSummary();
    const role = this.adminRole();

    if (!summary || !role || !this.canCreateAdminForSelected()) {
      return;
    }

    this.savingAdmin.set(true);
    this.error.set('');
    this.success.set('');

    this.securityApi
      .createUser({
        email: this.selectedAdminEmail().trim(),
        displayName: this.selectedAdminName().trim(),
        password: this.selectedAdminPassword(),
        idOrganization: summary.organization.idOrganization,
        membershipLabel: 'Admin de organización',
        idRole: role.idRole,
      })
      .subscribe({
        next: () => {
          this.clearSelectedAdminForm();
          this.success.set(`Admin creado para ${summary.organization.legalName}.`);
          this.loadPlatform();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(this.extractError(error));
          this.savingAdmin.set(false);
        },
      });
  }

  protected updateSelectedOrganization() {
    const summary = this.selectedSummary();
    if (!summary || !this.canUpdateSelectedOrganization()) {
      return;
    }

    this.savingOrganization.set(true);
    this.error.set('');
    this.success.set('');

    this.clientApi
      .updateOrganization(summary.organization.idOrganization, {
        codeOrganization: this.editOrganizationCode().trim(),
        legalName: this.editOrganizationLegalName().trim(),
        rfc: this.normalizeOptional(this.editOrganizationRfc()),
      })
      .subscribe({
        next: (organization) => {
          this.selectedOrganizationId.set(organization.idOrganization);
          this.success.set('Organización actualizada correctamente.');
          this.loadPlatform();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(this.extractError(error));
          this.savingOrganization.set(false);
        },
      });
  }

  protected toggleSelectedOrganizationStatus() {
    const summary = this.selectedSummary();
    if (!summary) {
      return;
    }

    this.savingOrganization.set(true);
    this.error.set('');
    this.success.set('');

    const onSuccess = () => {
      this.success.set(summary.organization.active ? 'Organización desactivada.' : 'Organización reactivada.');
      this.loadPlatform();
    };
    const onError = (error: HttpErrorResponse) => {
      this.error.set(this.extractError(error));
      this.savingOrganization.set(false);
    };

    if (summary.organization.active) {
      this.clientApi.deactivateOrganization(summary.organization.idOrganization).subscribe({
        next: onSuccess,
        error: onError,
      });
      return;
    }

    this.clientApi.activateOrganization(summary.organization.idOrganization).subscribe({
      next: () => {
        onSuccess();
      },
      error: onError,
    });
  }

  private loadPlatform() {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      organizations: this.clientApi.listOrganizations(),
      governance: this.clientApi.listOrganizationGovernance(),
      users: this.securityApi.listUsers(),
      roles: this.securityApi.listRoles(),
    }).subscribe({
      next: ({ organizations, governance, users, roles }) => {
        this.organizations.set(organizations);
        this.users.set(users);
        this.roles.set(roles);
        this.selectedOrganizationId.set(this.selectedOrganizationId() || organizations[0]?.idOrganization || '');
        const selectedOrganization = organizations.find((organization) => organization.idOrganization === this.selectedOrganizationId()) ?? organizations[0];
        if (selectedOrganization) {
          this.syncOrganizationEditor(selectedOrganization);
        }
        this.summaries.set(governance);
        this.loading.set(false);
        this.savingOrganization.set(false);
        this.savingAdmin.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.detail ?? 'No se pudo cargar la información de organizaciones.');
        this.loading.set(false);
        this.savingOrganization.set(false);
        this.savingAdmin.set(false);
      },
    });
  }

  private clearOrganizationForm() {
    this.newOrganizationCode.set('');
    this.newOrganizationLegalName.set('');
    this.newOrganizationRfc.set('');
    this.initialAdminName.set('');
    this.initialAdminEmail.set('');
    this.initialAdminPassword.set('');
  }

  private clearSelectedAdminForm() {
    this.selectedAdminName.set('');
    this.selectedAdminEmail.set('');
    this.selectedAdminPassword.set('');
  }

  private syncOrganizationEditor(organization: Organization) {
    this.editOrganizationCode.set(organization.codeOrganization);
    this.editOrganizationLegalName.set(organization.legalName);
    this.editOrganizationRfc.set(organization.rfc ?? '');
  }

  private normalizeOptional(value: string) {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private extractError(error: HttpErrorResponse) {
    if (error.error?.message) {
      return error.error.message;
    }

    if (error.error?.detail) {
      return error.error.detail;
    }

    if (error.error?.errors) {
      const first = Object.values(error.error.errors).flat().find(Boolean);
      if (typeof first === 'string') {
        return first;
      }
    }

    return 'No se pudo completar la acción.';
  }

  private isAdminRole(codeRole: string, name: string) {
    return /admin|administrador|super/i.test(`${codeRole} ${name}`);
  }

}
