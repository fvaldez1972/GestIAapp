import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GiCatalogCreation, GiCatalogOption, GiCatalogPicker } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { GiAccordion, GiEmptyState } from '../../../shared/ui/gi-ui';
import { AdministrativeIncident } from '../data-access/administrative-incident.models';

/** Lo que hace falta para registrar una incidencia administrativa. */
export type NewAdministrativeIncident = {
  readonly idIncidentTypeCatalogItem: string;
  readonly occurredDate: string;
  readonly details: string;
};

/**
 * Las incidencias administrativas del expediente.
 *
 * <p><b>No son las de la operación diaria, y la pantalla lo dice.</b> Una incidencia operativa
 * describe lo que pasó en un turno; ésta describe un hecho de la relación laboral y sigue en el
 * expediente aunque la persona cambie de servicio. Compartían nombre y no comparten nada más.</p>
 *
 * <p>Lo que decide si una incidencia impide asignar es la marca de su tipo en el catálogo, no la
 * fila: dos actas del mismo tipo bloquean o no bloquean juntas. Por eso la píldora no se puede
 * cambiar aquí; se cambia en Catálogos, y aquí se dice cuál es.</p>
 */
@Component({
  selector: 'app-employee-administrative-incidents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiAccordion, FormsModule, GiCatalogPicker, GiEmptyState],
  template: `
    <section class="inc">
      @if (visibles().length === 0 && !adding()) {
        <gi-empty-state
          variant="no-data"
          title="Sin incidencias administrativas"
          description="Aquí se registran actas, llamadas de atención y suspensiones. No es lo mismo que una incidencia de la operación diaria, que se captura en el turno."
          [actionLabel]="canWrite() ? 'Registrar incidencia' : ''"
          (action)="startAdd()"
        />
      } @else {
        <ul class="inc__list">
          @for (incidencia of vigentes(); track incidencia.idAdministrativeIncident) {
            <li class="inc__item" [class.inc__item--retirada]="!incidencia.active">
              <p class="inc__head">
                <span class="inc__type">{{ incidencia.incidentTypeName }}</span>
                <span
                  class="inc__pill"
                  [class.inc__pill--blocking]="incidencia.isRequired"
                >{{ incidencia.isRequired ? 'Impide asignar' : 'Deja constancia' }}</span>
                @if (!incidencia.active) { <span class="inc__pill">Retirada</span> }
              </p>
              <p class="inc__when">Ocurrió el {{ fecha(incidencia.occurredDate) }}</p>
              <p class="inc__details">{{ incidencia.details }}</p>
              @if (canWrite() && incidencia.active) {
                <p class="inc__actions">
                  <button type="button" (click)="startEdit(incidencia)">Editar</button>
                  <button type="button" (click)="retire.emit(incidencia.idAdministrativeIncident)">
                    Retirar
                  </button>
                </p>
              }
            </li>
          }
        </ul>

        @if (vigentes().length === 0) {
          <p class="inc__vacio">Ninguna incidencia vigente. Las retiradas siguen abajo.</p>
        }

        <!--
          Las retiradas siguen en el expediente —aqui los registros no se borran— pero plegadas:
          mezcladas con las vigentes obligaban a leer el atenuado de cada fila para saber cuales
          cuentan hoy, y la lista solo podia crecer.
        -->
        @if (retiradas().length) {
          <gi-accordion
            label="Incidencias retiradas"
            [count]="retiradas().length"
            summary="Siguen en el expediente; no cuentan para asignar"
          >
            <ul class="inc__list">
              @for (incidencia of retiradas(); track incidencia.idAdministrativeIncident) {
                <li class="inc__item inc__item--retirada">
                  <p class="inc__head">
                    <span class="inc__type">{{ incidencia.incidentTypeName }}</span>
                    <span class="inc__pill">Retirada</span>
                  </p>
                  <p class="inc__when">Ocurrió el {{ fecha(incidencia.occurredDate) }}</p>
                  <p class="inc__details">{{ incidencia.details }}</p>
                </li>
              }
            </ul>
          </gi-accordion>
        }

        @if (canWrite() && !adding()) {
          <p class="inc__add">
            <button class="button button--primary" type="button" (click)="startAdd()">
              Registrar incidencia
            </button>
          </p>
        }
      }

      @if (adding()) {
        <form class="new" (ngSubmit)="$event.preventDefault()">
          <p class="new__kicker">{{ editando() ? 'EDITAR INCIDENCIA' : 'NUEVA INCIDENCIA' }}</p>

          <gi-catalog-picker
            label="Tipo de incidencia"
            catalogLabel="el catálogo de incidencias administrativas"
            inputId="ai-tipo"
            [options]="types()"
            [value]="idType()"
            [canWrite]="canWrite()"
            (valueChange)="idType.set($event)"
            (create)="createType.emit($event)"
          />

          <label class="field" for="ai-fecha">
            <span class="field__label">FECHA DE OCURRENCIA</span>
            <input id="ai-fecha" name="occurredDate" type="date" [max]="today()"
              [ngModel]="occurredDate()" (ngModelChange)="occurredDate.set($event)"
              [ngModelOptions]="sueltos" />
          </label>

          <label class="field" for="ai-detalle">
            <span class="field__label">QUÉ OCURRIÓ</span>
            <textarea id="ai-detalle" name="details" rows="3"
              [ngModel]="details()" (ngModelChange)="details.set($event)"
              [ngModelOptions]="sueltos"></textarea>
          </label>

          @if (!ready()) {
            <p class="new__reason">
              Falta el tipo, la fecha o el relato. El relato es obligatorio porque el tipo dice de
              qué clase es y esto dice qué pasó: sin lo segundo, quien lo lea dentro de un año no
              podrá juzgar si sigue siendo pertinente.
            </p>
          }

          <p class="new__footer">
            <button class="button" type="button" (click)="cancelAdd()">Cancelar</button>
            <button class="button button--primary" type="button"
              [disabled]="saving() || !ready()" (click)="submit()">
              {{ saving() ? 'Guardando…' : editando() ? 'Guardar cambios' : 'Guardar incidencia' }}
            </button>
          </p>
        </form>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .inc__list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

    .inc__item {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 0.7rem 0;
      border-bottom: 1px solid var(--gestia-border);
    }

    .inc__item:last-child { border-bottom: 0; }
    .inc__item--retirada { opacity: 0.6; }

    .inc__head { display: flex; align-items: center; gap: 0.45rem; margin: 0; }

    .inc__vacio { margin: 0 0 0.6rem; color: var(--gestia-muted); font-size: 12px; }
    .inc__type { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }

    .inc__pill {
      border-radius: var(--gestia-radius-pill);
      padding: 0.05rem 0.45rem;
      background: var(--gestia-surface-muted);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    /* Del sistema, no a mano: la píldora usa el mismo amarillo que el resto de los avisos. */
    .inc__pill--blocking {
      border: 1px solid var(--gestia-warning);
      background: var(--gestia-surface);
      color: var(--gestia-warning);
    }

    .inc__when, .inc__details { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }
    .inc__details { color: var(--gestia-text); white-space: pre-wrap; }

    .inc__actions { display: flex; gap: 0.45rem; margin: 0.2rem 0 0; }

    .inc__actions button {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0.15rem 0.5rem;
      background: var(--gestia-surface);
      color: var(--gestia-navy);
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .inc__add { margin: 0.7rem 0 0; }

    .new {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin-top: 0.8rem;
      padding-top: 0.8rem;
      border-top: 1px solid var(--gestia-border);
    }

    .new__kicker { margin: 0; color: var(--gestia-muted); font-size: 11px; letter-spacing: 0.06em; }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

    .field__label {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .field input, .field textarea {
      box-sizing: border-box;
      width: 100%;
      padding: 0.4rem 0.7rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .new__reason { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }
    .new__footer { display: flex; justify-content: flex-end; gap: 0.55rem; margin: 0; }
  `,
})
export class EmployeeAdministrativeIncidents {
  readonly incidents = input.required<readonly AdministrativeIncident[]>();
  readonly types = input<readonly GiCatalogOption[]>([]);
  readonly canWrite = input(false);
  readonly saving = input(false);

  /** El día operativo del servidor. La fecha de ocurrencia no puede pasarse de ahí. */
  readonly today = input.required<string>();

  readonly create = output<NewAdministrativeIncident>();
  readonly edit = output<{ incident: AdministrativeIncident; datos: NewAdministrativeIncident }>();
  readonly retire = output<string>();
  readonly createType = output<GiCatalogCreation>();

  protected readonly sueltos = { standalone: true };

  protected readonly editando = signal<AdministrativeIncident | null>(null);
  private readonly addingByHand = signal(false);
  protected readonly adding = computed(() => this.canWrite() && this.addingByHand());

  protected readonly idType = signal('');
  protected readonly occurredDate = signal('');
  protected readonly details = signal('');

  /**
   * Las retiradas siguen visibles.
   *
   * <p>Aquí los registros no se borran, y una incidencia retirada es parte del expediente: se
   * atenúa y se dice que lo está, en vez de desaparecer como si nunca hubiera ocurrido.</p>
   */
  protected readonly visibles = computed(() => this.incidents());

  /**
   * Las que siguen en pie y las retiradas, por separado.
   *
   * <p>Aquí los registros no se borran, así que una incidencia retirada sigue en el expediente.
   * Pero mezclarla con las vigentes hacía que la lista creciera para siempre y que hubiera que
   * leer el atenuado de cada fila para saber cuáles cuentan hoy. Las retiradas se pliegan: siguen
   * estando, y ya no compiten por la atención.</p>
   */
  protected readonly vigentes = computed(() => this.incidents().filter((item) => item.active));

  protected readonly retiradas = computed(() => this.incidents().filter((item) => !item.active));

  protected readonly ready = computed(
    () => !!this.idType() && !!this.occurredDate() && this.details().trim().length > 0,
  );

  protected fecha(valor: string): string {
    // Se parte el texto en vez de construir un Date: `new Date('2026-09-19')` se interpreta en UTC
    // y en México cae un día antes, que es exactamente el defecto que ya se corrigió en Operación.
    const [anio, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  protected startAdd(): void {
    if (!this.canWrite()) return;
    this.reset();
    this.editando.set(null);
    this.addingByHand.set(true);
  }

  protected startEdit(incident: AdministrativeIncident): void {
    if (!this.canWrite()) return;
    this.reset();
    this.idType.set(incident.idIncidentTypeCatalogItem);
    this.occurredDate.set(incident.occurredDate);
    this.details.set(incident.details);
    this.editando.set(incident);
    this.addingByHand.set(true);
  }

  protected cancelAdd(): void {
    this.addingByHand.set(false);
    this.editando.set(null);
    this.reset();
  }

  protected submit(): void {
    if (!this.ready() || this.saving()) return;

    const datos: NewAdministrativeIncident = {
      idIncidentTypeCatalogItem: this.idType(),
      occurredDate: this.occurredDate(),
      details: this.details().trim(),
    };

    const enEdicion = this.editando();

    if (enEdicion) {
      this.edit.emit({ incident: enEdicion, datos });
    } else {
      this.create.emit(datos);
    }

    this.cancelAdd();
  }

  private reset(): void {
    this.idType.set('');
    this.occurredDate.set('');
    this.details.set('');
  }
}
