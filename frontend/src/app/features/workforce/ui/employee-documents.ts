import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../../shared/ui/app-icon/app-icon';
import { GiEmptyState, GiSelect, GiSelectOption } from '../../../shared/ui/gi-ui';
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
  imports: [AppIcon, GiEmptyState, GiSelect],
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
            (click)="elegirVista('obligatorios')"
          >
            Obligatorios
            <span class="subtab__count">{{ obligatorios().length }}</span>
          </button>

          <button
            type="button"
            role="tab"
            class="subtab"
            [class.is-active]="vista() === 'informativos'"
            [attr.aria-selected]="vista() === 'informativos'"
            (click)="elegirVista('informativos')"
          >
            Informativos
            <span class="subtab__count">{{ informativos().length }}</span>
          </button>
        </div>

        <!--
          Sin banda de aviso. La llevo unas horas el 24 de septiembre de 2026 y salio por
          peticion: ocupaba cuatro renglones encima de la lista para repetir lo que las propias
          pestañas ya separan —lo que impide asignar de lo que solo deja constancia—.
        -->
        <!--
          Buscar y filtrar, arriba y sobre la lista que se mira primero.
          Vivia entre las dos listas, y ahi no servia: quedaba debajo de los requisitos y encima de
          los archivos, sin pertenecer del todo a ninguna. Aqui filtra la lista de requisitos, que
          es lo que la pestaña enseña; el tipo ya lo eligen las propias pestañas, asi que no se
          repite en un desplegable.
        -->
        <div class="filtros">
          <label class="filtros__campo" for="docs-buscar">
            <span class="filtros__rotulo">Buscar</span>
            <input
              id="docs-buscar"
              type="search"
              maxlength="120"
              placeholder="Nombre del documento"
              [value]="busqueda()"
              (input)="busqueda.set($any($event.target).value)"
            />
          </label>

          <div class="filtros__campo">
            <span class="filtros__rotulo">Estado</span>
            <gi-select
              label="Estado del requisito"
              placeholder="Todos"
              [options]="opcionesDeEstado"
              [value]="estadoFiltro()"
              (valueChange)="estadoFiltro.set($any($event))"
            />
          </div>
        </div>

        <!--
          Encabezado de la lista, con la salida a la derecha.
          El boton de «Agregar documento» vivia suelto mas abajo, dentro del expediente de
          archivos, lejos de la lista a la que se le suma algo. Aqui esta donde se mira.
        -->
        <header class="seccion">
          <span class="seccion__texto">
            <h4 class="seccion__titulo">
              {{ vista() === 'obligatorios' ? 'Documentos obligatorios' : 'Documentos informativos' }}
            </h4>
            <span class="seccion__nota">
              {{
                vista() === 'obligatorios'
                  ? 'Gestiona los documentos requeridos para la operación de la persona.'
                  : 'Gestiona los documentos que esta organización pide sólo para dejar constancia.'
              }}
            </span>
          </span>

          @if (canWrite()) {
            <button class="seccion__accion" type="button" (click)="agregar.emit()">
              <app-icon name="document" /> Agregar documento
            </button>
          }
        </header>

        @let filas = filtradas();

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
                <span class="req__icono" aria-hidden="true"><app-icon name="document" /></span>

                <span class="req__body">
                  <span class="req__name">
                    {{ row.label }}
                    <!--
                      La marca del catalogo CLASIFICA; la regla de elegibilidad es la que BLOQUEA.
                      Un tipo marcado obligatorio al que nadie le creo su regla se pide igual, pero
                      hoy no impide asignar a nadie. Decirlo aqui evita que la pantalla prometa un
                      bloqueo que no existe, y de paso senala lo que falta configurar.
                    -->
                    @if (row.isRequired && row.withoutRule) {
                      <span class="req__soft" title="Está marcado obligatorio en el catálogo, pero no tiene regla de elegibilidad, así que hoy no impide asignar.">
                        sin regla
                      </span>
                    }
                  </span>
                  @let detalle = detail(row.state, row.expiresDate, row.documentStatus);
                  @if (detalle) {
                    <span class="req__detail">{{ detalle }}</span>
                  }
                </span>
                <span class="req__side">
                  <span class="req__state">{{ stateLabel(row.state) }}</span>

                  <!--
                    Las acciones del papel, en la propia fila.

                    Con enlace al documento de negocio se ofrecen las tres que ya existen abajo
                    —descargar, historial y corregir—, porque hay un archivo al que apuntar. Sin
                    enlace no se ofrecen: no serian un boton apagado, serian un boton que promete
                    un archivo que no existe. Y sin papel, adjuntarlo.

                    Lo sembrado antes de que existiera la columna de enlace se queda en
                    «Reemplazar» hasta que alguien lo vuelva a cargar desde aqui.
                  -->
                  @if (row.idBusinessDocument; as idDocumento) {
                    <button class="req__accion" type="button" (click)="descargar.emit(idDocumento)">
                      Descargar
                    </button>
                    <button class="req__accion" type="button" (click)="historial.emit(idDocumento)">
                      Historial
                    </button>
                    @if (canWrite()) {
                      <button class="req__accion" type="button" (click)="editar.emit(idDocumento)">
                        Editar
                      </button>
                    }
                  } @else if (canWrite() && row.state !== 'UpToDate') {
                    <button class="req__accion" type="button" (click)="cargar.emit(row.code)">
                      {{ row.state === 'Missing' ? 'Adjuntar' : 'Reemplazar' }}
                    </button>
                  }
                </span>
              </li>
            }
          </ul>
        }

        <!--
          Sin «Otros documentos». Era un plegado al final con los archivos que la organizacion no
          exige, y el usuario lo resumio: o son obligatorios o son informativos. Un tercer monton
          sin regla detras solo anadia un sitio mas donde mirar. Los archivos siguen enteros en el
          expediente de abajo, que es donde se consultan y se descargan.
        -->
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

    /* El aviso de cada pestana. Misma forma en las dos; el color dice cual urge. */
    .banda {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      margin: 0;
      padding: 0.7rem 0.85rem;
      border-radius: var(--gestia-radius-lg);
      font-size: 12px;
      line-height: 1.5;
    }

    .banda--obliga { background: var(--gestia-danger-soft); color: var(--gestia-danger); }
    .banda--informa { background: var(--gestia-surface-soft); color: var(--gestia-muted); }

    .banda__icono {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 600;
    }

    .banda--obliga .banda__icono { background: var(--gestia-danger); color: var(--gestia-surface); }
    .banda--informa .banda__icono { background: var(--gestia-muted); color: var(--gestia-surface); }

    .banda__texto { min-width: 0; }
    .banda__titulo { display: block; font-size: 12.5px; }

    .filtros { display: flex; gap: 0.6rem; flex-wrap: wrap; }

    .filtros__campo { display: flex; flex: 1; flex-direction: column; gap: 0.15rem; min-width: 11rem; }

    .filtros__rotulo {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .filtros__campo input {
      height: var(--gestia-control-height);
      padding: 0 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .filtros__campo input:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .seccion {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .seccion__texto { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
    .seccion__titulo { margin: 0; color: var(--gestia-navy); font-size: 14px; font-weight: 600; }
    .seccion__nota { color: var(--gestia-muted); font-size: 11.5px; }

    .seccion__accion {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      flex: none;
      height: var(--gestia-control-height);
      padding: 0 0.85rem;
      border: 1px solid var(--gestia-navy);
      border-radius: var(--gestia-radius);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .seccion__accion:hover { background: var(--gestia-navy-soft); border-color: var(--gestia-navy-soft); }
    .seccion__accion:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    /* El icono de cada renglon. Sin el, la lista es una columna de texto suelto. */
    .req__icono {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 2rem;
      height: 2rem;
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
      color: var(--gestia-muted);
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

    /* El cuerpo crece, y por eso lleva flex uno: con el icono delante dejaba de ser el unico
       elemento que crece, y el nombre se iba al centro del renglon. */
    .req__body { display: flex; flex: 1; flex-direction: column; gap: 0.1rem; min-width: 0; }

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

  protected readonly busqueda = signal('');
  protected readonly estadoFiltro = signal('');

  /** Los estados que una fila puede tener, con la palabra que ya usa la propia fila. */
  protected readonly opcionesDeEstado: readonly GiSelectOption[] = [
    { value: '', label: 'Todos' },
    { value: 'UpToDate', label: 'Al día' },
    { value: 'Expiring', label: 'Por vencer' },
    { value: 'Missing', label: 'Sin cargar' },
    { value: 'Expired', label: 'Vencido' },
    { value: 'Rejected', label: 'Rechazado' },
    { value: 'Unvalidated', label: 'Sin validar' },
  ];

  /**
   * Las filas de la pestaña que se está mirando, pasadas por el buscador y el estado.
   *
   * <p>El tipo no entra aquí: lo eligen las propias pestañas, y repetirlo en un desplegable
   * dejaría dos controles diciendo lo mismo, con la posibilidad de contradecirse.</p>
   */
  protected readonly filtradas = computed(() => {
    const base = this.vista() === 'obligatorios' ? this.obligatorios() : this.informativos();
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.estadoFiltro();

    return base.filter(
      (fila) =>
        (!texto || fila.label.toLowerCase().includes(texto)) &&
        (!estado || fila.state === estado),
    );
  });

  protected elegirVista(cual: 'obligatorios' | 'informativos'): void {
    this.vista.set(cual);
    this.vistaChange.emit(cual);
  }

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
  readonly categories = input<
    readonly { readonly idCatalogItem: string; readonly name: string; readonly isRequired?: boolean | null }[]
  >([]);

  /** El tipo de documento del requisito que hay que cubrir. La pantalla abre el alta con él puesto. */
  readonly cargar = output<string>();

  /** Sumar un documento que no corresponde a ningún requisito, desde el encabezado de la lista. */
  readonly agregar = output<void>();

  /**
   * Qué pestaña se está mirando.
   *
   * <p>Sale del componente porque el expediente de archivos vive debajo, fuera de él, y enseñaba
   * los archivos de los dos tipos a la vez: en la pestaña de obligatorios aparecían los
   * informativos, mezclados y sin decirlo.</p>
   */
  readonly vistaChange = output<'obligatorios' | 'informativos'>();

  /**
   * Las tres acciones del papel, por identificador del documento de negocio.
   *
   * <p>No se resuelven aquí: las implementa el expediente de archivos, que es quien habla con el
   * servidor y quien tiene las ventanas. Repetirlas sería tener dos códigos que descargan, y el
   * día que uno cambie el otro se queda viejo.</p>
   */
  readonly descargar = output<string>();
  readonly historial = output<string>();
  readonly editar = output<string>();

  protected readonly stateLabel = requirementStateLabel;
  protected readonly tone = requirementStateTone;
  protected readonly typeLabel = documentTypeLabel;

  // `categoryLabel` nombraba cada archivo de «Otros documentos» y se fue con el plegado. El
  // nombre de la categoria lo sigue poniendo el expediente de abajo, que es quien lista archivos.

  protected readonly rows = computed(() =>
    employeeRequirementRows(
      this.requirements(),
      this.documents(),
      this.today(),
      this.expiringWithinDays(),
      // El catálogo manda: es la lista completa de tipos, y cada uno trae del servidor si es
      // obligatorio o informativo. Las reglas de elegibilidad aportan el estado de los que tienen.
      this.categories(),
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

  // `porAtender` vivia aqui y alimentaba la insignia «N por atender» de la pestana, que se retiro
  // el 24 de septiembre de 2026 por peticion. Sin quien lo lea, el calculo sobra.
}
