import {
  eligibilityDetail,
  employeeDocumentBadge,
  employeeDocumentTypeOptions,
  employeeRequirementRows,
  employeeJobPositionLabel,
} from './employee-list.models';
import { EmployeeListItem } from './employee-list.models';

const empleado = (extra: Partial<EmployeeListItem>) => ({ jobTitle: null, jobPositionName: null, ...extra } as EmployeeListItem);

describe('Ningún nulo llega escrito a la pantalla', () => {
  /**
   * El defecto que se vio al desactivar un puesto: la pantalla mostraba el texto «NULL».
   *
   * <p>Un nulo interpolado en una plantilla de cadena escribe la palabra. En una plantilla de
   * Angular no pasa —pinta vacío—, y por eso es fácil no verlo venir: el mismo dato es inofensivo
   * en un sitio y aparece en crudo en el otro.</p>
   */
  it('el detalle de elegibilidad no escribe «null» cuando falta el puesto', () => {
    const bloqueado = eligibilityDetail('blocked', null, 'Guardia de acceso');
    const elegible = eligibilityDetail('eligible', null, null);

    for (const texto of [bloqueado, elegible]) {
      expect(texto.toLowerCase()).not.toContain('null');
      expect(texto.toLowerCase()).not.toContain('undefined');
    }

    expect(bloqueado).toContain('sin puesto');
    expect(bloqueado).toContain('Guardia de acceso');
  });

  it('con los dos puestos presentes, los dice tal cual', () => {
    const texto = eligibilityDetail('blocked', 'Escolta', 'Guardia de acceso');

    expect(texto).toContain('«Escolta»');
    expect(texto).toContain('«Guardia de acceso»');
  });

  /** El puesto de catálogo manda; el texto libre es lo heredado, y la ausencia se dice. */
  it('la etiqueta del puesto distingue catálogo, texto libre y ausencia', () => {
    expect(employeeJobPositionLabel(empleado({ jobPositionName: 'Escolta' }))).toBe('Escolta');
    expect(employeeJobPositionLabel(empleado({ jobTitle: 'Guardia' }))).toBe('Guardia · sin catalogar');
    expect(employeeJobPositionLabel(empleado({}))).toBe('Sin puesto');
  });
});

describe('Los tipos de documento que se ofrecen al capturar', () => {
  /**
   * La lista es del sistema y la marca es de la organizacion.
   *
   * <p>Los catorce tipos salen del enum que el servidor reconoce: una categoria escrita a mano no
   * cumple ningun requisito, porque las reglas de elegibilidad apuntan al enum y no a un texto.</p>
   */
  /**
   * El catálogo de la organización, que desde el 19 de septiembre de 2026 es de donde sale la lista.
   * Antes eran catorce valores fijos del servidor.
   */
  const categorias = [
    { idCatalogItem: 'c-curp', name: 'CURP' },
    { idCatalogItem: 'c-domicilio', name: 'Comprobante de domicilio' },
    { idCatalogItem: 'c-licencia', name: 'Licencia de conducir' },
    { idCatalogItem: 'c-propia', name: 'Carta de recomendación' },
  ];

  it('ofrece lo que la organizacion tenga en su catalogo, aunque no exija ninguno', () => {
    const tipos = employeeDocumentTypeOptions([], categorias);

    expect(tipos).toHaveLength(4);
    expect(tipos.every((tipo) => !tipo.isRequired)).toBe(true);
    // Y una categoria que la organizacion agrego sale igual que las que venian sembradas: es lo
    // que la conversion a catalogo vino a permitir.
    expect(tipos.map((tipo) => tipo.label)).toContain('Carta de recomendación');
  });

  /** Los exigidos van primero, porque son los que destraban una asignacion. */
  it('marca los exigidos y los pone al principio', () => {
    const tipos = employeeDocumentTypeOptions([
      { idRequiredCatalogItem: 'c-domicilio', isRequiredEffective: true },
      { idRequiredCatalogItem: 'c-curp', isRequiredEffective: true },
    ], categorias);

    expect(tipos.slice(0, 2).map((tipo) => tipo.code)).toEqual(['c-curp', 'c-domicilio']);
    expect(tipos.slice(0, 2).every((tipo) => tipo.isRequired)).toBe(true);
    expect(tipos[2].isRequired).toBe(false);
  });

  /**
   * Una regla que no bloquea se pide igual, pero no se marca como obligatoria.
   *
   * <p>Marcarla seria decirle al usuario que sin ese documento no puede asignar, y si puede. La
   * pestaña de requisitos ya la lista aparte, diciendo que no bloquea.</p>
   */
  it('no marca como obligatoria una regla informativa', () => {
    const tipos = employeeDocumentTypeOptions([
      { idRequiredCatalogItem: 'c-licencia', isRequiredEffective: false },
    ], categorias);

    expect(tipos.find((tipo) => tipo.code === 'c-licencia')?.isRequired).toBe(false);
  });

  /** Y una regla que no exige nada del catálogo —una restricción— no debe marcar nada. */
  it('ignora las reglas sin entrada de catalogo', () => {
    const tipos = employeeDocumentTypeOptions([{ idRequiredCatalogItem: null, isRequiredEffective: true }], categorias);

    expect(tipos.every((tipo) => !tipo.isRequired)).toBe(true);
  });
});

describe('Un documento cargado que no cuenta no puede leerse «Al día»', () => {
  const requisito = [{
    idRequiredCatalogItem: 'c-antecedentes',
    requiredCatalogItemName: 'Antecedentes no penales',
    name: 'Carta de no antecedentes',
    isRequiredEffective: true,
  }];
  const documento = (extra: Record<string, unknown>) => [{
    idDocumentCategoryCatalogItem: 'c-antecedentes',
    documentType: 'CriminalRecordCertificate',
    status: 'Validated',
    expiresDate: null,
    documentNumber: null,
    active: true,
    ...extra,
  }] as never;
  const estado = (docs: never) => employeeRequirementRows(requisito, docs, '2026-09-16', 30)[0].state;

  /**
   * El defecto que se vio en los datos de la demo: el cruce miraba sólo si el documento estaba
   * activo y su vencimiento, no su estado.
   *
   * <p>El servidor sólo cuenta como cubierto lo que está en <c>Received</c> o <c>Validated</c>, así
   * que un rechazado con vencimiento futuro se pintaba «Al día» mientras la asignación se rechazaba
   * por ese mismo documento. Es el mismo defecto de siempre: la pantalla afirmando algo que el
   * servidor iba a contradecir.</p>
   */
  it('un rechazado con vencimiento futuro se dice Rechazado, no Al día', () => {
    expect(estado(documento({ status: 'Rejected', expiresDate: '2028-05-21' }))).toBe('Rejected');
  });

  it('un pendiente de validar se dice Sin validar', () => {
    expect(estado(documento({ status: 'Pending', expiresDate: '2028-05-21' }))).toBe('Unvalidated');
  });

  it('uno marcado como no aplicable tampoco cubre', () => {
    expect(estado(documento({ status: 'NotApplicable' }))).toBe('Unvalidated');
  });

  /**
   * Haber caducado manda sobre estar sin validar.
   *
   * <p>El contador de la fila lo calcula el servidor como «estado vencido <b>o</b> fecha pasada»,
   * sin mirar la validación. Mientras esta lista ponía el estado por delante de la fecha, un papel
   * pendiente de validar y caducado se contaba como vencido arriba y se decía «Sin validar» abajo:
   * la ficha ponía «2 vencidos» y la pestaña enseñaba uno.</p>
   *
   * <p>El control es el par: el <b>mismo</b> estado con fecha futura sigue diciendo «Sin validar»,
   * así que lo que cambia el veredicto es la fecha y no otra cosa.</p>
   */
  it('un pendiente de validar que ya caducó se dice Vencido', () => {
    expect(estado(documento({ status: 'Pending', expiresDate: '2025-03-28' }))).toBe('Expired');
    expect(estado(documento({ status: 'Pending', expiresDate: '2028-05-21' }))).toBe('Unvalidated');
  });

  /** El estado `Expired` conserva su etiqueta de siempre, aunque la fecha todavía no haya pasado. */
  it('el estado Expired manda sobre la fecha', () => {
    expect(estado(documento({ status: 'Expired', expiresDate: '2028-05-21' }))).toBe('Expired');
  });

  /** Y lo que sí cuenta sigue contando, con su ventana de aviso intacta. */
  it('recibido y validado siguen dando Al día, Por vencer y Vencido', () => {
    expect(estado(documento({ status: 'Received' }))).toBe('UpToDate');
    expect(estado(documento({ status: 'Validated', expiresDate: '2026-12-31' }))).toBe('UpToDate');
    expect(estado(documento({ status: 'Received', expiresDate: '2026-10-01' }))).toBe('Expiring');
    expect(estado(documento({ status: 'Validated', expiresDate: '2026-09-15' }))).toBe('Expired');
  });

  /** Sin documento sigue siendo «Sin cargar», que es distinto de un documento que no cuenta. */
  it('distingue no tener documento de tener uno que no cuenta', () => {
    expect(employeeRequirementRows(requisito, [], '2026-09-16', 30)[0].state).toBe('Missing');
    expect(employeeRequirementRows(requisito, [], '2026-09-16', 30)[0].documentStatus).toBeNull();
    expect(estado(documento({ status: 'Rejected' }))).not.toBe('Missing');
  });

  /** El estado del documento viaja en la fila, para poder decir por qué no cuenta. */
  it('la fila lleva el estado del documento', () => {
    const fila = employeeRequirementRows(requisito, documento({ status: 'Rejected' }), '2026-09-16', 30)[0];
    expect(fila.documentStatus).toBe('Rejected');
  });
});

describe('La insignia del listado no puede contradecir a la ficha', () => {
  const listado = (extra: Partial<EmployeeListItem>) =>
    ({
      requiredDocuments: 3,
      expiredDocuments: 0,
      expiringDocuments: 0,
      missingDocuments: 0,
      notValidDocuments: 0,
      ...extra,
    }) as EmployeeListItem;

  /**
   * La píldora dice si el expediente está cubierto, y ya no por qué no lo está.
   *
   * <p>El 23 de septiembre de 2026 la pantalla dejó de mostrar vigencias, y con ellas se fueron los
   * conteos —«1 vencido», «2 sin validar»—: dos de esos tres números cuentan requisitos y el otro
   * cuenta archivos, así que fuera del contexto que los explicaba sumaban una cifra que no
   * corresponde a nada.</p>
   */
  it('con todo cubierto dice Completo, y sin requisitos no afirma nada', () => {
    expect(employeeDocumentBadge(listado({})).label).toBe('Completo');
    expect(employeeDocumentBadge(listado({})).tone).toBe('success');
    expect(employeeDocumentBadge(listado({ requiredDocuments: 0 })).label).toBe('Sin requisitos');
  });

  /**
   * <b>La trampa de haber quitado las fechas, y la razón de que esta prueba exista.</b>
   *
   * <p>Al retirar la vigencia de la pantalla era fácil retirar también el hecho: si «vencido»
   * dejara de contar, la persona con la CURP caducada saldría <b>Completo</b> mientras el servidor
   * le niega la asignación por ese mismo documento —y la lista estaría afirmando lo contrario de
   * lo que va a pasar—. Lo que se quitó es la fecha, no el hecho.</p>
   *
   * <p>Las tres causas se comprueban por separado y cada una sola, para que ninguna se apoye en
   * las otras.</p>
   */
  it('un vencido, un rechazado o un hueco dejan el expediente incompleto', () => {
    expect(employeeDocumentBadge(listado({ expiredDocuments: 1 })).label).toBe('Incompleto');
    expect(employeeDocumentBadge(listado({ notValidDocuments: 1 })).label).toBe('Incompleto');
    expect(employeeDocumentBadge(listado({ missingDocuments: 1 })).label).toBe('Incompleto');

    expect(employeeDocumentBadge(listado({ expiredDocuments: 1 })).tone).toBe('danger');
  });

  /**
   * Lo que **no** deja el expediente incompleto: que algo esté por caducar.
   *
   * <p>Es el control que distingue haber quitado las fechas de haber quitado la regla. Un documento
   * vigente que caduca pronto sigue cubriendo su requisito hoy, y el servidor sigue dejando asignar
   * a esa persona: decir «Incompleto» la bloquearía en la pantalla sin que nada la bloquee de
   * verdad.</p>
   */
  it('uno por vencer todavía cubre, así que el expediente sigue completo', () => {
    expect(employeeDocumentBadge(listado({ expiringDocuments: 2 })).label).toBe('Completo');
  });
});
