import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { AuthSession, LoginRequest, OrganizationAccess } from './auth.models';

const storageKey = 'gestia.auth.session';
const activeOrganizationStorageKey = 'gestia.auth.activeOrganizationId';

/**
 * Clave que usaba el modo soporte, ya eliminado. Se borra una sola vez al arrancar para no
 * dejar dato muerto en el navegador de quien ya había usado la aplicación.
 */
const legacySupportSessionStorageKey = 'gestia.auth.supportSession';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<AuthSession | null>(loadSession());
  private readonly platformOrganizationsState = signal<readonly OrganizationAccess[]>([]);
  /**
   * La organización activa sólo se escribe desde este servicio, y sólo pasando por la
   * comprobación de membresía de `setActiveOrganization`. Antes la señal se exponía escribible:
   * el `readonly` protegía la referencia, no el valor, así que cualquier componente podía
   * asignarla y saltarse esa comprobación.
   */
  private readonly activeOrganizationIdState = signal(loadActiveOrganizationId());

  constructor() {
    removeLegacySupportSession();
  }

  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => {
    const session = this.sessionState();
    return !!session && new Date(session.expiresAt).getTime() > Date.now();
  });
  readonly displayName = computed(() => this.sessionState()?.user.displayName ?? '');
  readonly organizations = computed(() => this.sessionState()?.organizations ?? []);
  readonly activeOrganizationId = this.activeOrganizationIdState.asReadonly();
  readonly platformOrganizations = this.platformOrganizationsState.asReadonly();
  readonly isPlatformAdmin = computed(
    () => this.sessionState()?.permissions.includes('PLATFORM.ADMIN') ?? false,
  );

  /**
   * De dónde puede elegir el usuario. El super admin elige entre todas las organizaciones de
   * la plataforma; cualquier otro rol, sólo entre aquellas donde tiene membresía.
   */
  readonly availableOrganizations = computed<readonly OrganizationAccess[]>(() =>
    this.isPlatformAdmin() ? this.platformOrganizations() : this.organizations(),
  );

  readonly activeOrganization = computed(() => {
    const selectedId = this.activeOrganizationId();
    const available = this.availableOrganizations();
    const selected = available.find((organization) => organization.idOrganization === selectedId);

    // El super admin no cae a la primera organización por omisión: entra a una cuando la
    // elige, y mientras tanto no está dentro de ninguna.
    return selected ?? (this.isPlatformAdmin() ? null : available[0] ?? null);
  });

  /**
   * La organización sobre la que operan las pantallas. **Fuente única.**
   *
   * No recibe argumentos, y eso es lo que arregla. El método que sustituyó,
   * `resolveOperationalOrganizationId`, recibía la lista de organizaciones de cada pantalla y, si
   * la activa no estaba en ella, caía en silencio a la primera de esa lista. Dos pantallas con
   * listas distintas —porque una cargó las de plataforma y otra las de la sesión, o porque una
   * respondió antes que la otra— resolvían organizaciones distintas a partir del mismo valor
   * activo. La barra de contexto decía una y la pantalla mostraba otra, y las dos creían tener
   * razón. Con el método fuera, no queda ninguna forma de resolverla que no sea ésta.
   *
   * Deriva de `activeOrganization()`, que ya conoce la regla del super admin: fuera de toda
   * organización devuelve cadena vacía, y la pantalla queda en espera en vez de mostrar datos de
   * una organización que nadie eligió.
   */
  readonly operationalOrganizationId = computed(
    () => this.activeOrganization()?.idOrganization ?? '',
  );

  login(request: LoginRequest) {
    return this.http.post<AuthSession>('/api/v1/auth/login', request).pipe(
      tap((session) => this.storeSession(session)),
    );
  }

  logout() {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(activeOrganizationStorageKey);
    this.sessionState.set(null);
    this.activeOrganizationIdState.set('');
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

  setActiveOrganization(idOrganization: string) {
    const exists = this.availableOrganizations().some(
      (organization) => organization.idOrganization === idOrganization,
    );

    if (!exists) {
      return;
    }

    localStorage.setItem(activeOrganizationStorageKey, idOrganization);
    this.activeOrganizationIdState.set(idOrganization);
  }

  /** Salir de la organización sin cerrar sesión. Es la contraparte de entrar a una. */
  clearActiveOrganization() {
    localStorage.removeItem(activeOrganizationStorageKey);
    this.activeOrganizationIdState.set('');
  }

  loadPlatformOrganizations() {
    return this.http.get<readonly OrganizationAccess[]>('/api/v1/organizations').pipe(
      tap((organizations) => this.platformOrganizationsState.set(organizations)),
    );
  }

  private storeSession(session: AuthSession) {
    localStorage.setItem(storageKey, JSON.stringify(session));
    const isPlatformAdmin = session.permissions.includes('PLATFORM.ADMIN');
    const currentOrganizationId = this.activeOrganizationId();
    const belongsToSession = session.organizations.some(
      (organization) => organization.idOrganization === currentOrganizationId,
    );

    // El super admin arranca fuera de toda organización y elige a cuál entrar.
    const activeOrganizationId = isPlatformAdmin
      ? ''
      : belongsToSession
        ? currentOrganizationId
        : session.organizations[0]?.idOrganization ?? '';

    if (activeOrganizationId) {
      localStorage.setItem(activeOrganizationStorageKey, activeOrganizationId);
    } else {
      localStorage.removeItem(activeOrganizationStorageKey);
    }

    this.activeOrganizationIdState.set(activeOrganizationId);
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

function removeLegacySupportSession(): void {
  try {
    localStorage.removeItem(legacySupportSessionStorageKey);
  } catch {
    // Un navegador con almacenamiento bloqueado no tiene nada que limpiar.
  }
}
