import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { GiSelect } from '../../../../shared/ui/gi-select/gi-select';
import { CatalogApiService } from '../../data-access/catalog-api.service';
import {
  SHIFT_DAYPARTS,
  ShiftDaypart,
  ShiftPatternTemplate,
  ShiftPatternTemplateInput,
  crossesMidnight,
  formatHours,
  shiftDaypartLabel,
  shiftDurationMinutes,
  weeklyHoursOf,
} from '../../data-access/shift-pattern-template.models';

/** Un día del ciclo, tal como se captura: descanso, o un turno con entrada y salida. */
type DiaGrupo = FormGroup<{
  isRest: FormControl<boolean>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
}>;

/**
 * El constructor de patrones de turno.
 *
 * <p><b>Por qué existe.</b> El patrón se capturaba dentro de cada posición y sus días se declaraban
 * por día de la semana, así que sólo cabían ciclos semanales: un 24x48 es un ciclo de tres días y no
 * había forma de expresarlo. Además había que volver a teclear el mismo horario en cada posición.
 * Aquí el patrón se captura una vez —«Día 1, 07:00 a 19:00; Día 2, descanso»— y la posición lo
 * elige de un desplegable.</p>
 *
 * <p><b>El descanso es un hecho declarado, no un hueco.</b> Antes «descansa el día 2» y «nadie
 * configuró el día 2» se veían idénticos, y por eso el descanso no se podía heredar ni proteger.
 * Aquí se marca, y el patrón sabe decir si le faltan días por declarar.</p>
 *
 * <p><b>Las horas por semana que se ven abajo son una vista previa, no la regla.</b> El servidor
 * las vuelve a calcular y es el que juzga contra el límite legal vigente, porque ese límite cambia
 * con la ley y no puede vivir en el navegador. La previa está para no capturar a ciegas.</p>
 */
@Component({
  selector: 'app-shift-pattern-templates',
  imports: [ReactiveFormsModule, GiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pat" aria-label="Patrones de turno">
      <!--
        Sin título ni nota aquí. El título lo pone la página que envuelve este bloque, y decirlo dos
        veces seguidas hacía dudar de si eran dos cosas; la nota explicaba qué es un patrón de turno
        a quien ya entró a la pantalla de patrones de turno.
      -->
      <header class="pat__cabecera">
        <button
          class="gi-button gi-button--primary"
          type="button"
          [disabled]="!canWrite() || saving()"
          (click)="nuevo()"
        >
          Nuevo patrón
        </button>
      </header>

      @if (error()) { <p class="gi-alert gi-alert--error" role="alert">{{ error() }}</p> }
      @if (message()) { <p class="gi-alert gi-alert--success" role="status">{{ message() }}</p> }

      @if (loading() && !templates().length) {
        <div class="pat__cargando" role="status" aria-label="Cargando patrones">
          <span class="gi-skeleton"></span><span class="gi-skeleton"></span>
        </div>
      } @else if (!templates().length) {
        <p class="pat__vacio">
          Todavía no hay patrones en el catálogo. Mientras no haya ninguno, cada posición sigue
          usando el patrón que se le capturó por dentro.
        </p>
      } @else {
        <div class="table-wrap">
          <table class="gi-table">
            <thead>
              <tr>
                <th scope="col">Patrón</th>
                <th scope="col">Jornada</th>
                <th scope="col">Ciclo</th>
                <th scope="col">Horas turno</th>
                <th scope="col">Promedio semanal</th>
                <th scope="col">Jornada 48 h</th>
                <th scope="col">Descanso</th>
                <th scope="col">Vigencia</th>
                <th scope="col"><span class="pat__oculto">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (patron of templates(); track patron.idShiftPatternTemplate) {
                <tr>
                  <th scope="row">
                    {{ patron.name }}
                    @if (!patron.isComplete) {
                      <span class="gi-badge gi-badge--warning">Días sin declarar</span>
                    }
                    @if (!patron.active) {
                      <span class="gi-badge gi-badge--muted">Retirado</span>
                    }
                  </th>
                  <td>{{ daypartLabel(patron.daypart) }}</td>
                  <td>{{ cicloTexto(patron) }}</td>
                  <td>{{ horasTurno(patron) }}</td>
                  <td>{{ patron.weeklyHours }} h</td>
                  <td>
                    @if (patron.compliance === 'Exceeds') {
                      <span class="gi-badge gi-badge--warning"
                        >Excede por {{ patron.excessHours }} h</span
                      >
                    } @else {
                      <span class="gi-badge gi-badge--success">Conforme</span>
                    }
                    <small class="pat__limite">Límite {{ patron.weeklyLimit }} h</small>
                  </td>
                  <td>{{ patron.restDescription }}</td>
                  <td>{{ vigencia(patron) }}</td>
                  <td class="pat__acciones">
                    <button class="gi-button gi-button--ghost" type="button" (click)="editar(patron)">
                      {{ canWrite() ? 'Editar' : 'Ver' }}
                    </button>
                    @if (patron.active && canWrite()) {
                      <button
                        class="gi-button gi-button--ghost-danger"
                        type="button"
                        [disabled]="saving()"
                        (click)="retirar(patron)"
                      >
                        Retirar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <dialog
      #editor
      class="pat__dialogo"
      aria-label="Patrón de turno"
      (cancel)="saving() ? $event.preventDefault() : cerrar()"
    >
      <form [formGroup]="form" (ngSubmit)="guardar()">
        <header class="pat__dialogo-cabecera">
          <div>
            <span class="eyebrow">Catálogo</span>
            <h2>{{ editando() ? 'Editar patrón' : 'Nuevo patrón' }}</h2>
          </div>
          <button class="gi-button gi-button--ghost" type="button" (click)="cerrar()">Cerrar</button>
        </header>

        <!--
          Los rótulos van en un <span> dentro del .gi-field, que es lo que les da el tamaño de
          rótulo. Sueltos como texto del <label> salían del tamaño del cuerpo y competían con el
          contenido; y el desplegable de jornada no tenía ninguno, porque gi-select se nombra con
          aria-label y no lo dibuja: quedaba flotando arriba a la derecha sin decir de qué era.
        -->
        <div class="pat__cuerpo">
          <div class="pat__fila pat__fila--nombre">
            <label class="gi-field">
              <span>Nombre del patrón</span>
              <input class="gi-input" type="text" formControlName="name" placeholder="Ej. 12x12 diurno" />
            </label>
            <div class="gi-field">
              <span>Jornada</span>
              <gi-select
                label="Jornada"
                [options]="daypartOptions"
                [value]="form.controls.daypart.value"
                [disabled]="!canWrite()"
                (valueChange)="form.controls.daypart.setValue($any($event))"
              />
            </div>
          </div>

          <div class="pat__fila pat__fila--tres">
            <label class="gi-field">
              <span>Días del ciclo</span>
              <input class="gi-input" type="number" min="1" max="366" formControlName="cycleDays" />
            </label>
            <label class="gi-field">
              <span>Vigente desde</span>
              <input class="gi-input" type="date" formControlName="effectiveFromDate" />
            </label>
            <label class="gi-field">
              <span>Vigente hasta</span>
              <input class="gi-input" type="date" formControlName="effectiveToDate" />
            </label>
          </div>

          <label class="gi-field">
            <span>Descripción</span>
            <textarea
              class="gi-input"
              rows="2"
              formControlName="description"
              placeholder="Opcional. Cómo lo llama el cliente, o qué lo distingue de otro parecido."
            ></textarea>
          </label>

        <!--
          Los días del ciclo. Cada uno es un turno con horario o un descanso declarado; el cruce de
          medianoche no se pregunta, se deduce del horario, porque pedirlo como casilla dejaba
          declarar un 19:00–07:00 sin marcarla y la duración salía negativa.
        -->
          <fieldset class="pat__dias" formArrayName="days" [disabled]="!canWrite() || saving()">
          <legend>Qué es cada día del ciclo</legend>
          @for (dia of dayControls(); track dia.numero; let i = $index) {
            <div class="pat__dia" [formGroupName]="i">
              <span class="pat__dia-numero">Día {{ dia.numero }}</span>
              <label class="pat__casilla">
                <input type="checkbox" formControlName="isRest" />
                <span>Descanso</span>
              </label>
              @if (!dia.grupo.controls.isRest.value) {
<!--
                  La hora va en un control propio y no en un input de tipo «time».
                  El desplegable del nativo lo dibuja el navegador: no se puede cerrar al elegir, no
                  se puede estilizar, y dentro del modal tapaba las filas de abajo con huecos en
                  blanco en sus columnas. Además el sistema cerrado exige que los selectores de esta
                  pantalla sean nuestros, y el input de tipo «time» se colaba porque no es un
                  selector nativo y la prueba no lo atrapaba.
                -->
                <span class="pat__hora">
                  <span>Entra</span>
                  <gi-select
                    label="Hora de entrada del día {{ dia.numero }}"
                    [options]="timeOptions"
                    [value]="dia.grupo.controls.startTime.value"
                    [disabled]="!canWrite() || saving()"
                    (valueChange)="dia.grupo.controls.startTime.setValue($event)"
                  />
                </span>
                <span class="pat__hora">
                  <span>Sale</span>
                  <gi-select
                    label="Hora de salida del día {{ dia.numero }}"
                    [options]="timeOptions"
                    [value]="dia.grupo.controls.endTime.value"
                    [disabled]="!canWrite() || saving()"
                    (valueChange)="dia.grupo.controls.endTime.setValue($event)"
                  />
                </span>
                <span class="pat__dia-duracion">
                  {{ duracionDe(dia.numero) }}
                  @if (cruzaDe(dia.numero)) {
                    <span class="gi-badge gi-badge--muted">Cruza medianoche</span>
                  }
                </span>
              } @else {
                <span class="pat__dia-duracion">Sin horario</span>
              }
            </div>
          }
          </fieldset>

          <!--
            Las dos cifras, no una. Sólo con las horas por semana, quien sumaba los turnos a mano
            obtenía otra cosa: cuatro días de 12 h en un ciclo de seis son 48 h en el ciclo y 56 por
            semana —48 × 7 ÷ 6—. Los dos números eran correctos y la pantalla parecía equivocada por
            enseñar el segundo sin el primero. La división va escrita por lo mismo.
          -->
          <p class="pat__previa" role="status">
            <strong>{{ previaHorasCiclo() }} h de turno</strong> en el ciclo de
            {{ form.controls.cycleDays.value }}
            {{ form.controls.cycleDays.value === 1 ? 'día' : 'días' }}
            ({{ previaTurnos() }} de turno, {{ previaDescansos() }} de descanso) ·
            <strong>promedio semanal de {{ previaHoras() }} h</strong>
            <small>
              {{ previaHorasCiclo() }} h ÷ {{ form.controls.cycleDays.value }}
              {{ form.controls.cycleDays.value === 1 ? 'día' : 'días' }} × 7 días =
              {{ previaHoras() }} h. Es un promedio: el servidor lo vuelve a calcular al guardar y,
              si excede la jornada legal, el patrón se guarda igual y la tabla dice por cuánto.
            </small>
          </p>
        </div>

        @if (error()) { <p class="gi-alert gi-alert--error" role="alert">{{ error() }}</p> }

        <footer class="pat__dialogo-acciones">
          <button class="gi-button gi-button--secondary" type="button" (click)="cerrar()">
            Cancelar
          </button>
          <button
            class="gi-button gi-button--primary"
            type="submit"
            [disabled]="saving() || !canWrite() || form.invalid"
          >
            {{ saving() ? 'Guardando…' : 'Guardar patrón' }}
          </button>
        </footer>
      </form>
    </dialog>
  `,
  styles: `
    :host { display: block; }

    .pat { display: flex; flex-direction: column; gap: 0.75rem; }

    .pat__cabecera { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; }

    .pat__vacio { margin: 0; color: var(--gestia-muted); font-size: 12px; }

    .pat__cargando { display: flex; flex-direction: column; gap: 0.5rem; }

    .pat__oculto {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    .pat__acciones { display: flex; gap: 0.35rem; justify-content: flex-end; }

    .pat__limite { display: block; color: var(--gestia-muted); font-size: 10.5px; }

    /* Más angosto que antes —58 rem daban un cuadro casi tan ancho como la pantalla— y sin relleno
       propio: lo ponen la cabecera, el cuerpo y el pie, que es lo que les da sus líneas. */
    .pat__dialogo { width: min(44rem, calc(100vw - 2rem)); padding: 0; }

    .pat__dialogo form { display: block; }

    .pat__dialogo-cabecera {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 1.1rem 1.25rem 0.9rem;
      border-bottom: 1px solid var(--gestia-border);
      gap: 1rem;
    }

    .pat__dialogo-cabecera h2 { margin: 0.1rem 0 0; }

    .pat__dialogo-acciones {
      display: flex;
      justify-content: flex-end;
      padding: 0.9rem 1.25rem 1.1rem;
      border-top: 1px solid var(--gestia-border);
      gap: 0.5rem;
    }

    /* El cuerpo en una rejilla, y cada fila con sus columnas. Antes eran filas flex sueltas con
       anchos distintos, y los campos no se alineaban entre una fila y la siguiente. */
    .pat__cuerpo {
      display: grid;
      padding: 1.1rem 1.25rem;
      gap: 0.9rem;
    }

    .pat__fila { display: grid; gap: 0.9rem; }
    .pat__fila--nombre { grid-template-columns: 1fr 12rem; }
    .pat__fila--tres { grid-template-columns: 1fr 1fr 1fr; }

    .pat__cuerpo textarea { resize: vertical; }

    @media (max-width: 42rem) {
      .pat__fila--nombre,
      .pat__fila--tres { grid-template-columns: 1fr; }
    }

    .pat__dias {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      padding: 0.65rem;
      max-height: 22rem;
      overflow-y: auto;
    }

    .pat__dias legend { padding: 0 0.35rem; color: var(--gestia-muted); font-size: 11px; }

    .pat__dia {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.6rem;
      padding: 0.35rem 0.5rem;
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .pat__dia-numero { min-width: 4.5rem; font-size: 12px; color: var(--gestia-text); }

    .pat__dia-duracion {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-left: auto;
      color: var(--gestia-muted);
      font-size: 11.5px;
    }

    .pat__casilla, .pat__hora { display: flex; align-items: center; gap: 0.35rem; font-size: 11.5px; }

    .pat__hora gi-select { display: block; width: 7.5rem; }

    .pat__previa {
      margin: 0;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--gestia-border);
      border-left: 3px solid var(--gestia-cyan);
      border-radius: var(--gestia-radius);
      background: var(--gestia-cyan-soft);
      color: var(--gestia-text);
      font-size: 12px;
    }

    .pat__previa small { display: block; margin-top: 0.25rem; color: var(--gestia-muted); font-size: 10.5px; }

    .pat__dia input:focus-visible,
    .pat__previa a:focus-visible {
      outline: 2px solid var(--gestia-cyan);
      outline-offset: 2px;
    }
  `,
})
export class ShiftPatternTemplates {
  private readonly editor = viewChild<ElementRef<HTMLDialogElement>>('editor');
  private readonly api = inject(CatalogApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly systemInfo = inject(SystemInfoService);

  readonly organizationId = input.required<string>();
  readonly canWrite = input(false);

  protected readonly daypartOptions = SHIFT_DAYPARTS.map((opcion) => ({
    value: opcion.value,
    label: opcion.label,
  }));

  /**
   * Las horas que se pueden elegir, en pasos de quince minutos.
   *
   * <p>Los patrones de seguridad privada caen en hora o media hora —07:00, 19:00, 20:00, 06:30—,
   * así que el cuarto de hora cubre de sobra lo que se captura y deja una lista navegable. Si
   * alguna vez hace falta un 06:35, lo que cambia es el paso, no el control.</p>
   *
   * <p>Se escriben en 24 horas a propósito: el nativo mostraba «07:00 PM» y en una tabla de turnos
   * eso obliga a traducir mentalmente cada renglón.</p>
   */
  protected readonly timeOptions = Array.from({ length: (24 * 60) / 15 }, (_, indice) => {
    const minutos = indice * 15;
    const valor = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
    return { value: valor, label: valor };
  });

  protected readonly templates = signal<readonly ShiftPatternTemplate[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly editando = signal<ShiftPatternTemplate | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(1000)]],
    daypart: ['Day' as ShiftDaypart, [Validators.required]],
    cycleDays: [2, [Validators.required, Validators.min(1), Validators.max(366)]],
    effectiveFromDate: [this.hoy(), [Validators.required]],
    effectiveToDate: [''],
    days: new FormArray<DiaGrupo>([]),
  });

  /**
   * Una foto del valor del formulario que las señales puedan leer.
   *
   * <p>Un `FormArray` no es reactivo para las señales, así que la previa y el propio listado de días
   * se recalculan de aquí. Sin esto, cambiar «Días del ciclo» no redibujaba nada.</p>
   */
  private readonly formValue = signal(this.form.getRawValue());

  protected readonly dayControls = computed(() =>
    this.formValue().days.map((_, indice) => ({
      numero: indice + 1,
      grupo: this.form.controls.days.at(indice),
    })),
  );

  protected readonly previaDescansos = computed(
    () => this.formValue().days.filter((dia) => dia.isRest).length,
  );

  protected readonly previaTurnos = computed(
    () => this.formValue().days.filter((dia) => !dia.isRest).length,
  );

  /** Los minutos de turno que declara el ciclo completo. */
  private readonly previaMinutos = computed(() =>
    this.formValue()
      .days.filter((dia) => !dia.isRest && dia.startTime && dia.endTime)
      .reduce((total, dia) => total + shiftDurationMinutes(dia.startTime, dia.endTime), 0),
  );

  /** Las horas de turno del ciclo, que es lo que alguien suma a mano al revisar la pantalla. */
  protected readonly previaHorasCiclo = computed(
    () => Math.round((this.previaMinutos() / 60) * 100) / 100,
  );

  protected readonly previaHoras = computed(() =>
    weeklyHoursOf(this.previaMinutos(), Math.max(1, Number(this.formValue().cycleDays) || 1)),
  );

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formValue.set(this.form.getRawValue());
    });

    // Los días siguen a la longitud del ciclo. Cambiar de 2 a 3 agrega el día 3 y no borra los dos
    // ya capturados: bajar y volver a subir perdería lo escrito, que es lo que más molesta.
    this.form.controls.cycleDays.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => this.ajustarDias(Number(valor)));

    effect(() => {
      const org = this.organizationId();
      if (org) this.cargar(org);
    });

    this.ajustarDias(2);
  }

  protected daypartLabel = shiftDaypartLabel;

  protected cicloTexto(patron: ShiftPatternTemplate): string {
    return patron.cycleDays === 1 ? '1 día' : `${patron.cycleDays} días`;
  }

  /** Las horas de turno del patrón. Un rango cuando los días no duran lo mismo. */
  protected horasTurno(patron: ShiftPatternTemplate): string {
    const duraciones = patron.days
      .filter((dia) => !dia.isRest && dia.durationMinutes > 0)
      .map((dia) => dia.durationMinutes);

    if (!duraciones.length) return '—';

    const minimo = Math.min(...duraciones);
    const maximo = Math.max(...duraciones);
    return minimo === maximo ? formatHours(minimo) : `${formatHours(minimo)} a ${formatHours(maximo)}`;
  }

  protected vigencia(patron: ShiftPatternTemplate): string {
    return patron.effectiveToDate
      ? `${patron.effectiveFromDate} a ${patron.effectiveToDate}`
      : `Desde ${patron.effectiveFromDate}`;
  }

  protected duracionDe(numero: number): string {
    const dia = this.formValue().days[numero - 1];
    if (!dia || dia.isRest || !dia.startTime || !dia.endTime) return '—';
    return formatHours(shiftDurationMinutes(dia.startTime, dia.endTime));
  }

  protected cruzaDe(numero: number): boolean {
    const dia = this.formValue().days[numero - 1];
    return !!dia && !dia.isRest && !!dia.startTime && !!dia.endTime
      ? crossesMidnight(dia.startTime, dia.endTime)
      : false;
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.error.set('');
    this.form.reset({
      name: '',
      description: '',
      daypart: 'Day',
      cycleDays: 2,
      effectiveFromDate: this.hoy(),
      effectiveToDate: '',
    });
    this.ajustarDias(2);
    this.abrir();
  }

  protected editar(patron: ShiftPatternTemplate): void {
    this.editando.set(patron);
    this.error.set('');
    this.form.reset({
      name: patron.name,
      description: patron.description ?? '',
      daypart: patron.daypart,
      cycleDays: patron.cycleDays,
      effectiveFromDate: patron.effectiveFromDate.slice(0, 10),
      effectiveToDate: patron.effectiveToDate?.slice(0, 10) ?? '',
    });

    this.ajustarDias(patron.cycleDays);

    for (const dia of patron.days) {
      const grupo = this.form.controls.days.at(dia.cycleDayNumber - 1);
      if (!grupo) continue;

      grupo.setValue({
        isRest: dia.isRest,
        startTime: dia.startTime?.slice(0, 5) ?? '07:00',
        endTime: dia.endTime?.slice(0, 5) ?? '19:00',
      });
    }

    this.formValue.set(this.form.getRawValue());
    this.abrir();
  }

  protected cerrar(): void {
    this.editor()?.nativeElement.close();
  }

  protected guardar(): void {
    const org = this.organizationId();
    if (!this.canWrite() || this.form.invalid || !org) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    const input: ShiftPatternTemplateInput = {
      idOrganization: org,
      name: valor.name.trim(),
      description: valor.description.trim() || null,
      daypart: valor.daypart,
      cycleDays: Number(valor.cycleDays),
      effectiveFromDate: valor.effectiveFromDate,
      effectiveToDate: valor.effectiveToDate || null,
      days: valor.days.map((dia, indice) => ({
        cycleDayNumber: indice + 1,
        isRest: dia.isRest,
        startTime: dia.isRest ? null : dia.startTime,
        endTime: dia.isRest ? null : dia.endTime,
      })),
    };

    const editando = this.editando();
    const request = editando
      ? this.api.updateShiftPatternTemplate(editando.idShiftPatternTemplate, input)
      : this.api.createShiftPatternTemplate(input);

    this.saving.set(true);
    this.error.set('');
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.message.set(editando ? 'Patrón actualizado.' : 'Patrón creado.');
        this.cerrar();
        this.cargar(org);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected retirar(patron: ShiftPatternTemplate): void {
    const org = this.organizationId();
    if (!this.canWrite() || !org) return;

    this.saving.set(true);
    this.error.set('');
    this.api
      .deactivateShiftPatternTemplate(org, patron.idShiftPatternTemplate)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.message.set(`Patrón ${patron.name} retirado. Su nombre sigue ocupado.`);
          this.cargar(org);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  private cargar(organizationId: string): void {
    this.loading.set(true);
    this.api
      .listShiftPatternTemplates(organizationId, true)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (filas) => this.templates.set(filas),
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  private abrir(): void {
    this.editor()?.nativeElement.showModal();
  }

  /**
   * Un grupo por día del ciclo. El horario por omisión es un turno de doce horas diurno, que es el
   * caso más común en seguridad privada; el descanso se marca y el horario se guarda vacío.
   */
  private diaGrupo(): DiaGrupo {
    return this.formBuilder.nonNullable.group({
      isRest: [false],
      startTime: ['07:00', [Validators.required]],
      endTime: ['19:00', [Validators.required]],
    });
  }

  private ajustarDias(cycleDays: number): void {
    const objetivo = Math.min(366, Math.max(1, Number.isFinite(cycleDays) ? cycleDays : 1));
    const dias = this.form.controls.days;

    while (dias.length > objetivo) dias.removeAt(dias.length - 1);
    while (dias.length < objetivo) dias.push(this.diaGrupo());

    this.formValue.set(this.form.getRawValue());
  }

  /**
   * El día operativo lo dice el servidor.
   *
   * <p>Calcularlo con `new Date()` daría el día UTC, que de las 18:00 en adelante ya es el
   * siguiente en México: la vigencia del patrón arrancaría un día después del que quien captura
   * cree. Vacío mientras no haya respuesta, porque un campo vacío se nota y se llena; una fecha
   * equivocada se guarda sin que nadie la mire.</p>
   */
  private hoy(): string {
    return this.systemInfo.operationDate();
  }

  private setError(error: HttpErrorResponse): void {
    const cuerpo = error.error as { detail?: string; title?: string; errors?: Record<string, string[]> } | null;
    const deCampo = cuerpo?.errors ? Object.values(cuerpo.errors).flat()[0] : undefined;
    this.error.set(deCampo ?? cuerpo?.detail ?? cuerpo?.title ?? 'No se pudo completar la operación.');
  }
}
