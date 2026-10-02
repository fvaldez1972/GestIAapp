import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { GiCatalogOption } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { GiSelect, GiSelectOption } from '../../../shared/ui/gi-select/gi-select';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';

/**
 * Una experiencia que se pide para la posición, tal como se acaba de elegir.
 *
 * <p><b>Sin severidad, desde el 19 de septiembre de 2026.</b> Qué tan grave es que falte lo dice la
 * entrada del catálogo, no la posición: RF-POS-010 pidió una sola fuente, porque con dos el mismo
 * requisito podía quedar obligatorio en un sitio e informativo en otro.</p>
 */
export type PositionSkillRequest = {
  readonly idSkillCatalogItem: string;
  readonly name: string;
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
  imports: [GiSelect],
  template: `
    <section class="perfil">
      <header class="perfil__head">
        <h4 class="perfil__kicker">EXPERIENCIA QUE PIDE LA POSICIÓN</h4>
        @if (pendingCount() > 0) {
          <span class="perfil__pending">{{ pendingCount() }} se guardarán con la posición</span>
        }
      </header>

      <!--
        Sin experiencias no se dibuja nada. El parrafo que explicaba el vacio ocupaba tres
        renglones para decir que no habia nada, justo encima del desplegable que sirve para
        ponerlas: el propio desplegable ya es la invitacion.
      -->
      @if (rows().length > 0) {
        <ul class="perfil__list">
          @for (row of rows(); track row.key) {
            <li class="skill" [class.skill--pendiente]="row.pending">
              <span class="skill__name">{{ row.name }}</span>

              @if (row.pending) {
                <span class="skill__marca" title="Se guarda al guardar la posición">sin guardar</span>
              }

              @if (canWrite()) {
                <button
                  class="skill__quitar"
                  type="button"
                  [disabled]="saving()"
                  [attr.aria-label]="'Quitar ' + row.name"
                  [title]="'Quitar ' + row.name"
                  (click)="quitar(row)"
                >&times;</button>
              }
            </li>
          }
        </ul>
      }

      @if (canWrite()) {
        <p class="perfil__kicker perfil__kicker--add">AGREGAR UNA EXPERIENCIA</p>
        <!--
          Sin boton «Agregar»: elegir una experiencia la agrega.

          El boton pedia un segundo clic para confirmar algo que ya se habia decidido con el
          primero, y su unico efecto real era que alguien eligiera y se fuera creyendo que estaba
          puesta. El selector es seguro para esto porque solo emite al elegir de una lista cerrada
          —no mientras se teclea—, asi que no hay forma de agregar a medias.

          La salida sigue existiendo: cada experiencia puesta lleva su «Quitar» en la lista de
          arriba, que es donde se mira lo que la posicion pide.
        -->
        <div class="perfil__add">
          <gi-select
            label="Experiencia"
            placeholder="Elige la experiencia que la posición pide"
            [openDown]="true"
            [options]="opciones()"
            [disabled]="saving() || !opciones().length"
            value=""
            (valueChange)="agregar($event)"
          />
        </div>

        @if (!opciones().length) {
          <p class="perfil__note">Ya están pedidas todas las experiencias del catálogo.</p>
        }

      }
    </section>
  `,
  styles: `
    :host { display: block; grid-column: 1 / -1; }

    .perfil { display: flex; flex-direction: column; gap: 0.5rem; }

    .perfil__add gi-select { display: block; max-width: 28rem; }

    /* Cada experiencia, una ficha del tamano de su texto.
       Ocupaban el ancho entero con un boton «Quitar» al otro extremo, asi que tres experiencias
       eran tres barras y el ojo tenia que cruzar la caja para llegar a la accion. Como fichas en
       linea ocupan lo que miden, se ven como una coleccion, y la equis va pegada al nombre que
       quita. Es la misma forma que ya tiene «Equipo requerido» dos campos mas arriba. */
    .perfil__list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .skill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-surface);
      max-width: 100%;
    }

    /* Lo que todavia no se ha guardado se distingue por el borde, no solo por la palabra. */
    .skill--pendiente { border-color: var(--gestia-warning); }

    .skill__name {
      color: var(--gestia-text);
      font-size: 12px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .skill__marca { color: var(--gestia-warning); font-size: 10.5px; white-space: nowrap; }

    .skill__quitar {
      border: 0;
      background: none;
      padding: 0;
      color: var(--gestia-muted);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
    }

    .skill__quitar:hover { color: var(--gestia-danger); }
    .skill__quitar:disabled { color: var(--gestia-border); cursor: default; }
    .skill__quitar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
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

  readonly add = output<PositionSkillRequest>();
  /** Quitar una ya guardada, por identificador de regla. */
  readonly remove = output<string>();
  /** Quitar una que todavía no se guarda, por identificador de catálogo. */
  readonly removePending = output<string>();


  protected readonly rows = computed(() => [
    ...this.requirements().map((requirement) => ({
      key: requirement.idEligibilityRequirement,
      idSkillCatalogItem: requirement.idRequiredCatalogItem ?? '',
      name: requirement.requiredCatalogItemName || requirement.name,
      isRequired: requirement.isRequiredEffective,
      pending: false,
    })),
    ...this.pending().map((item) => ({
      key: `pendiente:${item.idSkillCatalogItem}`,
      idSkillCatalogItem: item.idSkillCatalogItem,
      name: item.name,
      // Todavia no hay regla, asi que no hay severidad resuelta que ensenar. La fila lo dice con
      // «se guarda al guardar la posicion» en vez de afirmar algo que no sabe.
      isRequired: false,
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
   * Suma la experiencia recién elegida a las que la posición pide.
   *
   * <p>La llama el propio selector al elegir, no un botón: un segundo clic para confirmar lo que ya
   * se decidió con el primero sólo servía para que alguien eligiera, se fuera, y la experiencia no
   * quedara puesta.</p>
   *
   * <p><b>Lo que no está en el catálogo no se agrega</b>, y con eso basta para los dos casos que
   * no son una elección: el vacío que el selector emite al limpiarse, y un identificador que ya no
   * existe. Había aquí una guarda aparte para el vacío y se quitó al comprobar que sobraba —la
   * prueba no cambiaba de color con ella ni sin ella—, que es la señal de que el código no hacía
   * nada.</p>
   */
  /** Lo que el desplegable ofrece, con la forma que pide `gi-select`. */
  protected readonly opciones = computed<readonly GiSelectOption[]>(() =>
    this.available().map((opcion) => ({ value: opcion.idCatalogItem, label: opcion.name })),
  );

  protected agregar(idCatalogItem: string): void {
    const opcion = this.catalogSkills().find((item) => item.idCatalogItem === idCatalogItem);

    if (!opcion) {
      return;
    }

    this.add.emit({
      idSkillCatalogItem: opcion.idCatalogItem,
      name: opcion.name,
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
