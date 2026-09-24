import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GiAccordion, GiSelect, GiSelectOption } from '../../../shared/ui/gi-ui';
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
  imports: [EmployeeAddress, EmployeeEligibilityBand, EmployeeJobPosition, GiAccordion, GiSelect],
  template: `
    <div class="data">
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
        />
      }

      <!--
        Identificacion: la unica seccion que NO se pliega. Es lo que contesta «¿de quien es esta
        ficha?», y plegarla obligaria a abrir algo para saber en que registro estas.
      -->
      <section class="data__block data__block--principal">
        <h3 class="data__kicker">Identificación</h3>
        <dl class="data__grid data__grid--two">
          <div class="data__field data__field--wide">
            <dt>Nombre</dt>
            <dd>{{ row().fullName }}</dd>
          </div>
          <div class="data__field">
            <dt>Código</dt>
            <dd>{{ row().codeEmployee }}</dd>
          </div>
          <div class="data__field">
            <dt>Estado</dt>
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
            <dt>Escolaridad</dt>
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

      <gi-accordion
        label="Relación laboral"
        [summary]="resumenLaboral()"
        [tone]="row().jobPositionName ? 'neutral' : 'warning'"
        [toneLabel]="row().jobPositionName ? '' : 'Sin puesto'"
      >
        <dl class="data__grid data__grid--two">
          <div class="data__field">
            <dt>Ingreso</dt>
            <dd>{{ hired() }}</dd>
          </div>
          <div class="data__field">
            <dt>Asignaciones</dt>
            <dd>{{ row().assignmentCount === 0 ? 'Ninguna' : row().assignmentCount }}</dd>
          </div>
          <div class="data__field">
            <dt>Puesto</dt>
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
          <!--
            El texto heredado sale de la vista cuando coincide con el puesto del catalogo.

            Antes se enseñaban siempre los dos campos, uno al lado del otro. En la inmensa mayoria
            de las fichas dicen exactamente lo mismo —«Auxiliar de intendencia» y «Auxiliar de
            intendencia»—, asi que el usuario leia dos veces el mismo dato y tenia que decidir cual
            de los dos era el bueno. Cuando difieren si importa, y entonces se muestra.
          -->
          @if (textoHeredadoDistinto()) {
            <div class="data__field">
              <dt>Texto capturado antes del catálogo</dt>
              <dd>{{ row().jobTitle }}</dd>
            </div>
          }
        </dl>
        @if (row().jobTitle && !row().jobPositionName) {
          <p class="data__note">
            El texto de arriba es lo que se capturó antes del catálogo. No sirve para comparar
            contra el perfil de una posición, porque la comparación es por identificador.
          </p>
        }
      </gi-accordion>

      <gi-accordion
        label="Domicilio"
        [summary]="resumenDomicilio()"
        [tone]="domicilioVacio() ? 'warning' : 'neutral'"
        [toneLabel]="domicilioVacio() ? 'Sin capturar' : ''"
      >
        @if (canWrite() && !editingAddress()) {
          <p class="data__acciones">
            <button class="data__editar" type="button" (click)="editAddress.emit()">
              {{ domicilioVacio() ? 'Capturar domicilio' : 'Editar domicilio' }}
            </button>
          </p>
        }

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
            <dt>Calle</dt>
            <dd>{{ delDetalle(employee()?.street || 'Sin calle registrada') }}</dd>
          </div>
          <div class="data__field">
            <dt>Número</dt>
            <dd>{{ delDetalle(employee()?.streetNumber || 'Sin número registrado') }}</dd>
          </div>
          <div class="data__field">
            <dt>Colonia</dt>
            <dd>{{ delDetalle(employee()?.neighborhood || 'Sin colonia registrada') }}</dd>
          </div>
          <div class="data__field">
            <dt>Código postal</dt>
            <dd>{{ delDetalle(employee()?.postalCode || 'Sin código postal') }}</dd>
          </div>
          <div class="data__field">
            <dt>Estado</dt>
            <dd>{{ row().state || 'Sin estado registrado' }}</dd>
          </div>
          <div class="data__field">
            <dt>Municipio</dt>
            <dd>{{ row().municipality || 'Sin municipio registrado' }}</dd>
          </div>
        </dl>
        }
      </gi-accordion>

      <!--
        Contacto va aparte del domicilio. Son dos cosas que se consultan en momentos distintos —una
        para ubicar a la persona y otra para localizarla—, y juntas hacian un bloque de nueve
        campos que era el mas largo de la ficha.
      -->
      <gi-accordion
        label="Contacto"
        [summary]="resumenContacto()"
        [tone]="tieneContactoEmergencia() ? 'neutral' : 'warning'"
        [toneLabel]="tieneContactoEmergencia() ? '' : 'Sin contacto de emergencia'"
      >
        <dl class="data__grid data__grid--two">
          <div class="data__field">
            <dt>Teléfono</dt>
            <dd>{{ delDetalle(employee()?.mobilePhone || employee()?.homePhone || 'Sin teléfono') }}</dd>
          </div>
          <div class="data__field">
            <dt>Correo</dt>
            <dd>{{ delDetalle(employee()?.email || 'Sin correo') }}</dd>
          </div>
          <div class="data__field data__field--wide">
            <dt>Contacto de emergencia</dt>
            <dd>{{ emergency() }}</dd>
          </div>
        </dl>
      </gi-accordion>
    </div>
  `,
  styles: `
    :host { display: block; }

    .data { display: flex; flex-direction: column; gap: 0.55rem; }

    .data__block { display: flex; flex-direction: column; gap: 0.6rem; }

    /* La identificacion ya no lleva separador superior: es la primera y la unica sin plegar, asi
       que no hay nada de lo que separarla. Los acordeones traen su propio borde. */
    .data__block--principal { gap: 0.5rem; }

    .data__acciones { margin: 0 0 0.6rem; }

    /* El rótulo de bloque va en cian y con una línea debajo: es lo que divide la ficha en partes,
       y en gris quedaba al mismo peso visual que las etiquetas de campo que encabeza. */
    .data__kicker {
      margin: 0;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--gestia-border);
      color: var(--gestia-cyan-dark);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .data__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem 1.25rem; margin: 0; }

    .data__field { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .data__field--wide { grid-column: 1 / -1; }

    /* La etiqueta baja a 11.5 px sin mayúsculas forzadas y el valor sube a 13 px 600.
       Antes la etiqueta iba en versalitas grises de 11 px y el valor en 12.5 px, tan cerca que
       ninguno de los dos mandaba: la ficha se leía como una lista de pares del mismo peso en vez
       de como datos con su rótulo. El dato es lo que se viene a leer, así que es lo que pesa. */
    .data__field dt {
      color: var(--gestia-muted);
      font-size: 11.5px;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
    }

    .data__field dd {
      margin: 0;
      color: var(--gestia-text);
      font-size: 13px;
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

  /**
   * Si el texto heredado dice algo que el puesto del catálogo no diga ya.
   *
   * <p>Se compara sin acentos ni mayúsculas porque la conversión al catálogo normalizó la
   * escritura: «Auxiliar de Intendencia» y «Auxiliar de intendencia» son el mismo puesto escrito
   * dos veces, y enseñarlos como campos distintos sugiere una diferencia que no existe.</p>
   */
  protected readonly textoHeredadoDistinto = computed(() => {
    const heredado = this.row().jobTitle?.trim();

    if (!heredado) {
      return false;
    }

    const catalogo = this.row().jobPositionName?.trim();

    if (!catalogo) {
      // Sin puesto de catálogo el texto heredado es lo único que hay: se enseña siempre.
      return true;
    }

    const normalizar = (valor: string) =>
      valor
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLocaleLowerCase('es');

    return normalizar(heredado) !== normalizar(catalogo);
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

  protected readonly statusLabel = computed(() => employeeStatusLabel(this.row().status));
  protected readonly statusTone = computed(() => employeeStatusTone(this.row().status));
  protected readonly hired = computed(() => formatOperationalDate(this.row().hireDate));

  /**
   * Lo que cada acordeón dice sin abrirse.
   *
   * <p>Es lo que hace que plegar no cueste nada: una sección cerrada que sólo dice «Domicilio»
   * obliga a abrirla para saber si hay algo dentro, y entonces plegar sólo ha añadido un clic.</p>
   */
  protected readonly resumenLaboral = computed(() => {
    const puesto = this.row().jobPositionName || 'Sin puesto del catálogo';
    return `${puesto} · desde ${this.hired()}`;
  });

  protected readonly resumenDomicilio = computed(() => {
    const employee = this.employee();

    if (this.loading()) {
      return '…';
    }

    // Municipio y estado primero: es lo que se pregunta de un domicilio cuando no se va a ir a él.
    const lugar = [this.row().municipality, this.row().state].filter(Boolean).join(', ');
    const calle = [employee?.street, employee?.streetNumber].filter(Boolean).join(' ');

    if (!lugar && !calle) {
      return 'Sin domicilio capturado';
    }

    return [lugar, calle].filter(Boolean).join(' · ');
  });

  protected readonly resumenContacto = computed(() => {
    const employee = this.employee();

    if (this.loading()) {
      return '…';
    }

    const telefono = employee?.mobilePhone || employee?.homePhone;
    return telefono || employee?.email || 'Sin datos de contacto';
  });

  protected readonly tieneContactoEmergencia = computed(
    () => !!this.employee()?.emergencyContactName,
  );

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
