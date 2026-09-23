import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { formatOperationalDate } from '../../../shared/util/operational-date';
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
        <p class="docs__note">
          {{ requirements().length }}
          {{ requirements().length === 1 ? 'requisito definido' : 'requisitos definidos' }} por esta
          organización, sobre los tipos de documento que el sistema reconoce. Se considera «por
          vencer» lo que caduca en {{ expiringWithinDays() }} días o menos.
        </p>

        <!-- Tres numeros que contestan «que tengo que hacer aqui» sin recorrer las listas. -->
        <ul class="resumen">
          <li class="resumen__dato">
            <strong>{{ obligatorios().length }}</strong>
            <span>obligatorios</span>
            <small>{{ conObservaciones() === 0 ? 'Todos al día' : conObservaciones() + ' con observaciones' }}</small>
          </li>
          <li class="resumen__dato">
            <strong>{{ informativos().length }}</strong>
            <span>informativos</span>
            <small>{{ informativosAlDia() ? 'Todos al día' : 'Alguno sin cubrir' }}</small>
          </li>
          <li class="resumen__dato" [class.resumen__dato--alerta]="porAtender() > 0">
            <strong>{{ porAtender() }}</strong>
            <span>por atender</span>
            <small>{{ porAtender() === 0 ? 'Nada pendiente' : 'Requieren tu acción' }}</small>
          </li>
        </ul>

        @if (obligatorios().length) {
        <section class="bloque bloque--obligatorios">
          <h3 class="bloque__titulo">Documentos obligatorios</h3>
          <p class="bloque__nota">
            Si falta uno, está vencido o no es válido, no se puede asignar a esta persona ni publicar
            la planeación.
          </p>

        <ul class="docs__list">
          @for (row of obligatorios(); track row.code) {
            <li class="req" [class]="'req--' + tone(row.state)">
              <span class="req__body">
                <span class="req__name">{{ row.label }}</span>
                <span class="req__detail">{{ detail(row.state, row.expiresDate, row.documentStatus) }}</span>
              </span>
              <span class="req__side">
                <span class="req__state">{{ stateLabel(row.state) }}</span>
                <span class="req__vigencia">Vigencia: {{ vigencia(row.expiresDate) }}</span>
                <!--
                  La salida, en la propia fila.

                  Antes «Sin cargar» era una etiqueta muerta: la pantalla decia que faltaba la carta
                  de no antecedentes y no dejaba hacer nada con esa informacion. Habia que bajar al
                  bloque del expediente, pulsar «Agregar documento» y volver a buscar a mano el tipo
                  que aqui arriba ya estaba nombrado.

                  En «Al día» no se ofrece nada, porque no hay nada que hacer.
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
        </section>
        }

        <!--
          Los informativos van debajo y con su propio bloque. Antes compartían lista con los
          obligatorios y se distinguían por una etiqueta pequeña que había que leer fila por fila.
        -->
        @if (informativos().length) {
          <section class="bloque bloque--informativos">
          <h3 class="bloque__titulo">Documentos informativos</h3>
          <p class="bloque__nota">
            No son obligatorios para asignar, pero se recomienda mantenerlos actualizados.
          </p>

          <ul class="docs__list">
            @for (row of informativos(); track row.code) {
              <li class="req" [class]="'req--' + tone(row.state)">
                <span class="req__body">
                  <span class="req__name">{{ row.label }}</span>
                  <span class="req__detail">{{ detail(row.state, row.expiresDate, row.documentStatus) }}</span>
                </span>
                <span class="req__side">
                  <span class="req__state">{{ stateLabel(row.state) }}</span>
                  <span class="req__vigencia">Vigencia: {{ vigencia(row.expiresDate) }}</span>
                  @if (canWrite() && row.state !== 'UpToDate') {
                    <button class="req__accion" type="button" (click)="cargar.emit(row.code)">
                      {{ row.state === 'Missing' ? 'Cargar' : 'Reemplazar' }}
                    </button>
                  }
                </span>
              </li>
            }
          </ul>
          </section>
        }

        @if (extras().length) {
          <div class="docs__extra">
            <h3 class="docs__kicker">OTROS DOCUMENTOS CARGADOS</h3>
            <p class="docs__note">
              Están en el expediente pero esta organización no los exige. No cuentan para la
              vigencia.
            </p>
            <ul class="docs__plain">
              @for (extra of extras(); track extra.idEmployeeDocument) {
                <li>{{ categoryLabel(extra) }} · {{ expiry(extra.expiresDate) }}</li>
              }
            </ul>
          </div>
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

    /* El resumen: tres numeros que contestan «que tengo que hacer aqui». */
    .resumen {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.6rem;
      margin: 0 0 0.9rem;
      padding: 0;
      list-style: none;
    }

    .resumen__dato {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0.6rem 0.75rem;
      background: var(--gestia-surface);
    }

    .resumen__dato strong { color: var(--gestia-navy); font-size: 22px; line-height: 1.1; }
    .resumen__dato span { color: var(--gestia-text); font-size: 12px; }
    .resumen__dato small { color: var(--gestia-muted); font-size: 11px; }
    .resumen__dato--alerta { border-color: var(--gestia-warning, var(--gestia-border)); }

    /*
      Cada grupo en su tarjeta, con el color de lo que pasa si falta uno. El borde de la izquierda
      es lo que se ve sin leer: rojo, lo que impide trabajar; cian, lo que solo deja constancia.
    */
    .bloque {
      margin: 0 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0.75rem 0.85rem;
      background: var(--gestia-surface);
    }

    .bloque--obligatorios { border-left: 3px solid var(--gestia-danger); }
    .bloque--informativos { border-left: 3px solid var(--gestia-cyan); }

    .bloque__titulo { margin: 0; color: var(--gestia-navy); font-size: 13px; font-weight: 700; }
    .bloque__nota { margin: 0.2rem 0 0.6rem; color: var(--gestia-muted); font-size: 11.5px; }

    .req__vigencia { flex: none; color: var(--gestia-muted); font-size: 11px; white-space: nowrap; }

    @media (width < 52rem) {
      .resumen { grid-template-columns: minmax(0, 1fr); }
      .req__vigencia { display: none; }
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

  protected expiry(date: string | null): string {
    return date ? `vence el ${formatOperationalDate(date)}` : 'sin fecha de vencimiento';
  }

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

    if (!expires) {
      return 'Cargado, sin fecha de vencimiento.';
    }

    // La fecha ya no va en la frase: tiene su propia columna «Vigencia». Repetirla en las dos
    // hacía la fila larga y obligaba a leer una oración para encontrar un dato que es una fecha.
    return state === 'Expired' ? 'El documento venció.' : 'Documento vigente.';
  }

  /** La fecha de vigencia, en su columna. Un guion cuando el documento no vence. */
  protected vigencia(date: string | null): string {
    return date ? formatOperationalDate(date) : '—';
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
