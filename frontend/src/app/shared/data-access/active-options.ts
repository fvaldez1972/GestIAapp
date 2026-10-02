import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

type Page<T> = { readonly items: readonly T[]; readonly totalCount: number; readonly page: number; readonly pageSize: number };

export function activeOptions<T extends { readonly active: boolean }>(load: (page: number) => Observable<Page<T>>) {
  return load(1).pipe(
    expand(page => page.items.length && page.page * page.pageSize < page.totalCount ? load(page.page + 1) : EMPTY),
    reduce((items, page) => [...items, ...page.items.filter(item => item.active)], [] as T[]),
    map(items => ({ items, totalCount: items.length, page: 1, pageSize: items.length, totalPages: items.length ? 1 : 0 })),
  );
}
