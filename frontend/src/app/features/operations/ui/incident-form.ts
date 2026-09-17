import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { GiCatalogCreation, GiCatalogPicker, GiSelect, GiSelectOption, GI_REASON_MIN_LENGTH } from '../../../shared/ui/gi-ui';
import { IncidentDraft, IncidentRow } from '../data-access/incident-day';

const SEVERIDADES: readonly GiSelectOption[] = [
  { value: 'Low', label: 'Baja' },
  { value: 'Medium', label: 'Media' },
  { value: 'High', label: 'Alta' },
  { value: 'Critical', label: 'Crítica' },
];

const ESTADOS: readonly GiSelectOption[] = [
  { value: 'Open', label: 'Abierta' },
  { value: 'InReview', label: 'En revisión' },
  { value: 'Resolved', label: 'Resuelta' },
  { value: 'Cancelled', label: 'Cancelada' },
];

/** Cierran la incidencia y por eso exigen decir cómo se resolvió. */
const TERMINALES = new Set(['Resolved', 'Cancelled']);

/**
 * Registro y corrección de una incidencia.
 *
 * <p><b>Aquí conviven dos motivos que se parecen mucho y no son lo mismo.</b> El formulario los
 * separa en bloques distintos, con nombres distintos en el modelo y etiquetas que dicen cuál es
 * cuál:</p>
 *
 * <ul>
 * <li><b>El motivo del hecho</b> (<c>factReasonCode</c>) es <i>por qué ocurrió</i>: un robo, una
 * falta, un incidente médico. Sale del catálogo de la organización, se <b>elige</b>, y describe la
 * realidad operativa. Existe desde que se registra la incidencia.</li>
 * <li><b>El motivo de la corrección</b> (<c>correctionReason</c>) es <i>por qué se está cambiando
 * el registro después</i>. Se <b>escribe</b>, va a la bitácora, y sólo aparece al corregir un día
 * cerrado.</li>
 * </ul>
 *
 * <p>Fundirlos dejaría la bitácora diciendo «robo» donde debería decir «se corrigió la severidad
 * porque el reporte del cliente la elevó», que son dos frases sobre cosas distintas.</p>
 *
 * <p><b>Corregir una incidencia no pide autorización, y no es un descuido.</b> Corregir una
 * asistencia sí la pide. La razón: <b>la asistencia es el hecho que se le factura al cliente y la
 * incidencia es la descripción de algo que ya ocurrió, así que corregir la primera cambia lo que se
 * cobra y corregir la segunda cambia cómo se cuenta.</b> Pedir el mismo permiso para las dos
 * pondría una firma de por medio para redactar mejor un párrafo.</p>
 *
 * <p>Queda escrito para que quien lo encuentre después no lo lea como una regla que se olvidó. Si el
 * negocio decide otra cosa, se cambia con su caso.</p>
 */
@Component({
  selector: 'app-incident-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiCatalogPicker, GiSelect],
  template: `
    <form class="incf" (submit)="$event.preventDefault(); guardar()">
      <section class="incf__bloque">
        <h3 class="incf__titulo">Qué pasó</h3>
        <p class="incf__ayuda">
          El <strong>motivo del hecho</strong>: por qué ocurrió. Sale del catálogo de la
          organización y describe la realidad operativa.
        </p>

        <!--
          El catálogo vacío deja de mandar a otra pantalla. Antes decía «está vacío» y ofrecía ir a
          Catálogos, lo que obligaba a abandonar la incidencia a medias; y una incidencia que no se
          registra en el momento se registra fuera del sistema, o no se registra.
        -->
        <gi-catalog-picker
          label="Motivo"
          catalogLabel="el catálogo de motivos de incidencia"
          inputId="incf-motivo"
          [options]="reasonOptions()"
          [value]="draft().factReasonCode"
          [canWrite]="canWrite()"
          (valueChange)="cambiar('factReasonCode', $event)"
          (create)="createReason.emit($event)"
        />

        <div class="incf__par">
          <label class="incf__campo">
            <span>Severidad</span>
            <gi-select
              label="Severidad de la incidencia"
              [options]="severidades"
              [value]="draft().severity"
              (valueChange)="cambiar('severity', $any($event))"
            />
          </label>

          <label class="incf__campo">
            <span>Estado</span>
            <gi-select
              label="Estado de la incidencia"
              [options]="estados"
              [value]="draft().status"
              (valueChange)="cambiar('status', $any($event))"
            />
          </label>
        </div>

        <label class="incf__campo">
          <span>Qué ocurrió</span>
          <textarea
            rows="3"
            [value]="draft().description"
            (input)="cambiar('description', $any($event.target).value)"
          ></textarea>
        </label>

        @if (cierraLaIncidencia()) {
          <label class="incf__campo">
            <span>Cómo se resolvió</span>
            <textarea
              rows="2"
              [value]="draft().resolutionNotes ?? ''"
              (input)="cambiar('resolutionNotes', $any($event.target).value || null)"
            ></textarea>
            <small>Cerrar una incidencia sin decir cómo deja el expediente a medias.</small>
          </label>
        }
      </section>

      @if (needsCorrectionReason()) {
        <section class="incf__bloque incf__bloque--motivo">
          <h3 class="incf__titulo">Motivo de la corrección</h3>
          <p class="incf__ayuda">
            Es <strong>por qué se está cambiando el registro</strong>, no por qué ocurrió el hecho.
            Va a la bitácora. Se pide porque el día ya está cerrado.
          </p>

          <label class="incf__campo">
            <span>Por qué se corrige</span>
            <textarea
              rows="3"
              [value]="draft().correctionReason ?? ''"
              (input)="cambiar('correctionReason', $any($event.target).value || null)"
              [attr.aria-describedby]="motivoCorto() ? 'incf-motivo' : null"
            ></textarea>
          </label>

          @if (motivoCorto()) {
            <p class="incf__problema" id="incf-motivo">
              Escribe al menos {{ minLength }} caracteres. Van {{ largoMotivo() }}.
            </p>
          }
        </section>
      }

      @if (problema()) {
        <p class="incf__problema" id="incf-problema">{{ problema() }}</p>
      }

      <div class="incf__acciones">
        <button class="incf__cancelar" type="button" (click)="cancel.emit()">Cancelar</button>
        <button
          class="incf__guardar"
          type="submit"
          [disabled]="!!problema() || saving()"
          [attr.aria-describedby]="problema() ? 'incf-problema' : null"
        >
          {{ isCorrection() ? 'Guardar la corrección' : 'Registrar la incidencia' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; }

    .incf { display: flex; flex-direction: column; gap: 0.85rem; }

    .incf__bloque {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .incf__bloque--motivo { border-left: 3px solid var(--gestia-warning); }

    .incf__titulo { margin: 0; color: var(--gestia-navy); font-size: 12.5px; font-weight: 700; }
    .incf__ayuda { margin: 0; color: var(--gestia-muted); font-size: 11.5px; line-height: 1.5; }
    .incf__ayuda strong { color: var(--gestia-text); }

    .incf__campo { display: flex; flex-direction: column; gap: 0.25rem; font-size: 12px; }
    .incf__campo > span { color: var(--gestia-muted); font-weight: 600; }
    .incf__campo small { color: var(--gestia-muted); font-size: 11px; }

    .incf__campo textarea {
      padding: 0.5rem 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      resize: vertical;
    }

    .incf__par { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }

    .incf__falta { color: var(--gestia-warning); }
    .incf__problema { margin: 0; color: var(--gestia-warning); font-size: 11.5px; }

    .incf__link {
      border: none;
      background: none;
      padding: 0;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .incf__acciones { display: flex; justify-content: flex-end; gap: 0.75rem; }

    .incf__cancelar,
    .incf__guardar {
      height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border-radius: var(--gestia-radius);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .incf__cancelar {
      border: 1px solid var(--gestia-border);
      background: var(--gestia-surface);
      color: var(--gestia-text);
    }

    .incf__guardar {
      border: 1px solid var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .incf__guardar[disabled] { opacity: 0.5; cursor: not-allowed; }

    .incf__link:focus-visible,
    .incf__cancelar:focus-visible,
    .incf__guardar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
  `,
})
export class IncidentForm {
  /** La incidencia que se corrige, o nulo cuando se está registrando una nueva. */
  readonly row = input<IncidentRow | null>(null);

  /** Los motivos del catálogo de la organización. Nunca texto libre. */
  readonly reasons = input.required<readonly GiSelectOption[]>();

  /** El motivo que hay que crear en el catálogo antes de poder elegirlo. */
  readonly createReason = output<GiCatalogCreation>();

  /** Sin esto, el alta al vuelo ofrecería crear algo que el servidor va a rechazar con 403. */
  readonly canWrite = input(false);

  /**
   * El motivo del hecho viaja por <b>nombre</b>, no por identificador, porque es lo que
   * <c>Incident.IncidentType</c> guarda. La cobertura sí guarda el identificador. Que las dos no se
   * parezcan es deuda reconocida y tiene tanda propia.
   */
  protected readonly reasonOptions = computed(() =>
    this.reasons().map((option) => ({ idCatalogItem: option.value, name: option.label })),
  );

  /** Si el día está cerrado. Es lo único que decide si se pide el motivo de la corrección. */
  readonly dayClosed = input(false);
  readonly saving = input(false);

  readonly save = output<IncidentDraft>();
  readonly cancel = output<void>();
  readonly openCatalog = output<void>();

  protected readonly severidades = SEVERIDADES;
  protected readonly estados = ESTADOS;
  protected readonly minLength = GI_REASON_MIN_LENGTH;

  protected readonly isCorrection = computed(() => this.row() !== null);

  protected readonly draft = linkedSignal<IncidentRow | null, IncidentDraft>({
    source: this.row,
    computation: (row) => ({
      factReasonCode: row?.factReasonCode ?? '',
      severity: row?.severity ?? 'Medium',
      status: row?.status ?? 'Open',
      description: row?.description ?? '',
      resolutionNotes: row?.resolutionNotes ?? null,
      // El motivo de la corrección arranca vacío SIEMPRE, incluso al reabrir la misma incidencia:
      // es de esta edición, no del registro.
      correctionReason: null,
    }),
  });

  protected readonly cierraLaIncidencia = computed(() => TERMINALES.has(this.draft().status));

  protected readonly needsCorrectionReason = computed(() => this.isCorrection() && this.dayClosed());
  protected readonly largoMotivo = computed(() => (this.draft().correctionReason ?? '').trim().length);
  protected readonly motivoCorto = computed(
    () => this.needsCorrectionReason() && this.largoMotivo() < GI_REASON_MIN_LENGTH,
  );

  protected readonly problema = computed(() => {
    const draft = this.draft();

    if (!draft.factReasonCode) {
      return this.reasons().length === 0
        ? 'No hay motivos en el catálogo de la organización, así que no se puede registrar la incidencia todavía.'
        : 'Elige el motivo del hecho.';
    }

    if (draft.description.trim().length < 10) {
      return 'Describe qué ocurrió, con al menos diez caracteres.';
    }

    if (this.cierraLaIncidencia() && !draft.resolutionNotes?.trim()) {
      return 'Para cerrar la incidencia hay que decir cómo se resolvió.';
    }

    if (this.motivoCorto()) {
      return `El día está cerrado: escribe el motivo de la corrección, de al menos ${GI_REASON_MIN_LENGTH} caracteres.`;
    }

    return '';
  });

  protected cambiar<K extends keyof IncidentDraft>(campo: K, valor: IncidentDraft[K]): void {
    this.draft.set({ ...this.draft(), [campo]: valor });
  }

  protected guardar(): void {
    if (this.problema() || this.saving()) {
      return;
    }

    const draft = this.draft();

    this.save.emit({
      ...draft,
      description: draft.description.trim(),
      resolutionNotes: draft.resolutionNotes?.trim() || null,
      correctionReason: draft.correctionReason?.trim() || null,
    });
  }
}
