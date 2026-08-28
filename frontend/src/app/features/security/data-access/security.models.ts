export type SecurityUserOrganization = {
  readonly idOrganization: string;
  readonly codeOrganization: string;
  readonly legalName: string;
  readonly label: string;
};

export type SecurityUserRole = {
  readonly idRole: string;
  readonly codeRole: string;
  readonly name: string;
  readonly organizationName: string | null;
};

export type SecurityUser = {
  readonly idUser: string;
  readonly email: string;
  readonly displayName: string;
  readonly lastLoginAt: string | null;
  readonly organizations: readonly SecurityUserOrganization[];
  readonly roles: readonly SecurityUserRole[];
};

export type SecurityPermission = {
  readonly idPermission: string;
  readonly codePermission: string;
  readonly module: string;
  readonly description: string;
};

export type SecurityRole = {
  readonly idRole: string;
  readonly idOrganization: string | null;
  readonly codeRole: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly permissions: readonly SecurityPermission[];
};

export type CreateSecurityUser = {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  readonly idOrganization: string;
  readonly membershipLabel: string | null;
  readonly idRole: string;
};

export type AssignSecurityUserAccess = {
  readonly idOrganization: string;
  readonly membershipLabel: string | null;
  readonly idRole: string;
};

export type ResetSecurityUserPassword = {
  readonly password: string;
};

export type CreateSecurityRole = {
  readonly idOrganization: string | null;
  readonly codeRole: string;
  readonly name: string;
  readonly permissionCodes: readonly string[];
};
