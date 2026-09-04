export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  idUser: string;
  email: string;
  displayName: string;
}

export interface OrganizationAccess {
  idOrganization: string;
  codeOrganization: string;
  legalName: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
  organizations: readonly OrganizationAccess[];
  permissions: readonly string[];
}

export interface SupportSession {
  idSupportSession: string;
  idOrganization: string;
  organizationName: string;
  reason: string;
  startsAt: string;
  expiresAt: string;
  endedAt: string | null;
  startedBy: string;
  active: boolean;
}

export interface StartSupportSessionRequest {
  idOrganization: string;
  reason: string;
  durationMinutes: number;
}
