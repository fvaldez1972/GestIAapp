import { GiCandidate } from '../../../shared/ui/gi-candidate-picker/gi-candidate-picker';
import { ServiceAssignment } from '../../clients/data-access/client.models';
import { CandidateEligibility } from '../../planning/data-access/planning.models';

/** Lo que hace falta saber de una persona para ofrecerla como candidata. */
export type AssignmentCandidateSource = {
  readonly idEmployee: string;
  readonly codeEmployee: string;
  readonly fullName: string;
  readonly jobPositionName: string | null;
  readonly jobTitle: string | null;
  /** Cuántas asignaciones vigentes tiene, en cualquier servicio. Lo cuenta el servidor. */
  readonly assignmentCount: number;
};

/**
 * Quién puede tomar una posición, y qué se sabe de cada uno antes de guardar.
 *
 * <p><b>Por qué existe.</b> La lista de candidatos ofrecía a todos los empleados activos sin
 * distinguir, y el rechazo llegaba al guardar: quien asignaba descubría ahí que a la persona le
 * faltaba un documento. Ahora el estado va en la fila, antes de elegir.</p>
 *
 * <p><b>Ocupado no bloquea, y es deliberado.</b> Alguien con asignaciones vigentes puede estar
 * cubriendo sólo los domingos y hacer falta un miércoles. El dato se enseña para decidir, no para
 * impedir; los traslapes de turno se reportan en Planeación, que es donde se ven las horas.</p>
 *
 * <p><b>«Elegible» sólo lo dice el servidor.</b> Sin su veredicto la persona sale «Sin comprobar»,
 * que es la verdad: no es lo mismo no saber que saber que sí. Repetir aquí las reglas de
 * elegibilidad sería la regla de negocio protegible que el principio 5 prohíbe en el frontend, y
 * encima podría contestar distinto de lo que contesta al guardar.</p>
 */
export function buildAssignmentCandidates(options: {
  readonly employees: readonly AssignmentCandidateSource[];
  /** Las asignaciones del servicio abierto, para no ofrecer a quien ya está en esa posición. */
  readonly assignments: readonly ServiceAssignment[];
  readonly idPosition: string;
  readonly eligibility?: ReadonlyMap<string, CandidateEligibility>;
  /**
   * Con qué clientes está ocupada cada persona hoy, según el servidor.
   *
   * <p>Sin esto la fila decía «Ocupado · con una asignación vigente» sin nombrar a nadie, y para
   * saber si esa persona podía tomar otro turno había que salir de la pantalla.</p>
   */
  readonly currentClients?: ReadonlyMap<string, readonly string[]>;
}): readonly GiCandidate[] {
  const vigentes = options.assignments.filter((assignment) => assignment.active);

  const yaEnLaPosicion = new Set(
    vigentes
      .filter((assignment) => assignment.idPosition === options.idPosition)
      .map((assignment) => assignment.idEmployee),
  );

  const enOtraPosicion = new Map(
    vigentes
      .filter((assignment) => assignment.idPosition !== options.idPosition)
      .map((assignment) => [assignment.idEmployee, assignment]),
  );

  return options.employees
    .filter((employee) => !yaEnLaPosicion.has(employee.idEmployee))
    .map((employee): GiCandidate => {
      const otra = enOtraPosicion.get(employee.idEmployee);
      const veredicto = options.eligibility?.get(employee.idEmployee);

      return {
        id: employee.idEmployee,
        name: `${employee.codeEmployee} · ${employee.fullName}`,
        // El puesto por catálogo. El texto libre heredado se dice como lo que es, para que nadie
        // suponga que sirve para comprobar el perfil: la comparación va por identificador.
        role:
          employee.jobPositionName ??
          (employee.jobTitle ? `${employee.jobTitle} · sin catalogar` : 'Sin puesto registrado'),
        availability: disponibilidad(employee, otra, options.currentClients?.get(employee.idEmployee)),
        ...veredictoDelServidor(veredicto),
      };
    });
}

/**
 * Qué dice la línea de disponibilidad.
 *
 * <p><b>Ocupado nombra al cliente.</b> Decir «con una asignación vigente» obligaba a salir de la
 * pantalla para saber si esa persona podía tomar otro turno: con el cliente delante, quien asigna
 * decide sin moverse.</p>
 *
 * <p>Los nombres los manda el servidor. Si no llegan —un backend anterior a este endpoint— se cae
 * al conteo de siempre en lugar de dejar la línea vacía.</p>
 */
function disponibilidad(
  employee: AssignmentCandidateSource,
  otra: ServiceAssignment | undefined,
  clientes: readonly string[] | undefined,
): string {
  if (otra) {
    const posicion = otra.positionName ?? otra.positionCode ?? 'otra posición';
    return `Ocupado · ya cubre ${posicion} en este servicio`;
  }

  if (clientes?.length) {
    // Tres y «y N más»: con ocho clientes la línea se volvía más larga que la fila.
    const visibles = clientes.slice(0, 3).join(', ');
    const resto = clientes.length - 3;
    return resto > 0
      ? `Ocupado · con ${visibles} y ${resto} ${resto === 1 ? 'cliente' : 'clientes'} más`
      : `Ocupado · con ${visibles}`;
  }

  if (employee.assignmentCount > 0) {
    return employee.assignmentCount === 1
      ? 'Ocupado · con una asignación vigente'
      : `Ocupado · con ${employee.assignmentCount} asignaciones vigentes`;
  }

  return 'Disponible · sin asignaciones vigentes';
}

function veredictoDelServidor(
  veredicto: CandidateEligibility | undefined,
): Pick<GiCandidate, 'standing' | 'consequence'> {
  if (!veredicto) {
    return { standing: 'unchecked' };
  }

  if (veredicto.isEligible) {
    return { standing: 'eligible' };
  }

  return {
    standing: 'blocked',
    // El motivo va entero. «No cumple» a secas deja a quien asigna sin saber si el problema se
    // arregla en Personal, en Catálogos o pidiendo un documento.
    consequence:
      veredicto.blockingReasons.length > 0
        ? veredicto.blockingReasons.join(' · ')
        : 'El servidor no lo considera elegible para esta posición.',
  };
}
