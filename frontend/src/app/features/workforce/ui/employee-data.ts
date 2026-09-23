import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GiCatalogCreation, GiSelect, GiSelectOption } from '../../../shared/ui/gi-ui';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import { Employee } from '../data-access/workforce.models';
import {
  EmployeeJobPositionOption,
  EmployeeListItem,
  employeeStatusLabel,
  employeeStatusTone,
} from '../data-access/employee-list.models';
import { EmployeeAddress, EmployeeAddressValue } from './employee-address';
import { EmployeeEligibilityBand } from './employee-eligibility';
import { EmployeeJobPosition } from './employee-job-position';

/**
 * La pestaña de Datos.
 *
 * <p>Arriba va la franja de elegibilidad, porque es la condición que decide si a esta persona se le
 * puede asignar una posición, y quien abre la ficha viene casi siempre a eso.</p>
 *
 * <p>La ubicación se rotula <b>Estado · Municipio</b> y no «Zona»: la zona no existe en el modelo
 * —el empleado tiene estado y municipio en su domicilio— y el bosquejo la dibujaba como si fuera un
 * dato guardado.</p>
 */
@Component({
  selector: 'app-employee-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmployeeAddress, EmployeeEligibilityBand, EmployeeJobPosition, GiSelect],
  template: `
    <div class="data">
      <!--
        El aviso de vencimiento, arriba del todo. Los documentos por vencer sólo se veían entrando a
        su pestaña, y son justo lo que hay que resolver antes de que la persona deje de poder
        trabajar: el expediente no se rompe hoy, se rompe el día que caduquen.

        Dice que la persona sigue activa a propósito. Sin esa línea un aviso rojo sobre un
        expediente correcto se lee como si ya hubiera un problema.
      -->
      @if (row().expiringDocuments > 0) {
        <section class="aviso" role="status">
          <div class="aviso__texto">
            <p class="aviso__titulo">Documentos próximos a vencer</p>
            <p class="aviso__linea">
              Esta persona tiene {{ row().expiringDocuments }}
              {{ row().expiringDocuments === 1 ? 'documento' : 'documentos' }} por vencer en los
              próximos {{ expiringWithinDays() }} días o menos. Puede seguir trabajando, pero
              conviene actualizarlos antes de que caduquen.
            </p>
          </div>
          <button class="aviso__accion" type="button" (click)="openDocuments.emit()">Ver documentos</button>
        </section>
      }

      <app-employee-eligibility
        [employeeJobPositionId]="row().idJobPositionCatalogItem"
        [employeeJobPosition]="row().jobPositionName"
        (fixJobPosition)="editJobPosition.emit()"
        (openCatalog)="openCatalog.emit()"
      />

      @if (editingJobPosition()) {
        <app-employee-job-position
          [jobPositions]="jobPositions()"
          [current]="row().idJobPositionCatalogItem ?? ''"
          [saving]="savingJobPosition()"
          [problem]="jobPositionProblem()"
          [canWrite]="canWrite()"
          (cancel)="cancelJobPosition.emit()"
          (save)="saveJobPosition.emit($event)"
          (createJobPosition)="createJobPosition.emit($event)"
        />
      }

      <section class="data__block">
        <h3 class="data__kicker">IDENTIFICACIÓN</h3>
        <dl class="data__grid data__grid--two">
          <div class="data__field data__field--wide">
            <dt>NOMBRE</dt>
            <dd>{{ row().fullName }}</dd>
          </div>
          <div class="data__field">
            <dt>CÓDIGO</dt>
            <dd>{{ row().codeEmployee }}</dd>
          </div>
          <div class="data__field">
            <dt>ESTADO</dt>
            <dd class="data__status">
              <span class="data__dot" [class]="'data__dot--' + statusTone()" aria-hidden="true"></span>
              {{ statusLabel() }}
            </dd>
          </div>
          <div class="data__field">
            <dt>CURP</dt>
            <dd>{{ masked(row().curp) }}</dd>
          </div>
          <div class="data__field">
            <dt>RFC</dt>
            <dd>{{ delDetalle(masked(employee()?.rfc ?? null)) }}</dd>
          </div>
          <!--
            La escolaridad. Se compara contra la que pide la posicion, asi que se guarda por
            identificador del catalogo y no como texto. Vacia significa «no se sabe», no «no
            cumple»: la columna nacio el 19 de septiembre de 2026 y ningun expediente la traia.
          -->
          <div class="data__field">
            <dt>ESCOLARIDAD</dt>
            <dd>
              @if (canWrite()) {
                <gi-select
                  label="Escolaridad"
                  placeholder="Sin registrar"
                  [options]="educationLevelOptions()"
                  [value]="employee()?.idEducationLevelCatalogItem ?? ''"
                  [disabled]="savingEducation()"
                  (valueChange)="saveEducation.emit($event || null)"
                />
              } @else {
                {{ delDetalle(educationLevelName()) }}
              }
            </dd>
          </div>
        </dl>
        @if (!canViewSensitive()) {
          <p class="data__note">
            CURP y RFC se muestran parciales: ver el dato completo necesita permiso sobre datos
            personales.
          </p>
        }
      </section>

      <section class="data__block">
        <h3 class="data__kicker">PUESTO</h3>
        <dl class="data__grid data__grid--two">
          <div class="data__field">
            <dt>PUESTO DEL CATÁLOGO</dt>
            <dd [class.data__warning]="!row().jobPositionName">
              {{ row().jobPositionName || 'Sin puesto del catálogo' }}
              <!--
                El puesto se conserva aunque el valor se desactive, porque es historia: la persona
                lo tuvo. Pero verlo igual que uno vigente engaña, y sobre todo esconde que ya no se
                puede elegir para nadie más.
              -->
              @if (puestoInactivo()) {
                <small class="data__inactivo">Este puesto está desactivado en el catálogo</small>
              }
            </dd>
          </div>
          <div class="data__field">
            <dt>PUESTO CAPTURADO ANTES</dt>
            <dd>{{ row().jobTitle || 'Sin texto capturado' }}</dd>
          </div>
        </dl>
        @if (row().jobTitle && !row().jobPositionName) {
          <p class="data__note">
            El texto de arriba es lo que se capturó antes del catálogo. No sirve para comparar
            contra el perfil de una posición, porque la comparación es por identificador.
          </p>
        }
      </section>

      <section class="data__block">
        <h3 class="data__kicker">
          UBICACIÓN Y CONTACTO
          @if (canWrite() && !editingAddress()) {
            <button class="data__editar" type="button" (click)="editAddress.emit()">
              {{ domicilioVacio() ? 'Capturar domicilio' : 'Editar domicilio' }}
            </button>
          }
        </h3>

        <!--
          El domicilio se podía ver y no se podía escribir. Las columnas existían en la base desde
          antes, la ficha las pintaba con «Sin colonia registrada», y no había ninguna pantalla
          donde capturarlas: 0 de 271 expedientes tenían colonia. El editor va aquí por lo mismo
          que el del puesto, un bloque más arriba: decir que falta algo sin ofrecer dónde
          completarlo obliga a buscar, y quien busca casi siempre lo deja así.
        -->
        @if (editingAddress()) {
          <app-employee-address
            [organizationId]="organizationId()"
            [employee]="employee()"
            [saving]="savingAddress()"
            [problem]="addressProblem()"
            (guardar)="saveAddress.emit($event)"
            (cancelar)="cancelAddress.emit()"
          />
        } @else {
        <dl class="data__grid data__grid--two">
          <!--
            Calle y número aparte desde el 19 de septiembre de 2026. Los expedientes anteriores
            traen la dirección en una sola línea, que se copió a la calle sin partirla: por eso el
            número puede estar vacío en un domicilio que sí está capturado, y la pantalla lo dice
            así en vez de fingir que falta el domicilio entero.
          -->
          <div class="data__field">
            <dt>CALLE</dt>
            <dd>{{ delDetalle(employee()?.street || 'Sin calle registrada') }}</dd>
          </div>
          <div class="data__field">
            <dt>NÚMERO</dt>
            <dd>{{ delDetalle(employee()?.streetNumber || 'Sin número registrado') }}</dd>
          </div>
          <div class="data__field">
            <dt>COLONIA</dt>
            <dd>{{ delDetalle(employee()?.neighborhood || 'Sin colonia registrada') }}</dd>
          </div>
          <div class="data__field">
            <dt>CÓDIGO POSTAL</dt>
            <dd>{{ delDetalle(employee()?.postalCode || 'Sin código postal') }}</dd>
          </div>
          <div class="data__field">
            <dt>ESTADO</dt>
            <dd>{{ row().state || 'Sin estado registrado' }}</dd>
          </div>
          <div class="data__field">
            <dt>MUNICIPIO</dt>
            <dd>{{ row().municipality || 'Sin municipio registrado' }}</dd>
          </div>
          <div class="data__field">
            <dt>TELÉFONO</dt>
            <dd>{{ delDetalle(employee()?.mobilePhone || employee()?.homePhone || 'Sin teléfono') }}</dd>
          </div>
          <div class="data__field">
            <dt>CORREO</dt>
            <dd>{{ delDetalle(employee()?.email || 'Sin correo') }}</dd>
          </div>
          <div class="data__field data__field--wide">
            <dt>CONTACTO DE EMERGENCIA</dt>
            <dd>{{ emergency() }}</dd>
          </div>
        </dl>
        }
      </section>

      <section class="data__block">
        <h3 class="data__kicker">RELACIÓN LABORAL</h3>
        <dl class="data__grid data__grid--two">
          <div class="data__field">
            <dt>INGRESO</dt>
            <dd>{{ hired() }}</dd>
          </div>
          <div class="data__field">
            <dt>ASIGNACIONES</dt>
            <dd>{{ row().assignmentCount === 0 ? 'Ninguna' : row().assignmentCount }}</dd>
          </div>
        </dl>
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }

    .data { display: flex; flex-direction: column; gap: 1.1rem; }

    .data__block { display: flex; flex-direction: column; gap: 0.6rem; }

    .data__block + .data__block { border-top: 1px solid var(--gestia-border); padding-top: 1.1rem; }

    .data__kicker {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .data__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem 1rem; margin: 0; }

    .data__field { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
    .data__field--wide { grid-column: 1 / -1; }

    .data__field dt {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .data__field dd {
      margin: 0;
      color: var(--gestia-text);
      font-size: 12.5px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .data__status { display: flex; align-items: center; gap: 0.45rem; }

    .data__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gestia-muted); }
    .data__dot--success { background: var(--gestia-success); }
    .data__dot--warning { background: var(--gestia-warning); }
    .data__dot--danger { background: var(--gestia-danger); }
    .data__dot--info { background: var(--gestia-info); }
    .data__dot--muted { background: var(--gestia-muted); }

    .data__warning { color: var(--gestia-warning); }

    .data__inactivo { display: block; color: var(--gestia-warning); font-size: 11px; }

    .data__note { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    .aviso {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      border: 1px solid var(--gestia-border);
      border-left: 3px solid var(--gestia-cyan);
      border-radius: var(--gestia-radius);
      padding: 0.7rem 0.85rem;
      background: var(--gestia-surface-soft);
    }

    .aviso__texto { flex: 1; min-width: 0; }
    .aviso__titulo { margin: 0; color: var(--gestia-navy); font-size: 12.5px; font-weight: 700; }
    .aviso__linea { margin: 0.15rem 0 0; color: var(--gestia-text); font-size: 11.5px; }

    .aviso__accion {
      flex: none;
      height: var(--gestia-control-height);
      padding: 0 0.8rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .aviso__accion:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .data__editar {
      margin-left: 0.6rem;
      padding: 0.1rem 0.5rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 11px;
      letter-spacing: normal;
      text-transform: none;
      cursor: pointer;
    }

    .data__editar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    @media (width < 45rem) {
      .data__grid { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class EmployeeData {
  /** La fila del listado: lo que el servidor ya resolvió. Siempre está. */
  readonly row = input.required<EmployeeListItem>();
  /** El expediente completo. Llega después de la fila, así que puede ser nulo un instante. */
  readonly employee = input<Employee | null>(null);
  readonly canViewSensitive = input(false);
  /** Los puestos del catálogo de la organización, para el editor de la franja. */
  readonly jobPositions = input<readonly EmployeeJobPositionOption[]>([]);
  readonly editingJobPosition = input(false);
  readonly savingJobPosition = input(false);
  readonly jobPositionProblem = input('');
  /** Los niveles de escolaridad del catálogo, para ver y capturar hasta dónde estudió. */
  readonly educationLevels = input<readonly EmployeeJobPositionOption[]>([]);
  readonly savingEducation = input(false);
  readonly canWrite = input(false);
  /** La organización que pide el desplegable de catálogo; la geografía ya no la usa. */
  readonly organizationId = input('');
  readonly editingAddress = input(false);
  readonly savingAddress = input(false);
  readonly addressProblem = input('');

  readonly editAddress = output<void>();
  readonly cancelAddress = output<void>();
  readonly saveAddress = output<EmployeeAddressValue>();

  /**
   * Si el domicilio está en blanco, para que el botón diga capturar en vez de editar.
   *
   * <p>No mira la calle sola: un expediente traído de antes puede tener la dirección en una línea
   * y nada más, y eso ya es algo capturado.</p>
   */
  protected domicilioVacio(): boolean {
    const expediente = this.employee();
    return !expediente?.street && !expediente?.neighborhood && !expediente?.postalCode
      && !this.row().state && !this.row().municipality;
  }

  /** La escolaridad elegida, resuelta a nombre. Vacía cuando no se ha registrado. */
  readonly saveEducation = output<string | null>();

  protected readonly educationLevelOptions = computed<readonly GiSelectOption[]>(() =>
    this.educationLevels().map((nivel) => ({ value: nivel.idCatalogItem, label: nivel.name })),
  );

  protected educationLevelName(): string {
    const id = this.employee()?.idEducationLevelCatalogItem;
    if (!id) return 'Sin escolaridad registrada';
    return this.educationLevels().find((nivel) => nivel.idCatalogItem === id)?.name
      ?? 'Sin escolaridad registrada';
  }

  /** Si el expediente completo todavía viene en camino. */
  readonly loading = input(false);

  /**
   * Un campo que sólo existe en el expediente completo.
   *
   * <p>La ficha se dibuja con la fila del listado, que llega de inmediato, mientras el expediente
   * viaja aparte. Sin esto, teléfono y correo se pintaban como «Sin teléfono» y «Sin correo»
   * durante ese hueco y luego cambiaban solos: parecía que el dato no estaba y aparecía después.
   * Decir que se está cargando es distinto de decir que no hay.</p>
   *
   * <p>Basta con que esté cargando: el primer intento sólo cubría el caso sin detalle todavía, y
   * al volver a pulsar una persona ya abierta el detalle anterior seguía en memoria, así que el
   * parpadeo volvía. Mientras se recarga no se afirma nada, ni siquiera lo que ya se sabía.</p>
   */
  /**
   * Si el puesto que la persona tiene ya no está activo en el catálogo.
   *
   * <p>Se deduce de la lista de puestos activos, que la pantalla ya carga: si la persona apunta a
   * uno que no está ahí, es que se desactivó. No hace falta pedirle nada más al servidor.</p>
   */
  protected readonly puestoInactivo = computed(() => {
    const id = this.row().idJobPositionCatalogItem;
    const opciones = this.jobPositions();

    return !!id && !!this.row().jobPositionName && opciones.length > 0
      && !opciones.some((opcion) => opcion.idCatalogItem === id);
  });

  protected delDetalle(valor: string): string {
    return this.loading() ? '…' : valor;
  }

  readonly editJobPosition = output<void>();
  readonly openCatalog = output<void>();

  /** Cuántos días antes se considera «por vencer». Lo decide la organización. */
  readonly expiringWithinDays = input(30);

  /** Llevar a la pestaña de Documentos desde el aviso, sin buscarla. */
  readonly openDocuments = output<void>();
  readonly cancelJobPosition = output<void>();
  readonly saveJobPosition = output<string>();
  readonly createJobPosition = output<GiCatalogCreation>();

  protected readonly statusLabel = computed(() => employeeStatusLabel(this.row().status));
  protected readonly statusTone = computed(() => employeeStatusTone(this.row().status));
  protected readonly hired = computed(() => formatOperationalDate(this.row().hireDate));

  protected readonly emergency = computed(() => {
    const employee = this.employee();

    if (!employee?.emergencyContactName) {
      return 'Sin contacto de emergencia registrado';
    }

    // El parentesco entra si está: quien llama en una emergencia necesita saber con quién habla.
    const parentesco = employee.emergencyContactRelationship
      ? ` (${employee.emergencyContactRelationship})`
      : '';

    return employee.emergencyContactPhone
      ? `${employee.emergencyContactName}${parentesco} · ${employee.emergencyContactPhone}`
      : `${employee.emergencyContactName}${parentesco} · sin teléfono`;
  });

  /**
   * Un dato personal se muestra parcial sin el permiso.
   *
   * <p>No es la protección: la protección es del servidor. Aquí sólo se evita enseñar de más en una
   * pantalla que se consulta con gente alrededor.</p>
   */
  protected masked(value: string | null): string {
    if (!value) {
      return 'Sin dato capturado';
    }

    if (this.canViewSensitive()) {
      return value;
    }

    return value.length > 4 ? `•••• ${value.slice(-4)}` : 'Dato reservado';
  }
}
