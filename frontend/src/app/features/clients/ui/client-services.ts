import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { ServiceListItem } from '../../services/data-access/service.models';

/**
 * Los servicios del cliente, dentro de su ficha.
 *
 * <p><b>Es una lista de lectura, no un editor.</b> Un servicio se da de alta y se configura en su
 * propia pantalla, que tiene el contrato, las posiciones y los precios; repetir eso aquí sería
 * mantener dos sitios para lo mismo. Lo que la ficha necesita contestar es «¿qué le estamos
 * dando a este cliente?», y para eso basta el nombre, la zona y desde cuándo.</p>
 *
 * <p>El vacío no dice «no hay nada»: dice qué falta para que lo haya, que en un cliente sin zona es
 * la zona. Es la misma distinción que usa la pestaña de Zonas.</p>
 */
@Component({
  selector: 'app-client-services',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState],
  template: `
    @if (loading()) {
      <p class="serv__cargando" role="status">Cargando los servicios…</p>
    } @else if (!services().length) {
      <gi-empty-state
        [variant]="canCreate() ? 'no-data' : 'missing-prerequisite'"
        title="Este cliente todavía no tiene servicios"
        [description]="canCreate()
          ? 'Un servicio se liga a una zona del cliente y es lo que después se planea y se cubre.'
          : 'Para crear un servicio hace falta antes una zona: el servicio se liga a ella.'"
        [actionLabel]="canCreate() ? 'Crear servicio de este cliente' : ''"
        (action)="create.emit()"
      />
    } @else {
      <ul class="serv">
        @for (service of services(); track service.idService) {
          <li class="serv__fila">
            <span class="serv__nombre">{{ service.name }}</span>
            <span class="serv__zona">{{ service.clientZoneName || 'Sin zona' }}</span>
            <span class="serv__desde">Desde {{ desde(service) }}</span>
          </li>
        }
      </ul>
      <p class="serv__nota">
        Los servicios se configuran en su propia pantalla: aquí sólo se ven los de este cliente.
      </p>
    }
  `,
  styles: `
    :host { display: block; }

    .serv { display: flex; flex-direction: column; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }

    .serv__fila {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
      gap: 0.75rem;
      align-items: baseline;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0.55rem 0.75rem;
      background: var(--gestia-surface);
    }

    .serv__nombre { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .serv__zona { color: var(--gestia-muted); font-size: 11.5px; }
    .serv__desde { color: var(--gestia-muted); font-size: 11.5px; }

    .serv__cargando, .serv__nota { margin: 0.5rem 0 0; color: var(--gestia-muted); font-size: 11.5px; }

    @media (width < 45rem) {
      .serv__fila { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class ClientServices {
  readonly services = input<readonly ServiceListItem[]>([]);
  readonly loading = input(false);
  /** Si el cliente ya tiene zona. Sin ella no se puede crear un servicio, y el vacío lo dice. */
  readonly canCreate = input(false);
  readonly create = output<void>();

  /** Un solo formato de fecha en todo lo que se lee: «28 abr 2016». */
  protected desde(service: ServiceListItem): string {
    return formatOperationalDate(service.startDate);
  }
}
