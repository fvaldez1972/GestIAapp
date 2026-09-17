import { ServiceAssignment } from '../../clients/data-access/client.models';
import { AssignmentCandidateSource, buildAssignmentCandidates } from './assignment-candidates';

const persona = (overrides: Partial<AssignmentCandidateSource> = {}): AssignmentCandidateSource => ({
  idEmployee: 'e1',
  codeEmployee: 'EMP-001',
  fullName: 'Renata Villaseñor Cortés',
  jobPositionName: 'Guardia intramuros',
  jobTitle: null,
  assignmentCount: 0,
  ...overrides,
});

const asignacion = (overrides: Partial<ServiceAssignment> = {}): ServiceAssignment => ({
  idServiceAssignment: 'a1',
  idEmployee: 'e1',
  employeeCode: 'EMP-001',
  employeeName: 'Renata Villaseñor Cortés',
  idService: 's1',
  idPosition: 'p1',
  positionCode: 'P-01',
  positionName: 'Caseta poniente',
  assignmentType: 'Primary',
  startDate: '2026-09-01',
  endDate: null,
  isPrimary: true,
  notes: null,
  active: true,
  rowVersion: 'rv',
  ...overrides,
});

describe('buildAssignmentCandidates', () => {
  /**
   * Quien ya está en esa posición no es candidato: ofrecerlo sería ofrecer duplicar la asignación
   * que ya tiene.
   */
  it('no ofrece a quien ya está asignado a esa misma posición', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [persona(), persona({ idEmployee: 'e2', codeEmployee: 'EMP-002', fullName: 'Ana Ruiz' })],
      assignments: [asignacion()],
      idPosition: 'p1',
    });

    expect(candidatos.map((c) => c.id)).toEqual(['e2']);
  });

  /** Pero sí ofrece a quien está en otra posición del mismo servicio, diciendo cuál. */
  it('ofrece a quien cubre otra posición del servicio y dice qué cubre', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [persona()],
      assignments: [asignacion({ idPosition: 'p9', positionName: 'Rondín nocturno' })],
      idPosition: 'p1',
    });

    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].availability).toBe('Ocupado · ya cubre Rondín nocturno en este servicio');
  });

  /**
   * «Ocupado» sale del conteo del servidor, no de una suposición: un empleado puede estar asignado
   * en otro servicio que esta pantalla no ve.
   */
  it('dice Ocupado con el conteo de asignaciones vigentes, y Disponible sin ninguna', () => {
    const conAsignaciones = buildAssignmentCandidates({
      employees: [persona({ assignmentCount: 1 }), persona({ idEmployee: 'e2', assignmentCount: 3 })],
      assignments: [],
      idPosition: 'p1',
    });

    expect(conAsignaciones[0].availability).toBe('Ocupado · con una asignación vigente');
    expect(conAsignaciones[1].availability).toBe('Ocupado · con 3 asignaciones vigentes');

    const libre = buildAssignmentCandidates({
      employees: [persona()],
      assignments: [],
      idPosition: 'p1',
    });

    expect(libre[0].availability).toBe('Disponible · sin asignaciones vigentes');
  });

  /** Ocupado no bloquea: el estado sirve para decidir, no para impedir. */
  it('ocupado no cambia el veredicto de elegibilidad', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [persona({ assignmentCount: 2 })],
      assignments: [],
      idPosition: 'p1',
      eligibility: new Map([['e1', { isEligible: true, blockingReasons: [] }]]),
    });

    expect(candidatos[0].standing).toBe('eligible');
    expect(candidatos[0].availability).toContain('Ocupado');
  });

  /**
   * «Elegible» es una afirmación del servidor. Sin su respuesta la fila dice «Sin comprobar», que
   * no es lo mismo que decir que cumple.
   */
  it('sin veredicto del servidor nadie sale elegible', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [persona()],
      assignments: [],
      idPosition: 'p1',
    });

    expect(candidatos[0].standing).toBe('unchecked');
    expect(candidatos[0].consequence).toBeUndefined();
  });

  it('un veredicto negativo lleva el motivo entero', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [persona()],
      assignments: [],
      idPosition: 'p1',
      eligibility: new Map([
        [
          'e1',
          {
            isEligible: false,
            blockingReasons: ['Falta documento vigente: Curp', 'Falta evaluación: Polygraph'],
          },
        ],
      ]),
    });

    expect(candidatos[0].standing).toBe('blocked');
    expect(candidatos[0].consequence).toBe(
      'Falta documento vigente: Curp · Falta evaluación: Polygraph',
    );
  });

  /** Un rechazo sin motivo no se deja en blanco: quien asigna necesita algo que hacer. */
  it('un veredicto negativo sin motivos igual explica algo', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [persona()],
      assignments: [],
      idPosition: 'p1',
      eligibility: new Map([['e1', { isEligible: false, blockingReasons: [] }]]),
    });

    expect(candidatos[0].consequence).toContain('no lo considera elegible');
  });

  /** El puesto por catálogo, y el texto libre heredado dicho como lo que es. */
  it('distingue el puesto de catálogo del texto libre sin catalogar', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [
        persona(),
        persona({ idEmployee: 'e2', jobPositionName: null, jobTitle: 'Velador' }),
        persona({ idEmployee: 'e3', jobPositionName: null, jobTitle: null }),
      ],
      assignments: [],
      idPosition: 'p1',
    });

    expect(candidatos.map((c) => c.role)).toEqual([
      'Guardia intramuros',
      'Velador · sin catalogar',
      'Sin puesto registrado',
    ]);
  });

  /** Una asignación terminada no ocupa a nadie. */
  it('las asignaciones inactivas no cuentan para ocupar ni para excluir', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [persona()],
      assignments: [asignacion({ active: false })],
      idPosition: 'p1',
    });

    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].availability).toBe('Disponible · sin asignaciones vigentes');
  });

  it('el nombre lleva el código, para desempatar homónimos', () => {
    const candidatos = buildAssignmentCandidates({
      employees: [persona()],
      assignments: [],
      idPosition: 'p1',
    });

    expect(candidatos[0].name).toBe('EMP-001 · Renata Villaseñor Cortés');
  });
});
