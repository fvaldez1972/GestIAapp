import { BusinessDocumentEvent } from '../../data-access/document.models';
import { historyChanges } from './entity-document-history';

describe('document history changes', () => {
  const event: BusinessDocumentEvent = {
    idBusinessDocumentEvent: 'event-1', action: 'Updated', status: 'PendingReview', notes: null,
    actorName: 'Reviewer', occurredAt: '2026-09-03T12:00:00Z',
  };

  it('renders only changed allowlisted metadata from backend PascalCase snapshots', () => {
    const changes = historyChanges({ ...event,
      beforeSnapshot: JSON.stringify({ Title: 'Old', Status: 0, Category: 'Contract', IsSensitive: false, OwnerId: 'old-owner', StorageReference: 'private/old' }),
      afterSnapshot: JSON.stringify({ Title: 'New', Status: 1, Category: 'Contract', IsSensitive: true, OwnerId: 'new-owner', StorageReference: 'private/new' }),
    });
    expect(changes).toEqual([
      { label: 'Titulo', before: 'Old', after: 'New' },
      { label: 'Estado', before: 'Pendiente de revision', after: 'Validado' },
      { label: 'Sensible', before: 'No', after: 'Si' },
    ]);
  });

  it.each([undefined, null, '', '{bad json', 'null', '[]', '3'])('does not fabricate changes when a snapshot is unavailable: %s', snapshot => {
    expect(historyChanges({ ...event, beforeSnapshot: snapshot, afterSnapshot: '{"Title":"New"}' })).toEqual([]);
    expect(historyChanges({ ...event, beforeSnapshot: '{"Title":"Old"}', afterSnapshot: snapshot })).toEqual([]);
  });

  it('accepts camelCase and string statuses and excludes objects, notes and raw references', () => {
    expect(historyChanges({ ...event,
      beforeSnapshot: JSON.stringify({ title: {}, status: 'PendingReview', notes: 'old', storageReference: 'old' }),
      afterSnapshot: JSON.stringify({ title: [], status: 'Rejected', notes: 'new', storageReference: 'new' }),
    })).toEqual([{ label: 'Estado', before: 'Pendiente de revision', after: 'Rechazado' }]);
  });
});
