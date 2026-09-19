import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GiEmptyState, GiSelect, GiSelectOption } from '../../../shared/ui/gi-ui';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';
import { EmployeeEvaluation } from '../data-access/workforce.models';
import {
  employeeEvaluationRequirementRows,
  evaluationResultLabel,
  evaluationStateLabel,
  evaluationStateTone,
  evaluationTypeLabel,
  evaluationTypeOptions,
} from '../data-access/employee-list.models';

/** Lo que el formulario entrega. La pantalla decide con qué endpoint guardarlo. */
export type EmployeeEvaluationFormValue = {
  readonly idEmployeeEvaluation: string | null;
  readonly evaluationType: string;
  readonly result: string;
  readonly evaluatedDate: string;
  readonly expiresDate: string | null;
  readonly certificateNumber: string | null;
  readonly notes: string | null;
};

const RESULTADOS = ['Approved', 'ApprovedWithObservations', 'Pending', 'Inconclusive', 'NotApproved'];

/**
 * La pestaña de Evaluaciones.
 *
 * <p><b>Por qué existe, y por qué faltaba.</b> El servidor exige evaluaciones aprobadas para
 * asignar a alguien a una posición, y las cuatro rutas del expediente existían desde el principio
 * —con sus métodos en el cliente Angular— sin que ninguna pantalla las llamara. El resultado era
 * que una organización con una regla de evaluación bloqueante no podía asignar a nadie, y no había
 * forma de arreglarlo desde el portal. En los datos de la base viva eso dejaba a 100 de 156
 * personas sin poder cubrir un turno.</p>
 *
 * <p>Misma forma que la de Documentos, y por la misma razón: <b>arriba se recorren los requisitos,
 * no los registros</b>. Al revés, el requisito que nadie cubrió no tendría fila que lo represente,
 * y ése es justo el que hay que ver.</p>
 *
 * <p><b>El resultado manda sobre la fecha.</b> Una evaluación pendiente o no aprobada, aunque
 * tenga vencimiento futuro, no cubre nada: es la misma regla que el servidor aplica al asignar, y
 * decir «Al día» sería afirmar lo contrario de lo que va a responder.</p>
 */
@Component({
  selector: 'app-employee-evaluations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GiEmptyState, GiSelect],
  template: `
    <section class="evals">
      @if (requirements().length === 0) {
        <gi-empty-state
          variant="missing-prerequisite"
          title="Esta organización todavía no exige ninguna evaluación"
          description="Los requisitos de evaluación se definen en Catálogos, por organización. Mientras no haya ninguno, ninguna evaluación impide asignar a nadie."
          link="/catalogos"
          actionLabel="Ir a Catálogos"
        />
      } @else {
        <p class="evals__note">
          {{ requirements().length }}
          {{ requirements().length === 1 ? 'evaluación exigida' : 'evaluaciones exigidas' }} por esta
          organización. Se considera «por vencer» lo que caduca en {{ expiringWithinDays() }} días o
          menos.
        </p>

        <ul class="evals__list">
          @for (row of rows(); track row.code) {
            <li class="req" [class]="'req--' + tone(row.state)">
              <span class="req__body">
                <span class="req__name">
                  {{ row.label }}
                  @if (!row.isBlocking) {
                    <span class="req__soft">no bloquea</span>
                  }
                </span>
                <span class="req__detail">{{ detail(row.state, row.expiresDate, row.result) }}</span>
              </span>
              <span class="req__state">{{ stateLabel(row.state) }}</span>
            </li>
          }
        </ul>
      }

      <div class="evals__block">
        <header class="evals__head">
          <h3 class="evals__kicker">EVALUACIONES REGISTRADAS</h3>
          @if (canWrite() && !editorOpen()) {
            <button class="gi-button" type="button" [disabled]="saving()" (click)="openCreate()">
              Registrar evaluación
            </button>
          }
        </header>

        @if (activas().length === 0) {
          <p class="evals__note">
            No hay ninguna evaluación registrada. Mientras falte una que la organización exija, la
            persona no se puede asignar a una posición.
          </p>
        } @else {
          <ul class="evals__plain">
            @for (item of activas(); track item.idEmployeeEvaluation) {
              <li class="row">
                <span class="row__body">
                  <span class="row__name">{{ categoryLabel(item) }}</span>
                  <span class="row__detail">
                    {{ resultLabel(item.result) }} · evaluada el
                    {{ formatDate(item.evaluatedDate) }} ·
                    {{ item.expiresDate ? 'vence el ' + formatDate(item.expiresDate) : 'sin vencimiento' }}
                    @if (item.certificateNumber) {
                      · folio {{ item.certificateNumber }}
                    }
                  </span>
                </span>
                @if (canWrite()) {
                  <span class="row__actions">
                    <button class="gi-button" type="button" [disabled]="saving()" (click)="openEdit(item)">
                      Editar
                    </button>
                    <button class="gi-button" type="button" [disabled]="saving()" (click)="deactivate.emit(item.idEmployeeEvaluation)">
                      Quitar
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
        }

        @if (editorOpen()) {
          <form class="form" [formGroup]="form" (ngSubmit)="submit()">
            <h4 class="evals__kicker">
              {{ editing() ? 'EDITAR EVALUACIÓN' : 'NUEVA EVALUACIÓN' }}
            </h4>

            <div class="form__row">
              <div class="field">
                <span class="field__label">TIPO</span>
                <gi-select
                  label="Tipo de evaluación"
                  placeholder="Elige el tipo"
                  [options]="typeOptions()"
                  [value]="form.controls.evaluationType.value"
                  [disabled]="saving()"
                  (valueChange)="form.controls.evaluationType.setValue($event)"
                />
              </div>
              <div class="field">
                <span class="field__label">RESULTADO</span>
                <gi-select
                  label="Resultado de la evaluación"
                  placeholder="Elige el resultado"
                  [options]="resultOptions"
                  [value]="form.controls.result.value"
                  [disabled]="saving()"
                  (valueChange)="form.controls.result.setValue($event)"
                />
              </div>
              <label class="field">
                <span class="field__label">FECHA DE EVALUACIÓN</span>
                <input type="date" formControlName="evaluatedDate" />
              </label>
              <label class="field">
                <span class="field__label">VENCIMIENTO · OPCIONAL</span>
                <input type="date" formControlName="expiresDate" [min]="form.controls.evaluatedDate.value" />
              </label>
              <label class="field">
                <span class="field__label">FOLIO O CERTIFICADO · OPCIONAL</span>
                <input type="text" formControlName="certificateNumber" maxlength="80" />
              </label>
              <label class="field field--wide">
                <span class="field__label">NOTAS · OPCIONAL</span>
                <textarea rows="2" formControlName="notes" maxlength="1000"></textarea>
              </label>
            </div>

            <p class="evals__note">
              Sólo una evaluación <strong>aprobada</strong> —o aprobada con observaciones— y vigente
              cubre el requisito. Con cualquier otro resultado la persona sigue sin poder asignarse.
            </p>

            @if (problem()) {
              <p class="form__problem" role="alert">{{ problem() }}</p>
            }

            <footer class="form__footer">
              <button class="gi-button" type="button" [disabled]="saving()" (click)="close()">
                Cancelar
              </button>
              <button class="gi-button gi-button--primary" type="submit" [disabled]="saving()">
                {{ saving() ? 'Guardando…' : 'Guardar evaluación' }}
              </button>
            </footer>
          </form>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }

    .evals { display: flex; flex-direction: column; gap: 0.85rem; }

    .evals__note { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    .evals__kicker {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .evals__list, .evals__plain {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .evals__block {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--gestia-border);
    }

    .evals__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }

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

    .req__soft {
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .req__detail { color: var(--gestia-muted); font-size: 11.5px; }

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

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--gestia-border);
    }

    .row:last-child { border-bottom: 0; }

    .row__body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
    .row__name { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .row__detail { color: var(--gestia-muted); font-size: 11.5px; }
    .row__actions { display: flex; flex: none; gap: 0.35rem; }

    .form { display: flex; flex-direction: column; gap: 0.6rem; }

    .form__row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: 0.6rem;
    }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
    .field--wide { grid-column: 1 / -1; }

    .field__label {
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .field input, .field textarea {
      width: 100%;
      padding: 0.4rem 0.55rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12px;
    }

    .field input:focus-visible, .field textarea:focus-visible {
      outline: 2px solid var(--gestia-cyan);
      outline-offset: 1px;
    }

    .form__problem { margin: 0; color: var(--gestia-danger); font-size: 11.5px; }

    .form__footer { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `,
})
export class EmployeeEvaluations {
  private readonly formBuilder = inject(FormBuilder);

  readonly requirements = input.required<readonly EligibilityRequirement[]>();
  readonly evaluations = input.required<readonly EmployeeEvaluation[]>();
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
  readonly saving = input(false);

  readonly save = output<EmployeeEvaluationFormValue>();
  readonly deactivate = output<string>();

  protected readonly stateLabel = evaluationStateLabel;
  protected readonly tone = evaluationStateTone;
  protected readonly typeLabel = evaluationTypeLabel;

  /** El nombre de la categoría del catálogo, con el enum heredado de respaldo. */
  protected categoryLabel(evaluation: { readonly evaluationCategoryName: string | null; readonly evaluationType: string }): string {
    return evaluation.evaluationCategoryName ?? evaluationTypeLabel(evaluation.evaluationType);
  }

  /** El nombre de la categoría del catálogo, con el enum heredado de respaldo. */

  protected readonly resultLabel = evaluationResultLabel;
  protected readonly formatDate = formatOperationalDate;

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<EmployeeEvaluation | null>(null);
  protected readonly problem = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    evaluationType: ['', [Validators.required]],
    result: ['', [Validators.required]],
    evaluatedDate: ['', [Validators.required]],
    expiresDate: [''],
    certificateNumber: ['', [Validators.maxLength(80)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  protected readonly rows = computed(() =>
    employeeEvaluationRequirementRows(
      this.requirements(),
      this.evaluations(),
      this.today(),
      this.expiringWithinDays(),
    ),
  );

  protected readonly activas = computed(() => this.evaluations().filter((item) => item.active));

  /** Los tipos, con los que esta organización exige al principio y marcados. */
  protected readonly typeOptions = computed<readonly GiSelectOption[]>(() =>
    evaluationTypeOptions(this.requirements(), this.categories()).map((tipo) => ({
      value: tipo.code,
      label: tipo.label,
      hint: tipo.isRequired ? 'Lo exige esta organización' : undefined,
    })),
  );

  protected readonly resultOptions: readonly GiSelectOption[] = RESULTADOS.map((value) => ({
    value,
    label: evaluationResultLabel(value),
    hint: value === 'Approved' || value === 'ApprovedWithObservations' ? 'Cubre el requisito' : undefined,
  }));

  protected openCreate(): void {
    this.editing.set(null);
    this.problem.set('');
    this.form.reset({
      evaluationType: '',
      result: '',
      // El día operativo del servidor, no `new Date()`: en UTC el día mexicano empieza seis horas
      // antes y el formulario propondría mañana por la tarde.
      evaluatedDate: this.today(),
      expiresDate: '',
      certificateNumber: '',
      notes: '',
    });
    this.editorOpen.set(true);
  }

  protected openEdit(item: EmployeeEvaluation): void {
    this.editing.set(item);
    this.problem.set('');
    this.form.reset({
      evaluationType: item.evaluationType,
      result: item.result,
      evaluatedDate: item.evaluatedDate,
      expiresDate: item.expiresDate ?? '',
      certificateNumber: item.certificateNumber ?? '',
      notes: item.notes ?? '',
    });
    this.editorOpen.set(true);
  }

  protected close(): void {
    if (this.saving()) return;
    this.editorOpen.set(false);
    this.editing.set(null);
    this.problem.set('');
  }

  protected submit(): void {
    if (this.saving()) return;

    this.form.markAllAsTouched();
    const valor = this.form.getRawValue();

    if (!valor.evaluationType || !valor.result || !valor.evaluatedDate) {
      this.problem.set('El tipo, el resultado y la fecha de evaluación son obligatorios.');
      return;
    }

    if (valor.expiresDate && valor.expiresDate < valor.evaluatedDate) {
      this.problem.set('El vencimiento no puede ser anterior a la fecha de evaluación.');
      return;
    }

    this.problem.set('');
    this.save.emit({
      idEmployeeEvaluation: this.editing()?.idEmployeeEvaluation ?? null,
      evaluationType: valor.evaluationType,
      result: valor.result,
      evaluatedDate: valor.evaluatedDate,
      expiresDate: valor.expiresDate || null,
      certificateNumber: valor.certificateNumber.trim() || null,
      notes: valor.notes.trim() || null,
    });
  }

  /** Por qué el requisito está como está, con el vocabulario de una evaluación. */
  protected detail(state: string, expires: string | null, result: string | null): string {
    if (state === 'Missing') {
      return 'No hay ninguna evaluación registrada de este tipo.';
    }

    if (state === 'Rejected') {
      return 'La evaluación registrada no se aprobó, así que el requisito sigue sin cubrirse.';
    }

    if (state === 'Unvalidated') {
      return result === 'Inconclusive'
        ? 'La evaluación quedó como no concluyente, así que no cubre el requisito.'
        : 'La evaluación está registrada pero sigue pendiente, así que todavía no cubre el requisito.';
    }

    if (!expires) {
      return 'Aprobada, sin fecha de vencimiento.';
    }

    return state === 'Expired'
      ? `Venció el ${formatOperationalDate(expires)}.`
      : `Vence el ${formatOperationalDate(expires)}.`;
  }
}
