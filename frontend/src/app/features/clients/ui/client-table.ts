import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GiCell, GiColumn, GiDataTable, GiRowAction, GiRowActions, GiTableState } from '../../../shared/ui/gi-ui';
import {
  ClientListItem,
  clientDisplayName,
  clientLocation,
  clientSiteBadge,
} from '../data-access/client.models';

/**
 * El listado de clientes.
 *
 * <p>La columna de sedes es el prerrequisito del paso siguiente y por eso no es un número más:
 * <b>cero sedes se pinta como raya con la palabra «Sin sede»</b>, nunca como cero. Un cero diría
 * que el cliente está en orden, y lo que dice de verdad es que no se le puede crear un
 * servicio.</p>
 *
 * <p>Las columnas se reducen cuando la ficha está abierta, para que la tabla se comprima en vez de
 * cortar seis columnas dentro de su propio scroll.</p>
 */
@Component({
  selector: 'app-client-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiCell, GiDataTable, GiRowActions],
  template: `
    <gi-data-table
      [columns]="columns()"
      [rows]="clients()"
      [rowId]="rowId"
      [state]="state()"
      [selectedId]="selectedId()"
      [errorMessage]="errorMessage()"
      emptyActionLabel="Nuevo cliente"
      label="Clientes de la organización"
      (rowSelect)="open.emit($any($event))"
      (retry)="retry.emit()"
      (emptyAction)="create.emit()"
    >
      <ng-template giCell="name" let-client>
        <span class="cell__name">{{ name(client) }}</span>
        <span class="cell__code">{{ client.codeClient }}</span>
      </ng-template>

      <ng-template giCell="location" let-client>{{ location(client) }}</ng-template>

      <ng-template giCell="sites" let-client>
        @let badge = siteBadge(client);
        <span class="cell__sites">
          <span class="cell__count" [class]="'cell__count--' + badge.tone">{{ badge.value }}</span>
          @if (badge.pill) {
            <span class="pill" [class]="'pill--' + badge.tone">{{ badge.pill }}</span>
          }
        </span>
      </ng-template>

      <ng-template giCell="services" let-client>
        <span [class.cell__none]="client.serviceCount === 0">{{ client.serviceCount }}</span>
      </ng-template>

      <ng-template giCell="status" let-client>
        <span class="cell__status">
          <span class="cell__dot" [class.cell__dot--off]="!client.active" aria-hidden="true"></span>
          {{ client.active ? 'Activo' : 'Inactivo' }}
        </span>
      </ng-template>

      <ng-template giCell="actions" let-client>
        <!-- El clic del menú no debe abrir la ficha: quien sólo quería ver las acciones se
             encontraría el panel encima. -->
        <span class="cell__actions" (click)="$event.stopPropagation()">
          <gi-row-actions
            [actions]="actions()"
            [label]="'Acciones de ' + name(client)"
            (select)="action.emit({ id: $event.id, client })"
          />
        </span>
      </ng-template>
    </gi-data-table>
  `,
  styles: `
    :host { display: block; min-width: 0; }

    .cell__name { display: block; color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .cell__code { display: block; color: var(--gestia-muted); font-size: 11px; }

    .cell__sites { display: flex; align-items: center; gap: 0.55rem; }

    .cell__count { color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .cell__count--warning { color: var(--gestia-warning); }

    .cell__none { color: var(--gestia-muted); }

    /* Borde y texto en el token sobre la superficie, con la palabra dentro: el estado no depende
       del color. */
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .pill--warning { border-color: var(--gestia-warning); color: var(--gestia-warning); }

    .cell__status { display: flex; align-items: center; gap: 0.45rem; font-size: 12px; }

    .cell__dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--gestia-success);
    }

    .cell__dot--off { background: var(--gestia-muted); }

    .cell__actions { display: flex; justify-content: flex-end; }
  `,
})
export class ClientTable {
  readonly clients = input.required<readonly ClientListItem[]>();
  readonly state = input<GiTableState>('ready');
  readonly selectedId = input<string | null>(null);
  readonly errorMessage = input('');
  /** Con la ficha abierta la tabla se comprime a lo esencial. */
  readonly compact = input(false);
  readonly canWrite = input(false);

  readonly open = output<ClientListItem>();
  readonly create = output<void>();
  readonly retry = output<void>();
  readonly action = output<{ id: string; client: ClientListItem }>();

  protected readonly rowId = (client: ClientListItem) => client.idClient;

  protected readonly name = clientDisplayName;
  protected readonly location = clientLocation;
  protected readonly siteBadge = clientSiteBadge;

  protected readonly columns = computed<readonly GiColumn[]>(() =>
    this.compact()
      ? [
          { key: 'name', label: 'Cliente', kind: 'name' },
          { key: 'sites', label: 'Sedes', width: '9rem' },
          { key: 'actions', label: '', width: '3rem', align: 'end' },
        ]
      : [
          { key: 'name', label: 'Cliente', width: '220px', kind: 'name' },
          { key: 'location', label: 'Estado · Municipio' },
          { key: 'sites', label: 'Sedes', width: '190px' },
          { key: 'services', label: 'Servicios', width: '130px' },
          { key: 'status', label: 'Estado', width: '130px' },
          { key: 'actions', label: '', width: '52px', align: 'end' },
        ],
  );

  /**
   * Una sola acción de editar.
   *
   * <p>Antes había dos, «Editar cliente» y «Editar ficha», que hacían lo mismo. Dos nombres para
   * una acción obligan a elegir entre opciones que no se distinguen.</p>
   */
  protected readonly actions = computed<readonly GiRowAction[]>(() => [
    {
      id: 'edit',
      label: 'Editar cliente',
      disabled: !this.canWrite(),
      disabledReason: 'Necesitas permiso de escritura sobre clientes',
    },
    { id: 'sites', label: 'Ver sedes' },
    { id: 'documents', label: 'Documentos' },
    {
      id: 'deactivate',
      label: 'Desactivar cliente',
      destructive: true,
      disabled: !this.canWrite(),
      disabledReason: 'Necesitas permiso de escritura sobre clientes',
    },
  ]);
}
