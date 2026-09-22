import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientApiService } from '../../../clients/data-access/client-api.service';
import { OrganizationClientZone } from '../../../clients/data-access/client.models';
import { GiCell, GiColumn, GiDataTable, GiTableState } from '../../../../shared/ui/gi-data-table/gi-data-table';
import { GiFilterBar, GiFilterGroup } from '../../../../shared/ui/gi-filter-bar/gi-filter-bar';
import { GiSelect, GiSelectOption } from '../../../../shared/ui/gi-select/gi-select';
import { normalizeCatalogName } from '../../../../shared/util/catalog-name';

const TAMANOS_DE_PAGINA = [5, 10, 50, 100] as const;
const TAMANO_POR_OMISION = 10;

/**
 * Las zonas de la organización, todas juntas.
 *
 * <p><b>Una zona no es un valor de catálogo, y esta pantalla no pretende que lo sea.</b> Es un
 * lugar de un cliente concreto, con su propia calle, colonia, municipio y estado; un servicio
 * apunta a la zona del cliente que lo contrató. Por eso cada fila dice de quién es, y por eso no
 * se puede crear una zona desde aquí sin decir a qué cliente pertenece.</p>
 *
 * <p><b>Entonces por qué vive en Catálogos.</b> Porque hasta el 22 de septiembre de 2026 las zonas
 * sólo se podían ver desde la ficha de su cliente, una a una: para saber qué zonas tiene la
 * organización había que entrar a los 37 clientes que tienen alguna. Aquí se ven las 56 de corrido,
 * se buscan y se corrigen. Es una vista, no un catálogo nuevo.</p>
 *
 * <p><b>Editar abre la ficha del cliente.</b> El formulario de la zona vive ahí, con su cascada de
 * estado y municipio y su validación del código; duplicarlo aquí habría creado dos formularios para
 * la misma cosa, y el segundo se queda atrás el primer día que alguien corrija el primero.</p>
 */
@Component({
  selector: 'app-client-zones-page',
  imports: [GiCell, GiDataTable, GiFilterBar, GiSelect],
  templateUrl: './client-zones-page.html',
  styleUrl: './client-zones-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientZonesPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ClientApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly organizationId = this.auth.operationalOrganizationId;
  protected readonly canWrite = computed(() => this.auth.hasPermission('CLIENTS.WRITE'));

  protected readonly zones = signal<readonly OrganizationClientZone[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly search = signal('');
  protected readonly clientFilter = signal('');
  protected readonly stateFilter = signal<'' | 'active' | 'inactive'>('');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal<number>(TAMANO_POR_OMISION);

  constructor() {
    this.loadData();
  }

  protected readonly columns: readonly GiColumn[] = [
    { key: 'fila', label: '#', width: '52px', kind: 'meta' },
    { key: 'name', label: 'Zona', width: '200px', kind: 'name' },
    { key: 'clientName', label: 'Cliente', width: '200px' },
    { key: 'address', label: 'Dirección' },
    { key: 'place', label: 'Municipio y estado', width: '210px' },
    { key: 'state', label: 'Estatus', width: '110px' },
    { key: 'actions', label: '', width: '110px', align: 'end' },
  ];

  protected readonly filterGroups = computed<readonly GiFilterGroup[]>(() => [
    {
      id: 'cliente',
      label: 'Cliente',
      value: this.clientFilter(),
      allLabel: 'Todos los clientes',
      options: [...new Set(this.zones().map((zona) => zona.clientName))]
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((nombre) => ({ value: nombre, label: nombre })),
    },
    {
      id: 'estado',
      label: 'Estatus',
      value: this.stateFilter(),
      allLabel: 'Todos los estatus',
      options: [
        { value: 'active', label: 'Activas' },
        { value: 'inactive', label: 'Inactivas' },
      ],
    },
  ]);

  protected readonly filtradas = computed(() => {
    const texto = normalizeCatalogName(this.search());
    const cliente = this.clientFilter();
    const estado = this.stateFilter();

    return this.zones().filter((zona) => {
      if (cliente && zona.clientName !== cliente) return false;
      if (estado === 'active' && !zona.active) return false;
      if (estado === 'inactive' && zona.active) return false;

      if (!texto) return true;

      // Se busca por lo que alguien recuerda de una zona: cómo se llama, de quién es y dónde está.
      return [zona.name, zona.clientName, zona.street, zona.neighborhood ?? '', zona.municipality, zona.state]
        .some((campo) => normalizeCatalogName(campo).includes(texto));
    });
  });

  protected readonly paginadas = computed(() => {
    const desde = (this.currentPage() - 1) * this.pageSize();
    return this.filtradas().slice(desde, desde + this.pageSize());
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtradas().length / this.pageSize())),
  );

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
    return this.zones().length > 0 ? 'empty-filtered' : 'empty';
  });

  protected readonly porId = (zona: OrganizationClientZone) => zona.idClientZone;

  protected rowNumber(zona: OrganizationClientZone): number {
    return this.filtradas().indexOf(zona) + 1;
  }

  protected direccion(zona: OrganizationClientZone): string {
    const numero = [zona.exteriorNumber, zona.interiorNumber ? `int. ${zona.interiorNumber}` : '']
      .filter(Boolean)
      .join(' ');

    return [`${zona.street} ${numero}`.trim(), zona.neighborhood, zona.postalCode]
      .filter(Boolean)
      .join(' · ');
  }

  protected lugar(zona: OrganizationClientZone): string {
    return [zona.municipality, zona.state].filter(Boolean).join(', ');
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(1);
  }

  protected onFilter(change: { groupId: string; value: string }): void {
    if (change.groupId === 'cliente') this.clientFilter.set(change.value);
    if (change.groupId === 'estado') this.stateFilter.set(change.value as '' | 'active' | 'inactive');
    this.currentPage.set(1);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.clientFilter.set('');
    this.stateFilter.set('');
    this.currentPage.set(1);
  }

  protected goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPaginas()));
  }

  protected setPageSize(value: string): void {
    const tamano = Number(value);

    if (TAMANOS_DE_PAGINA.includes(tamano as (typeof TAMANOS_DE_PAGINA)[number])) {
      this.pageSize.set(tamano);
      this.currentPage.set(1);
    }
  }

  /**
   * Editar lleva a la ficha del cliente, donde vive el formulario de la zona.
   *
   * <p>Con su cascada de estado y municipio y su validación de código único por cliente. Copiarlo
   * aquí habría dejado dos formularios para lo mismo, y el segundo se queda atrás el primer día que
   * alguien corrija el primero.</p>
   */
  protected editar(zona: OrganizationClientZone): void {
    void this.router.navigate(['/clientes'], {
      queryParams: { cliente: zona.idClient, zona: zona.idClientZone },
    });
  }

  protected loadData(): void {
    const organizationId = this.organizationId();

    this.zones.set([]);

    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api
      .listAllZones(organizationId)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (zonas) => {
          // La organización pudo cambiar mientras la petición volvía.
          if (organizationId !== this.organizationId()) return;
          this.zones.set(zonas);
        },
        error: (error: HttpErrorResponse) => {
          const detail = typeof error.error === 'object' && error.error?.detail;
          this.error.set(detail || 'No se pudieron cargar las zonas.');
        },
      });
  }
}
