import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';
import { EmployeeDocument } from '../data-access/workforce.models';
import {
  documentTypeLabel,
  employeeRequirementRows,
  requirementStateLabel,
  requirementStateTone,
} from '../data-access/employee-list.models';

/**
 * La pestaña de Documentos.
 *
 * <p><b>Se listan los requisitos, no los archivos.</b> Recorrer los documentos cargados haría
 * invisible el único caso que importa —el requisito que nadie cubrió— porque un hueco no tiene
 * archivo que lo represente.</p>
 *
 * <p>Y se dice de dónde salen: <b>los exige esta organización</b>, desde su catálogo. Sin esa
 * frase, quien ve «4 requisitos» supone que son del sistema y no busca dónde cambiarlos.</p>
 *
 * <p><b>Cada requisito sin cubrir lleva su propia acción, y eso no reabre el par duplicado que se
 * quitó.</b> Lo que se elimino entonces fueron dos botones genéricos de «Agregar documento» que
 * hacían lo mismo. Esto es distinto: la acción de la fila <b>carga el tipo que esa fila nombra</b>,
 * así que no repite nada. Sin ella, la pantalla afirmaba un problema —«Sin cargar»— y obligaba a
 * bajar al bloque del expediente y volver a buscar el tipo a mano, que es justo la clase de hueco
 * que este proyecto lleva semanas cerrando.</p>
 *
 * <p>El bloque del expediente sigue debajo, y sigue teniendo su botón: sirve para los documentos
 * que la organización <b>no</b> exige, que no tienen fila arriba.</p>
 */
@Component({
  selector: 'app-employee-documents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState],
  template: `
    <section class="docs">
      @if (requirements().length === 0) {
        <gi-empty-state
          variant="missing-prerequisite"
          title="Esta organización todavía no exige ningún documento"
          description="Los requisitos documentales se definen en Catálogos, por organización. Mientras no haya ninguno, no se puede decir que un expediente esté completo ni incompleto."
          link="/catalogos"
          actionLabel="Ir a Catálogos"
        />
      } @else {

        <!--
          Dos pestanas, y nada mas.

          Antes esto era una sola columna con: tres tarjetas de resumen, el bloque de obligatorios
          con su titulo y su parrafo, el de informativos con los suyos, y «Otros documentos»
          plegado al final. Cuatro encabezados apilados para dos listas, y habia que desplazar
          para llegar a la segunda.

          Obligatorios e informativos no se mezclan porque **no son la misma cosa**: uno impide
          asignar a la persona y el otro solo deja constancia. Separarlos en pestanas dice esa
          diferencia con la estructura, que es mas dificil de ignorar que una etiqueta pequena.
        -->
        <div class="subtabs" role="tablist" aria-label="Tipos de documento">
          <button
            type="button"
            role="tab"
            class="subtab"
            [class.is-active]="vista() === 'obligatorios'"
            [attr.aria-selected]="vista() === 'obligatorios'"
            (click)="vista.set('obligatorios')"
          >
            Obligatorios
            <span class="subtab__count">{{ obligatorios().length }}</span>
            @if (porAtender() > 0) {
              <span class="subtab__alerta">{{ porAtender() }} por atender</span>
            }
          </button>

          <button
            type="button"
            role="tab"
            class="subtab"
            [class.is-active]="vista() === 'informativos'"
            [attr.aria-selected]="vista() === 'informativos'"
            (click)="vista.set('informativos')"
          >
            Informativos
            <span class="subtab__count">{{ informativos().length }}</span>
          </button>
        </div>

        <p class="docs__note">
          @if (vista() === 'obligatorios') {
            Si falta uno, está vencido o no es válido, no se puede asignar a esta persona ni
            publicar la planeación.
          } @else {
            No impiden asignar; sólo dejan constancia. Aun así conviene mantenerlos al día.
          }
        </p>

        @let filas = vista() === 'obligatorios' ? obligatorios() : informativos();

        @if (filas.length === 0) {
          <p class="docs__vacio">
            @if (vista() === 'obligatorios') {
              Esta organización no exige ningún documento obligatorio.
            } @else {
              Esta organización no define ningún documento informativo.
            }
          </p>
        } @else {
          <ul class="docs__list">
            @for (row of filas; track row.code) {
              <li class="req" [class]="'req--' + tone(row.state)">
                <span class="req__body">
                  <span class="req__name">{{ row.label }}</span>
                  @let detalle = detail(row.state, row.expiresDate, row.documentStatus);
                  @if (detalle) {
                    <span class="req__detail">{{ detalle }}</span>
                  }
                </span>
                <span class="req__side">
                  <span class="req__state">{{ stateLabel(row.state) }}</span>
                  <!--
                    La salida, en la propia fila. «Sin cargar» sin accion era una etiqueta muerta:
                    obligaba a bajar al expediente y buscar a mano el tipo que la fila ya nombra.
                    En «Al dia» no se ofrece nada, porque no hay nada que hacer.
                  -->
                  @if (canWrite() && row.state !== 'UpToDate') {
                    <button class="req__accion" type="button" (click)="cargar.emit(row.code)">
                      {{ row.state === 'Missing' ? 'Cargar' : 'Reemplazar' }}
                    </button>
                  }
                </span>
              </li>
            }
          </ul>
        }

        <!--
          Los archivos que la organizacion no exige. Siguen plegados y al final: no cuentan para la
          expediente, asi que no compiten con lo que si.
        -->
        @if (extras().length) {
          <details class="otros">
            <summary>
              Otros documentos
              <span class="otros__cuenta">
                {{ extras().length }} {{ extras().length === 1 ? 'documento' : 'documentos' }}
              </span>
            </summary>
            <ul class="docs__plain">
              @for (extra of extras(); track extra.idEmployeeDocument) {
                <li>{{ categoryLabel(extra) }}</li>
              }
            </ul>
          </details>
        }
      }

    </section>
  `,
  styles: `
    :host { display: block; }

    .docs { display: flex; flex-direction: column; gap: 0.85rem; }

    .docs__note { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    .docs__kicker {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    /* Las sub-pestanas. Mismo lenguaje que las del panel —subrayado cian en la activa— pero mas
       pequenas, porque estan un nivel por dentro y no deben competir con ellas. */
    .subtabs {
      display: flex;
      gap: 0.15rem;
      margin: 0 0 0.6rem;
      border-bottom: 1px solid var(--gestia-border);
    }

    .subtab {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.55rem;
      border: 0;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--gestia-muted);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .subtab:hover { color: var(--gestia-text); }
    .subtab.is-active { border-bottom-color: var(--gestia-cyan); color: var(--gestia-text); }
    .subtab:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: -2px; }

    .subtab__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.15rem;
      padding: 0 0.25rem;
      border-radius: var(--gestia-radius-pill);
      background: var(--gestia-surface-soft);
      font-size: 10.5px;
    }

    /* Lo que hay que atender se dice con palabra, no solo con color. */
    .subtab__alerta {
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--gestia-danger);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-danger);
      font-size: 10.5px;
    }

    .docs__vacio {
      margin: 0;
      padding: 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      color: var(--gestia-muted);
      font-size: 12px;
    }

    .bloque__nota { margin: 0.2rem 0 0.6rem; color: var(--gestia-muted); font-size: 11.5px; }


    .otros {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0.5rem 0.75rem;
      background: var(--gestia-surface);
    }

    .otros > summary {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--gestia-text);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .otros__cuenta { color: var(--gestia-muted); font-weight: 400; font-size: 11px; }
    .otros > summary:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    @media (width < 52rem) {
    }

    .docs__list, .docs__plain { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

    .req {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--gestia-border);
    }

    .req:last-child { border-bottom: 0; }

    .req__body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }

    .req__name {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--gestia-text);
      font-size: 12.5px;
      font-weight: 600;
    }

    /* Un requisito que no bloquea se pide igual. Decirlo evita que se lea como opcional. */
    .req__soft {
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .req__detail { color: var(--gestia-muted); font-size: 11.5px; }

    .req__side { display: flex; flex: none; align-items: center; gap: 0.4rem; }

    .req__accion {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      padding: 0.2rem 0.5rem;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .req__accion:hover { border-color: var(--gestia-navy); color: var(--gestia-navy); }

    .req__accion:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .req__state {
      flex: none;
      padding: 0.15rem 0.45rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .req--danger .req__state { border-color: var(--gestia-danger); color: var(--gestia-danger); }
    .req--warning .req__state { border-color: var(--gestia-warning); color: var(--gestia-warning); }
    .req--success .req__state { border-color: var(--gestia-success); color: var(--gestia-success); }

    .docs__extra {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--gestia-border);
    }

    .docs__plain li { color: var(--gestia-text); font-size: 12px; padding: 0.2rem 0; }

  `,
})
export class EmployeeDocuments {
  /**
   * Qué lista se está viendo.
   *
   * <p>Arranca en obligatorios porque son los que impiden asignar: quien abre esta pestaña casi
   * siempre viene a ver si la persona puede trabajar, no a repasar lo informativo.</p>
   */
  protected readonly vista = signal<'obligatorios' | 'informativos'>('obligatorios');

  readonly requirements = input.required<readonly EligibilityRequirement[]>();
  readonly documents = input.required<readonly EmployeeDocument[]>();
  /** El día operativo del servidor. No se lee del reloj del navegador. */
  readonly today = input.required<string>();
  readonly expiringWithinDays = input(30);
  readonly canWrite = input(false);

  /**
   * Las categorías del catálogo de la organización.
   *
   * <p>Entra como dato y no se descubre aquí porque la pantalla que la contiene ya las tiene
   * cargadas: pedirlas otra vez sería un viaje al servidor por cada pestaña que se abre.</p>
   */
  readonly categories = input<readonly { readonly idCatalogItem: string; readonly name: string }[]>([]);

  /** El tipo de documento del requisito que hay que cubrir. La pantalla abre el alta con él puesto. */
  readonly cargar = output<string>();

  protected readonly stateLabel = requirementStateLabel;
  protected readonly tone = requirementStateTone;
  protected readonly typeLabel = documentTypeLabel;

  /**
   * Cómo se nombra un documento en la lista.
   *
   * <p>Manda el nombre de la categoría del catálogo. El enum sólo se usa de respaldo, para los
   * expedientes anteriores a la conversión del 19 de septiembre de 2026 que todavía no tienen
   * categoría: son los únicos donde ese enum significa algo.</p>
   */
  protected categoryLabel(document: { readonly documentCategoryName: string | null; readonly documentType: string }): string {
    return document.documentCategoryName ?? documentTypeLabel(document.documentType);
  }

  /**
   * Cómo se nombra un documento en la lista.
   *
   * <p>Manda el nombre de la categoría del catálogo. El enum sólo se usa de respaldo, para los
   * expedientes anteriores a la conversión del 19 de septiembre de 2026 que todavía no tienen
   * categoría: son los únicos donde ese enum significa algo.</p>
   */


  protected readonly rows = computed(() =>
    employeeRequirementRows(
      this.requirements(),
      this.documents(),
      this.today(),
      this.expiringWithinDays(),
    ),
  );

  /**
   * Los requisitos, separados por lo que pasa si faltan.
   *
   * <p>Iban en una sola lista, distinguidos por una etiqueta pequeña que decía «no bloquea». Con
   * doce requisitos había que leer fila por fila para saber cuáles impiden asignar a la persona y
   * cuáles sólo dejan constancia, que es lo primero que uno quiere saber al abrir un expediente.
   * Ahora son dos bloques y el orden lo dice sin leer: primero lo que impide trabajar.</p>
   */
  protected readonly obligatorios = computed(() => this.rows().filter((fila) => fila.isRequired));
  protected readonly informativos = computed(() => this.rows().filter((fila) => !fila.isRequired));

  /** Lo cargado que nadie exige. Se muestra aparte para que no se confunda con un requisito. */
  protected readonly extras = computed(() => {
    const exigidos = new Set(
      this.requirements()
        .map((item) => (item.requiredDocumentType ?? '').toLowerCase())
        .filter(Boolean),
    );

    return this.documents().filter(
      (document) => document.active && !exigidos.has(document.documentType.toLowerCase()),
    );
  });

  /**
   * Por qué el requisito está como está.
   *
   * <p>Los dos casos de documento cargado que no cuenta se explican, en lugar de dejar sólo la
   * etiqueta: quien ve «Rechazado» sobre un documento que subió necesita saber que el requisito
   * sigue abierto, y quien ve «Sin validar» necesita saber que falta que alguien lo revise.</p>
   */
  protected detail(state: string, expires: string | null, status: string | null = null): string {
    if (state === 'Missing') {
      return 'No hay documento cargado para este requisito.';
    }

    if (state === 'Rejected') {
      return 'El documento cargado se rechazó, así que el requisito sigue sin cubrirse.';
    }

    if (state === 'Unvalidated') {
      return status === 'NotApplicable'
        ? 'El documento está marcado como no aplicable, así que no cubre el requisito.'
        : 'El documento está cargado pero sin validar, así que todavía no cubre el requisito.';
    }

    // Los estados por fecha —vencido y vigente— no llevan frase: el rótulo del lado ya lo dice, y
    // repetirlo en prosa alargaba la fila sin añadir nada. Sólo se explican los estados que
    // necesitan una acción distinta de «renovar», que son los de más arriba.
    return '';
  }

  /**
   * El resumen de arriba: tres números que contestan «¿qué tengo que hacer aquí?».
   *
   * <p>Sin ellos había que recorrer las dos listas para saber si algo requiere acción, que es lo
   * primero que se pregunta quien abre un expediente.</p>
   */
  protected readonly conObservaciones = computed(
    () => this.obligatorios().filter((fila) => fila.state !== 'UpToDate').length,
  );

  protected readonly informativosAlDia = computed(
    () => this.informativos().every((fila) => fila.state === 'UpToDate'),
  );

  protected readonly porAtender = computed(
    () => this.rows().filter((fila) => fila.state !== 'UpToDate').length,
  );
}
