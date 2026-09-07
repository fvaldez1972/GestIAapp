import { shiftOperationalDate } from '../../../shared/util/operational-date';
import { PagedResult } from '../../clients/data-access/client.models';

/**
 * Lo que el servidor dice del personal.
 *
 * <p>El servidor manda hechos y aquí se componen las frases, como en Inicio y en Clientes: los
 * conteos y los estados son suyos —qué exige la organización es regla de negocio—, la redacción es
 * de este lado, donde se ve y se puede probar.</p>
 */
export type EmployeeStatus = 'Candidate' | 'Active' | 'OnLeave' | 'Inactive' | 'Terminated';

/**
 * Cómo está el expediente documental.
 *
 * <p><b>«Sin cargar» no es «al día»</b>: un requisito sin documento es un hueco, no un expediente
 * en orden. Es la distinción que da sentido a la píldora del listado.</p>
 */
export type EmployeeDocumentHealth = 'UpToDate' | 'Missing' | 'Expiring' | 'Expired';

export type EmployeeDocumentFilter = 'Any' | 'Expired' | 'Expiring' | 'Missing' | 'UpToDate';

export type EmployeeListItem = {
  readonly idEmployee: string;
  readonly idOrganization: string;
  readonly codeEmployee: string;
  readonly fullName: string;
  readonly status: EmployeeStatus;
  readonly hireDate: string;
  readonly curp: string | null;
  readonly idJobPositionCatalogItem: string | null;
  readonly jobPositionName: string | null;
  readonly jobTitle: string | null;
  readonly state: string | null;
  readonly municipality: string | null;
  readonly requiredDocuments: number;
  readonly expiredDocuments: number;
  readonly expiringDocuments: number;
  readonly missingDocuments: number;
  readonly assignmentCount: number;
  readonly documentHealth: EmployeeDocumentHealth;
};

export type EmployeeSearchResult = {
  readonly page: PagedResult<EmployeeListItem>;
  /** Cuántos días antes de caducar cuenta como «por vencer». Se escribe en la pantalla. */
  readonly expiringWithinDays: number;
  /** Cuántos requisitos documentales exige esta organización. */
  readonly requiredDocuments: number;
};

export type EmployeeJobPositionOption = { readonly idCatalogItem: string; readonly name: string };

export type EmployeeFilterOptions = {
  readonly jobPositions: readonly EmployeeJobPositionOption[];
  readonly municipalities: readonly string[];
};

export type EmployeeAssignment = {
  readonly idServiceAssignment: string;
  readonly idService: string;
  readonly serviceName: string;
  readonly clientName: string;
  readonly idPosition: string | null;
  readonly positionName: string | null;
  readonly assignmentType: 'Primary' | 'Support' | 'Relief' | 'TemporaryReplacement';
  readonly isPrimary: boolean;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly inForce: boolean;
  readonly hasShiftInProgress: boolean;
  readonly shiftInProgressDate: string | null;
};

// ── Los cinco estados del empleado ─────────────────────────────────────────────────────────

const ESTADOS: Record<EmployeeStatus, { readonly label: string; readonly tone: string }> = {
  Candidate: { label: 'Candidato', tone: 'info' },
  Active: { label: 'Activo', tone: 'success' },
  OnLeave: { label: 'Permiso', tone: 'warning' },
  Inactive: { label: 'Inactivo', tone: 'muted' },
  Terminated: { label: 'Baja', tone: 'danger' },
};

export const employeeStatusLabel = (status: EmployeeStatus) => ESTADOS[status].label;
export const employeeStatusTone = (status: EmployeeStatus) => ESTADOS[status].tone;

export const EMPLOYEE_STATUS_OPTIONS = (Object.keys(ESTADOS) as EmployeeStatus[]).map((value) => ({
  value,
  label: ESTADOS[value].label,
}));

// ── La píldora de vigencia documental ──────────────────────────────────────────────────────

export type EmployeeDocumentBadge = {
  readonly label: string;
  readonly tone: 'danger' | 'warning' | 'success' | 'muted';
};

/**
 * Lo que dice la columna de documentos.
 *
 * <p>Nunca un número suelto: <b>cuántos y de qué</b>. Y el peor manda, porque un vencido ya está
 * bloqueando mientras que un hueco todavía se puede llenar.</p>
 *
 * <p>Cuando la organización no exige ningún documento, no hay nada que medir: decir «al día»
 * sería afirmar algo sobre una regla que nadie escribió.</p>
 */
export function employeeDocumentBadge(employee: EmployeeListItem): EmployeeDocumentBadge {
  if (employee.requiredDocuments === 0) {
    return { label: 'Sin requisitos', tone: 'muted' };
  }

  if (employee.expiredDocuments > 0) {
    return {
      label: employee.expiredDocuments === 1 ? '1 vencido' : `${employee.expiredDocuments} vencidos`,
      tone: 'danger',
    };
  }

  if (employee.missingDocuments > 0) {
    return {
      label:
        employee.missingDocuments === 1 ? '1 sin cargar' : `${employee.missingDocuments} sin cargar`,
      tone: 'warning',
    };
  }

  if (employee.expiringDocuments > 0) {
    return {
      label:
        employee.expiringDocuments === 1 ? '1 por vencer' : `${employee.expiringDocuments} por vencer`,
      tone: 'warning',
    };
  }

  return { label: 'Al día', tone: 'success' };
}

/** De dónde salen los requisitos, dicho con precisión. */
export function documentRequirementsNote(requiredDocuments: number, expiringWithinDays: number): string {
  if (requiredDocuments === 0) {
    return 'Esta organización todavía no exige ningún documento. Los requisitos se definen en Catálogos.';
  }

  const cuantos =
    requiredDocuments === 1 ? 'Un requisito documental' : `${requiredDocuments} requisitos documentales`;

  // Se dice completo a propósito: la organización elige **cuáles**, no inventa tipos nuevos.
  return (
    `${cuantos} definidos por esta organización, sobre los tipos de documento que el sistema ` +
    `reconoce. Por vencer: ${expiringWithinDays} días o menos.`
  );
}

// ── La elegibilidad ────────────────────────────────────────────────────────────────────────

export type EmployeeEligibility =
  /** Los dos lados declaran puesto y son el mismo. */
  | 'eligible'
  /** El empleado no tiene puesto de catálogo: no bloquea, pero el expediente está incompleto. */
  | 'incomplete'
  /** Los dos declaran puesto y difieren. */
  | 'blocked';

/**
 * Si el puesto de una persona la descalifica para una posición.
 *
 * <p>Copia exacta de la regla del servidor, que compara <b>identificadores de catálogo</b>. Aquí
 * sólo sirve para explicarla en pantalla: la que decide es la del servidor.</p>
 *
 * <p><b>Un nulo no bloquea</b>, y ése es el caso que la pantalla tiene que hacer visible: un
 * expediente incompleto que igual permite asignar es una condición que hoy no ve nadie.</p>
 */
export function employeeEligibility(
  requiredByPosition: string | null,
  heldByEmployee: string | null,
): EmployeeEligibility {
  if (!heldByEmployee) {
    return 'incomplete';
  }

  if (!requiredByPosition || requiredByPosition === heldByEmployee) {
    return 'eligible';
  }

  return 'blocked';
}

export function eligibilityTitle(eligibility: EmployeeEligibility): string {
  switch (eligibility) {
    case 'blocked':
      return 'No elegible para esta posición';
    case 'incomplete':
      return 'Elegible, con el expediente incompleto';
    case 'eligible':
      return 'Elegible para esta posición';
  }
}

export function eligibilityDetail(
  eligibility: EmployeeEligibility,
  employeeJobPosition: string | null,
  positionJobPosition: string | null,
): string {
  switch (eligibility) {
    case 'blocked':
      return (
        `El puesto de la persona es «${employeeJobPosition}» y la posición pide ` +
        `«${positionJobPosition}». Se comparan por identificador de catálogo, así que son puestos ` +
        'distintos, no una diferencia de redacción.'
      );
    case 'incomplete':
      return (
        // Sin asteriscos: esto se pinta como texto, no como Markdown, y los asteriscos se leian
        // literales en la pantalla.
        'La persona no tiene puesto del catálogo, así que el sistema no sabe cuál es. Eso no ' +
        'impide asignarla: no saber su puesto no es lo mismo que no cumplir el perfil. Pero su ' +
        'expediente queda incompleto y nadie puede comprobar que corresponde.'
      );
    case 'eligible':
      return `El puesto de la persona corresponde con el que la posición pide: «${employeeJobPosition}».`;
  }
}

/** Dónde está el empleado. La zona no existe en el modelo; el estado y el municipio sí. */
export function employeeLocation(employee: EmployeeListItem): string {
  if (!employee.municipality && !employee.state) {
    return 'Sin domicilio registrado';
  }

  return [employee.state, employee.municipality].filter(Boolean).join(' · ');
}

/** El puesto que se muestra. El de catálogo manda; el texto libre es lo heredado. */
export function employeeJobPositionLabel(employee: EmployeeListItem): string {
  if (employee.jobPositionName) {
    return employee.jobPositionName;
  }

  return employee.jobTitle ? `${employee.jobTitle} · sin catalogar` : 'Sin puesto';
}

// ── Los requisitos documentales, uno por uno ───────────────────────────────────────────────

/**
 * El nombre visible de cada tipo de documento.
 *
 * <p>El vocabulario es del sistema; lo que la organización elige es <b>cuáles exige</b>. Por eso
 * el mapa vive aquí y no en un catálogo editable: un requisito escrito a mano que no corresponde a
 * ningún tipo no lo podría cumplir nadie, y el servidor ya lo descarta.</p>
 */
const TIPOS_DE_DOCUMENTO: Record<string, string> = {
  EmploymentApplication: 'Solicitud de empleo',
  BirthCertificate: 'Acta de nacimiento',
  MarriageCertificate: 'Acta de matrimonio',
  VoterId: 'INE',
  Curp: 'CURP',
  SocialSecurityNumber: 'NSS',
  Rfc: 'RFC',
  TaxStatusCertificate: 'Constancia de situación fiscal',
  DriverLicense: 'Licencia de conducir',
  ProofOfAddress: 'Comprobante de domicilio',
  ProofOfStudies: 'Comprobante de estudios',
  MilitaryServiceCard: 'Cartilla militar',
  CriminalRecordCertificate: 'Antecedentes no penales',
  Other: 'Otro documento',
};

export const documentTypeLabel = (type: string): string => TIPOS_DE_DOCUMENTO[type] ?? type;

/** Un requisito de la organización y cómo lo cubre esta persona. */
export type EmployeeRequirementRow = {
  /** El tipo del sistema, tal como lo exige la organización. */
  readonly code: string;
  readonly label: string;
  /** Un requisito que no bloquea se pide igual, pero no impide asignar. Se dice cuál es cuál. */
  readonly isBlocking: boolean;
  readonly state: EmployeeDocumentHealth;
  readonly expiresDate: string | null;
  readonly documentNumber: string | null;
};

/**
 * Cruza lo que la organización exige contra lo que la persona tiene.
 *
 * <p><b>Se recorren los requisitos, no los documentos.</b> Al revés nunca aparecería un hueco: un
 * requisito sin documento no tiene fila que lo represente, y ése es justo el caso que la pestaña
 * existe para mostrar. Un documento cargado que nadie exige tampoco es un problema, y por eso no
 * ocupa un renglón de la lista de requisitos.</p>
 *
 * <p>Copia de la regla del servidor, que es la que decide. Aquí sólo sirve para explicarla al
 * detalle, del mismo modo que la franja de elegibilidad.</p>
 */
export function employeeRequirementRows(
  required: readonly {
    /** El tipo de documento que la regla exige. Nulo en las reglas que no son de documento. */
    readonly requiredDocumentType: string | null;
    readonly name: string;
    readonly isBlocking: boolean;
  }[],
  documents: readonly {
    readonly documentType: string;
    readonly expiresDate: string | null;
    readonly documentNumber: string | null;
    readonly active: boolean;
  }[],
  today: string,
  expiringWithinDays: number,
): readonly EmployeeRequirementRow[] {
  const limite = shiftOperationalDate(today, expiringWithinDays);

  return required.map((requisito) => {
    const documento = documents.find(
      (item) => item.active && item.documentType.toLowerCase() === (requisito.requiredDocumentType ?? '').toLowerCase(),
    );

    const state: EmployeeDocumentHealth = !documento
      ? 'Missing'
      : documento.expiresDate && documento.expiresDate < today
        ? 'Expired'
        : documento.expiresDate && documento.expiresDate <= limite
          ? 'Expiring'
          : 'UpToDate';

    return {
      code: requisito.requiredDocumentType ?? '',
      label: requisito.name || documentTypeLabel(requisito.requiredDocumentType ?? ''),
      isBlocking: requisito.isBlocking,
      state,
      expiresDate: documento?.expiresDate ?? null,
      documentNumber: documento?.documentNumber ?? null,
    };
  });
}

const ESTADO_DEL_REQUISITO: Record<EmployeeDocumentHealth, { readonly label: string; readonly tone: string }> = {
  UpToDate: { label: 'Al día', tone: 'success' },
  Expiring: { label: 'Por vencer', tone: 'warning' },
  Missing: { label: 'Sin cargar', tone: 'warning' },
  Expired: { label: 'Vencido', tone: 'danger' },
};

export const requirementStateLabel = (state: EmployeeDocumentHealth) => ESTADO_DEL_REQUISITO[state].label;
export const requirementStateTone = (state: EmployeeDocumentHealth) => ESTADO_DEL_REQUISITO[state].tone;
