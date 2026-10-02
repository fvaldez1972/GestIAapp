import { BusinessDocumentEvent, BusinessDocumentStatus } from '../../data-access/document.models';

export const documentStatusLabels: Record<BusinessDocumentStatus, string> = {
  PendingReview: 'Pendiente de revision', Validated: 'Validado', Rejected: 'Rechazado',
  Expired: 'Vencido', Archived: 'Archivado',
};

const fields = [
  ['Title', 'Titulo'], ['Category', 'Categoria'], ['Status', 'Estado'], ['IssuedDate', 'Emision'],
  ['ExpiresDate', 'Vencimiento'], ['IsSensitive', 'Sensible'], ['HasNotes', 'Con notas'],
  ['HasReviewNotes', 'Con notas de revision'], ['Active', 'Activo'],
] as const;

export function historyChanges(event: BusinessDocumentEvent): { label: string; before: string; after: string }[] {
  const before = parseSnapshot(event.beforeSnapshot);
  const after = parseSnapshot(event.afterSnapshot);
  if (!before || !after) return [];
  // Only display named metadata fields; never expose references, raw snapshots or owner identifiers.
  return fields.flatMap(([field, label]) => {
    const oldValue = readField(before, field);
    const newValue = readField(after, field);
    return oldValue === newValue ? [] : [{ label, before: formatValue(field, oldValue), after: formatValue(field, newValue) }];
  });
}

function parseSnapshot(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readField(snapshot: Record<string, unknown>, field: string): string | number | boolean | null {
  const value = snapshot[field] ?? snapshot[field[0].toLowerCase() + field.slice(1)];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
}

function formatValue(field: string, value: string | number | boolean | null): string {
  if (value === null || value === '') return 'Sin dato';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (field === 'Status') {
    const statuses: readonly BusinessDocumentStatus[] = ['PendingReview', 'Validated', 'Rejected', 'Expired', 'Archived'];
    const status = typeof value === 'number' ? statuses[value] : value as BusinessDocumentStatus;
    return Object.hasOwn(documentStatusLabels, status) ? documentStatusLabels[status] : 'Desconocido';
  }
  return String(value);
}
