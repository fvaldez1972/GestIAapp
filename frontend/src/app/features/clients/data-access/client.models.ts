export type Organization = {
  readonly idOrganization: string;
  readonly codeOrganization: string;
  readonly legalName: string;
  readonly rfc: string | null;
  readonly active: boolean;
  /**
   * Cada cuando se le paga al personal de esta organizacion.
   *
   * <p>Nulo es «sin declarar», no un valor faltante: es de la organizacion y nadie decide por ella.
   * En seguridad se paga semanal y en limpieza puede ser quincenal, pero dentro de una misma
   * empresa no cambia de una persona a otra.</p>
   */
  readonly payrollFrequency: PaymentFrequency | null;
};

export type CreateOrganization = {
  /**
   * Opcional: sin el, lo pone el servidor con la forma `ORG-01`. No se captura desde ninguna
   * pantalla, y al editar una organizacion omitirlo conserva el que ya tiene.
   */
  readonly codeOrganization?: string | null;
  readonly legalName: string;
  readonly rfc: string | null;
};

/**
 * La edicion de una organizacion.
 *
 * <p>Lleva la periodicidad de pago, que el alta no pide: el alta se queda minima y esto se decide
 * despues. Nulo la deja «sin declarar», que es un estado valido.</p>
 */
export type UpdateOrganization = CreateOrganization & {
  readonly payrollFrequency?: PaymentFrequency | null;
};

/**
 * El alta de una organizacion junto con su administrador inicial.
 *
 * <p>El codigo va aparte de <c>CreateOrganization</c> porque aqui es <b>opcional</b>: cuando no se
 * manda, lo pone el servidor con la forma <c>ORG-01</c>. Pedirselo a quien da de alta una empresa
 * le hace inventar una convencion que el sistema ya tiene, y el codigo no es la clave del
 * registro sino un identificador de conveniencia.</p>
 */
export type CreateOrganizationWithAdmin = Omit<CreateOrganization, 'codeOrganization'> & {
  readonly codeOrganization?: string | null;
  readonly admin: {
    readonly displayName: string;
    readonly email: string;
    readonly password: string;
  };
};

export type OrganizationProvisioningResult = {
  readonly organization: Organization;
  readonly idAdminUser: string;
  readonly adminEmail: string;
  readonly adminDisplayName: string;
};

export type OrganizationClientSummary = {
  readonly idClient: string;
  readonly codeClient: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly rfc: string;
  readonly active: boolean;
};

export type OrganizationGovernanceSummary = {
  readonly organization: Organization;
  readonly clients: readonly OrganizationClientSummary[];
  readonly usersCount: number;
  readonly adminsCount: number;
};

export type Client = {
  readonly idClient: string;
  readonly idOrganization: string;
  readonly organizationName: string;
  readonly codeClient: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly rfc: string;
  readonly nationality: string | null;
  readonly taxActivity: string | null;
  readonly taxAddress: string | null;
  readonly publicRegistryDate: string | null;
  readonly commercialRegistryFolio: string | null;
  readonly employerRegistrationNumber: string | null;
  readonly incorporationDate: string | null;
  readonly incorporationDeedNumber: string | null;
  readonly legalRepresentativeInstrumentNumber: string | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
};

export type ClientInput = {
  readonly idOrganization: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly rfc: string;
  readonly nationality: string | null;
  readonly taxActivity: string | null;
  readonly taxAddress: string | null;
  readonly publicRegistryDate: string | null;
  readonly commercialRegistryFolio: string | null;
  readonly employerRegistrationNumber: string | null;
  readonly incorporationDate: string | null;
  readonly incorporationDeedNumber: string | null;
  readonly legalRepresentativeInstrumentNumber: string | null;
};

/**
 * El alta de un cliente.
 *
 * <p><c>codeClient</c> es opcional: cuando no va, <b>lo genera el servidor</b> con la forma
 * <c>CLI-01</c>. Es un identificador que después sirve para buscar, pero que nadie sabe inventar
 * al dar de alta.</p>
 */
export type CreateClient = ClientInput & {
  readonly codeClient?: string;
};

export type ClientZone = {
  readonly idClientZone: string;
  readonly idClient: string;
  readonly codeClientZone: string;
  readonly name: string;
  readonly street: string;
  readonly exteriorNumber: string | null;
  readonly interiorNumber: string | null;
  readonly neighborhood: string | null;
  readonly municipality: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly accessInstructions: string | null;
  readonly timeZoneId: string | null;
  readonly active: boolean;
};

/**
 * Una zona vista desde fuera de la ficha de su cliente.
 *
 * <p>Lleva el nombre del cliente porque sin él no se puede leer: hay cinco nombres de zona
 * repetidos entre clientes distintos, y dos filas idénticas serían indistinguibles.</p>
 */
export type OrganizationClientZone = ClientZone & { readonly clientName: string };

export type ClientZoneInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly name: string;
  readonly street: string;
  readonly exteriorNumber: string | null;
  readonly interiorNumber: string | null;
  readonly neighborhood: string | null;
  readonly municipality: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: string | null;
  readonly accessInstructions: string | null;
  readonly timeZoneId: string | null;
};

export type CreateClientZone = ClientZoneInput & {
  readonly codeClientZone: string;
};

export type ClientContactPurpose =
  | 'Administrative'
  | 'Operational'
  | 'Billing'
  | 'Legal'
  | 'Emergency'
  | 'Payments'
  | 'Purchasing'
  | 'InternalSecurity';

/**
 * A quién cubre un contacto.
 *
 * <p>Se podía deducir de si tiene zona, y aun así viaja: un contacto sin zona porque nadie se la
 * puso no es lo mismo que uno que vale para todo el cliente a propósito, y la decisión D-02 —un
 * contacto principal por alcance— necesita contar de cada clase.</p>
 */
export type ClientContactScope = 'General' | 'Zone';

export type ClientContact = {
  readonly idClientContact: string;
  readonly idClient: string;
  readonly idClientZone: string | null;
  readonly scope: ClientContactScope;
  readonly idPurposeCatalogItem: string | null;
  readonly idContactJobPositionCatalogItem: string | null;
  readonly clientZoneName: string | null;
  readonly purposeName: string | null;
  readonly contactJobPositionName: string | null;
  /** Para qué se le llama, como enum. <b>Rastro heredado</b> de antes de la conversión a catálogo. */
  readonly purpose: ClientContactPurpose;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobilePhone: string | null;
  readonly isPrimary: boolean;
  readonly active: boolean;
};

export type ClientContactInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idClientZone: string | null;
  readonly scope: ClientContactScope;
  readonly idPurposeCatalogItem: string | null;
  readonly idContactJobPositionCatalogItem: string | null;
  readonly purpose: ClientContactPurpose;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly mobilePhone: string | null;
  readonly isPrimary: boolean;
};

export type ServiceContractStatus =
  | 'Draft'
  | 'UnderReview'
  | 'Executed'
  | 'Effective'
  | 'Expired'
  | 'Terminated';

export type ServiceContract = {
  readonly idServiceContract: string;
  readonly idClient: string;
  readonly codeServiceContract: string;
  readonly status: ServiceContractStatus;
  readonly signedDate: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly paymentTermDays: number;
  readonly terminationNoticeDays: number;
  readonly currencyCode: string;
  readonly documentReference: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ServiceContractInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly status: ServiceContractStatus;
  readonly signedDate: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly paymentTermDays: number;
  readonly terminationNoticeDays: number;
  readonly currencyCode: string | null;
  readonly documentReference: string | null;
  readonly notes: string | null;
};

export type CreateServiceContract = ServiceContractInput & {
  readonly codeServiceContract: string;
};

export type ManagedService = {
  readonly idService: string;
  readonly idClient: string;
  readonly idClientZone: string;
  readonly clientZoneName: string | null;
  readonly idServiceContract: string | null;
  readonly serviceContractCode: string | null;
  readonly codeService: string;
  readonly name: string;
  readonly description: string;
  readonly invoiceDescription: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly active: boolean;
};

export type ManagedServiceInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idClientZone: string;
  readonly idServiceContract: string | null;
  readonly name: string;
  readonly description: string;
  readonly invoiceDescription: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
};

/**
 * El alta de un servicio contratado.
 *
 * <p>El codigo es <b>opcional</b>: sin el, lo pone el servidor con la forma `SRV-01`, consecutivo
 * por cliente. Es el mismo trato que el de cliente y el de organizacion, y por la misma razon: es
 * un identificador de conveniencia, no la clave del registro.</p>
 */
export type CreateManagedService = ManagedServiceInput & {
  readonly codeService?: string | null;
};

/**
 * Cada cuando se paga o se cobra algo.
 *
 * <p>Sirve para dos hechos distintos: cada cuando se le cobra al cliente el precio de un puesto, y
 * cada cuando se le paga al personal, que es de la organizacion. En seguridad privada casi nunca
 * coinciden.</p>
 *
 * <p><b>Quincenal y catorcenal no son lo mismo</b> y se confunden todo el tiempo: catorcenal son
 * veintiseis pagos al año y cae siempre en el mismo dia de la semana; quincenal son veinticuatro y
 * cae en fechas fijas. Entran las dos porque en Mexico conviven.</p>
 */
export type PaymentFrequency = 'Weekly' | 'Biweekly' | 'SemiMonthly' | 'Monthly';

/** Como se dice cada periodo en pantalla. */
export const PAYMENT_FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  Weekly: 'Semanal',
  Biweekly: 'Catorcenal',
  SemiMonthly: 'Quincenal',
  Monthly: 'Mensual',
};

export const paymentFrequencyLabel = (frequency: PaymentFrequency | null): string =>
  frequency ? PAYMENT_FREQUENCY_LABELS[frequency] : 'Sin declarar';

export type ServicePosition = {
  readonly idPosition: string;
  readonly idService: string;
  readonly codePosition: string;
  readonly name: string;
  readonly requiredWorkerCount: number;
  readonly requiredSkillProfile: string | null;
  readonly notes: string | null;
  readonly active: boolean;
  /**
   * Lo que se cobra por este puesto, en el periodo que dice `priceFrequency`.
   *
   * <p>Se llamaba `monthlyPrice` y dejo de ser cierto: el precio se pacta por semana o por mes
   * segun el cliente, y el importe se guarda tal como se pacto, sin convertirlo.</p>
   */
  readonly price: number;
  readonly priceFrequency: PaymentFrequency;
  readonly currencyCode: string;
  readonly isTaxIncluded: boolean;
  /**
   * El patron del catalogo de turnos que sigue este puesto.
   *
   * <p>Nulo mientras la posicion conserve su patron propio, el que se le capturo por dentro antes
   * de que existiera el catalogo. No es un dato faltante: es una posicion que todavia no se
   * migro.</p>
   */
  readonly idShiftPatternTemplate: string | null;

  /**
   * Lo que el cliente pide para el puesto. <b>Es del puesto, no de la persona.</b>
   *
   * <p>Describe lo contratado, y por eso el catálogo de sexo admite «Indistinto», que no
   * describiría a nadie. No se compara contra el expediente de quien se asigne: eso sería una regla
   * de elegibilidad, y las reglas viven en su propia pantalla.</p>
   *
   * <p>Nulos en lo capturado antes de que existieran los campos. Un nulo dice «no se sabe», que es
   * distinto de «no cumple».</p>
   */
  readonly idSexCatalogItem: string | null;
  readonly idAgeRangeCatalogItem: string | null;
  readonly idEducationLevelCatalogItem: string | null;

  /**
   * Desde cuándo hace falta el puesto.
   *
   * <p><b>Es del puesto, no del servicio.</b> Un servicio vigente todo el año puede tener un
   * refuerzo que sólo va de octubre a diciembre. Las posiciones capturadas antes del 19 de
   * septiembre de 2026 heredaron la del servicio, que es la que tenían implícitamente.</p>
   */
  readonly startDate: string;

  /** Hasta cuándo. Nulo es puesto permanente, no «no se sabe». */
  readonly endDate: string | null;

  /** El equipo requerido, ya resuelto por el servidor con su nombre. */
  readonly requiredEquipment: readonly PositionEquipment[];
};

/** Una pieza del equipo que una posición requiere. */
export type PositionEquipment = {
  readonly idCatalogItem: string;
  readonly name: string;
};

export type ServicePositionInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly name: string;
  readonly requiredWorkerCount: number;
  readonly requiredSkillProfile: string | null;
  readonly notes: string | null;
  readonly price: number;
  readonly priceFrequency: PaymentFrequency;
  readonly currencyCode: string;
  readonly isTaxIncluded: boolean;
  /** Opcional: una pantalla que no elige patron manda la posicion sin el campo y queda en nulo. */
  readonly idShiftPatternTemplate?: string | null;
  readonly idSexCatalogItem?: string | null;
  readonly idAgeRangeCatalogItem?: string | null;
  readonly idEducationLevelCatalogItem?: string | null;

  /** Desde cuándo hace falta. Omitirla hereda el inicio del servicio. */
  readonly startDate?: string | null;
  /** Hasta cuándo. Omitirla hereda el fin del servicio, que puede no tenerlo. */
  readonly endDate?: string | null;

  /**
   * El equipo requerido, por identificador.
   *
   * <p>Omitirlo deja el equipo como estaba; mandar una lista vacía lo retira entero. La diferencia
   * importa: una pantalla que edita sólo el precio no manda el equipo, y tratarlo como «vacío» le
   * borraría lo que no venía a tocar.</p>
   */
  readonly idRequiredEquipmentCatalogItems?: readonly string[];
};

/**
 * El alta de una posicion. El codigo es **opcional**: sin el, lo pone el servidor con la forma
 * `P-01`, consecutivo por servicio.
 */
export type CreateServicePosition = ServicePositionInput & {
  readonly codePosition?: string | null;
};

export type ShiftPattern = {
  readonly idShiftPattern: string;
  readonly idPosition: string;
  readonly codeShiftPattern: string;
  readonly name: string;
  readonly description: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
  readonly active: boolean;
};

export type ShiftPatternInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idPosition: string;
  readonly name: string;
  readonly description: string | null;
  readonly effectiveFromDate: string;
  readonly effectiveToDate: string | null;
};

/**
 * El alta de un patron de turnos. El codigo es **opcional**: sin el, lo pone el servidor con la
 * forma `PAT-01`, consecutivo por posicion.
 */
export type CreateShiftPattern = ShiftPatternInput & {
  readonly codeShiftPattern?: string | null;
};

export type ShiftSegment = {
  readonly idShiftSegment: string;
  readonly idShiftPattern: string;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly requiredWorkerCount: number;
  readonly durationMinutes: number;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ShiftSegmentInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idPosition: string;
  readonly idShiftPattern: string;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly requiredWorkerCount: number;
  readonly notes: string | null;
};

export type ServiceAssignmentType = 'Primary' | 'Support' | 'Relief' | 'TemporaryReplacement';

export type ServiceAssignment = {
  readonly idServiceAssignment: string;
  readonly idEmployee: string;
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly idService: string;
  readonly idPosition: string | null;
  readonly positionCode: string | null;
  readonly positionName: string | null;
  readonly assignmentType: ServiceAssignmentType;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isPrimary: boolean;
  readonly notes: string | null;
  readonly active: boolean;
  /** Token de concurrencia: detecta que otro guardo mientras esta pantalla tenia el dato. */
  readonly rowVersion: string;
};

/** Los campos que comparten el alta y la corrección de una asignación. Sin token: el alta no lo tiene. */
export type ServiceAssignmentInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idPosition: string;
  readonly assignmentType: ServiceAssignmentType;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isPrimary: boolean;
  readonly notes: string | null;
};

export type CreateServiceAssignment = ServiceAssignmentInput & {
  readonly idEmployee: string;
};

/**
 * La corrección de una asignación.
 *
 * El token es obligatorio y el tipo es distinto del alta a propósito. Antes los dos usaban
 * `ServiceAssignmentInput` con `rowVersion?`, y como el alta no podía traerlo, la corrección
 * tampoco lo exigía: la pantalla nunca lo mandó y el servidor guardaba sin comprobar nada.
 */
export type ServiceAssignmentCorrectionInput = ServiceAssignmentInput & {
  readonly rowVersion: string;
  /** Por qué se corrige. Obligatorio cuando la regla del servidor lo exige. */
  readonly correctionReason?: string;
};

export type ScheduleVersionStatus = 'Draft' | 'Published' | 'Superseded';

export type ScheduleVersion = {
  readonly idScheduleVersion: string;
  readonly idService: string;
  readonly name: string;
  readonly periodStartDate: string;
  readonly periodEndDate: string;
  readonly status: ScheduleVersionStatus;
  readonly publishedAt: string | null;
  readonly publishedByName: string | null;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ScheduleVersionInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly name: string;
  readonly periodStartDate: string;
  readonly periodEndDate: string;
  readonly notes: string | null;
};

export type ScheduledShift = {
  readonly idScheduledShift: string;
  readonly idScheduleVersion: string;
  readonly idPosition: string;
  readonly positionCode: string;
  readonly positionName: string;
  readonly idEmployee: string;
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly shiftDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly durationMinutes: number;
  readonly notes: string | null;
  readonly active: boolean;
};

export type ScheduledShiftInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduleVersion: string;
  readonly idPosition: string;
  readonly idEmployee: string;
  readonly shiftDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly notes: string | null;
};

export type GenerateScheduledShiftsRequest = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduleVersion: string;
  readonly skipExisting: boolean;
};

export type GenerateScheduledShiftsResponse = {
  readonly createdShifts: number;
  readonly skippedShifts: number;
  readonly missingAssignments: number;
  readonly warnings: readonly string[];
};

export type AttendanceStatus = 'Expected' | 'Present' | 'Late' | 'Absent' | 'Excused';

export type AttendanceRecord = {
  readonly idAttendanceRecord: string;
  readonly idScheduledShift: string;
  readonly idEmployee: string;
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly attendanceDate: string;
  readonly status: AttendanceStatus;
  readonly actualStartTime: string | null;
  readonly actualEndTime: string | null;
  readonly minutesLate: number;
  readonly notes: string | null;
  readonly active: boolean;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al corregir; si alguien
   * cambió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

export type UpsertAttendanceRecord = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduledShift: string;
  readonly status: AttendanceStatus;
  readonly actualStartTime: string | null;
  readonly actualEndTime: string | null;
  readonly minutesLate: number;
  readonly notes: string | null;
  /**
   * **Este campo no existe en el servidor y nunca existió.** `UpsertAttendanceRequest` no lo
   * declara, así que todo lo que se escribía en él se descartaba en silencio al llegar. Es el mismo
   * defecto de la transición T3 —el frontend mandaba `clientId` donde el endpoint esperaba
   * `idClient`— con otra cara: un campo que parece guardarse y no se guarda.
   *
   * Se conserva un momento porque la pantalla vieja todavía lo declara en su formulario, y esa
   * pantalla se retira cuando Incidencias y Cobertura se rehagan. **No lo uses en pantalla nueva.**
   * Lo que sí lee el servidor es `correctionReason`, aquí abajo.
   *
   * @deprecated El servidor lo ignora. Usa `correctionReason`.
   */
  readonly correctionAuthorizationNotes?: string | null;
  /**
   * El **permiso previo** para corregir: una autorización ya aprobada que apunta a este registro.
   * No es la explicación del cambio.
   */
  readonly idApprovalRequest?: string | null;
  /**
   * El **motivo de la corrección**: qué se hizo y por qué. Viaja a la bitácora del registro.
   *
   * <p>Es otra cosa que la autorización, y se pide por otra condición: el motivo lo exige el
   * servidor cuando el día está cerrado; la autorización, cuando los datos cambiaron.</p>
   */
  readonly correctionReason?: string;
  /**
   * **La única entrada donde el token es opcional**, porque este endpoint crea o corrige con la
   * misma petición y un alta no tiene versión previa. En cuanto la asistencia ya existe el
   * servidor lo exige y responde 428 si falta, así que opcional aquí significa «opcional al dar
   * de alta», no «se puede omitir al corregir».
   */
  readonly rowVersion?: string;
};

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type IncidentStatus = 'Open' | 'InReview' | 'Resolved' | 'Cancelled';

export type Incident = {
  readonly idIncident: string;
  readonly idService: string;
  readonly idScheduledShift: string | null;
  readonly idEmployee: string | null;
  readonly employeeCode: string | null;
  readonly employeeName: string | null;
  readonly incidentDate: string;
  readonly incidentType: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly description: string;
  readonly resolutionNotes: string | null;
  readonly active: boolean;
  /**
   * Cuándo se registró, en UTC.
   *
   * <p>Está para una marca que no se guarda: una incidencia es «posterior al cierre» si se creó
   * después del `closedAt` del cierre vigente. Es reconstruible, como la vacancia de posiciones,
   * pero sin este instante no se puede reconstruir nada.</p>
   */
  readonly createdAt: string;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al corregir; si alguien
   * cambió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

/**
 * El **alta** de una incidencia. No lleva token porque no hay versión previa que pisar.
 *
 * La corrección es otro tipo, `IncidentCorrectionInput`, y no por gusto: mientras alta y corrección
 * compartieron un solo tipo, el token no podía ser obligatorio en ninguna de las dos —el alta no
 * lo tiene— y esa imposibilidad se leyó como permiso para no mandarlo nunca.
 */
export type IncidentInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduledShift: string | null;
  readonly idEmployee: string | null;
  readonly incidentDate: string;
  readonly incidentType: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly description: string;
  readonly resolutionNotes: string | null;
};

/** La corrección de una incidencia. El token es obligatorio: aquí sí hay algo que pisar. */
export type IncidentCorrectionInput = IncidentInput & {
  readonly rowVersion: string;
  /** Por qué se corrige. Obligatorio cuando la regla del servidor lo exige. */
  readonly correctionReason?: string;
};

export type CoverageStatus = 'Requested' | 'Confirmed' | 'Completed' | 'Cancelled';

export type CoverageRecord = {
  readonly idCoverageReason?: string | null;
  readonly idCoverageRecord: string;
  readonly idScheduledShift: string;
  readonly idOriginalEmployee: string;
  readonly originalEmployeeCode: string;
  readonly originalEmployeeName: string;
  readonly idReplacementEmployee: string;
  readonly replacementEmployeeCode: string;
  readonly replacementEmployeeName: string;
  readonly coverageStartTime: string;
  readonly coverageEndTime: string;
  readonly isOvernight: boolean;
  readonly durationMinutes: number;
  readonly status: CoverageStatus;
  readonly notes: string | null;
  readonly active: boolean;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al corregir; si alguien
   * cambió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

export type CoverageInput = {
  readonly idCoverageReason?: string | null;
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idScheduledShift: string;
  readonly idReplacementEmployee: string;
  readonly coverageStartTime: string;
  readonly coverageEndTime: string;
  readonly isOvernight: boolean;
  readonly status: CoverageStatus;
  readonly notes: string | null;
};

/** La corrección de una cobertura. Mismo criterio que `IncidentCorrectionInput`. */
export type CoverageCorrectionInput = CoverageInput & {
  readonly rowVersion: string;
  /** Por qué se corrige. Obligatorio cuando la regla del servidor lo exige. */
  readonly correctionReason?: string;
};

export type OperationEvidenceType = 'Photo' | 'Document' | 'Report' | 'Signature' | 'Other';

export type OperationEvidence = {
  readonly idOperationEvidence: string;
  readonly idService: string;
  readonly idAttendanceRecord: string | null;
  readonly idIncident: string | null;
  readonly idCoverageRecord: string | null;
  readonly evidenceType: OperationEvidenceType;
  readonly title: string;
  readonly storageReference: string;
  readonly notes: string | null;
  readonly active: boolean;
};

export type OperationEvidenceInput = {
  readonly idOrganization: string;
  readonly idClient: string;
  readonly idService: string;
  readonly idAttendanceRecord: string | null;
  readonly idIncident: string | null;
  readonly idCoverageRecord: string | null;
  readonly evidenceType: OperationEvidenceType;
  readonly title: string;
  readonly storageReference: string;
  readonly notes: string | null;
};

export type FileUploadResponse = {
  readonly originalFileName: string;
  readonly contentType: string;
  readonly size: number;
  readonly storageReference: string;
};

export type ApprovalRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export type ApprovalRequestType =
  | 'AttendanceCorrection'
  | 'IncidentClosure'
  | 'CoverageCorrection'
  | 'ServiceConfigurationChange'
  | 'DocumentException'
  | 'Other';

export type ApprovalRequest = {
  readonly idApprovalRequest: string;
  readonly idOrganization: string;
  readonly idService: string;
  readonly approvalType: ApprovalRequestType;
  readonly entityType: string;
  readonly entityId: string;
  readonly reason: string;
  readonly requestedChangeSummary: string | null;
  readonly assignedApproverName: string | null;
  readonly idOperationEvidence: string | null;
  readonly status: ApprovalRequestStatus;
  readonly requestedAt: string;
  readonly requestedByName: string;
  readonly decidedAt: string | null;
  readonly decidedByName: string | null;
  readonly decisionNotes: string | null;
  readonly active: boolean;
};

export type CreateApprovalRequest = {
  readonly idOrganization: string;
  readonly idService: string;
  readonly approvalType: ApprovalRequestType;
  readonly entityType: string;
  readonly entityId: string;
  readonly reason: string;
  readonly requestedChangeSummary: string | null;
  readonly assignedApproverName: string | null;
  readonly idOperationEvidence: string | null;
};

export type DecideApprovalRequest = {
  readonly idOrganization: string;
  readonly status: ApprovalRequestStatus;
  readonly decisionNotes: string | null;
};

export type OperationDayClosureStatus = 'Closed' | 'Reopened';

export type OperationDayClosure = {
  readonly idOperationDayClosure: string;
  readonly idOrganization: string;
  readonly idService: string;
  readonly operationDate: string;
  readonly expectedShifts: number;
  readonly attendanceRecords: number;
  readonly pendingAttendance: number;
  readonly openIncidents: number;
  readonly coverageRecords: number;
  readonly notes: string | null;
  readonly status: OperationDayClosureStatus;
  readonly closedAt: string;
  readonly closedByName: string;
  readonly reopenedAt: string | null;
  readonly reopenedByName: string | null;
  readonly reopenReason: string | null;
  readonly active: boolean;
  /**
   * Token de concurrencia. Es `rowversion` en la base y viaja como **base64**: no se interpreta,
   * no se compara y no se construye. Se lee al abrir y se devuelve igual al corregir; si alguien
   * cambió el registro entre una cosa y la otra, el servidor responde 409 y dice quién fue.
   */
  readonly rowVersion: string;
};

export type CloseOperationDay = {
  readonly idOrganization: string;
  readonly operationDate: string;
  readonly notes: string | null;
};

export type ReopenOperationDay = {
  readonly idOrganization: string;
  readonly reason: string;
  /** El token del cierre que se está reabriendo. Reabrir es corregir. */
  readonly rowVersion: string;
};

export type OperationsSummary = {
  readonly attendanceRecords: number;
  readonly presentAttendance: number;
  readonly lateAttendance: number;
  readonly absentAttendance: number;
  readonly excusedAttendance: number;
  readonly incidents: number;
  readonly openIncidents: number;
  readonly criticalIncidents: number;
  readonly coverageRecords: number;
  readonly confirmedCoverages: number;
  readonly completedCoverages: number;
  readonly coveredMinutes: number;
  readonly pendingApprovals: number;
  readonly closedOperationDays: number;
};

export type OperationsServiceSummary = OperationsSummary & {
  readonly idClient: string;
  readonly clientName: string;
  readonly idService: string;
  readonly codeService: string;
  readonly serviceName: string;
};

export type WorkforceEligibilityReport = {
  readonly idEmployee: string;
  readonly codeEmployee: string;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly isEligible: boolean;
  /**
   * Si no había ninguna regla activa que aplicara a esta persona.
   *
   * <p>Tercer estado, y lo resuelve el servidor. Antes la pantalla lo adivinaba buscando las
   * palabras «regla», «suficiente» o «configur» en los motivos, y el motivo de quien sí cumple
   * dice «Elegible con las reglas actuales»: contenía «reglas», así que <b>toda persona elegible
   * se rotulaba «Sin reglas suficientes»</b> y aparecía en el filtro de incumplimientos.</p>
   */
  readonly hasNoApplicableRules: boolean;
  readonly reasons: readonly string[];
  readonly expiredDocuments: number;
  readonly rejectedDocuments: number;
  readonly invalidEvaluations: number;
};

export type PagedResult<T> = {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};

/**
 * Un cliente en el listado.
 *
 * <p>Trae los conteos resueltos por el servidor. El que importa es <c>zoneCount</c>: <b>la zona es
 * el prerrequisito para crear servicios</b>, porque el servicio se liga a una zona. Saberlo aquí
 * es lo que permite decirlo en esta pantalla en vez de dejar que el usuario se estrelle en la
 * siguiente.</p>
 */
export type ClientListItem = {
  readonly idClient: string;
  readonly idOrganization: string;
  readonly codeClient: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly rfc: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly zoneCount: number;
  readonly zonesWithoutContact: number;
  readonly contactCount: number;
  /** Documentos activos. Viaja con la fila para que la pestaña tenga contador sin abrirla. */
  readonly documentCount: number;
  readonly serviceCount: number;
  readonly mainZoneName: string | null;
  readonly mainZoneMunicipality: string | null;
  readonly mainZoneState: string | null;
  /** Cuántas ubicaciones distintas tienen sus zonas activas. Con más de una, no se afirma ninguna. */
  readonly zoneLocationCount: number;
};

/** Los tres modos del listado. Coincide con el enum del servidor. */
export type ClientStatusFilter = 'Active' | 'Inactive' | 'All';

/** Si el cliente tiene zona: el filtro que separa a los que pueden tener servicios. */
export type ClientZonePresenceFilter = 'Any' | 'WithZone' | 'WithoutZone';

/** El nombre que se muestra. El comercial manda; muchos clientes no lo tienen. */
export const clientDisplayName = (client: {
  readonly tradeName: string | null;
  readonly legalName: string;
}) => client.tradeName ?? client.legalName;

/**
 * Dónde está el cliente.
 *
 * <p><b>Con varias ubicaciones no se afirma una.</b> `mainZone*` es la primera zona por nombre, no
 * una zona destacada: el modelo no tiene jerarquía entre zonas. Almacenes Reforma tiene zonas en
 * Tijuana y en León, y la columna decía «Baja California · Tijuana» a secas, como si el cliente
 * estuviera sólo ahí. Elegir una en silencio es peor que decir cuántas hay.</p>
 *
 * <p>Con una sola ubicación sí se dice, que es el caso de la mayoría y el que sirve para ubicar la
 * fila de un vistazo.</p>
 */
export function clientLocation(client: ClientListItem): string {
  if (!client.mainZoneMunicipality) {
    return 'Sin ubicación: no tiene zona';
  }

  if (client.zoneLocationCount > 1) {
    return `${client.zoneLocationCount} ubicaciones`;
  }

  return client.mainZoneState
    ? `${client.mainZoneState} · ${client.mainZoneMunicipality}`
    : client.mainZoneMunicipality;
}

/**
 * Lo que dice la columna de zonas.
 *
 * <p><b>Cero zonas no se muestra como cero.</b> Un cero diría que está en orden, y lo que dice de
 * verdad es que a este cliente no se le puede crear un servicio. Va como raya más la palabra.</p>
 */
export type ClientZoneBadge = {
  readonly value: string;
  readonly pill: string;
  readonly tone: 'danger' | 'warning' | 'muted' | 'none';
};

export function clientZoneBadge(client: ClientListItem): ClientZoneBadge {
  if (client.zoneCount === 0) {
    return { value: '—', pill: 'Sin zona', tone: 'warning' };
  }

  if (client.zonesWithoutContact > 0) {
    return {
      value: String(client.zoneCount),
      pill: client.zonesWithoutContact === 1 ? '1 sin contacto' : `${client.zonesWithoutContact} sin contacto`,
      tone: 'muted',
    };
  }

  return { value: String(client.zoneCount), pill: '', tone: 'none' };
}

/**
 * Por qué no se puede crear un servicio de este cliente, o cadena vacía si sí se puede.
 *
 * <p>La razón se escribe al lado del botón bloqueado. Un botón gris sin explicación obliga a
 * adivinar, y quien adivina mal se va a Servicios a intentarlo de todos modos.</p>
 */
export const clientServiceBlockReason = (client: { readonly zoneCount: number }) =>
  client.zoneCount === 0 ? 'No se puede crear el servicio: falta la zona a la que se ligaría.' : '';
