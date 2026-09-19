import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  GiCatalogCreation,
  GiCatalogOption,
  GiCatalogPicker,
} from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';

/** Una experiencia que se pide para la posición, tal como se acaba de elegir. */
/** Lo que hace falta para cambiarle el modo a una experiencia ya puesta. */
export type PositionSkillToggle = {
  /** El identificador de la regla si ya existe, o el de la experiencia si está pendiente. */
  readonly key: string;
  readonly idSkillCatalogItem: string;
  readonly name: string;
  readonly isBlocking: boolean | null;
  /** Si todavía no existe en el servidor porque la posición no se ha guardado. */
  readonly pending: boolean;
};

export type PositionSkillRequest = {
  readonly idSkillCatalogItem: string;
  readonly name: string;
  /** Si impide asignar, o sólo deja constancia. */
  readonly isBlocking: boolean | null;
};

/**
 * El perfil requerido de una posición, armado con experiencias del catálogo.
 *
 * <p><b>Por qué deja de ser texto libre.</b> El campo decía cosas como «30 a 40 años de edad,
 * hombre o mujer, buen trato»: una descripción que ninguna persona puede cumplir a ojos del
 * sistema, porque nada la compara con nadie. Con experiencias del catálogo el perfil se vuelve
 * comprobable —el servidor ya evalúa las reglas de experiencia al asignar y al publicar— y además
 * sirve para lo que de verdad hacía falta: filtrar. Con 250 guardias nadie los conoce por nombre;
 * se llega a los tres que pueden cubrir el turno quitando por experiencia.</p>
 *
 * <p><b>Por identificador, no por nombre.</b> Cada experiencia apunta a una fila del catálogo, así
 * que renombrarla la renombra en todas partes en lugar de dejar reglas apuntando a un texto que ya
 * no existe.</p>
 *
 * <p><b>El texto libre no se borra.</b> Queda como nota del perfil, y la pantalla dice lo que es:
 * algo que se lee, no algo que se comprueba. Borrarlo perdería lo que alguien escribió.</p>
 */
@Component({
  selector: 'app-position-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiCatalogPicker],
  template: `
    <section class="perfil">
      <header class="perfil__head">
        <h4 class="perfil__kicker">EXPERIENCIA QUE PIDE LA POSICIÓN</h4>
        @if (pendingCount() > 0) {
          <span class="perfil__pending">{{ pendingCount() }} se guardarán con la posición</span>
        }
      </header>

      @if (rows().length === 0) {
        <p class="perfil__note">
          Ninguna experiencia exigida. La posición se puede cubrir con cualquier persona que cumpla
          los requisitos de la organización.
        </p>
      } @else {
        <ul class="perfil__list">
          @for (row of rows(); track row.key) {
            <li class="skill">
              <span class="skill__body">
                <span class="skill__name">{{ row.name }}</span>
                <span class="skill__detail">
                  {{ row.isBlocking ? 'Impide asignar a quien no la tenga' : 'Sólo deja constancia' }}
                  @if (row.pending) {
                    · se guarda al guardar la posición
                  }
                </span>
              </span>
              @if (canWrite()) {
                <!--
                  Y se puede cambiar de opinión sin quitarla y volver a ponerla: es lo que QA
                  intentaba hacer cuando reportó que desmarcar la casilla no se guardaba.
                -->
                <button
                  class="button button--secondary"
                  type="button"
                  [disabled]="saving()"
                  (click)="alternar(row)"
                >
                  {{ row.isBlocking ? 'Sólo dejar constancia' : 'Que impida asignar' }}
                </button>
                <button
                  class="button button--secondary"
                  type="button"
                  [disabled]="saving()"
                  (click)="quitar(row)"
                >
                  Quitar
                </button>
              }
            </li>
          }
        </ul>
      }

      @if (canWrite()) {
        <!--
          El alta va rotulada y encerrada.
          La casilla «Impide asignar si no la tiene» queda justo debajo de la lista de experiencias
          ya pedidas, y sin rótulo parecía gobernarlas: quien la desmarcaba creía estar cambiando la
          experiencia de arriba y no pasaba nada, porque es la casilla de la que se va a agregar. Cada
          experiencia ya puesta se cambia con su propio botón, en su fila.
        -->
        <p class="perfil__kicker perfil__kicker--add">AGREGAR UNA EXPERIENCIA</p>
        <div class="perfil__add">
          <gi-catalog-picker
            label="Experiencia"
            catalogLabel="el catálogo de experiencias"
            inputId="ps-experiencia"
            [options]="available()"
            [value]="elegida()"
            [canWrite]="canWrite()"
            [disabled]="saving()"
            (valueChange)="elegida.set($event)"
            (create)="createSkill.emit($event)"
          />
          <!--
            La casilla se lee al pulsar «Agregar», no al elegir la experiencia.
            Antes la experiencia se creaba en el momento de elegirla del catálogo, y la casilla está
            al lado: quien la desmarcaba después lo hacía cuando la regla ya existía como
            bloqueante, y desmarcarla no cambiaba nada. La pantalla leía un dato antes de que la
            persona lo diera.
          -->
          <label class="perfil__check">
            <input type="checkbox" [checked]="bloquea()" (change)="bloquea.set($any($event.target).checked)" />
            <span>Que la nueva impida asignar si no la tiene</span>
          </label>
          <button
            class="button button--primary"
            type="button"
            [disabled]="saving() || !elegida()"
            (click)="agregar()"
          >
            Agregar
          </button>
        </div>
        <p class="perfil__note">
          Una experiencia que impide asignar detiene también la publicación de la semana. Si sólo
          quieres que quede escrita, desmarca la casilla antes de agregarla. Para cambiar una que ya
          está en la lista, usa su propio botón.
        </p>
      }
    </section>
  `,
  styles: `
    :host { display: block; grid-column: 1 / -1; }

    .perfil { display: flex; flex-direction: column; gap: 0.5rem; }

    .perfil__head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; }

    .perfil__kicker {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .perfil__kicker--add {
      margin-top: 0.35rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--gestia-border);
    }

    .perfil__pending { color: var(--gestia-muted); font-size: 10.5px; }

    .perfil__note { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    .perfil__list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

    .perfil__add { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

    .perfil__check { display: flex; align-items: center; gap: 0.35rem; font-size: 12px; }

    .skill {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.45rem 0;
      border-bottom: 1px solid var(--gestia-border);
    }

    .skill:last-child { border-bottom: 0; }

    .skill__body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
    .skill__name { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .skill__detail { color: var(--gestia-muted); font-size: 11px; }
  `,
})
export class PositionSkills {
  /** Las experiencias activas del catálogo de la organización. */
  readonly catalogSkills = input.required<readonly GiCatalogOption[]>();
  /** Las reglas de experiencia ya guardadas para esta posición. */
  readonly requirements = input<readonly EligibilityRequirement[]>([]);
  /** Las elegidas que todavía no existen en el servidor, porque la posición tampoco. */
  readonly pending = input<readonly PositionSkillRequest[]>([]);
  readonly canWrite = input(false);
  readonly saving = input(false);

  /** Cambiar una regla ya puesta de bloqueante a informativa, o al revés. */
  readonly toggleBlocking = output<PositionSkillToggle>();

  readonly add = output<PositionSkillRequest>();
  /** Quitar una ya guardada, por identificador de regla. */
  readonly remove = output<string>();
  /** Quitar una que todavía no se guarda, por identificador de catálogo. */
  readonly removePending = output<string>();
  readonly createSkill = output<GiCatalogCreation>();

  protected readonly elegida = signal('');
  protected readonly bloquea = signal(true);

  protected readonly rows = computed(() => [
    ...this.requirements().map((requirement) => ({
      key: requirement.idEligibilityRequirement,
      idSkillCatalogItem: requirement.idRequiredCatalogItem ?? '',
      name: requirement.requiredCatalogItemName || requirement.name,
      isBlocking: requirement.isBlocking,
      pending: false,
    })),
    ...this.pending().map((item) => ({
      key: `pendiente:${item.idSkillCatalogItem}`,
      idSkillCatalogItem: item.idSkillCatalogItem,
      name: item.name,
      isBlocking: item.isBlocking,
      pending: true,
    })),
  ]);

  protected readonly pendingCount = computed(() => this.pending().length);

  /** Lo ya pedido no se vuelve a ofrecer: dos reglas de la misma experiencia dirían lo mismo dos veces. */
  protected readonly available = computed(() => {
    const puestas = new Set(this.rows().map((row) => row.idSkillCatalogItem));
    return this.catalogSkills().filter((option) => !puestas.has(option.idCatalogItem));
  });

  /**
   * Suma la experiencia elegida con el modo que dice la casilla.
   *
   * <p>Se dispara con «Agregar» y no al elegir del catálogo. Elegir y decidir si impide asignar son
   * dos datos, y leerlos en momentos distintos era el defecto: la regla nacía bloqueante antes de
   * que nadie tocara la casilla.</p>
   */
  protected agregar(): void {
    const opcion = this.catalogSkills().find((item) => item.idCatalogItem === this.elegida());

    if (!opcion) {
      this.elegida.set('');
      return;
    }

    this.add.emit({
      idSkillCatalogItem: opcion.idCatalogItem,
      name: opcion.name,
      isBlocking: this.bloquea(),
    });

    // El selector se limpia para poder sumar otra sin borrar a mano lo anterior. La casilla se
    // queda como estaba: quien pide tres experiencias informativas no quiere desmarcarla tres veces.
    this.elegida.set('');
  }

  protected alternar(row: {
    readonly key: string;
    readonly idSkillCatalogItem: string;
    readonly name: string;
    readonly isBlocking: boolean | null;
    readonly pending: boolean;
  }): void {
    if (this.saving()) return;

    this.toggleBlocking.emit({
      key: row.key,
      idSkillCatalogItem: row.idSkillCatalogItem,
      name: row.name,
      isBlocking: !row.isBlocking,
      pending: row.pending,
    });
  }

  protected quitar(row: { readonly key: string; readonly idSkillCatalogItem: string; readonly pending: boolean }): void {
    if (this.saving()) return;

    if (row.pending) {
      this.removePending.emit(row.idSkillCatalogItem);
      return;
    }

    this.remove.emit(row.key);
  }
}
