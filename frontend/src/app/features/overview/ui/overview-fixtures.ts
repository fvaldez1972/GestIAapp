import {
  Overview,
  OverviewAttentionItem,
  OverviewMetric,
} from '../data-access/overview.models';

/**
 * Datos de ejemplo para las pruebas de la pantalla de Inicio.
 *
 * <p>Vive aquí y no dentro de una prueba porque los archivos de prueba necesitan el mismo objeto y
 * con la misma forma: si cada uno se lo inventa, dejan de comprobar lo mismo. No lo importa ningún
 * componente, así que no entra al paquete.</p>
 *
 * <p>Nombres inventados, como manda el proyecto: nunca personas reales.</p>
 */

export function overview(extra: Partial<Overview> = {}): Overview {
  return {
    operationDate: '2026-09-09',
    previousOperationDate: '2026-09-08',
    weekStartDate: '2026-09-07',
    weekEndDate: '2026-09-13',
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
    coveredDays: 7,
    ...extra,
  };
}

/**
 * Una organización recién creada: los cuatro indicadores sin poder calcularse y nada que atender.
 *
 * <p>Es el escenario que decide el diseño de la pantalla, así que se escribe una vez y se comparte:
 * el servidor devuelve los cuatro indicadores <b>siempre</b>, y con la organización vacía los
 * cuatro salen en <c>Pending</c> con su propio motivo.</p>
 */
export function organizacionVacia(): Overview {
  return overview({
    metrics: [
      indicador({
        key: 'PlannedShifts',
        state: 'Pending',
        value: 0,
        tone: 'Neutral',
        total: 0,
        serviceCount: 0,
        coveredDays: 0,
        route: '/planeacion',
      }),
      indicador({
        key: 'PositionsWithoutPrimary',
        state: 'Pending',
        value: 0,
        tone: 'Success',
        total: 0,
        serviceCount: 0,
      }),
      indicador({
        key: 'UncoveredShiftsYesterday',
        state: 'Pending',
        value: 0,
        tone: 'Success',
        total: 0,
        serviceCount: 0,
        asOfDate: '2026-09-08',
        route: '/operacion/cobertura',
      }),
      indicador({
        key: 'ExpiredDocuments',
        state: 'Pending',
        value: 0,
        tone: 'Success',
        total: 0,
        serviceCount: 0,
        route: '/personal',
      }),
    ],
    attention: [],
  });
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
