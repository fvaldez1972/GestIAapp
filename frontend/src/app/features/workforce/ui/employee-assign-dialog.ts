import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { GiSelect, GiSelectOption } from '../../../shared/ui/gi-ui';

/** Una opción de la cascada: lo que el desplegable enseña y el identificador con el que se guarda. */
export type AssignOption = {
  readonly id: string;
  readonly name: string;
};

/** Lo que la ventana devuelve cuando se pulsa Asignar. Todo por identificador. */
export type EmployeeAssignValue = {
  readonly idClient: string;
  readonly idService: string;
  readonly idPosition: string;
  readonly assignmentType: 'Primary' | 'Support' | 'Relief' | 'TemporaryReplacement';
  readonly startDate: string;
  readonly isPrimary: boolean;
};

/**
 * Los cuatro tipos, con la palabra que se usa en la operación.
 *
 * <p><b>«Titular» es lo mismo que la marca de titular del contrato.</b> El alta de Servicios lleva
 * el tipo y una casilla <c>isPrimary</c> por separado, y eso permite guardar un «Apoyo» marcado
 * como titular: dos campos que pueden contradecirse sobre el mismo hecho. Aquí la marca se deriva
 * del tipo, que es lo que el tipo ya significa.</p>
 */
const TIPOS: readonly { readonly value: EmployeeAssignValue['assignmentType']; readonly label: string }[] = [
  { value: 'Primary', label: 'Titular' },
  { value: 'Support', label: 'Apoyo' },
  { value: 'Relief', label: 'Cubre-descansos' },
  { value: 'TemporaryReplacement', label: 'Suplencia temporal' },
];

/**
 * Asignar a una persona a una posición, sin salir de su expediente.
 *
 * <p><b>Por qué una ventana y no un viaje a Servicios.</b> El botón llevaba a Servicios, que es
 * donde vive el alta, y eso dejaba a quien lo pulsaba en otra pantalla con la persona en la cabeza
 * y nada en el formulario. La asignación se sigue creando con el mismo endpoint y las mismas
 * reglas; lo que cambia es desde dónde se pide.</p>
 *
 * <p><b>La cascada se limpia sola.</b> Cambiar de cliente vacía servicio y posición, y cambiar de
 * servicio vacía posición. Sin eso se puede guardar la posición de un servicio con el servicio de
 * otro: los tres identificadores viajan juntos y nadie comprueba que se correspondan hasta el
 * servidor.</p>
 *
 * <p><b>La elegibilidad no la juzga esta ventana.</b> Si la persona no cumple el perfil o tiene un
 * documento vencido, quien lo dice es el servidor al guardar. Adivinarlo aquí sería una regla de
 * negocio viviendo en el frontend, y el día que las dos no coincidan gana la del servidor.</p>
 */
@Component({
  selector: 'app-employee-assign-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiSelect],
  template: `
    <dialog #dialogo class="asig" aria-labelledby="asig-titulo" (close)="cancel.emit()">
      <header class="asig__head">
        <div>
          <h2 class="asig__title" id="asig-titulo">Asignar a una posición</h2>
          <p class="asig__who">{{ employeeName() }}</p>
        </div>
        <button class="asig__cerrar" type="button" aria-label="Cerrar" (click)="cancel.emit()">
          <span aria-hidden="true">&times;</span>
        </button>
      </header>

      <!--
        Los campos con desplegable NO son <label>.
        Un label sin atributo «for» asocia su primer descendiente etiquetable, que aqui es el
        boton del desplegable, y pulsar una opcion —que vive dentro del label— reenviaba un
        segundo clic a ese boton: la lista se volvia a abrir justo despues de cerrarse, y habia
        que pulsar en otra parte para quitarla. El desplegable ya se nombra solo, con su entrada
        «label».
      -->
      <div class="asig__campos">
        <div class="asig__campo">
          <span class="asig__rotulo">Cliente</span>
          <gi-select
            label="Cliente"
            placeholder="Elige el cliente"
            [options]="opcionesDe(clients())"
            [value]="idClient()"
            [disabled]="saving()"
            (valueChange)="elegirCliente($event)"
          />
        </div>

        <div class="asig__campo">
          <span class="asig__rotulo">Servicio</span>
          <gi-select
            label="Servicio"
            [placeholder]="idClient() ? 'Elige el servicio' : 'Elige antes el cliente'"
            [options]="opcionesDe(services())"
            [value]="idService()"
            [disabled]="saving() || !idClient()"
            (valueChange)="elegirServicio($event)"
          />
        </div>

        <div class="asig__campo">
          <span class="asig__rotulo">Posición</span>
          <gi-select
            label="Posición"
            [placeholder]="idService() ? 'Elige la posición' : 'Elige antes el servicio'"
            [options]="opcionesDe(positions())"
            [value]="idPosition()"
            [disabled]="saving() || !idService()"
            (valueChange)="idPosition.set($event)"
          />
        </div>

        <div class="asig__campo">
          <span class="asig__rotulo">Tipo</span>
          <gi-select
            label="Tipo de asignación"
            [options]="tipos"
            [value]="assignmentType()"
            [disabled]="saving()"
            (valueChange)="elegirTipo($event)"
          />
        </div>

        <label class="asig__campo" for="asig-desde">
          <span class="asig__rotulo">Desde</span>
          <input
            id="asig-desde"
            type="date"
            [value]="startDate()"
            [disabled]="saving()"
            (input)="startDate.set($any($event.target).value)"
          />
        </label>
      </div>

      @if (problem()) {
        <p class="asig__problema" role="alert">{{ problem() }}</p>
      }

      @if (falta()) {
        <p class="asig__falta" id="asig-falta">{{ falta() }}</p>
      }

      <footer class="asig__acciones">
        <button #cancelar class="asig__boton" type="button" [disabled]="saving()" (click)="cancel.emit()">
          Cancelar
        </button>
        <button
          class="asig__boton asig__boton--primario"
          type="button"
          [disabled]="saving() || !!falta()"
          [attr.aria-describedby]="falta() ? 'asig-falta' : null"
          (click)="asignar()"
        >
          {{ saving() ? 'Asignando…' : 'Asignar' }}
        </button>
      </footer>
    </dialog>
  `,
  styles: `
    .asig {
      width: min(34rem, calc(100vw - 2rem));
      padding: 1.1rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-lg);
      background: var(--gestia-surface);
      color: var(--gestia-text);
    }

    /* El único valor derivado de un token en todo el sistema. */
    .asig::backdrop { background: var(--gestia-dialog-veil); }

    .asig__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.9rem;
    }

    .asig__title { margin: 0; color: var(--gestia-navy); font-size: 16px; font-weight: 600; }
    .asig__who { margin: 0.1rem 0 0; color: var(--gestia-muted); font-size: 12px; }

    .asig__cerrar {
      flex: none;
      width: var(--gestia-control-height);
      height: var(--gestia-control-height);
      border: 1px solid transparent;
      border-radius: var(--gestia-radius);
      background: none;
      color: var(--gestia-muted);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    .asig__cerrar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .asig__campos { display: flex; flex-direction: column; gap: 0.6rem; }

    .asig__campo { display: grid; align-content: start; gap: 0.25rem; min-width: 0; }

    .asig__rotulo {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .asig__campo input {
      height: var(--gestia-control-height);
      padding: 0 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .asig__campo input:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .asig__problema {
      margin: 0.75rem 0 0;
      padding: 0.45rem 0.7rem;
      border-radius: var(--gestia-radius);
      background: var(--gestia-danger-soft);
      color: var(--gestia-danger);
      font-size: 12px;
      line-height: 1.5;
    }

    .asig__falta { margin: 0.75rem 0 0; color: var(--gestia-muted); font-size: 12px; }

    .asig__acciones { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }

    .asig__boton {
      height: var(--gestia-control-height);
      padding: 0 1rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .asig__boton--primario {
      border-color: var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .asig__boton[disabled] { opacity: 0.5; cursor: not-allowed; }
    .asig__boton:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
  `,
})
export class EmployeeAssignDialog {
  readonly open = input(false);
  readonly employeeName = input('');

  readonly clients = input<readonly AssignOption[]>([]);
  readonly services = input<readonly AssignOption[]>([]);
  readonly positions = input<readonly AssignOption[]>([]);

  /** El día operativo del servidor. No se usa el reloj del navegador: en UTC el día ya cambió. */
  readonly operationalToday = input('');
  readonly saving = input(false);
  /** Lo que el servidor contestó al rechazar. Vacío mientras no haya rechazado nada. */
  readonly problem = input('');

  readonly clientChange = output<string>();
  readonly serviceChange = output<string>();
  readonly save = output<EmployeeAssignValue>();
  readonly cancel = output<void>();

  protected readonly tipos: readonly GiSelectOption[] = TIPOS.map((tipo) => ({
    value: tipo.value,
    label: tipo.label,
  }));

  protected readonly idClient = signal('');
  protected readonly idService = signal('');
  protected readonly idPosition = signal('');
  protected readonly assignmentType = signal<EmployeeAssignValue['assignmentType']>('Support');
  protected readonly startDate = signal('');

  /**
   * Qué falta para poder asignar, en palabras.
   *
   * <p>Un botón apagado sin motivo se lee como que la aplicación se rompió. Se nombra <b>un</b>
   * campo, el primero que falta, y en el orden en que se llenan: decir los cuatro a la vez obliga a
   * leer una lista para encontrar el que toca.</p>
   */
  protected readonly falta = computed(() => {
    if (!this.idClient()) return 'Falta elegir el cliente.';
    if (!this.idService()) return 'Falta elegir el servicio.';
    if (!this.idPosition()) return 'Falta elegir la posición.';
    if (!this.startDate()) return 'Falta la fecha desde la que se asigna.';

    return '';
  });

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly cancelar = viewChild<ElementRef<HTMLButtonElement>>('cancelar');

  constructor() {
    effect(() => {
      const elemento = this.dialogo().nativeElement;

      if (this.open() && !elemento.open) {
        // Cada apertura empieza en blanco: lo elegido en la anterior era de otra persona.
        this.idClient.set('');
        this.idService.set('');
        this.idPosition.set('');
        this.assignmentType.set('Support');
        this.startDate.set(this.operationalToday());
        elemento.showModal();
        this.cancelar()?.nativeElement.focus();
      } else if (!this.open() && elemento.open) {
        elemento.close();
      }
    });
  }

  protected opcionesDe(valores: readonly AssignOption[]): readonly GiSelectOption[] {
    return valores.map((valor) => ({ value: valor.id, label: valor.name }));
  }

  /**
   * Elegir cliente vacía lo que colgaba de él.
   *
   * <p>Sin esto se puede guardar la posición de un servicio junto al servicio de otro: los tres
   * identificadores viajan juntos y el desplegable de abajo conserva lo que ya tenía elegido.</p>
   */
  protected elegirCliente(id: string): void {
    this.idClient.set(id);
    this.idService.set('');
    this.idPosition.set('');
    this.clientChange.emit(id);
  }

  protected elegirServicio(id: string): void {
    this.idService.set(id);
    this.idPosition.set('');
    this.serviceChange.emit(id);
  }

  protected elegirTipo(valor: string): void {
    this.assignmentType.set(valor as EmployeeAssignValue['assignmentType']);
  }

  protected asignar(): void {
    if (this.falta() || this.saving()) {
      return;
    }

    const tipo = this.assignmentType();

    this.save.emit({
      idClient: this.idClient(),
      idService: this.idService(),
      idPosition: this.idPosition(),
      assignmentType: tipo,
      startDate: this.startDate(),
      // La marca de titular sale del tipo. Ver la nota de TIPOS.
      isPrimary: tipo === 'Primary',
    });
  }
}
