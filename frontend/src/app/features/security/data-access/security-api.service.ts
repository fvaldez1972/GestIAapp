import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AssignSecurityUserAccess,
  CreateSecurityUser,
  CreateSecurityRole,
  ResetSecurityUserPassword,
  SecurityPermission,
  SecurityRole,
  SecurityUser,
} from './security.models';

@Injectable({ providedIn: 'root' })
export class SecurityApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/security';

  listUsers() {
    return this.http.get<readonly SecurityUser[]>(`${this.baseUrl}/users`);
  }

  listRoles() {
    return this.http.get<readonly SecurityRole[]>(`${this.baseUrl}/roles`);
  }

  listPermissions() {
    return this.http.get<readonly SecurityPermission[]>(`${this.baseUrl}/permissions`);
  }

  createRole(request: CreateSecurityRole) {
    return this.http.post<SecurityRole>(`${this.baseUrl}/roles`, request);
  }

  deactivateRole(idRole: string) {
    return this.http.delete<void>(`${this.baseUrl}/roles/${idRole}`);
  }

  createUser(request: CreateSecurityUser) {
    return this.http.post<SecurityUser>(`${this.baseUrl}/users`, request);
  }

  assignUserAccess(idUser: string, request: AssignSecurityUserAccess) {
    return this.http.patch<SecurityUser>(`${this.baseUrl}/users/${idUser}/access`, request);
  }

  resetUserPassword(idUser: string, request: ResetSecurityUserPassword) {
    return this.http.patch<void>(`${this.baseUrl}/users/${idUser}/password`, request);
  }

  deactivateUser(idUser: string) {
    return this.http.delete<void>(`${this.baseUrl}/users/${idUser}`);
  }
}
