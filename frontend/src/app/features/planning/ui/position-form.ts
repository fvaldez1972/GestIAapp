import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/** Lo que se pide para dar de alta una posición. */
export type PositionDraft = {
  readonly codePosition: string;
  readonly name: string;
  readonly requiredWorkerCount: number;
  readonly notes: string | null;
};

/**
 * Alta de una posición.
 *
 * <p><b>La posición es el puesto que hay que cubrir, y existe con independencia de quién lo
 * ocupe.</b> Es el primer principio del proyecto, y por eso el formulario no pregunta por ninguna
 * persona: quién lo cubre se decide después, semana por semana, y mezclarlo aquí ataría el puesto
 * a alguien que puede irse mañana.</p>
 *
 * <p><b>El código lo escribe quien da de alta.</b> No se propone uno: un código sugerido se acepta
 * sin mirarlo, y el código de una posición es lo que la operación va a usar para nombrarla en voz
 * alta —«el P-01 está descubierto»—. Que lo elija una persona es lo que hace que signifique algo.
 * <i>Queda anotado que el servidor tampoco lo genera, a diferencia del código de cliente, que sí se
 * movió al servidor.</i></p>
 */
@Component({
  selector: 'app-position-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="pos" (submit)="$event.preventDefault(); guardar()">
      <label class="pos__campo">
        <span>Código</span>
        <input
          [value]="draft().codePosition"
          (input)="cambiar('codePosition', $any($event.target).value)"
          placeholder="P-01"
          maxlength="30"
        />
        <small>Con el que la operación va a nombrarla en voz alta.</small>
      </label>

      <label class="pos__campo">
        <span>Nombre</span>
        <input
          [value]="draft().name"
          (input)="cambiar('name', $any($event.target).value)"
          placeholder="Acceso principal"
          maxlength="150"
        />
      </label>

      <label class="pos__campo pos__campo--corto">
        <span>Elementos que pide</span>
        <input
          type="number"
          min="1"
          [value]="draft().requiredWorkerCount"
          (input)="cambiar('requiredWorkerCount', +$any($event.target).value)"
        />
        <small>Cuánta gente hace falta en el turno, no cuánta hay.</small>
      </label>

      <label class="pos__campo">
        <span>Notas <em>(opcional)</em></span>
        <textarea
          rows="2"
          [value]="draft().notes ?? ''"
          (input)="cambiar('notes', $any($event.target).value)"
        ></textarea>
      </label>

      @if (problema()) {
        <p class="pos__problema" id="pos-problema">{{ problema() }}</p>
      }

      <div class="pos__acciones">
        <button class="pos__cancelar" type="button" (click)="cancel.emit()">Cancelar</button>
        <button
          class="pos__guardar"
          type="submit"
          [disabled]="!!problema() || saving()"
          [attr.aria-describedby]="problema() ? 'pos-problema' : null"
        >
          Crear la posición
        </button>
      </div>
    </form>
  `,
  styles: `
    :host { display: block; }

    .pos { display: flex; flex-direction: column; gap: 0.75rem; }

    .pos__campo { display: flex; flex-direction: column; gap: 0.25rem; font-size: 12px; }
    .pos__campo > span { color: var(--gestia-muted); font-weight: 600; }
    .pos__campo em { font-style: normal; font-weight: 400; }
    .pos__campo small { color: var(--gestia-muted); font-size: 11px; }
    .pos__campo--corto input { width: 6rem; }

    .pos__campo input,
    .pos__campo textarea {
      padding: 0.5rem 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .pos__campo input { height: var(--gestia-control-height); }
    .pos__campo textarea { resize: vertical; }

    .pos__problema { margin: 0; color: var(--gestia-warning); font-size: 11.5px; }

    .pos__acciones { display: flex; justify-content: flex-end; gap: 0.75rem; }

    .pos__cancelar,
    .pos__guardar {
      height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border-radius: var(--gestia-radius);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .pos__cancelar {
      border: 1px solid var(--gestia-border);
      background: var(--gestia-surface);
      color: var(--gestia-text);
    }

    .pos__guardar {
      border: 1px solid var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .pos__guardar[disabled] { opacity: 0.5; cursor: not-allowed; }

    .pos__cancelar:focus-visible,
    .pos__guardar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
  `,
})
export class PositionForm {
  readonly saving = input(false);

  /** Los códigos que ya existen, para no chocar con uno y enterarse por un 409. */
  readonly usedCodes = input<readonly string[]>([]);

  readonly save = output<PositionDraft>();
  readonly cancel = output<void>();

  protected readonly draft = signal<PositionDraft>({
    codePosition: '',
    name: '',
    requiredWorkerCount: 1,
    notes: null,
  });

  /**
   * Qué le falta al alta. Cadena vacía significa que ya se puede guardar.
   *
   * <p>El choque de código se comprueba aquí <b>además</b> de en el servidor. No es desconfianza:
   * el servidor responde 409 y esa respuesta llega después de escribir todo el formulario, cuando
   * el código ya se pensó. Decirlo mientras se escribe cuesta una comparación.</p>
   *
   * <p><b>Un código sigue ocupado aunque la posición esté inactiva</b>, porque aquí no se borra.
   * Por eso la lista que se compara incluye las inactivas: si sólo trajera las activas, el aviso
   * diría que está libre y el servidor diría que no.</p>
   */
  protected readonly problema = computed(() => {
    const { codePosition, name, requiredWorkerCount } = this.draft();

    if (!codePosition.trim()) {
      return 'Falta el código de la posición.';
    }

    if (this.usedCodes().some((code) => code.toLowerCase() === codePosition.trim().toLowerCase())) {
      return `El código ${codePosition.trim()} ya está en uso en este servicio, aunque la posición esté inactiva: aquí los registros no se borran.`;
    }

    if (!name.trim()) {
      return 'Falta el nombre de la posición.';
    }

    if (requiredWorkerCount < 1) {
      return 'Una posición pide al menos un elemento; si no, no hay nada que cubrir.';
    }

    return '';
  });

  protected cambiar<K extends keyof PositionDraft>(campo: K, valor: PositionDraft[K]): void {
    this.draft.set({ ...this.draft(), [campo]: valor });
  }

  protected guardar(): void {
    if (this.problema() || this.saving()) {
      return;
    }

    const { codePosition, name, requiredWorkerCount, notes } = this.draft();

    this.save.emit({
      codePosition: codePosition.trim(),
      name: name.trim(),
      requiredWorkerCount,
      notes: notes?.trim() || null,
    });
  }
}
