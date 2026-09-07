import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogSelect } from '../../../shared/ui/catalog-select/catalog-select';
import { GiCatalogCreation, GiCatalogPicker } from '../../../shared/ui/gi-ui';
import { EmployeeJobPositionOption } from '../data-access/employee-list.models';

/** Lo que el formulario devuelve. El puesto viaja por identificador y por nombre. */
export type EmployeeFormValue = {
  readonly fullName: string;
  readonly idJobPositionCatalogItem: string;
  readonly jobPositionName: string;
  readonly hireDate: string;
  readonly curp: string;
  readonly state: string;
  readonly municipality: string;
  readonly mobilePhone: string;
  readonly email: string;
};

/**
 * El alta de una persona.
 *
 * <p><b>El puesto se elige del catálogo, y se puede guardar sin él.</b> Las dos salidas dicen qué
 * deja cada una, igual que en Clientes: «Guardar con puesto» deja el expediente comparable contra
 * el perfil de una posición; «Guardar sin puesto» deja a alguien a quien se puede asignar y que
 * nadie podrá comprobar. Esa segunda condición es la que hoy no se ve en ningún sitio.</p>
 *
 * <p>No hay campo de código: lo arma el sistema. Y el estado tampoco se elige aquí: una persona
 * nueva entra como candidata y avanza por su propio camino.</p>
 */
@Component({
  selector: 'app-employee-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CatalogSelect, FormsModule, GiCatalogPicker],
  template: `
    <form class="form" (ngSubmit)="$event.preventDefault()">
      <section class="form__block">
        <h3 class="form__kicker">IDENTIFICACIÓN</h3>

        <label class="field field--wide" for="ef-nombre">
          <span class="field__label">NOMBRE COMPLETO</span>
          <input
            id="ef-nombre"
            name="fullName"
            type="text"
            [ngModel]="fullName()"
            (ngModelChange)="fullName.set($event)"
            [ngModelOptions]="sueltos"
            autocomplete="off"
          />
        </label>

        <div class="form__row form__row--two">
          <label class="field" for="ef-curp">
            <span class="field__label">CURP · OPCIONAL</span>
            <input
              id="ef-curp"
              name="curp"
              type="text"
              [ngModel]="curp()"
              (ngModelChange)="curp.set($event)"
              [ngModelOptions]="sueltos"
              placeholder="Dieciocho caracteres"
              autocomplete="off"
            />
          </label>
          <label class="field" for="ef-ingreso">
            <span class="field__label">FECHA DE INGRESO</span>
            <input
              id="ef-ingreso"
              name="hireDate"
              type="date"
              [ngModel]="hireDate()"
              (ngModelChange)="hireDate.set($event)"
              [ngModelOptions]="sueltos"
            />
          </label>
        </div>
      </section>

      <section class="form__block">
        <h3 class="form__kicker">
          PUESTO · DEL CATÁLOGO DE LA ORGANIZACIÓN
          <span class="form__warning">Sin puesto no se puede comprobar el perfil</span>
        </h3>

        <!--
          El catálogo vacío ya no es una pared: se escribe el puesto y se ofrece agregarlo. Antes
          aquí salía un estado vacío que mandaba a Catálogos, y había que abandonar el alta a medias,
          crear el puesto y volver a empezar.
        -->
        <gi-catalog-picker
          label="Puesto del catálogo"
          catalogLabel="el catálogo de puestos"
          inputId="empleado-puesto"
          [options]="jobPositions()"
          [value]="idJobPositionCatalogItem()"
          [canWrite]="canWrite()"
          (valueChange)="idJobPositionCatalogItem.set($event)"
          (create)="createJobPosition.emit($event)"
        />
        <p class="form__hint">
          Los puestos salen del catálogo de esta organización. La elegibilidad se compara por
          identificador, así que un puesto escrito a mano no sirve para comprobarla.
        </p>
      </section>

      <section class="form__block">
        <h3 class="form__kicker">DOMICILIO Y CONTACTO</h3>

        <div class="form__row form__row--two">
          <label class="field" for="ef-estado">
            <span class="field__label">ESTADO</span>
            <app-catalog-select
              id="ef-estado"
              type="State"
              label="Estado"
              country="MX"
              [organizationId]="organizationId()"
              [ngModel]="state()"
              (ngModelChange)="onState($event)"
              [ngModelOptions]="sueltos"
            />
          </label>
          <label class="field" for="ef-municipio">
            <span class="field__label">MUNICIPIO</span>
            <app-catalog-select
              id="ef-municipio"
              type="City"
              label="Municipio"
              country="MX"
              [state]="state()"
              [organizationId]="organizationId()"
              [ngModel]="municipality()"
              (ngModelChange)="municipality.set($event)"
              [ngModelOptions]="sueltos"
            />
          </label>
          <label class="field" for="ef-tel">
            <span class="field__label">TELÉFONO · OPCIONAL</span>
            <input
              id="ef-tel"
              name="mobilePhone"
              type="text"
              [ngModel]="mobilePhone()"
              (ngModelChange)="mobilePhone.set($event)"
              [ngModelOptions]="sueltos"
              autocomplete="off"
            />
          </label>
          <label class="field" for="ef-correo">
            <span class="field__label">CORREO · OPCIONAL</span>
            <input
              id="ef-correo"
              name="email"
              type="text"
              [ngModel]="email()"
              (ngModelChange)="email.set($event)"
              [ngModelOptions]="sueltos"
              autocomplete="off"
            />
          </label>
        </div>
        <p class="form__hint">
          Estado y municipio se eligen del catálogo de direcciones. El servidor rechaza un texto
          libre que no corresponda a un municipio activo del estado.
        </p>
      </section>

      @if (problem()) {
        <p class="form__problem" role="alert">{{ problem() }}</p>
      }
    </form>

    <div class="form__footer">
      <button class="button" type="button" (click)="cancel.emit()">Cancelar</button>
      <span class="form__exits">
        <button
          class="button"
          type="button"
          [disabled]="saving() || !personReady()"
          [attr.aria-describedby]="personReady() ? null : 'ef-falta-persona'"
          (click)="submit()"
        >
          Guardar sin puesto
        </button>
        <button
          class="button button--primary"
          type="button"
          [disabled]="saving() || !jobReady()"
          [attr.aria-describedby]="jobReady() ? null : 'ef-falta-puesto'"
          (click)="submit()"
        >
          Guardar con puesto
        </button>
      </span>
    </div>

    <!-- Las razones se escriben. Un botón gris sin motivo obliga a adivinar qué falta. -->
    <p class="form__reason" id="ef-falta-persona" [hidden]="personReady()">
      Faltan el nombre completo o la fecha de ingreso.
    </p>
    <p class="form__reason" id="ef-falta-puesto" [hidden]="jobReady()">
      Para guardar con puesto hace falta elegir uno del catálogo, además del nombre y la fecha de
      ingreso.
    </p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 0; }

    .form { display: flex; flex-direction: column; gap: 1.1rem; padding: var(--gestia-card-padding); }

    .form__block { display: flex; flex-direction: column; gap: 0.7rem; }

    .form__block + .form__block { border-top: 1px solid var(--gestia-border); padding-top: 1.1rem; }

    .form__kicker {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.6rem;
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .form__warning { color: var(--gestia-warning); font-size: 11.5px; letter-spacing: 0; }

    .form__row { display: grid; gap: 0.7rem; }
    .form__row--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

    .field__label {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    /* 40 px, como todo control de la aplicación. El bosquejo dibujaba el de fecha a 42. */
    .field input {
      box-sizing: border-box;
      width: 100%;
      height: var(--gestia-control-height);
      padding: 0 0.7rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
    }

    .field input:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .form__hint { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    .form__problem {
      margin: 0;
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--gestia-danger);
      border-radius: var(--gestia-radius);
      color: var(--gestia-danger);
      font-size: 12px;
    }

    .form__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: auto;
      padding: var(--gestia-card-padding);
      border-top: 1px solid var(--gestia-border);
    }

    .form__exits { display: flex; gap: 0.5rem; }

    .form__reason {
      margin: 0;
      padding: 0 var(--gestia-card-padding) var(--gestia-card-padding);
      color: var(--gestia-warning);
      font-size: 11.5px;
      font-weight: 600;
    }

    .button {
      flex: none;
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

    .button:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }
    .button:disabled { color: var(--gestia-muted); cursor: not-allowed; }

    .button--primary {
      border-color: var(--gestia-navy);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
    }

    .button--primary:disabled { border-color: var(--gestia-border); background: var(--gestia-surface-soft); }

    @media (width < 45rem) {
      .form__row--two { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class EmployeeForm {
  readonly organizationId = input('');
  readonly jobPositions = input.required<readonly EmployeeJobPositionOption[]>();

  /** Sin esto, el alta al vuelo ofrecería crear algo que el servidor va a rechazar con 403. */
  readonly canWrite = input(false);
  /** El día operativo del servidor, para proponer el ingreso de hoy. */
  readonly today = input('');
  readonly saving = input(false);
  readonly problem = input('');

  readonly cancel = output<void>();
  readonly save = output<EmployeeFormValue>();

  /**
   * El puesto que hay que crear en el catálogo antes de poder elegirlo.
   *
   * <p>Lo resuelve la pantalla y no este formulario: crear un valor de catálogo es una escritura a
   * otro módulo, y quien la hace tiene que poder recargar la lista y contarlo. El formulario sólo
   * dice qué se pidió.</p>
   */
  readonly createJobPosition = output<GiCatalogCreation>();

  /** Un objeto estable: creado en la plantilla se recrearía en cada ciclo de detección. */
  protected readonly sueltos = { standalone: true };

  protected readonly fullName = signal('');
  protected readonly idJobPositionCatalogItem = signal('');
  protected readonly hireDate = signal('');
  protected readonly curp = signal('');
  protected readonly state = signal('');
  protected readonly municipality = signal('');
  protected readonly mobilePhone = signal('');
  protected readonly email = signal('');

  protected readonly personReady = computed(
    () => !!this.fullName().trim() && !!this.effectiveHireDate(),
  );

  protected readonly jobReady = computed(() => this.personReady() && !!this.idJobPositionCatalogItem());

  /** El municipio pertenecía al estado anterior: cambiar de estado lo invalida. */
  protected onState(value: string): void {
    this.state.set(value);
    this.municipality.set('');
  }

  protected submit(): void {
    if (!this.personReady()) {
      return;
    }

    const elegido = this.jobPositions().find(
      (option) => option.idCatalogItem === this.idJobPositionCatalogItem(),
    );

    this.save.emit({
      fullName: this.fullName().trim(),
      idJobPositionCatalogItem: elegido?.idCatalogItem ?? '',
      jobPositionName: elegido?.name ?? '',
      hireDate: this.effectiveHireDate(),
      curp: this.curp().trim(),
      state: this.state(),
      municipality: this.municipality(),
      mobilePhone: this.mobilePhone().trim(),
      email: this.email().trim(),
    });
  }

  /** Sin fecha capturada vale la de hoy del servidor, no la del reloj del navegador. */
  private effectiveHireDate(): string {
    return this.hireDate() || this.today();
  }
}
