import { DocumentsPage } from './documents-page';

describe('Document date rendering', () => {
  const format = (value: string | null) => DocumentsPage.prototype['formattedDate'](value);

  it('renders a missing date without inventing one', () => {
    expect(format(null)).toBe('No capturada');
  });

  it.each(['2026-09-03', '2026-09-03T12:00:00Z'])('accepts API date %s', value => {
    expect(format(value)).toContain('2026');
    expect(format(value)).not.toContain('disponible');
  });

  it('does not crash the document list on an invalid legacy date', () => {
    expect(format('invalid-date')).toBe('Fecha no disponible');
  });
});
