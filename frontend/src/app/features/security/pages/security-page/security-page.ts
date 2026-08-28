import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { Organization } from '../../../clients/data-access/client.models';
import { SecurityApiService } from '../../data-access/security-api.service';
import { SecurityPermission, SecurityRole, SecurityUser } from '../../data-access/security.models';

type PermissionGroup = {
  readonly module: string;
  readonly permissions: readonly SecurityPermission[];
};

@Component({
  selector: 'app-security-page',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './security-page.html',
  styleUrl: './security-page.scss',
})
export class SecurityPage implements OnInit {
  private readonly api = inject(SecurityApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly users = signal<readonly SecurityUser[]>([]);
  protected readonly roles = signal<readonly SecurityRole[]>([]);
  protected readonly permissions = signal<readonly SecurityPermission[]>([]);
  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly selectedUserId = signal('');
  protected readonly selectedPermissionCodes = signal<readonly string[]>([]);

  protected readonly canAdministerSecurity = computed(() => this.auth.hasPermission('PLATFORM.ADMIN'));
  protected readonly selectedUser = computed(
    () => this.users().find((user) => user.idUser === this.selectedUserId()) ?? null,
  );
  protected readonly systemRoles = computed(() => this.roles().filter((role) => role.isSystem).length);
  protected readonly permissionGroups = computed<readonly PermissionGroup[]>(() => {
    const groups = new Map<string, SecurityPermission[]>();

    for (const permission of this.permissions()) {
      const modulePermissions = groups.get(permission.module) ?? [];
      modulePermissions.push(permission);
      groups.set(permission.module, modulePermissions);
    }

    return Array.from(groups.entries())
      .map(([module, permissions]) => ({ module, permissions }))
      .sort((first, second) => first.module.localeCompare(second.module));
  });

  protected readonly createUserForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]],
    idOrganization: ['', [Validators.required]],
    membershipLabel: ['Acceso operativo'],
    idRole: ['', [Validators.required]],
  });

  protected readonly accessForm = this.formBuilder.nonNullable.group({
    idOrganization: ['', [Validators.required]],
    membershipLabel: ['Acceso operativo'],
    idRole: ['', [Validators.required]],
  });

  protected readonly passwordForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]],
  });

  protected readonly roleForm = this.formBuilder.nonNullable.group({
    codeRole: ['', [Validators.required, Validators.maxLength(60)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    idOrganization: [''],
  });

  ngOnInit() {
    if (this.canAdministerSecurity()) {
      this.loadSecurity();
    }
  }

  protected loadSecurity() {
    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    forkJoin({
      users: this.api.listUsers(),
      roles: this.api.listRoles(),
      permissions: this.api.listPermissions(),
      organizations: this.clientApi.listOrganizations(),
    }).subscribe({
      next: ({ users, roles, permissions, organizations }) => {
        this.users.set(users);
        this.roles.set(roles);
        this.permissions.set(permissions);
        this.organizations.set(organizations);
        this.selectedUserId.set(this.selectedUserId() || users[0]?.idUser || '');
        this.resetDefaults();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la información de seguridad. Intenta nuevamente.');
        this.loading.set(false);
      },
    });
  }

  protected selectUser(user: SecurityUser) {
    this.selectedUserId.set(user.idUser);
  }

  protected createUser() {
    if (this.createUserForm.invalid) {
      this.createUserForm.markAllAsTouched();
      return;
    }

    const form = this.createUserForm.getRawValue();
    this.beginSave();

    this.api
      .createUser({
        email: form.email.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        idOrganization: form.idOrganization,
        membershipLabel: this.emptyToNull(form.membershipLabel),
        idRole: form.idRole,
      })
      .subscribe({
        next: (user) => {
          this.message.set('Usuario creado correctamente.');
          this.selectedUserId.set(user.idUser);
          this.createUserForm.patchValue({ email: '', displayName: '', password: '' });
          this.loadSecurity();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo crear el usuario.'),
        complete: () => this.saving.set(false),
      });
  }

  protected assignAccess() {
    const user = this.selectedUser();

    if (!user || this.accessForm.invalid) {
      this.accessForm.markAllAsTouched();
      return;
    }

    const form = this.accessForm.getRawValue();
    this.beginSave();

    this.api
      .assignUserAccess(user.idUser, {
        idOrganization: form.idOrganization,
        membershipLabel: this.emptyToNull(form.membershipLabel),
        idRole: form.idRole,
      })
      .subscribe({
        next: () => {
          this.message.set('Acceso asignado correctamente.');
          this.loadSecurity();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo asignar el acceso.'),
        complete: () => this.saving.set(false),
      });
  }

  protected resetPassword() {
    const user = this.selectedUser();

    if (!user || this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.beginSave();

    this.api
      .resetUserPassword(user.idUser, { password: this.passwordForm.getRawValue().password })
      .subscribe({
        next: () => {
          this.message.set('Contraseña actualizada correctamente.');
          this.passwordForm.reset({ password: '' });
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo actualizar la contraseña.'),
        complete: () => this.saving.set(false),
      });
  }

  protected deactivateUser(user: SecurityUser) {
    this.beginSave();

    this.api.deactivateUser(user.idUser).subscribe({
      next: () => {
        this.message.set('Usuario desactivado correctamente.');
        this.selectedUserId.set('');
        this.loadSecurity();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo desactivar el usuario.'),
      complete: () => this.saving.set(false),
    });
  }

  protected togglePermission(codePermission: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.selectedPermissionCodes();

    this.selectedPermissionCodes.set(
      checked
        ? Array.from(new Set([...current, codePermission]))
        : current.filter((permission) => permission !== codePermission),
    );
  }

  protected isPermissionSelected(codePermission: string) {
    return this.selectedPermissionCodes().includes(codePermission);
  }

  protected createRole() {
    if (this.roleForm.invalid || this.selectedPermissionCodes().length === 0) {
      this.roleForm.markAllAsTouched();
      if (this.selectedPermissionCodes().length === 0) {
        this.error.set('Selecciona al menos un permiso para crear el rol.');
      }
      return;
    }

    const form = this.roleForm.getRawValue();
    this.beginSave();

    this.api
      .createRole({
        codeRole: form.codeRole.trim(),
        name: form.name.trim(),
        idOrganization: this.emptyToNull(form.idOrganization),
        permissionCodes: this.selectedPermissionCodes(),
      })
      .subscribe({
        next: () => {
          this.message.set('Rol creado correctamente.');
          this.roleForm.reset({ codeRole: '', name: '', idOrganization: '' });
          this.selectedPermissionCodes.set([]);
          this.loadSecurity();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo crear el rol.'),
        complete: () => this.saving.set(false),
      });
  }

  protected deactivateRole(role: SecurityRole) {
    this.beginSave();

    this.api.deactivateRole(role.idRole).subscribe({
      next: () => {
        this.message.set('Rol desactivado correctamente.');
        this.loadSecurity();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo desactivar el rol.'),
      complete: () => this.saving.set(false),
    });
  }

  private beginSave() {
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
  }

  private resetDefaults() {
    const organizationId = this.organizations()[0]?.idOrganization ?? '';
    const roleId = this.roles()[0]?.idRole ?? '';

    if (!this.createUserForm.getRawValue().idOrganization) {
      this.createUserForm.patchValue({ idOrganization: organizationId, idRole: roleId });
    }

    if (!this.accessForm.getRawValue().idOrganization) {
      this.accessForm.patchValue({ idOrganization: organizationId, idRole: roleId });
    }
  }

  private setError(error: HttpErrorResponse, fallback: string) {
    this.loading.set(false);
    this.saving.set(false);
    this.error.set(error.error?.detail ?? error.error?.message ?? fallback);
  }

  private emptyToNull(value: string) {
    const cleanValue = value.trim();
    return cleanValue.length > 0 ? cleanValue : null;
  }
}
