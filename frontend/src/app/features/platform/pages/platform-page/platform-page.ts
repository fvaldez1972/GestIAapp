import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
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

  /**
   * Que se esta mirando de la organizacion elegida.
   *
   * <p>La ficha apilaba cinco bloques en una columna: los datos editables, el alta de un admin, la
   * lista de admins, la lista de clientes y una nota. Lo que se <b>crea</b> y lo que se
   * <b>consulta</b> quedaban mezclados en el mismo desplazamiento, y para leer quien es el
   * responsable habia que pasar por encima de un formulario vacio.</p>
   *
   * <p>Hubo una tercera, «Datos», que enseñaba el nombre y el RFC: los mismos dos datos que el
   * titulo y el subtitulo de la ficha ya dicen, a dos centimetros. Editarlos se pide desde la
   * cabecera, junto a las demas acciones.</p>
   */
  protected readonly detailTab = signal<'responsables' | 'clientes'>('responsables');

  /** Si el alta de admin esta abierta. Cerrada por omision, como la de organizacion. */
  protected readonly creatingAdmin = signal(false);

  /**
   * Si la edicion de la organizacion esta abierta.
   *
   * <p>La pestaña Datos <b>enseña</b>; editar es otra cosa y se pide aparte. Antes los tres campos
   * eran cajas de texto siempre listas para escribir, asi que consultar el RFC de una organizacion
   * y cambiarlo se veian igual, y no habia forma de leer sin tener el cursor a un clic de
   * modificar.</p>
   *
   * <p>Se abre en ventana, como las dos altas: en esta pantalla los formularios no se incrustan.</p>
   */
  protected readonly editingOrganization = signal(false);

  /**
   * Si al guardar la organizacion debe quedar desactivada.
   *
   * <p>La baja era un boton suelto que se aplicaba solo, al margen del formulario. Dentro del
   * formulario se ve en que estado va a quedar antes de confirmar, y se deshace cerrando sin
   * guardar, que es lo que un boton suelto no permitia.</p>
   */
  protected readonly editOrganizationInactive = signal(false);

  protected readonly selectedAdminName = signal('');
  protected readonly selectedAdminEmail = signal('');
  protected readonly selectedAdminPassword = signal('');
  protected readonly editOrganizationLegalName = signal('');
  protected readonly editOrganizationRfc = signal('');

  protected readonly selectedSummary = computed(
    () => this.summaries().find((summary) => summary.organization.idOrganization === this.selectedOrganizationRowId()) ?? this.summaries()[0] ?? null,
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

  /** Abre la edicion con los valores que hay hoy, no con lo que quedo de un intento anterior. */
  protected startOrganizationEdit() {
    const summary = this.selectedSummary();

    if (!summary) {
      return;
    }

    this.syncOrganizationEditor(summary.organization);
    this.editOrganizationInactive.set(!summary.organization.active);
    this.editingOrganization.set(true);
  }

  protected cancelOrganizationEdit() {
    if (this.savingOrganization()) { return; }
    this.editingOrganization.set(false);
  }

  /** Abre el alta de admin de la organizacion elegida, sin arrastrar un intento anterior. */
  protected startAdminCreation() {
    this.clearSelectedAdminForm();
    this.creatingAdmin.set(true);
  }

  protected cancelAdminCreation() {
    if (this.savingAdmin()) { return; }
    this.clearSelectedAdminForm();
    this.creatingAdmin.set(false);
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
          this.creatingAdmin.set(false);
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

    const idOrganization = summary.organization.idOrganization;
    const debeQuedarActiva = !this.editOrganizationInactive();
    const cambiaElEstado = debeQuedarActiva !== summary.organization.active;

    this.clientApi
      .updateOrganization(idOrganization, {
        // Sin codigo: el servidor conserva el que ya tiene. No se captura ni se corrige desde
        // aqui, asi que mandarlo solo abriria la puerta a cambiarlo sin querer al guardar.
        legalName: this.editOrganizationLegalName().trim(),
        rfc: this.normalizeOptional(this.editOrganizationRfc()),
      })
      .pipe(
        // El estado va en la misma peticion de guardar sólo si cambio. El alta y la baja son
        // endpoints aparte, asi que se encadenan; mandarlos siempre dejaria en la auditoria un
        // cambio de estado cada vez que alguien corrige una letra del nombre.
        switchMap(() =>
          cambiaElEstado
            ? debeQuedarActiva
              ? this.clientApi.activateOrganization(idOrganization)
              : this.clientApi.deactivateOrganization(idOrganization)
            : of(null),
        ),
      )
      .subscribe({
        next: () => {
          this.selectedOrganizationRowId.set(idOrganization);
          this.editingOrganization.set(false);
          this.success.set(
            cambiaElEstado
              ? debeQuedarActiva
                ? 'Organización actualizada y reactivada.'
                : 'Organización actualizada y desactivada.'
              : 'Organización actualizada correctamente.',
          );
          this.loadPlatform();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(this.extractError(error));
          this.savingOrganization.set(false);
        },
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
