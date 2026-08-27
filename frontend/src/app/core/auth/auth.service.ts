import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { AuthSession, LoginRequest } from './auth.models';

const storageKey = 'gestia.auth.session';

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

  login(request: LoginRequest) {
    return this.http.post<AuthSession>('/api/v1/auth/login', request).pipe(
      tap((session) => this.storeSession(session)),
    );
  }

  logout() {
    localStorage.removeItem(storageKey);
    this.sessionState.set(null);
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

  private storeSession(session: AuthSession) {
    localStorage.setItem(storageKey, JSON.stringify(session));
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
