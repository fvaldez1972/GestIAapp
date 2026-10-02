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
