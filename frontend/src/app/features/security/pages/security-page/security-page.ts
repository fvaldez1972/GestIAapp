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
  protected readonly selectedRoleId = signal('');
  protected readonly selectedPermissionCodes = signal<readonly string[]>([]);

  protected readonly canAdministerSecurity = computed(() => this.auth.hasPermission('PLATFORM.ADMIN'));
  protected readonly selectedUser = computed(
    () => this.users().find((user) => user.idUser === this.selectedUserId()) ?? null,
  );
  protected readonly selectedRole = computed(
    () => this.roles().find((role) => role.idRole === this.selectedRoleId()) ?? null,
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

  protected readonly editUserForm = this.formBuilder.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
  });

  protected readonly passwordForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]],
  });

  protected readonly roleForm = this.formBuilder.nonNullable.group({
    codeRole: ['', [Validators.required, Validators.maxLength(60)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    idOrganization: [''],
  });

  protected readonly editRoleForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
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
        this.selectedRoleId.set(this.selectedRoleId() || roles.find((role) => !role.isSystem)?.idRole || '');
        this.resetDefaults();
        this.syncSelectedEditors();
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
    this.editUserForm.reset({
      displayName: user.displayName,
      email: user.email,
    });
  }

  protected selectRole(role: SecurityRole) {
    this.selectedRoleId.set(role.idRole);
    this.editRoleForm.reset({ name: role.name });
    this.selectedPermissionCodes.set(role.permissions.map((permission) => permission.codePermission));
  }

  protected updateUser() {
    const user = this.selectedUser();

    if (!user || this.editUserForm.invalid) {
      this.editUserForm.markAllAsTouched();
      return;
    }

    const form = this.editUserForm.getRawValue();
    this.beginSave();

    this.api
      .updateUser(user.idUser, {
        displayName: form.displayName.trim(),
        email: form.email.trim(),
      })
      .subscribe({
        next: () => {
          this.message.set('Usuario actualizado correctamente.');
          this.loadSecurity();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo actualizar el usuario.'),
        complete: () => this.saving.set(false),
      });
  }

  protected createUser() {
    if (this.createUserForm.invalid) {
      this.createUserForm.markAllAsTouched();
      return;
    }

    const form = this.createUserForm.getRawValue();
    if (
      this.selectedAccessRoleIsSensitive(form.idRole) &&
      !window.confirm('El rol seleccionado permite administrar usuarios, roles y permisos. ¿Deseas continuar?')
    ) {
      return;
    }

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
    if (
      this.selectedAccessRoleIsSensitive(form.idRole) &&
      !window.confirm('Este acceso dará administración completa de seguridad. ¿Deseas continuar?')
    ) {
      return;
    }

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

    if (!window.confirm(`¿Actualizar la contraseña de ${user.displayName}?`)) {
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
    if (!window.confirm(`¿Desactivar el usuario ${user.displayName}?`)) {
      return;
    }

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

  protected activateUser(user: SecurityUser) {
    if (!window.confirm(`¿Reactivar el usuario ${user.displayName}?`)) {
      return;
    }

    this.beginSave();

    this.api.activateUser(user.idUser).subscribe({
      next: () => {
        this.message.set('Usuario reactivado correctamente.');
        this.selectedUserId.set(user.idUser);
        this.loadSecurity();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo reactivar el usuario.'),
      complete: () => this.saving.set(false),
    });
  }

  protected removeUserAccess(role: SecurityUser['roles'][number]) {
    const user = this.selectedUser();

    if (!user || !role.idOrganization) {
      return;
    }

    if (!window.confirm(`¿Remover el rol ${role.name} de ${user.displayName}?`)) {
      return;
    }

    this.beginSave();

    this.api.removeUserAccess(user.idUser, role.idOrganization, role.idRole).subscribe({
      next: () => {
        this.message.set('Acceso removido correctamente.');
        this.loadSecurity();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo remover el acceso.'),
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

  protected passwordGuidance(value: string) {
    const checks = [
      value.length >= 12,
      /[A-ZÁÉÍÓÚÑ]/.test(value),
      /[a-záéíóúñ]/.test(value),
      /\d/.test(value),
      /[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(value),
    ];
    const passed = checks.filter(Boolean).length;

    if (!value) {
      return 'Usa al menos 12 caracteres combinando mayúsculas, minúsculas, números y símbolo.';
    }

    if (passed >= 5) {
      return 'Contraseña temporal fuerte.';
    }

    if (passed >= 3) {
      return 'Contraseña aceptable; agrega variedad para hacerla más segura.';
    }

    return 'Contraseña débil; conviene reforzarla antes de guardar.';
  }

  protected selectedAccessRoleIsSensitive(formRoleId: string) {
    const role = this.roles().find((item) => item.idRole === formRoleId);
    return Boolean(role?.permissions.some((permission) => permission.codePermission === 'PLATFORM.ADMIN'));
  }

  protected roleCodeLabel(codeRole: string) {
    return codeRole
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  protected permissionModuleLabel(module: string) {
    const labels: Record<string, string> = {
      Audit: 'Auditoría',
      Catalogs: 'Catálogos',
      Clients: 'Clientes',
      Documents: 'Documentos',
      Operations: 'Operación',
      Organizations: 'Organizaciones',
      Planning: 'Planeación',
      Platform: 'Plataforma',
      Reports: 'Reportes',
      Requests: 'Solicitudes',
      Workforce: 'Personal',
    };

    return labels[module] ?? module;
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
    if (
      this.selectedPermissionCodes().includes('PLATFORM.ADMIN') &&
      !window.confirm('El rol tendrá administración completa de seguridad. ¿Deseas crearlo con ese permiso?')
    ) {
      return;
    }

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

  protected updateRole() {
    const role = this.selectedRole();

    if (!role || role.isSystem || this.editRoleForm.invalid || this.selectedPermissionCodes().length === 0) {
      this.editRoleForm.markAllAsTouched();
      if (this.selectedPermissionCodes().length === 0) {
        this.error.set('Selecciona al menos un permiso para actualizar el rol.');
      }
      return;
    }

    if (
      this.selectedPermissionCodes().includes('PLATFORM.ADMIN') &&
      !window.confirm('El rol quedará con administración completa de seguridad. ¿Deseas guardar estos permisos?')
    ) {
      return;
    }

    this.beginSave();

    this.api
      .updateRole(role.idRole, {
        name: this.editRoleForm.getRawValue().name.trim(),
        permissionCodes: this.selectedPermissionCodes(),
      })
      .subscribe({
        next: () => {
          this.message.set('Rol actualizado correctamente.');
          this.loadSecurity();
        },
        error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo actualizar el rol.'),
        complete: () => this.saving.set(false),
      });
  }

  protected deactivateRole(role: SecurityRole) {
    if (!window.confirm(`¿Desactivar el rol ${role.name}?`)) {
      return;
    }

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

  protected activateRole(role: SecurityRole) {
    if (!window.confirm(`¿Reactivar el rol ${role.name}?`)) {
      return;
    }

    this.beginSave();

    this.api.activateRole(role.idRole).subscribe({
      next: () => {
        this.message.set('Rol reactivado correctamente.');
        this.selectedRoleId.set(role.idRole);
        this.loadSecurity();
      },
      error: (error: HttpErrorResponse) => this.setError(error, 'No se pudo reactivar el rol.'),
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

  private syncSelectedEditors() {
    const selectedUser = this.selectedUser();
    if (selectedUser) {
      this.editUserForm.reset({
        displayName: selectedUser.displayName,
        email: selectedUser.email,
      });
    }

    const selectedRole = this.selectedRole();
    if (selectedRole) {
      this.editRoleForm.reset({ name: selectedRole.name });
      this.selectedPermissionCodes.set(selectedRole.permissions.map((permission) => permission.codePermission));
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
