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
export type EmployeeDocumentHealth = 'UpToDate' | 'Missing' | 'NotValid' | 'Expiring' | 'Expired';

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
  /** Requisitos con documento que no cuenta: rechazado, sin validar o no aplicable. */
  readonly notValidDocuments: number;
  readonly assignmentCount: number;
  /**
   * Cuántos documentos tiene el expediente. Lo dice el servidor, con la lista.
   *
   * <p>No es `requiredDocuments`: aquéllos son los tipos que la organización exige, éste son los
   * archivos que de verdad hay. Una organización sin requisitos puede tener cinco archivos.</p>
   */
  readonly documentCount: number;
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

  // Antes de «sin cargar»: un documento rechazado está más cerca de bloquear que uno que falta, y
  // decir «sin cargar» de un archivo que sí está manda a subirlo otra vez en lugar de a revisarlo.
  if (employee.notValidDocuments > 0) {
    return {
      label:
        employee.notValidDocuments === 1
          ? '1 sin validar'
          : `${employee.notValidDocuments} sin validar`,
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

/**
 * Un nombre que puede faltar, dicho de forma que se pueda leer.
 *
 * <p>Interpolar un nulo en una plantilla de cadena escribe la palabra «null» en la pantalla. En
 * una plantilla de Angular no pasa —pinta vacío—, y por eso es fácil no verlo venir: el mismo dato
 * es inofensivo en un sitio y aparece en crudo en el otro.</p>
 */
const nombreOFalta = (valor: string | null, falta: string) => valor?.trim() || falta;

export function eligibilityDetail(
  eligibility: EmployeeEligibility,
  employeeJobPosition: string | null,
  positionJobPosition: string | null,
): string {
  switch (eligibility) {
    case 'blocked':
      return (
        `El puesto de la persona es «${nombreOFalta(employeeJobPosition, 'sin puesto')}» y la `
        + `posición pide «${nombreOFalta(positionJobPosition, 'sin puesto')}». Se comparan por `
        + 'identificador de catálogo, así que son puestos distintos, no una diferencia de redacción.'
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
      return 'El puesto de la persona corresponde con el que la posición pide: '
        + `«${nombreOFalta(employeeJobPosition, 'sin puesto')}».`;
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

/** Un tipo de documento como se ofrece al capturar, con la marca de si la organización lo exige. */
export type EmployeeDocumentTypeOption = {
  readonly code: string;
  readonly label: string;
  readonly isRequired: boolean;
};

/**
 * Los tipos que se ofrecen al subir un documento, con los exigidos primero.
 *
 * <p><b>La lista es del sistema y la marca es de la organización.</b> Los catorce tipos salen del
 * enum que el servidor reconoce —una categoría escrita a mano no la podría cumplir nadie, porque
 * las reglas de elegibilidad apuntan al enum—, y cuáles son obligatorios sale de las reglas que esa
 * organización tenga declaradas como bloqueantes.</p>
 *
 * <p>Los obligatorios van al principio porque son los que destraban una asignación. Dentro de cada
 * grupo se conserva el orden del expediente, que es el del enum, y no el alfabético: así la lista
 * se lee en el mismo orden en que se arma una carpeta.</p>
 */
export function employeeDocumentTypeOptions(
  required: readonly {
    readonly requiredDocumentType: string | null;
    readonly isBlocking: boolean;
  }[],
): readonly EmployeeDocumentTypeOption[] {
  const exigidos = new Set(
    required
      .filter((regla) => regla.isBlocking && regla.requiredDocumentType)
      .map((regla) => regla.requiredDocumentType!.toLowerCase()),
  );

  const tipos = Object.entries(TIPOS_DE_DOCUMENTO).map(([code, label]) => ({
    code,
    label,
    isRequired: exigidos.has(code.toLowerCase()),
  }));

  return [...tipos.filter((tipo) => tipo.isRequired), ...tipos.filter((tipo) => !tipo.isRequired)];
}

/**
 * En qué estado está un requisito para esta persona.
 *
 * <p><b>No se deriva del estado de la insignia del listado, y es deliberado.</b> La insignia habla
 * de una persona —«2 sin cargar»— y esto habla de un requisito; son dos vocabularios y atarlos hizo
 * que agregar un estado a uno rompiera al otro. Se parecen y no son lo mismo.</p>
 *
 * <p>Son dos más que los de la insignia del listado, y la diferencia importa: un documento
 * <b>rechazado</b> o <b>sin validar</b> está cargado y no cubre nada. El servidor sólo cuenta como
 * cubierto lo que está en <c>Received</c> o <c>Validated</c>, así que pintarlo «Al día» decía lo
 * contrario de lo que el servidor iba a responder al asignar.</p>
 */
export type EmployeeRequirementState =
  | 'UpToDate'
  | 'Expiring'
  | 'Missing'
  | 'Expired'
  | 'Rejected'
  | 'Unvalidated';

/** Un requisito de la organización y cómo lo cubre esta persona. */
export type EmployeeRequirementRow = {
  /** El tipo del sistema, tal como lo exige la organización. */
  readonly code: string;
  readonly label: string;
  /** Un requisito que no bloquea se pide igual, pero no impide asignar. Se dice cuál es cuál. */
  readonly isBlocking: boolean;
  readonly state: EmployeeRequirementState;
  readonly expiresDate: string | null;
  readonly documentNumber: string | null;
  /** El estado del documento cargado, para poder decir por qué no cuenta. Nulo si no hay ninguno. */
  readonly documentStatus: string | null;
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
    readonly status: string;
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

    // El mismo orden que usa el servidor para decidir si el requisito está cubierto: primero el
    // estado del documento, y sólo después las fechas. Al revés, un rechazado con vencimiento
    // futuro se leía «Al día» mientras el servidor lo rechazaba al asignar.
    const state: EmployeeRequirementState = !documento
      ? 'Missing'
      : documento.status === 'Rejected'
        ? 'Rejected'
        : documento.status === 'Expired'
          ? 'Expired'
          : documento.status !== 'Received' && documento.status !== 'Validated'
            ? 'Unvalidated'
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
      documentStatus: documento?.status ?? null,
    };
  });
}

const ESTADO_DEL_REQUISITO: Record<EmployeeRequirementState, { readonly label: string; readonly tone: string }> = {
  UpToDate: { label: 'Al día', tone: 'success' },
  Expiring: { label: 'Por vencer', tone: 'warning' },
  Missing: { label: 'Sin cargar', tone: 'warning' },
  Expired: { label: 'Vencido', tone: 'danger' },
  // Los dos que faltaban. Un documento cargado que no cuenta necesita decir por qué no cuenta:
  // «Sin cargar» sería falso —el archivo está— y «Al día» sería lo contrario de la verdad.
  Rejected: { label: 'Rechazado', tone: 'danger' },
  Unvalidated: { label: 'Sin validar', tone: 'warning' },
};

export const requirementStateLabel = (state: EmployeeRequirementState) => ESTADO_DEL_REQUISITO[state].label;
export const requirementStateTone = (state: EmployeeRequirementState) => ESTADO_DEL_REQUISITO[state].tone;

// ── Las evaluaciones, con la misma forma que los documentos ───────────────────────────────────

/**
 * El nombre visible de cada tipo de evaluación.
 *
 * <p>Vive aquí por la misma razón que el de los documentos: el vocabulario es del servidor —las
 * reglas de elegibilidad apuntan al enum— y lo que la organización elige es cuáles exige.</p>
 */
const TIPOS_DE_EVALUACION: Record<string, string> = {
  Polygraph: 'Polígrafo',
  SocioeconomicStudy: 'Estudio socioeconómico',
  CriminalRecordReview: 'Revisión de antecedentes',
  DrugTest: 'Antidoping',
  Other: 'Otra evaluación',
};

export const evaluationTypeLabel = (type: string): string => TIPOS_DE_EVALUACION[type] ?? type;

const RESULTADOS_DE_EVALUACION: Record<string, string> = {
  Pending: 'Pendiente',
  Approved: 'Aprobada',
  ApprovedWithObservations: 'Aprobada con observaciones',
  NotApproved: 'No aprobada',
  Inconclusive: 'No concluyente',
};

export const evaluationResultLabel = (result: string): string =>
  RESULTADOS_DE_EVALUACION[result] ?? result;

/** Los tipos que se ofrecen al registrar, con los que la organización exige al principio. */
export function evaluationTypeOptions(
  required: readonly {
    readonly requiredEvaluationType: string | null;
    readonly isBlocking: boolean;
  }[],
): readonly EmployeeDocumentTypeOption[] {
  const exigidos = new Set(
    required
      .filter((regla) => regla.isBlocking && regla.requiredEvaluationType)
      .map((regla) => regla.requiredEvaluationType!.toLowerCase()),
  );

  const tipos = Object.entries(TIPOS_DE_EVALUACION).map(([code, label]) => ({
    code,
    label,
    isRequired: exigidos.has(code.toLowerCase()),
  }));

  return [...tipos.filter((tipo) => tipo.isRequired), ...tipos.filter((tipo) => !tipo.isRequired)];
}

/** Un requisito de evaluación de la organización y cómo lo cubre esta persona. */
export type EmployeeEvaluationRequirementRow = {
  readonly code: string;
  readonly label: string;
  readonly isBlocking: boolean;
  readonly state: EmployeeRequirementState;
  readonly expiresDate: string | null;
  /** El resultado de la evaluación registrada, para poder decir por qué no cuenta. */
  readonly result: string | null;
};

/**
 * Cruza las evaluaciones que la organización exige contra las que la persona tiene.
 *
 * <p><b>El resultado manda sobre la fecha</b>, igual que el estado en los documentos. El servidor
 * sólo cuenta como cubierta una evaluación <c>Approved</c> o <c>ApprovedWithObservations</c> y
 * vigente; una pendiente o no aprobada con vencimiento futuro no cubre nada, y decir «Al día»
 * sería lo contrario de lo que el servidor responde al asignar.</p>
 *
 * <p>Se recorren los requisitos y no las evaluaciones: al revés, el requisito que nadie cubrió no
 * tendría fila que lo represente, y ése es justo el caso que hay que ver.</p>
 */
export function employeeEvaluationRequirementRows(
  required: readonly {
    readonly requiredEvaluationType: string | null;
    readonly name: string;
    readonly isBlocking: boolean;
  }[],
  evaluations: readonly {
    readonly evaluationType: string;
    readonly result: string;
    readonly expiresDate: string | null;
    readonly active: boolean;
  }[],
  today: string,
  expiringWithinDays: number,
): readonly EmployeeEvaluationRequirementRow[] {
  const limite = shiftOperationalDate(today, expiringWithinDays);

  return required.map((requisito) => {
    const evaluacion = evaluations.find(
      (item) =>
        item.active &&
        item.evaluationType.toLowerCase() === (requisito.requiredEvaluationType ?? '').toLowerCase(),
    );

    const state: EmployeeRequirementState = !evaluacion
      ? 'Missing'
      : evaluacion.result === 'NotApproved'
        ? 'Rejected'
        : evaluacion.result !== 'Approved' && evaluacion.result !== 'ApprovedWithObservations'
          ? 'Unvalidated'
          : evaluacion.expiresDate && evaluacion.expiresDate < today
            ? 'Expired'
            : evaluacion.expiresDate && evaluacion.expiresDate <= limite
              ? 'Expiring'
              : 'UpToDate';

    return {
      code: requisito.requiredEvaluationType ?? '',
      label: requisito.name || evaluationTypeLabel(requisito.requiredEvaluationType ?? ''),
      isBlocking: requisito.isBlocking,
      state,
      expiresDate: evaluacion?.expiresDate ?? null,
      result: evaluacion?.result ?? null,
    };
  });
}

/**
 * Las mismas situaciones que en documentos, dichas en femenino y con el vocabulario de evaluación.
 *
 * <p>Un mapa aparte y no el de documentos: «Sin cargar» y «Rechazado» no son lo que se dice de una
 * evaluación, y reutilizar las etiquetas por ahorrar un mapa haría que la pantalla hablara de
 * archivos donde no hay archivos.</p>
 */
const ESTADO_DE_LA_EVALUACION: Record<EmployeeRequirementState, { readonly label: string; readonly tone: string }> = {
  UpToDate: { label: 'Al día', tone: 'success' },
  Expiring: { label: 'Por vencer', tone: 'warning' },
  Missing: { label: 'Sin registrar', tone: 'warning' },
  Expired: { label: 'Vencida', tone: 'danger' },
  Rejected: { label: 'No aprobada', tone: 'danger' },
  Unvalidated: { label: 'Sin resolver', tone: 'warning' },
};

export const evaluationStateLabel = (state: EmployeeRequirementState) => ESTADO_DE_LA_EVALUACION[state].label;
export const evaluationStateTone = (state: EmployeeRequirementState) => ESTADO_DE_LA_EVALUACION[state].tone;

// ── Las experiencias ───────────────────────────────────────────────────────────────────────────

/** Un requisito de experiencia de la organización y cómo lo cubre esta persona. */
export type EmployeeSkillRequirementRow = {
  /** El identificador del valor de catálogo que la regla exige. */
  readonly code: string;
  readonly label: string;
  readonly isBlocking: boolean;
  readonly state: EmployeeRequirementState;
  readonly expiresDate: string | null;
};

/**
 * Cruza las experiencias que la organización exige contra las que la persona tiene.
 *
 * <p><b>Por identificador y no por nombre</b>, igual que el servidor: la regla apunta a una fila
 * del catálogo, y comparar textos aceptaría «Manejo de CCTV» y «manejo de cctv» como dos
 * experiencias distintas. Una experiencia no tiene estado ni resultado, así que sólo hay hueco,
 * vigente, por vencer y vencida.</p>
 */
export function employeeSkillRequirementRows(
  required: readonly {
    readonly idRequiredCatalogItem: string | null;
    readonly requiredCatalogItemName: string | null;
    readonly name: string;
    readonly isBlocking: boolean;
  }[],
  skills: readonly {
    readonly idSkillCatalogItem: string;
    readonly expiresDate: string | null;
    readonly active: boolean;
  }[],
  today: string,
  expiringWithinDays: number,
): readonly EmployeeSkillRequirementRow[] {
  const limite = shiftOperationalDate(today, expiringWithinDays);

  return required.map((requisito) => {
    const experiencia = skills.find(
      (item) => item.active && item.idSkillCatalogItem === requisito.idRequiredCatalogItem,
    );

    const state: EmployeeRequirementState = !experiencia
      ? 'Missing'
      : experiencia.expiresDate && experiencia.expiresDate < today
        ? 'Expired'
        : experiencia.expiresDate && experiencia.expiresDate <= limite
          ? 'Expiring'
          : 'UpToDate';

    return {
      code: requisito.idRequiredCatalogItem ?? '',
      label: requisito.requiredCatalogItemName || requisito.name,
      isBlocking: requisito.isBlocking,
      state,
      expiresDate: experiencia?.expiresDate ?? null,
    };
  });
}

/** Las mismas situaciones, dichas de una experiencia. */
const ESTADO_DE_LA_EXPERIENCIA: Record<EmployeeRequirementState, { readonly label: string; readonly tone: string }> = {
  UpToDate: { label: 'Acreditada', tone: 'success' },
  Expiring: { label: 'Por vencer', tone: 'warning' },
  Missing: { label: 'Sin acreditar', tone: 'warning' },
  Expired: { label: 'Vencida', tone: 'danger' },
  // No le llegan a una experiencia, que no tiene estado ni resultado. Se declaran porque el tipo es
  // compartido, y si algún día le llegaran, sería mejor verlas que perderlas.
  Rejected: { label: 'No acreditada', tone: 'danger' },
  Unvalidated: { label: 'Sin resolver', tone: 'warning' },
};

export const skillStateLabel = (state: EmployeeRequirementState) => ESTADO_DE_LA_EXPERIENCIA[state].label;
export const skillStateTone = (state: EmployeeRequirementState) => ESTADO_DE_LA_EXPERIENCIA[state].tone;
