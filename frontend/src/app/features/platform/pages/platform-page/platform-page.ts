import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Organization, OrganizationClientSummary } from '../../../clients/data-access/client.models';
import { SecurityApiService } from '../../../security/data-access/security-api.service';
import { ServerProblem, fieldError, readServerProblem } from '../../../../shared/util/server-problem';
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

  /** El detalle por campo del último rechazo, para pintarlo junto al campo que falló. */
  protected readonly problem = signal<ServerProblem | null>(null);

  protected errorDe(campo: string): string {
    const problema = this.problem();
    return problema ? fieldError(problema, campo) : '';
  }
  protected readonly success = signal('');
  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly users = signal<readonly SecurityUser[]>([]);
  protected readonly roles = signal<readonly SecurityRole[]>([]);
  protected readonly summaries = signal<readonly OrganizationPlatformSummary[]>([]);
  /**
   * Qué fila de la tabla está abierta. **No es el contexto de trabajo**, que vive en la barra de
   * contexto: esta pantalla administra organizaciones desde fuera de todas ellas. Se llamaba
   * `selectedOrganizationId`, igual que la copia que tenían las demás pantallas, y por eso se
   * confundía con ella al leer el código.
   */
  protected readonly selectedOrganizationRowId = signal('');

  /**
   * Si el alta esta abierta.
   *
   * <p>El formulario ocupaba media pantalla siempre, abierto sobre el directorio, y competia por
   * la atencion con la organizacion que se estaba revisando. Dar de alta una empresa es algo que
   * pasa de vez en cuando; leer el directorio es a lo que se entra.</p>
   */
  protected readonly creatingOrganization = signal(false);

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
    () => this.summaries().find((summary) => summary.organization.idOrganization === this.selectedOrganizationRowId()) ?? this.summaries()[0] ?? null,
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
    this.selectedOrganizationRowId.set(idOrganization);
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
        // Sin codigo a proposito: lo genera el servidor con la forma ORG-01. Mandar cadena vacia
        // no seria lo mismo —el servidor la validaria como capturada y la rechazaria—, asi que se
        // omite el campo entero.
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
          this.selectedOrganizationRowId.set(result.organization.idOrganization);
          this.clearOrganizationForm();
          this.organizationStep.set(1);
          this.creatingOrganization.set(false);
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
      if (form.invalid || (this.organizationStep() === 1 && !this.newOrganizationLegalName().trim()) ||
        (this.organizationStep() === 2 && !this.initialAdminReady())) {
        this.organizationStepError.set('Revisa los campos obligatorios y su formato antes de continuar.');
        return;
      }
      this.organizationStep.update(step => step + 1);
      return;
    }
    this.createOrganizationWithAdmin();
  }

  /** Abre el alta en el primer paso y sin arrastrar lo que quedo de un intento anterior. */
  protected startOrganizationCreation() {
    this.clearOrganizationForm();
    this.organizationStep.set(1);
    this.organizationStepError.set('');
    this.creatingOrganization.set(true);
  }

  protected cancelOrganizationCreation() {
    if (this.savingOrganization()) { return; }
    this.clearOrganizationForm();
    this.organizationStep.set(1);
    this.organizationStepError.set('');
    this.creatingOrganization.set(false);
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
          this.selectedOrganizationRowId.set(organization.idOrganization);
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
        this.selectedOrganizationRowId.set(this.selectedOrganizationRowId() || organizations[0]?.idOrganization || '');
        const selectedOrganization = organizations.find((organization) => organization.idOrganization === this.selectedOrganizationRowId()) ?? organizations[0];
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

  /**
   * Lo que el servidor dijo, leído en el orden correcto.
   *
   * <p>Esta pantalla ya tenía el código para leer el detalle por campo, pero <b>detrás</b> de
   * `detail`. Como en una validación `detail` siempre trae «La solicitud contiene datos
   * inválidos.», la rama buena no se alcanzaba nunca: no faltaba código, sobraba una comprobación
   * por delante. El extractor compartido pone lo específico primero.</p>
   */
  private extractError(error: HttpErrorResponse) {
    const problema = readServerProblem(error, 'No se pudo completar la acción.');
    this.problem.set(problema);
    return problema.message;
  }

  private isAdminRole(codeRole: string, name: string) {
    return /admin|administrador|super/i.test(`${codeRole} ${name}`);
  }

}
