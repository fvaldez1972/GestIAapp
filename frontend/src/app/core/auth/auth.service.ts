import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { tap } from 'rxjs';
import { AuthSession, LoginRequest, OrganizationAccess, StartSupportSessionRequest, SupportSession } from './auth.models';

const storageKey = 'gestia.auth.session';
const activeOrganizationStorageKey = 'gestia.auth.activeOrganizationId';
const supportSessionStorageKey = 'gestia.auth.supportSession';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<AuthSession | null>(loadSession());
  private readonly supportSessionState = signal<SupportSession | null>(loadSupportSession());
  private readonly platformOrganizationsState = signal<readonly OrganizationAccess[]>([]);
  private supportExpiryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.scheduleSupportExpiry(this.supportSessionState());
  }

  ngOnDestroy() {
    clearTimeout(this.supportExpiryTimer);
  }

  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => {
    const session = this.sessionState();
    return !!session && new Date(session.expiresAt).getTime() > Date.now();
  });
  readonly displayName = computed(() => this.sessionState()?.user.displayName ?? '');
  readonly organizations = computed(() => this.sessionState()?.organizations ?? []);
  readonly activeOrganizationId = signal(loadActiveOrganizationId());
  readonly supportSession = this.supportSessionState.asReadonly();
  readonly platformOrganizations = this.platformOrganizationsState.asReadonly();
  readonly isSupportModeActive = computed(() => {
    const session = this.supportSessionState();
    return !!session && session.active && new Date(session.expiresAt).getTime() > Date.now();
  });
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
    clearTimeout(this.supportExpiryTimer);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(activeOrganizationStorageKey);
    localStorage.removeItem(supportSessionStorageKey);
    this.sessionState.set(null);
    this.activeOrganizationId.set('');
    this.supportSessionState.set(null);
    this.platformOrganizationsState.set([]);
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

  resolveOperationalOrganizationId(organizations: readonly OrganizationAccess[]) {
    if (this.sessionState()?.permissions.includes('PLATFORM.ADMIN')) {
      if (!this.isSupportModeActive()) {
        return '';
      }
      const supportOrganizationId = this.supportSessionState()?.idOrganization ?? '';
      return organizations.some((organization) => organization.idOrganization === supportOrganizationId)
        ? supportOrganizationId
        : '';
    }

    const activeOrganizationId = this.activeOrganizationId();
    return organizations.some((organization) => organization.idOrganization === activeOrganizationId)
      ? activeOrganizationId
      : organizations[0]?.idOrganization ?? '';
  }

  setActiveOrganization(idOrganization: string) {
    const exists = this.organizations().some((organization) => organization.idOrganization === idOrganization);

    if (!exists) {
      return;
    }

    localStorage.setItem(activeOrganizationStorageKey, idOrganization);
    this.activeOrganizationId.set(idOrganization);
  }

  loadPlatformOrganizations() {
    return this.http.get<readonly OrganizationAccess[]>('/api/v1/organizations').pipe(
      tap((organizations) => this.platformOrganizationsState.set(organizations)),
    );
  }

  loadCurrentSupportSession() {
    return this.http.get<SupportSession | null>('/api/v1/support-sessions/current').pipe(
      tap((session) => this.storeSupportSession(session)),
    );
  }

  startSupportSession(request: StartSupportSessionRequest) {
    return this.http.post<SupportSession>('/api/v1/support-sessions', request).pipe(
      tap((session) => this.storeSupportSession(session)),
    );
  }

  endSupportSession() {
    const session = this.supportSessionState();
    if (!session) {
      return null;
    }

    return this.http.delete<void>(`/api/v1/support-sessions/${session.idSupportSession}`).pipe(
      tap(() => this.storeSupportSession(null)),
    );
  }

  clearSupportSession() {
    this.storeSupportSession(null);
  }

  private storeSession(session: AuthSession) {
    this.storeSupportSession(null);
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

  private storeSupportSession(session: SupportSession | null) {
    clearTimeout(this.supportExpiryTimer);
    if (!session || !session.active || new Date(session.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(supportSessionStorageKey);
      this.supportSessionState.set(null);
      return;
    }

    localStorage.setItem(supportSessionStorageKey, JSON.stringify(session));
    this.supportSessionState.set(session);
    this.scheduleSupportExpiry(session);
  }

  private scheduleSupportExpiry(session: SupportSession | null) {
    if (session) {
      const delay = Math.max(0, new Date(session.expiresAt).getTime() - Date.now());
      this.supportExpiryTimer = setTimeout(() => this.storeSupportSession(null), delay);
    }
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

function loadSupportSession(): SupportSession | null {
  const value = localStorage.getItem(supportSessionStorageKey);
  if (!value) {
    return null;
  }

  try {
    const session = JSON.parse(value) as SupportSession;
    if (!session.active || new Date(session.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(supportSessionStorageKey);
      return null;
    }

    return session;
  } catch {
    localStorage.removeItem(supportSessionStorageKey);
    return null;
  }
}
