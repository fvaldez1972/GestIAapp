import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { AuthSession, LoginRequest } from './auth.models';

const storageKey = 'gestia.auth.session';
const activeOrganizationStorageKey = 'gestia.auth.activeOrganizationId';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<AuthSession | null>(loadSession());

  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => {
    const session = this.sessionState();
    return !!session && new Date(session.expiresAt).getTime() > Date.now();
  });
  readonly displayName = computed(() => this.sessionState()?.user.displayName ?? '');
  readonly organizations = computed(() => this.sessionState()?.organizations ?? []);
  readonly activeOrganizationId = signal(loadActiveOrganizationId());
  readonly activeOrganization = computed(() => {
    const selectedId = this.activeOrganizationId();
    const organizations = this.organizations();
    return organizations.find((organization) => organization.idOrganization === selectedId) ?? organizations[0] ?? null;
  });

  login(request: LoginRequest) {
    return this.http.post<AuthSession>('/api/v1/auth/login', request).pipe(
      tap((session) => this.storeSession(session)),
    );
  }

  logout() {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(activeOrganizationStorageKey);
    this.sessionState.set(null);
    this.activeOrganizationId.set('');
  }

  accessToken() {
    const session = this.sessionState();

    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
      this.logout();
      return null;
    }

    return session.accessToken;
  }

  hasPermission(permission: string) {
    const session = this.sessionState();
    return !!session && (session.permissions.includes(permission) || session.permissions.includes('PLATFORM.ADMIN'));
  }

  setActiveOrganization(idOrganization: string) {
    const exists = this.organizations().some((organization) => organization.idOrganization === idOrganization);

    if (!exists) {
      return;
    }

    localStorage.setItem(activeOrganizationStorageKey, idOrganization);
    this.activeOrganizationId.set(idOrganization);
  }

  private storeSession(session: AuthSession) {
    localStorage.setItem(storageKey, JSON.stringify(session));
    const currentOrganizationId = this.activeOrganizationId();
    const activeOrganizationId = session.organizations.some((organization) => organization.idOrganization === currentOrganizationId)
      ? currentOrganizationId
      : session.organizations[0]?.idOrganization ?? '';

    if (activeOrganizationId) {
      localStorage.setItem(activeOrganizationStorageKey, activeOrganizationId);
    }

    this.activeOrganizationId.set(activeOrganizationId);
    this.sessionState.set(session);
  }
}

function loadSession(): AuthSession | null {
  const value = localStorage.getItem(storageKey);

  if (!value) {
    return null;
  }

  try {
    const session = JSON.parse(value) as AuthSession;
    return new Date(session.expiresAt).getTime() > Date.now() ? session : null;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function loadActiveOrganizationId(): string {
  return localStorage.getItem(activeOrganizationStorageKey) ?? '';
}
