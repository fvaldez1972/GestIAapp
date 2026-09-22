import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { CoverageStatus } from '../../clients/data-access/client.models';
import {
  GiCandidate,
  GiCandidatePicker,
  GiCatalogCreation,
  GiCatalogPicker,
  GiSelect,
  GiSelectOption,
  GI_REASON_MIN_LENGTH,
} from '../../../shared/ui/gi-ui';

/** El turno que hay que cubrir, con lo que la pantalla necesita para plantearlo. */
export type CoverageTarget = {
  readonly idScheduledShift: string;
  readonly positionCode: string;
  readonly positionName: string;
  readonly originalEmployeeName: string;
  /** `07:00`, del turno publicado. */
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
};

/** Lo que se manda al registrar o corregir una cobertura. */
export type CoverageDraft = {
  readonly idReplacementEmployee: string;
  readonly coverageStartTime: string;
  readonly coverageEndTime: string;
  readonly isOvernight: boolean;
  readonly status: CoverageStatus;
  readonly notes: string | null;
  /** El motivo del HECHO: por qué hizo falta cubrir. Del catálogo. */
  readonly idCoverageReason: string | null;
  /** El motivo de la CORRECCIÓN, para la bitácora. Nunca es el de arriba. */
  readonly correctionReason: string | null;
};

const ESTADOS: readonly GiSelectOption[] = [
  { value: 'Requested', label: 'Solicitada' },
  { value: 'Confirmed', label: 'Confirmada' },
  { value: 'Completed', label: 'Completada' },
  { value: 'Cancelled', label: 'Cancelada' },
];

/**
 * Quién cubre un turno que quedó al descubierto.
 *
 * <p><b>El traslape se permite y se advierte.</b> Quien ya tiene turno a esa hora aparece en la
 * lista con el aviso de qué posición queda corta al elegirlo. El argumento es el del cierre del
 * día: el supervisor con un turno descubierto va a mover a alguien de todos modos, y si el sistema
 * no lo deja, lo mueve por teléfono y el sistema queda mintiendo sobre dónde está la gente. La
 * condición que acompaña a la decisión la impone <c>gi-candidate-picker</c>, que rompe en desarrollo
 * si un traslape no dice qué queda descubierto.</p>
 *
 * <p><b>El horario arranca en el del turno, y eso no contradice la regla de no proponer valores.</b>
 * Lo que no se propone es lo que nadie eligió —un motivo, la hora de una asistencia—. Aquí el
 * horario del turno <i>es</i> lo que se está cubriendo: proponerlo no adivina nada, y quien cubre
 * sólo una parte lo acorta.</p>
 *
 * <p>Los dos motivos vuelven a convivir y vuelven a ir separados: el <b>del hecho</b>
 * (<c>idCoverageReason</c>, del catálogo) dice por qué hizo falta cubrir; el <b>de la corrección</b>
 * (<c>correctionReason</c>) dice por qué se está cambiando el registro después.</p>
 */
@Component({
  selector: 'app-coverage-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiCandidatePicker, GiCatalogPicker, GiSelect],
  template: `
    <form class="cob" (submit)="$event.preventDefault(); guardar()">
      <p class="cob__turno">
        <strong>{{ target().positionCode }} · {{ target().positionName }}</strong>
        <span>
          {{ target().startTime }} – {{ target().endTime }} · descubierto por
          {{ target().originalEmployeeName }}
        </span>
      </p>

      @if (!isCorrection()) {
        <section class="cob__bloque">
          <h3 class="cob__titulo">Quién cubre</h3>
          <gi-candidate-picker
            title="CANDIDATOS PARA ESTE TURNO"
            [candidates]="candidates()"
            emptyActionLabel="Asignar personal al servicio"
            (choose)="elegir($event)"
            (resolveEmpty)="resolveEmpty.emit()"
          />

          @if (elegido(); as candidato) {
            <p class="cob__elegido">
              Cubre <strong>{{ candidato.name }}</strong>.
              <button type="button" class="cob__link" (click)="limpiarElegido()">Cambiar</button>
            </p>
          }
        </section>
      }

      <section class="cob__bloque">
        <h3 class="cob__titulo">La cobertura</h3>
        <p class="cob__ayuda">
          El <strong>motivo del hecho</strong>: por qué hizo falta cubrir. Sale del catálogo de la
          organización.
        </p>

        <!-- Aquí el motivo sí viaja por identificador: CoverageRecord tiene su clave foránea. -->
        <gi-catalog-picker
          label="Motivo"
          catalogLabel="el catálogo de motivos de cobertura"
          inputId="cob-motivo"
          [options]="reasonOptions()"
          [value]="draft().idCoverageReason ?? ''"
          [canWrite]="canWrite()"
          (valueChange)="cambiar('idCoverageReason', $event || null)"
          (create)="createReason.emit($event)"
        />

        <div class="cob__horas">
          <label class="cob__campo">
            <span>Desde</span>
            <input
              type="time"
              [value]="draft().coverageStartTime"
              (input)="cambiar('coverageStartTime', $any($event.target).value)"
            />
          </label>
          <label class="cob__campo">
            <span>Hasta</span>
            <input
              type="time"
              [value]="draft().coverageEndTime"
              (input)="cambiar('coverageEndTime', $any($event.target).value)"
            />
          </label>
          <!--
            Una cobertura nace solicitada. El servidor lo exige —«La cobertura debe crearse en
            estado solicitado»— y el formulario ofrecía «Confirmada», que además venía puesta por
            omisión: cada alta chocaba con un 409 antes de escribir nada. Aquí se dice, y se elige
            sólo al corregir una que ya existe.
          -->
          @if (isCorrection()) {
            <label class="cob__campo">
              <span>Estado</span>
              <gi-select
                label="Estado de la cobertura"
                [options]="estados"
                [value]="draft().status"
                (valueChange)="cambiar('status', $any($event))"
              />
            </label>
          } @else {
            <p class="cob__campo cob__nace">
              <span>Estado</span>
              <strong>Solicitada</strong>
            </p>
          }
        </div>

        <p class="cob__ayuda">
          Arranca con el horario del turno. Si sólo se cubre una parte, acórtalo.
        </p>

        <label class="cob__campo">
          <span>Notas <em>(opcional)</em></span>
          <textarea
            rows="2"
            [value]="draft().notes ?? ''"
            (input)="cambiar('notes', $any($event.target).value || null)"
          ></textarea>
        </label>
      </section>

      @if (needsCorrectionReason()) {
        <section class="cob__bloque cob__bloque--motivo">
          <h3 class="cob__titulo">Motivo de la corrección</h3>
          <p class="cob__ayuda">
            Es <strong>por qué se está cambiando el registro</strong>, no por qué hizo falta cubrir.
            Va a la bitácora. Se pide porque el día ya está cerrado.
          </p>

          <label class="cob__campo">
            <span>Por qué se corrige</span>
            <textarea
              rows="3"
              [value]="draft().correctionReason ?? ''"
              (input)="cambiar('correctionReason', $any($event.target).value || null)"
              [attr.aria-describedby]="motivoCorto() ? 'cob-motivo' : null"
            ></textarea>
          </label>

          @if (motivoCorto()) {
            <p class="cob__problema" id="cob-motivo">
              Escribe al menos {{ minLength }} caracteres. Van {{ largoMotivo() }}.
            </p>
          }
        </section>
      }

      @if (problema()) {
        <p class="cob__problema" id="cob-problema">{{ problema() }}</p>
      }

      <div class="cob__acciones">
        <button class="cob__cancelar" type="button" (click)="cancel.emit()">Cancelar</button>
        <button
          class="cob__guardar"
          type="submit"
          [disabled]="!!problema() || saving()"
          [attr.aria-describedby]="problema() ? 'cob-problema' : null"
        >
          {{ isCorrection() ? 'Guardar la corrección' : 'Registrar la cobertura' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; }

    .cob { display: flex; flex-direction: column; gap: 0.85rem; }

    .cob__turno { display: flex; flex-direction: column; gap: 0.15rem; margin: 0; font-size: 12.5px; }
    .cob__turno strong { color: var(--gestia-text); }
    .cob__turno span { color: var(--gestia-muted); font-size: 11.5px; }

    .cob__bloque {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .cob__bloque--motivo { border-left: 3px solid var(--gestia-warning); }

    .cob__titulo { margin: 0; color: var(--gestia-navy); font-size: 12.5px; font-weight: 700; }
    .cob__ayuda { margin: 0; color: var(--gestia-muted); font-size: 11.5px; line-height: 1.5; }
    .cob__ayuda strong { color: var(--gestia-text); }

    .cob__elegido { margin: 0; color: var(--gestia-text); font-size: 12px; }
    .cob__elegido strong { font-weight: 600; }

    .cob__campo { display: flex; flex-direction: column; gap: 0.25rem; font-size: 12px; }
    .cob__campo > span { color: var(--gestia-muted); font-weight: 600; }
    .cob__campo em { font-style: normal; font-weight: 400; }

    .cob__campo input,
    .cob__campo textarea {
      padding: 0.5rem 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .cob__campo input { height: var(--gestia-control-height); }
    .cob__campo textarea { resize: vertical; }

    .cob__horas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }

    .cob__problema { margin: 0; color: var(--gestia-warning); font-size: 11.5px; }

    .cob__link {
      border: none;
      background: none;
      padding: 0;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .cob__acciones { display: flex; justify-content: flex-end; gap: 0.75rem; }

    .cob__cancelar,
    .cob__guardar {
      height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border-radius: var(--gestia-radius);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .cob__cancelar {
      border: 1px solid var(--gestia-border);
      background: var(--gestia-surface);
      color: var(--gestia-text);
    }

    .cob__guardar {
      border: 1px solid var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .cob__guardar[disabled] { opacity: 0.5; cursor: not-allowed; }

    .cob__link:focus-visible,
    .cob__cancelar:focus-visible,
    .cob__guardar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
  `,
})
export class CoverageForm {
  readonly target = input.required<CoverageTarget>();
  readonly candidates = input<readonly GiCandidate[]>([]);
  readonly reasons = input<readonly GiSelectOption[]>([]);
  readonly canWrite = input(false);

  protected readonly reasonOptions = computed(() =>
    this.reasons().map((option) => ({ idCatalogItem: option.value, name: option.label })),
  );

  /** Cuando se corrige, ya hay suplente elegido y no se vuelve a elegir. */
  readonly isCorrection = input(false);
  readonly dayClosed = input(false);
  readonly saving = input(false);

  readonly save = output<CoverageDraft>();

  /** El motivo que hay que crear en el catálogo antes de poder elegirlo. */
  readonly createReason = output<GiCatalogCreation>();
  readonly cancel = output<void>();
  readonly resolveEmpty = output<void>();

  protected readonly estados = ESTADOS;
  protected readonly minLength = GI_REASON_MIN_LENGTH;

  protected readonly elegido = linkedSignal<CoverageTarget, GiCandidate | null>({
    source: this.target,
    computation: () => null,
  });

  protected readonly draft = linkedSignal<CoverageTarget, CoverageDraft>({
    source: this.target,
    computation: (target) => ({
      idReplacementEmployee: '',
      // El horario del turno no es una suposición: es lo que se está cubriendo.
      coverageStartTime: target.startTime,
      coverageEndTime: target.endTime,
      isOvernight: target.isOvernight,
      // Solicitada, que es como el servidor admite que nazca. Confirmarla es un paso posterior.
      status: 'Requested',
      notes: null,
      idCoverageReason: null,
      correctionReason: null,
    }),
  });

  protected readonly needsCorrectionReason = computed(() => this.isCorrection() && this.dayClosed());
  protected readonly largoMotivo = computed(() => (this.draft().correctionReason ?? '').trim().length);
  protected readonly motivoCorto = computed(
    () => this.needsCorrectionReason() && this.largoMotivo() < GI_REASON_MIN_LENGTH,
  );

  protected readonly problema = computed(() => {
    const draft = this.draft();

    if (!this.isCorrection() && !draft.idReplacementEmployee) {
      return this.candidates().length === 0
        ? 'No hay nadie asignado al servicio que pueda cubrir este turno.'
        : 'Elige quién cubre el turno.';
    }

    if (!draft.idCoverageReason) {
      return this.reasons().length === 0
        ? 'El catálogo de motivos de cobertura está vacío, así que no se puede registrar todavía.'
        : 'Elige el motivo: por qué hizo falta cubrir.';
    }

    if (!draft.coverageStartTime || !draft.coverageEndTime) {
      return 'Falta el horario que se cubre.';
    }

    // Igual que en el patrón: terminar antes de empezar sólo tiene sentido si cruza la medianoche,
    // y eso lo hereda del turno en vez de preguntarse otra vez.
    if (draft.coverageEndTime <= draft.coverageStartTime && !draft.isOvernight) {
      return 'El fin de la cobertura es anterior al inicio, y este turno no cruza la medianoche.';
    }

    if (this.motivoCorto()) {
      return `El día está cerrado: escribe el motivo de la corrección, de al menos ${GI_REASON_MIN_LENGTH} caracteres.`;
    }

    return '';
  });

  protected elegir(candidate: GiCandidate): void {
    this.elegido.set(candidate);
    this.cambiar('idReplacementEmployee', candidate.id);
  }

  protected limpiarElegido(): void {
    this.elegido.set(null);
    this.cambiar('idReplacementEmployee', '');
  }

  protected cambiar<K extends keyof CoverageDraft>(campo: K, valor: CoverageDraft[K]): void {
    this.draft.set({ ...this.draft(), [campo]: valor });
  }

  protected guardar(): void {
    if (this.problema() || this.saving()) {
      return;
    }

    const draft = this.draft();

    this.save.emit({
      ...draft,
      notes: draft.notes?.trim() || null,
      correctionReason: draft.correctionReason?.trim() || null,
    });
  }
}
