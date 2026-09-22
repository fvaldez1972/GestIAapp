import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, finalize, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { GiCell, GiColumn, GiDataTable, GiTableState } from '../../../../shared/ui/gi-data-table/gi-data-table';
import { GiFilterBar, GiFilterGroup } from '../../../../shared/ui/gi-filter-bar/gi-filter-bar';
import { GiRowAction, GiRowActions } from '../../../../shared/ui/gi-row-actions/gi-row-actions';
import { GiSelect, GiSelectOption } from '../../../../shared/ui/gi-select/gi-select';
import { normalizeCatalogName } from '../../../../shared/util/catalog-name';
import { CatalogApiService } from '../../data-access/catalog-api.service';
import { CatalogItem } from '../../data-access/catalog.models';
import { CatalogPage, catalogPageBySlug } from '../../data-access/catalog-pages';

/**
 * Los tamaños de página que se ofrecen.
 *
 * <p>Empieza en <b>10</b> y no en «todos» a propósito: la razón de paginar aquí no es que hoy
 * sobren registros —hoy no sobran— sino que mañana sí, y una lista que crece sin tope acaba siendo
 * una barra de desplazamiento dentro de otra. Con el tope puesto desde el principio, un catálogo
 * que pase de ocho a ochenta valores no cambia de comportamiento.</p>
 */
const TAMANOS_DE_PAGINA = [5, 10, 50, 100] as const;
const TAMANO_POR_OMISION = 10;

/**
 * La página de un catálogo. **Una sola, para los dieciséis.**
 *
 * <p><b>Por qué una y no dieciséis.</b> Todos los catálogos simples son la misma pantalla: una
 * lista de valores con nombre, descripción, orden y estado. Lo único que cambia entre ellos son
 * los rótulos, si sus valores llevan naturaleza y si cuelgan de otro catálogo, y eso cabe en una
 * tabla de datos —`CATALOG_PAGE_GROUPS`— en vez de en dieciséis componentes que habría que
 * corregir dieciséis veces. Agregar un catálogo nuevo es agregar un renglón ahí.</p>
 *
 * <p><b>Qué NO hace esta pantalla, y por qué no es un olvido.</b> No enseña la columna de uso —
 * cuántos registros usan cada valor— ni el número en el aviso al desactivar. Hoy ese conteo se
 * calcula en el navegador sobre listas que la pantalla anterior ya traía enteras, y aquí no se
 * puede: la página de Puestos tendría que descargarse todo el personal para contar. Se hace en el
 * servidor, en su propia tanda. <b>Hasta entonces la pantalla anterior sigue viva</b>, porque es
 * la única que hoy sabe ese número.</p>
 */
@Component({
  selector: 'app-catalog-list-page',
  imports: [ReactiveFormsModule, GiCell, GiDataTable, GiFilterBar, GiRowActions, GiSelect],
  templateUrl: './catalog-list-page.html',
  styleUrl: './catalog-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListPage {
  private readonly editor = viewChild<ElementRef<HTMLDialogElement>>('editor');

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CatalogApiService);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private dataSubscription?: Subscription;

  /** La organización de trabajo la fija la barra de contexto, y sólo ella. */
  protected readonly selectedOrganizationId = this.auth.operationalOrganizationId;
  protected readonly canWrite = computed(() => this.auth.hasPermission('CATALOGS.WRITE'));

  /**
   * Qué catálogo pide la ruta.
   *
   * <p>Se lee como señal y no una sola vez al construir, porque el enrutador <b>reutiliza el
   * componente</b> al pasar de un catálogo a otro del submenú: la ruta cambia y la instancia no.
   * Leerlo una vez dejaría la pantalla enseñando el catálogo anterior con el título nuevo.</p>
   */
  private readonly slug = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap })
    ;
  protected readonly page = computed<CatalogPage | undefined>(() =>
    catalogPageBySlug(this.slug().get('catalogo') ?? ''),
  );

  protected readonly items = signal<readonly CatalogItem[]>([]);
  protected readonly parents = signal<readonly CatalogItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly selectedItemId = signal('');

  protected readonly search = signal('');
  protected readonly stateFilter = signal<'' | 'active' | 'inactive'>('');
  protected readonly natureFilter = signal<'' | 'blocking' | 'informative'>('');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal<number>(TAMANO_POR_OMISION);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(1000)]],
    order: [1, [Validators.required, Validators.min(1), Validators.max(100000)]],
    status: ['active' as 'active' | 'inactive', [Validators.required]],
    idParentCatalogItem: [''],
    blockingMark: ['informative' as 'blocking' | 'informative'],
  });

  constructor() {
    // Cambiar de catálogo en el submenú tiene que recargar y devolver los filtros a cero: heredar
    // el texto buscado en el catálogo anterior enseñaría una lista vacía sin explicación.
    effect(() => {
      this.page();
      this.selectedOrganizationId();
      this.search.set('');
      this.stateFilter.set('');
      this.natureFilter.set('');
      this.currentPage.set(1);
      this.loadData();
    });
  }

  // ── Lo que se dibuja ────────────────────────────────────────────────────────────────────────

  protected readonly columns = computed<readonly GiColumn[]>(() => {
    const page = this.page();

    return [
      { key: 'fila', label: '#', width: '52px', kind: 'meta' as const },
      { key: 'name', label: 'Nombre', width: '220px', kind: 'name' as const },
      ...(page?.parentType ? [{ key: 'parent', label: 'Categoría', width: '170px' }] : []),
      { key: 'description', label: 'Descripción' },
      ...(page?.hasNature ? [{ key: 'nature', label: 'Naturaleza', width: '150px' }] : []),
      { key: 'state', label: 'Estatus', width: '120px' },
      { key: 'updatedAt', label: 'Última edición', width: '150px', kind: 'meta' as const },
      { key: 'actions', label: '', width: '90px', align: 'end' as const },
    ];
  });

  protected readonly filterGroups = computed<readonly GiFilterGroup[]>(() => {
    // Las opciones van sin la de «todos»: la agrega `gi-filter-bar`, y ponerla aquí la duplicaría.
    const grupos: GiFilterGroup[] = [
      {
        id: 'estado',
        label: 'Estatus',
        value: this.stateFilter(),
        allLabel: 'Todos los estatus',
        options: [
          { value: 'active', label: 'Activos' },
          { value: 'inactive', label: 'Inactivos' },
        ],
      },
    ];

    if (this.page()?.hasNature) {
      grupos.push({
        id: 'naturaleza',
        label: 'Naturaleza',
        value: this.natureFilter(),
        allLabel: 'Toda naturaleza',
        options: [
          { value: 'blocking', label: 'Bloqueante' },
          { value: 'informative', label: 'Informativa' },
        ],
      });
    }

    return grupos;
  });

  protected readonly filtradas = computed(() => {
    const texto = normalizeCatalogName(this.search());
    const estado = this.stateFilter();
    const naturaleza = this.natureFilter();

    return this.items().filter((item) => {
      if (estado === 'active' && !item.active) return false;
      if (estado === 'inactive' && item.active) return false;
      if (naturaleza === 'blocking' && item.isBlocking !== true) return false;
      if (naturaleza === 'informative' && item.isBlocking === true) return false;

      if (!texto) return true;

      return (
        normalizeCatalogName(item.name).includes(texto) ||
        normalizeCatalogName(item.description ?? '').includes(texto)
      );
    });
  });

  /**
   * La página que se ve, cortada en el navegador.
   *
   * <p>Se pagina aquí y no en el servidor porque, quitada la geografía, estos catálogos tienen
   * decenas de valores por organización: pedirlos por páginas costaría un cambio de contrato para
   * ahorrar unos kilobytes. Si alguno crece de verdad, esto es lo que hay que mover.</p>
   */
  protected readonly paginadas = computed(() => {
    const desde = (this.currentPage() - 1) * this.pageSize();
    return this.filtradas().slice(desde, desde + this.pageSize());
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtradas().length / this.pageSize())),
  );

  /** «1 a 10 de 34», para que el selector de tamaño diga algo. */
  protected readonly rango = computed(() => {
    const total = this.filtradas().length;

    if (total === 0) {
      return '';
    }

    const desde = (this.currentPage() - 1) * this.pageSize() + 1;
    return `${desde} a ${Math.min(desde + this.pageSize() - 1, total)} de ${total}`;
  });

  protected readonly pageSizeOptions: readonly GiSelectOption[] = TAMANOS_DE_PAGINA.map((tamano) => ({
    value: String(tamano),
    label: String(tamano),
  }));

  protected readonly tableState = computed<GiTableState>(() => {
    if (this.loading()) return 'loading';
    if (this.error()) return 'error';
    if (this.filtradas().length > 0) return 'ready';
    return this.items().length > 0 ? 'empty-filtered' : 'empty';
  });

  protected readonly parentOptions = computed<readonly GiSelectOption[]>(() => [
    { value: '', label: 'Sin categoría' },
    ...this.parents()
      .filter((item) => item.active)
      .map((item) => ({ value: item.idCatalogItem, label: item.name })),
  ]);

  protected readonly natureOptions: readonly GiSelectOption[] = [
    { value: 'blocking', label: 'Bloqueante: impide asignar y publicar' },
    { value: 'informative', label: 'Informativa: sólo deja constancia' },
  ];

  protected readonly statusOptions: readonly GiSelectOption[] = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
  ];

  /** Cómo se identifica una fila para la tabla. Sin esto no hay `track` fiable. */
  protected readonly porId = (item: CatalogItem) => item.idCatalogItem;

  protected rowActions(item: CatalogItem): readonly GiRowAction[] {
    // Nunca «Eliminar»: aquí nada se borra. Desactivar deja el valor consultable y libera la
    // pantalla sin romper los registros que ya lo apuntan.
    return [
      { id: 'edit', label: 'Editar' },
      { id: 'toggle', label: item.active ? 'Desactivar' : 'Activar' },
    ];
  }

  protected parentName(item: CatalogItem): string {
    if (!item.idParentCatalogItem) return '—';
    return this.parents().find((padre) => padre.idCatalogItem === item.idParentCatalogItem)?.name ?? '—';
  }

  protected natureLabel(item: CatalogItem): string {
    return item.isBlocking === true ? 'Bloqueante' : 'Informativa';
  }

  protected rowNumber(item: CatalogItem): number {
    // El número de fila es una ayuda de lectura, no un dato del registro: cambia con el orden y
    // con el filtro, y por eso la columna se llama «#» y nunca «ID».
    return this.filtradas().indexOf(item) + 1;
  }

  protected fecha(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Filtros y paginación ────────────────────────────────────────────────────────────────────

  protected onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(1);
  }

  protected onFilter(change: { groupId: string; value: string }): void {
    if (change.groupId === 'estado') this.stateFilter.set(change.value as '' | 'active' | 'inactive');
    if (change.groupId === 'naturaleza') this.natureFilter.set(change.value as '' | 'blocking' | 'informative');
    this.currentPage.set(1);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.stateFilter.set('');
    this.natureFilter.set('');
    this.currentPage.set(1);
  }

  protected goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPaginas()));
  }

  /**
   * Cambiar el tamaño devuelve a la primera página.
   *
   * <p>Sin esto, quien está en la página 4 de 5 y pasa de 10 a 100 por página se queda en una
   * página que ya no existe y ve una tabla vacía.</p>
   */
  protected setPageSize(value: string): void {
    const tamano = Number(value);

    if (TAMANOS_DE_PAGINA.includes(tamano as (typeof TAMANOS_DE_PAGINA)[number])) {
      this.pageSize.set(tamano);
      this.currentPage.set(1);
    }
  }

  // ── Alta y edición ──────────────────────────────────────────────────────────────────────────

  protected newItem(): void {
    if (!this.canWrite()) return;

    this.error.set('');
    this.selectedItemId.set('');
    this.form.reset({
      name: '',
      description: '',
      order: Math.min(100000, Math.max(0, ...this.items().map((item) => item.order ?? 1)) + 1),
      status: 'active',
      idParentCatalogItem: '',
      blockingMark: 'informative',
    });
    this.editor()?.nativeElement.showModal();
  }

  protected editItem(item: CatalogItem): void {
    if (!this.canWrite()) return;

    this.error.set('');
    this.selectedItemId.set(item.idCatalogItem);
    this.form.reset({
      name: item.name,
      description: item.description ?? '',
      order: item.order ?? 1,
      status: item.active ? 'active' : 'inactive',
      idParentCatalogItem: item.idParentCatalogItem ?? '',
      // Una entrada sin marca se dibuja informativa, que es lo que ya hace: los dos lugares que
      // consultan la marca resuelven el nulo como «no bloquea».
      blockingMark: item.isBlocking === true ? 'blocking' : 'informative',
    });
    this.editor()?.nativeElement.showModal();
  }

  protected closeEditor(): void {
    this.editor()?.nativeElement.close();
  }

  protected save(): void {
    const page = this.page();
    const organizationId = this.selectedOrganizationId();
    if (!page || !organizationId || !this.canWrite() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request = {
      idOrganization: organizationId,
      type: page.type,
      name: value.name.trim(),
      description: value.description.trim() || null,
      idParentCatalogItem: page.parentType ? value.idParentCatalogItem || null : null,
      order: Number(value.order),
      active: value.status === 'active',
      // Sólo viaja donde significa algo. En los demás catálogos el servidor la rechaza.
      isBlocking: page.hasNature ? value.blockingMark === 'blocking' : null,
    };

    const selected = this.selectedItemId();
    this.saving.set(true);
    const call = selected ? this.api.updateItem(selected, request) : this.api.createItem(request);

    call
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.set(selected ? 'Valor actualizado.' : 'Valor creado.');
          this.selectedItemId.set('');
          this.closeEditor();
          this.loadData();
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected toggleActive(item: CatalogItem): void {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || !this.canWrite()) return;

    if (item.active) {
      if (!window.confirm(`¿Desactivar «${item.name}»?\n\nDeja de ofrecerse en los formularios. Los registros que ya lo usan lo conservan.`)) {
        return;
      }

      this.api
        .deactivateItem(organizationId, item.idCatalogItem)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.message.set('Valor desactivado.');
            this.loadData();
          },
          error: (error: HttpErrorResponse) => this.setError(error),
        });
      return;
    }

    const page = this.page();
    this.api
      .updateItem(item.idCatalogItem, {
        idOrganization: organizationId,
        type: item.type,
        name: item.name,
        description: item.description,
        idParentCatalogItem: item.idParentCatalogItem ?? null,
        order: item.order,
        active: true,
        isBlocking: page?.hasNature ? item.isBlocking === true : null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.set('Valor activado.');
          this.loadData();
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  // ── Datos ───────────────────────────────────────────────────────────────────────────────────

  protected loadData(): void {
    const page = this.page();
    const organizationId = this.selectedOrganizationId();

    this.dataSubscription?.unsubscribe();
    this.items.set([]);
    this.parents.set([]);

    if (!page || !organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.dataSubscription = forkJoin({
      items: this.api.listItems(organizationId, page.type, true),
      parents: page.parentType ? this.api.listItems(organizationId, page.parentType, true) : of([]),
    })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, parents }) => {
          // La organización pudo cambiar mientras la petición volvía. Sin esta guarda, la lista de
          // la anterior se pintaría dentro de la nueva.
          if (organizationId !== this.selectedOrganizationId()) return;

          this.items.set([...items].sort((a, b) => (a.order ?? 1) - (b.order ?? 1) || a.name.localeCompare(b.name, 'es')));
          this.parents.set(parents);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  private setError(error: HttpErrorResponse): void {
    const detail = typeof error.error === 'object' && error.error?.detail;
    this.error.set(detail || 'No se pudo completar la operación.');
  }
}
