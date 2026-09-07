/**
 * Los componentes compartidos del sistema cerrado, en un solo sitio.
 *
 * <p>Una pantalla importa de aquí y no de siete rutas distintas. También sirve de inventario: lo
 * que no está en esta lista no es una pieza del sistema, y una pantalla que necesite algo que no
 * esté aquí tiene que decir por qué antes de inventárselo.</p>
 */
export { GiCell, GiDataTable } from './gi-data-table/gi-data-table';
export type { GiColumn, GiTableState } from './gi-data-table/gi-data-table';

export { GiDetailPanel, GiTabContent } from './gi-detail-panel/gi-detail-panel';
export type { GiTab } from './gi-detail-panel/gi-detail-panel';

export { GiFilterBar } from './gi-filter-bar/gi-filter-bar';
export type { GiFilterGroup } from './gi-filter-bar/gi-filter-bar';

export { GiRowActions } from './gi-row-actions/gi-row-actions';
export type { GiRowAction } from './gi-row-actions/gi-row-actions';

export { GiEmptyState } from './gi-empty-state/gi-empty-state';
export type { GiEmptyVariant } from './gi-empty-state/gi-empty-state';

export { GiConfirmDialog } from './gi-confirm-dialog/gi-confirm-dialog';

export { GiMetricCard } from './gi-metric-card/gi-metric-card';
export type { GiMetricState, GiMetricTone } from './gi-metric-card/gi-metric-card';

export { GiSelect } from './gi-select/gi-select';
export type { GiSelectOption } from './gi-select/gi-select';

export { GiDayClosure, GI_REASON_MIN_LENGTH } from './gi-day-closure/gi-day-closure';
export type { GiDayState, GiDaySnapshot } from './gi-day-closure/gi-day-closure';

export { GiOperationDayBar } from './gi-operation-day-bar/gi-operation-day-bar';

export { GiExceptionRow } from './gi-exception-row/gi-exception-row';
export type { GiExceptionType } from './gi-exception-row/gi-exception-row';
