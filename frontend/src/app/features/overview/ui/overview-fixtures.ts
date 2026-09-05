import {
  Overview,
  OverviewAttentionItem,
  OverviewMetric,
  OverviewSetupCounts,
  OverviewSetupStep,
  OverviewSetupStepKey,
} from '../data-access/overview.models';

/**
 * Datos de ejemplo para las pruebas de la pantalla de Inicio.
 *
 * <p>Vive aquí y no dentro de una prueba porque los cinco archivos de prueba necesitan el mismo
 * objeto y con la misma forma: si cada uno se lo inventa, dejan de comprobar lo mismo. No lo
 * importa ningún componente, así que no entra al paquete.</p>
 *
 * <p>Nombres inventados, como manda el proyecto: nunca personas reales.</p>
 */

const ORDENES: Record<OverviewSetupStepKey, number> = {
  Catalogs: 1,
  Clients: 2,
  Services: 3,
  Positions: 4,
  Employees: 5,
  Assignments: 6,
  Planning: 7,
};

const RUTAS: Record<OverviewSetupStepKey, string> = {
  Catalogs: '/catalogos',
  Clients: '/clientes',
  Services: '/servicios',
  Positions: '/servicios',
  Employees: '/personal',
  Assignments: '/servicios',
  Planning: '/planeacion',
};

export const CONTEOS: OverviewSetupCounts = {
  jobPositions: 8,
  skills: 14,
  zones: 4,
  incidentReasons: 6,
  coverageReasons: 3,
  clients: 3,
  clientSites: 4,
  clientContacts: 5,
  clientsWithoutContact: 1,
  services: 2,
  servicesWithConfiguration: 2,
  servicesWithoutPositions: 2,
  positions: 38,
  positionsWithPattern: 36,
  employees: 96,
  employeesWithFile: 96,
  primaryAssignments: 35,
  reliefAssignments: 9,
  publishedVersions: 1,
};

export function paso(
  key: OverviewSetupStepKey,
  done: boolean,
  extra: Partial<OverviewSetupStep> = {},
): OverviewSetupStep {
  return {
    key,
    order: ORDENES[key],
    done,
    blockedBy: [],
    route: RUTAS[key],
    highlightName: null,
    ...extra,
  };
}

/** Una organización con los primeros `hechos` pasos cerrados, en el orden del camino. */
export function overview(hechos: number, extra: Partial<Overview> = {}): Overview {
  const claves = Object.keys(ORDENES) as OverviewSetupStepKey[];
  const steps = claves.map((key, indice) => paso(key, indice < hechos));

  return {
    operationDate: '2026-09-09',
    previousOperationDate: '2026-09-08',
    weekStartDate: '2026-09-07',
    weekEndDate: '2026-09-13',
    setup: { completedSteps: hechos, totalSteps: 7, counts: CONTEOS, steps },
    metrics: [],
    attention: [],
    ...extra,
  };
}

export function indicador(extra: Partial<OverviewMetric> = {}): OverviewMetric {
  return {
    key: 'PositionsWithoutPrimary',
    state: 'Ready',
    value: 3,
    tone: 'Danger',
    total: 38,
    serviceCount: 2,
    asOfDate: null,
    route: '/servicios',
    ...extra,
  };
}

export function asunto(extra: Partial<OverviewAttentionItem> = {}): OverviewAttentionItem {
  return {
    key: 'PositionsWithoutPrimary',
    severity: 'Danger',
    count: 3,
    serviceCount: 2,
    sinceDate: '2026-08-28',
    route: '/servicios',
    ...extra,
  };
}
