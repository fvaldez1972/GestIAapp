import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import {
  AssignSecurityUserAccess,
  CreateSecurityUser,
  CreateSecurityRole,
  ResetSecurityUserPassword,
  SecurityPermission,
  SecurityRole,
  SecurityUser,
  UpdateSecurityRole,
  UpdateSecurityUser,
} from './security.models';

@Injectable({ providedIn: 'root' })
export class SecurityApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly platformBaseUrl = '/api/v1/security';
  private readonly organizationBaseUrl = '/api/v1/organization-security';

  listUsers() {
    if (this.isPlatformAdmin()) {
      return this.http.get<readonly SecurityUser[]>(`${this.platformBaseUrl}/users`);
    }

    return this.http.get<readonly SecurityUser[]>(`${this.organizationBaseUrl}/users`, {
      params: this.organizationParams(),
    });
  }

  listRoles() {
    if (this.isPlatformAdmin()) {
      return this.http.get<readonly SecurityRole[]>(`${this.platformBaseUrl}/roles`);
    }

    return this.http.get<readonly SecurityRole[]>(`${this.organizationBaseUrl}/roles`, {
      params: this.organizationParams(),
    });
  }

  listPermissions() {
    if (this.isPlatformAdmin()) {
      return this.http.get<readonly SecurityPermission[]>(`${this.platformBaseUrl}/permissions`);
    }

    return this.http.get<readonly SecurityPermission[]>(`${this.organizationBaseUrl}/permissions`, {
      params: this.organizationParams(),
    });
  }

  createRole(request: CreateSecurityRole) {
    return this.http.post<SecurityRole>(`${this.platformBaseUrl}/roles`, request);
  }

  updateRole(idRole: string, request: UpdateSecurityRole) {
    return this.http.put<SecurityRole>(`${this.platformBaseUrl}/roles/${idRole}`, request);
  }

  deactivateRole(idRole: string) {
    return this.http.delete<void>(`${this.platformBaseUrl}/roles/${idRole}`);
  }

  activateRole(idRole: string) {
    return this.http.patch<SecurityRole>(`${this.platformBaseUrl}/roles/${idRole}/activate`, {});
  }

  createUser(request: CreateSecurityUser) {
    return this.http.post<SecurityUser>(`${this.userBaseUrl()}/users`, request);
  }

  updateUser(idUser: string, request: UpdateSecurityUser) {
    return this.http.put<SecurityUser>(`${this.userBaseUrl()}/users/${idUser}`, request, {
      params: this.userActionParams(),
    });
  }

  assignUserAccess(idUser: string, request: AssignSecurityUserAccess) {
    return this.http.patch<SecurityUser>(`${this.userBaseUrl()}/users/${idUser}/access`, request);
  }

  removeUserAccess(idUser: string, organizationId: string, roleId: string) {
    return this.http.delete<SecurityUser>(
      `${this.userBaseUrl()}/users/${idUser}/access?organizationId=${organizationId}&roleId=${roleId}`,
    );
  }

  resetUserPassword(idUser: string, request: ResetSecurityUserPassword) {
    return this.http.patch<void>(`${this.userBaseUrl()}/users/${idUser}/password`, request, {
      params: this.userActionParams(),
    });
  }

  deactivateUser(idUser: string) {
    return this.http.delete<void>(`${this.userBaseUrl()}/users/${idUser}`, {
      params: this.userActionParams(),
    });
  }

  activateUser(idUser: string) {
    return this.http.patch<SecurityUser>(`${this.userBaseUrl()}/users/${idUser}/activate`, {}, {
      params: this.userActionParams(),
    });
  }

  private userBaseUrl() {
    return this.isPlatformAdmin() ? this.platformBaseUrl : this.organizationBaseUrl;
  }

  private isPlatformAdmin() {
    return this.auth.hasPermission('PLATFORM.ADMIN');
  }

  private userActionParams() {
    return this.isPlatformAdmin() ? undefined : this.organizationParams();
  }

  private organizationParams() {
    return new HttpParams().set('organizationId', this.auth.activeOrganizationId());
  }
}
