import { of } from 'rxjs';
import { activeOptions } from './active-options';

describe('activeOptions', () => {
  it('collects later pages without offering inactive records', () => {
    const load = vi.fn((page: number) => of({ page, pageSize: 2, totalCount: 3,
      items: page === 1 ? [{ active: true, id: 'first' }, { active: false, id: 'inactive' }] : [{ active: true, id: 'last' }] }));
    activeOptions(load).subscribe(result => expect(result.items.map(item => item.id)).toEqual(['first', 'last']));
    expect(load.mock.calls.map(args => args[0])).toEqual([1, 2]);
  });
  it('terminates on an empty page even when a stale total advertises more records', () => {
    const load = vi.fn((page: number) => of({ page, pageSize: 100, totalCount: 500, items: [] }));
    activeOptions(load).subscribe(result => expect(result.items).toEqual([]));
    expect(load).toHaveBeenCalledOnce();
  });
});
