import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import { EmployeeAssignment } from '../data-access/employee-list.models';

const TIPOS: Record<EmployeeAssignment['assignmentType'], string> = {
  Primary: 'Titular',
  Support: 'Apoyo',
  Relief: 'Relevo',
  TemporaryReplacement: 'Suplencia temporal',
};

/**
 * La pestaña de Asignaciones.
 *
 * <p>Lleva un estado que <b>no existe en el modelo</b>: «En curso». Se deriva de que haya entrada
 * registrada y no haya salida, hoy o ayer. Sin él, el turno nocturno que empezó a las 19:00 de
 * ayer y todavía no termina se lee como turno cerrado o como ausencia, y en un servicio de
 * vigilancia ésa es exactamente la fila que alguien está buscando.</p>
 *
 * <p>Se dice el día del turno junto al estado, porque «en curso» de un turno de ayer y «en curso»
 * de uno de hoy significan cosas distintas para quien supervisa.</p>
 */
@Component({
  selector: 'app-employee-assignments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState],
  template: `
    <section class="assign">
      @if (loading()) {
        <p class="assign__note" role="status">Cargando las asignaciones…</p>
      } @else if (assignments().length === 0) {
        <gi-empty-state
          variant="no-data"
          title="Esta persona no tiene asignaciones"
          description="Una asignación liga a la persona con una posición de un servicio. Sin ella no aparece en el rol ni en la cobertura."
          [actionLabel]="canWrite() ? 'Asignar a una posición' : ''"
          (action)="assign.emit()"
        />
      } @else {
        @if (inProgress(); as turno) {
          <p class="assign__live" role="status">
            <span class="assign__live-dot" aria-hidden="true"></span>
            Turno en curso desde el {{ day(turno.shiftInProgressDate) }} en
            {{ turno.positionName || turno.serviceName }}: hay entrada registrada y todavía no hay
            salida.
          </p>
        }

        <ul class="assign__list">
          @for (item of assignments(); track item.idServiceAssignment) {
            <li class="row" [class.row--live]="item.hasShiftInProgress">
              <span class="row__body">
                <span class="row__title">
                  {{ item.positionName || 'Posición sin nombre' }}
                  @if (item.isPrimary) {
                    <span class="row__pill">Titular</span>
                  }
                </span>
                <span class="row__where">{{ item.clientName }} · {{ item.serviceName }}</span>
                <span class="row__when">{{ period(item) }} · {{ type(item.assignmentType) }}</span>
              </span>
              <span class="row__state" [class]="'row__state--' + tone(item)">{{ state(item) }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .assign { display: flex; flex-direction: column; gap: 0.75rem; }

    .assign__note { margin: 0; color: var(--gestia-muted); font-size: 12px; }

    .assign__live {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin: 0;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-info);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
      color: var(--gestia-text);
      font-size: 12px;
    }

    .assign__live-dot {
      flex: none;
      width: 7px;
      height: 7px;
      margin-top: 0.35rem;
      border-radius: 50%;
      background: var(--gestia-info);
    }

    .assign__list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 0;
      border-bottom: 1px solid var(--gestia-border);
    }

    .row:last-child { border-bottom: 0; }

    .row__body { display: flex; flex-direction: column; gap: 0.12rem; min-width: 0; }

    .row__title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--gestia-text);
      font-size: 12.5px;
      font-weight: 600;
    }

    .row__pill {
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--gestia-cyan-dark);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-cyan-dark);
      font-size: 10.5px;
      font-weight: 600;
    }

    .row__where, .row__when { color: var(--gestia-muted); font-size: 11.5px; }

    .row__state {
      flex: none;
      padding: 0.15rem 0.45rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .row__state--info { border-color: var(--gestia-info); color: var(--gestia-info); }
    .row__state--success { border-color: var(--gestia-success); color: var(--gestia-success); }
  `,
})
export class EmployeeAssignments {
  readonly assignments = input.required<readonly EmployeeAssignment[]>();
  readonly loading = input(false);
  readonly canWrite = input(false);

  readonly assign = output<void>();

  protected readonly inProgress = computed(() =>
    this.assignments().find((item) => item.hasShiftInProgress) ?? null,
  );

  protected type(value: EmployeeAssignment['assignmentType']): string {
    return TIPOS[value] ?? 'Asignación';
  }

  protected day(date: string | null): string {
    return formatOperationalDate(date);
  }

  protected period(item: EmployeeAssignment): string {
    const desde = formatOperationalDate(item.startDate);
    return item.endDate ? `${desde} a ${formatOperationalDate(item.endDate)}` : `Desde ${desde}`;
  }

  /**
   * El estado de la fila. «En curso» gana a «Vigente»: las dos son ciertas y la primera es la que
   * cambia lo que alguien hace ahora mismo.
   */
  protected state(item: EmployeeAssignment): string {
    if (item.hasShiftInProgress) {
      return 'En curso';
    }

    return item.inForce ? 'Vigente' : 'Terminada';
  }

  protected tone(item: EmployeeAssignment): string {
    if (item.hasShiftInProgress) {
      return 'info';
    }

    return item.inForce ? 'success' : 'muted';
  }
}
