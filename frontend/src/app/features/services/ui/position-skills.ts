import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  GiCatalogCreation,
  GiCatalogOption,
  GiCatalogPicker,
} from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';

/** Una habilidad que se pide para la posición, tal como se acaba de elegir. */
export type PositionSkillRequest = {
  readonly idSkillCatalogItem: string;
  readonly name: string;
  /** Si impide asignar, o sólo deja constancia. */
  readonly isBlocking: boolean;
};

/**
 * El perfil requerido de una posición, armado con habilidades del catálogo.
 *
 * <p><b>Por qué deja de ser texto libre.</b> El campo decía cosas como «30 a 40 años de edad,
 * hombre o mujer, buen trato»: una descripción que ninguna persona puede cumplir a ojos del
 * sistema, porque nada la compara con nadie. Con habilidades del catálogo el perfil se vuelve
 * comprobable —el servidor ya evalúa las reglas de habilidad al asignar y al publicar— y además
 * sirve para lo que de verdad hacía falta: filtrar. Con 250 guardias nadie los conoce por nombre;
 * se llega a los tres que pueden cubrir el turno quitando por habilidad.</p>
 *
 * <p><b>Por identificador, no por nombre.</b> Cada habilidad apunta a una fila del catálogo, así
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
        <h4 class="perfil__kicker">HABILIDADES QUE PIDE LA POSICIÓN</h4>
        @if (pendingCount() > 0) {
          <span class="perfil__pending">{{ pendingCount() }} se guardarán con la posición</span>
        }
      </header>

      @if (rows().length === 0) {
        <p class="perfil__note">
          Ninguna habilidad exigida. La posición se puede cubrir con cualquier persona que cumpla
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
        <div class="perfil__add">
          <gi-catalog-picker
            label="Habilidad"
            catalogLabel="el catálogo de habilidades"
            inputId="ps-habilidad"
            [options]="available()"
            [value]="elegida()"
            [canWrite]="canWrite()"
            [disabled]="saving()"
            (valueChange)="elegir($event)"
            (create)="createSkill.emit($event)"
          />
          <label class="perfil__check">
            <input type="checkbox" [checked]="bloquea()" (change)="bloquea.set($any($event.target).checked)" />
            <span>Impide asignar si no la tiene</span>
          </label>
        </div>
        <p class="perfil__note">
          Una habilidad que impide asignar detiene también la publicación de la semana. Si sólo
          quieres que quede escrita, desmarca la casilla.
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
  /** Las habilidades activas del catálogo de la organización. */
  readonly catalogSkills = input.required<readonly GiCatalogOption[]>();
  /** Las reglas de habilidad ya guardadas para esta posición. */
  readonly requirements = input<readonly EligibilityRequirement[]>([]);
  /** Las elegidas que todavía no existen en el servidor, porque la posición tampoco. */
  readonly pending = input<readonly PositionSkillRequest[]>([]);
  readonly canWrite = input(false);
  readonly saving = input(false);

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

  /** Lo ya pedido no se vuelve a ofrecer: dos reglas de la misma habilidad dirían lo mismo dos veces. */
  protected readonly available = computed(() => {
    const puestas = new Set(this.rows().map((row) => row.idSkillCatalogItem));
    return this.catalogSkills().filter((option) => !puestas.has(option.idCatalogItem));
  });

  protected elegir(idCatalogItem: string): void {
    const opcion = this.catalogSkills().find((item) => item.idCatalogItem === idCatalogItem);

    if (!opcion) {
      this.elegida.set('');
      return;
    }

    this.add.emit({
      idSkillCatalogItem: opcion.idCatalogItem,
      name: opcion.name,
      isBlocking: this.bloquea(),
    });

    // El selector se limpia para poder sumar otra sin borrar a mano lo anterior.
    this.elegida.set('');
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
