import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GiCell, GiColumn, GiDataTable, GiRowAction, GiRowActions, GiTableState } from '../../../shared/ui/gi-ui';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import {
  EmployeeListItem,
  employeeDocumentBadge,
  employeeJobPositionLabel,
  employeeLocation,
  employeeStatusLabel,
  employeeStatusTone,
} from '../data-access/employee-list.models';

/**
 * El listado de personal.
 *
 * <p>La columna de documentos existe para <b>no tener que abrir la ficha</b>: dice cuántos y de
 * qué, con el peor estado mandando. Y la de estado lleva los cinco del modelo, cada uno con su
 * palabra además del punto, porque un punto de color no se lee en escala de grises.</p>
 */
@Component({
  selector: 'app-employee-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiCell, GiDataTable, GiRowActions],
  template: `
    <gi-data-table
      [columns]="columns()"
      [rows]="employees()"
      [rowId]="rowId"
      [state]="state()"
      [selectedId]="selectedId()"
      [errorMessage]="errorMessage()"
      emptyActionLabel="Nuevo empleado"
      label="Personal de la organización"
      (rowSelect)="open.emit($any($event))"
      (retry)="retry.emit()"
      (emptyAction)="create.emit()"
    >
      <ng-template giCell="name" let-employee>
        <span class="cell__name">{{ employee.fullName }}</span>
        <span class="cell__code">{{ employee.codeEmployee }}</span>
      </ng-template>

      <ng-template giCell="job" let-employee>
        <span [class.cell__uncatalogued]="!employee.jobPositionName">{{ job(employee) }}</span>
      </ng-template>

      <ng-template giCell="location" let-employee>{{ location(employee) }}</ng-template>

      <ng-template giCell="hire" let-employee>{{ hired(employee.hireDate) }}</ng-template>

      <ng-template giCell="documents" let-employee>
        @let badge = documentBadge(employee);
        <span class="pill" [class]="'pill--' + badge.tone">{{ badge.label }}</span>
      </ng-template>

      <ng-template giCell="status" let-employee>
        <span class="cell__status">
          <span class="cell__dot" [class]="'cell__dot--' + statusTone(employee.status)" aria-hidden="true"></span>
          {{ statusLabel(employee.status) }}
        </span>
      </ng-template>

      <!--
        El código va en el nombre accesible porque dos personas pueden llamarse igual, y entonces
        sus menús quedan indistinguibles para quien navega con lector.
      -->
      <ng-template giCell="actions" let-employee>
        <span class="cell__actions" (click)="$event.stopPropagation()">
          <gi-row-actions
            [actions]="actions()"
            [label]="'Acciones de ' + employee.fullName + ', ' + employee.codeEmployee"
            (select)="action.emit({ id: $event.id, employee })"
          />
        </span>
      </ng-template>
    </gi-data-table>
  `,
  styles: `
    :host { display: block; min-width: 0; }

    .cell__name { display: block; color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .cell__code { display: block; color: var(--gestia-muted); font-size: 11px; }

    /* El puesto heredado sin catalogar se lee distinto: no bloquea, pero no está comprobado. */
    .cell__uncatalogued { color: var(--gestia-warning); }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.45rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .pill--danger { border-color: var(--gestia-danger); color: var(--gestia-danger); }
    .pill--warning { border-color: var(--gestia-warning); color: var(--gestia-warning); }
    .pill--success { border-color: var(--gestia-success); color: var(--gestia-success); }

    .cell__status { display: flex; align-items: center; gap: 0.45rem; font-size: 12px; }

    .cell__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gestia-muted); }
    .cell__dot--success { background: var(--gestia-success); }
    .cell__dot--warning { background: var(--gestia-warning); }
    .cell__dot--danger { background: var(--gestia-danger); }
    .cell__dot--info { background: var(--gestia-info); }
    .cell__dot--muted { background: var(--gestia-muted); }

    .cell__actions { display: flex; justify-content: flex-end; }
  `,
})
export class EmployeeTable {
  readonly employees = input.required<readonly EmployeeListItem[]>();
  readonly state = input<GiTableState>('ready');
  readonly selectedId = input<string | null>(null);
  readonly errorMessage = input('');
  /** Con la ficha abierta la tabla se comprime a lo esencial. */
  readonly compact = input(false);
  readonly canWrite = input(false);

  readonly open = output<EmployeeListItem>();
  readonly create = output<void>();
  readonly retry = output<void>();
  readonly action = output<{ id: string; employee: EmployeeListItem }>();

  protected readonly rowId = (employee: EmployeeListItem) => employee.idEmployee;

  protected readonly job = employeeJobPositionLabel;
  protected readonly location = employeeLocation;
  protected readonly documentBadge = employeeDocumentBadge;
  protected readonly statusLabel = employeeStatusLabel;
  protected readonly statusTone = employeeStatusTone;
  protected readonly hired = formatOperationalDate;

  protected readonly columns = computed<readonly GiColumn[]>(() =>
    this.compact()
      ? [
          { key: 'name', label: 'Empleado', kind: 'name' },
          { key: 'documents', label: 'Documentos', width: '150px' },
          { key: 'actions', label: '', width: '52px', align: 'end' },
        ]
      : [
          { key: 'name', label: 'Empleado', width: '220px', kind: 'name' },
          { key: 'job', label: 'Puesto', width: '190px' },
          { key: 'location', label: 'Estado · Municipio' },
          { key: 'hire', label: 'Ingreso', width: '130px' },
          { key: 'documents', label: 'Documentos', width: '150px' },
          { key: 'status', label: 'Estado', width: '130px' },
          { key: 'actions', label: '', width: '52px', align: 'end' },
        ],
  );

  /**
   * Tres acciones, y ninguna repite un camino que ya existe.
   *
   * <p><b>«Editar empleado» y «Documentos» no están.</b> La fila entera abre la ficha, y los
   * documentos son una de sus pestañas: un menú que ofrece dos rutas al mismo sitio obliga a
   * elegir entre opciones que no se distinguen, que es el par duplicado que esta pantalla
   * venía arrastrando.</p>
   */
  protected readonly actions = computed<readonly GiRowAction[]>(() => [
    { id: 'assign', label: 'Asignar a una posición' },
    {
      id: 'leave',
      label: 'Registrar permiso',
      disabled: !this.canWrite(),
      disabledReason: 'Necesitas permiso de escritura sobre personal',
    },
    {
      id: 'terminate',
      label: 'Dar de baja',
      destructive: true,
      disabled: !this.canWrite(),
      disabledReason: 'Necesitas permiso de escritura sobre personal',
    },
  ]);
}
