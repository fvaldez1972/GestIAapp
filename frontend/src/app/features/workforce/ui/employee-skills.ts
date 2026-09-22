import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GiCatalogCreation, GiCatalogOption, GiCatalogPicker } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import { EligibilityRequirement, EmployeeSkill } from '../../catalogs/data-access/catalog.models';
import {
  employeeSkillRequirementRows,
  skillStateLabel,
  skillStateTone,
} from '../data-access/employee-list.models';

/** Lo que el formulario entrega. La pantalla decide con qué endpoint guardarlo. */
export type EmployeeSkillFormValue = {
  readonly idEmployeeSkill: string | null;
  readonly idSkillCatalogItem: string;
  readonly acquiredDate: string | null;
  readonly expiresDate: string | null;
  readonly notes: string | null;
};

/**
 * La pestaña de Experiencia.
 *
 * <p><b>Cierra una trampa, no agrega una función.</b> Desde el 7 de septiembre de 2026 se podía
 * crear una regla de elegibilidad de tipo experiencia —que el servidor evalúa de verdad y que, si es
 * bloqueante, detiene la publicación de una semana entera— sin que existiera ninguna pantalla para
 * otorgarle la experiencia a una persona. Quien caía en ella sólo podía salir desactivando la regla,
 * que es lo contrario de lo que quería al crearla, y lo descubría al publicar, cuando ya no hay
 * tiempo.</p>
 *
 * <p>Las experiencias se eligen <b>del catálogo, por identificador</b>, y se pueden crear al vuelo
 * si faltan. Comparar por nombre aceptaría «Manejo de CCTV» y «manejo de cctv» como dos cosas
 * distintas, y la regla dejaría de cumplirse sin que nada avisara.</p>
 *
 * <p><b>El vencimiento se ve</b> porque la evaluación de elegibilidad ya lo respeta: una experiencia
 * caducada no cubre su requisito, y esconderlo dejaría a alguien creyendo que sí.</p>
 */
@Component({
  selector: 'app-employee-skills',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GiCatalogPicker],
  template: `
    <section class="skills">
      @if (requirements().length === 0) {
        <p class="skills__note">
          Esta organización no exige ninguna experiencia. Las que se registren aquí no impiden
          asignar a nadie, pero sirven para encontrar a quién puede cubrir un turno.
        </p>
      } @else {
        <p class="skills__note">
          {{ requirements().length }}
          {{ requirements().length === 1 ? 'experiencia exigida' : 'experiencias exigidas' }} por esta
          organización. Se considera «por vencer» lo que caduca en {{ expiringWithinDays() }} días o
          menos.
        </p>

        <ul class="skills__list">
          @for (row of rows(); track row.code) {
            <li class="req" [class]="'req--' + tone(row.state)">
              <span class="req__body">
                <span class="req__name">
                  {{ row.label }}
                  @if (!row.isBlocking) {
                    <span class="req__soft">no bloquea</span>
                  }
                </span>
                <span class="req__detail">{{ detail(row.state, row.expiresDate) }}</span>
              </span>
              <span class="req__state">{{ stateLabel(row.state) }}</span>
            </li>
          }
        </ul>
      }

      <div class="skills__block">
        <header class="skills__head">
          <h3 class="skills__kicker">EXPERIENCIA ACREDITADAS</h3>
          @if (canWrite() && !editorOpen()) {
            <button class="gi-button" type="button" [disabled]="saving()" (click)="openCreate()">
              Acreditar experiencia
            </button>
          }
        </header>

        @if (activas().length === 0) {
          <p class="skills__note">
            No hay ninguna experiencia acreditada. Si esta organización exige alguna, la persona no se
            puede asignar hasta que se registre.
          </p>
        } @else {
          <ul class="skills__plain">
            @for (item of activas(); track item.idEmployeeSkill) {
              <li class="row">
                <span class="row__body">
                  <span class="row__name">{{ item.skillName }}</span>
                  <span class="row__detail">
                    {{ item.acquiredDate ? 'acreditada el ' + formatDate(item.acquiredDate) : 'sin fecha de acreditación' }}
                    ·
                    {{ item.expiresDate ? 'vence el ' + formatDate(item.expiresDate) : 'sin vencimiento' }}
                  </span>
                </span>
                @if (canWrite()) {
                  <span class="row__actions">
                    <button class="gi-button" type="button" [disabled]="saving()" (click)="openEdit(item)">
                      Editar
                    </button>
                    <button class="gi-button" type="button" [disabled]="saving()" (click)="deactivate.emit(item.idEmployeeSkill)">
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
            <h4 class="skills__kicker">
              {{ editing() ? 'EDITAR EXPERIENCIA' : 'NUEVA EXPERIENCIA' }}
            </h4>

            <div class="form__row">
              <div class="field field--wide">
                <span class="field__label">EXPERIENCIA</span>
                @if (editing()) {
                  <p class="field__fixed">{{ editing()!.skillName }}</p>
                } @else {
                  <gi-catalog-picker
                    label="Experiencia"
                    catalogLabel="el catálogo de experiencias"
                    inputId="es-experiencia"
                    [options]="catalogSkills()"
                    [value]="form.controls.idSkillCatalogItem.value"
                    [canWrite]="canWrite()"
                    [disabled]="saving()"
                    (valueChange)="form.controls.idSkillCatalogItem.setValue($event)"
                    (create)="createSkill.emit($event)"
                  />
                }
              </div>
              <label class="field">
                <span class="field__label">ACREDITADA EL · OPCIONAL</span>
                <input type="date" formControlName="acquiredDate" />
              </label>
              <label class="field">
                <span class="field__label">VENCIMIENTO · OPCIONAL</span>
                <input type="date" formControlName="expiresDate" [min]="form.controls.acquiredDate.value" />
              </label>
              <label class="field field--wide">
                <span class="field__label">NOTAS · OPCIONAL</span>
                <textarea rows="2" formControlName="notes" maxlength="1000"></textarea>
              </label>
            </div>

            <p class="skills__note">
              Una experiencia vencida deja de cubrir su requisito el día siguiente al vencimiento. Sin
              fecha, se considera que no caduca.
            </p>

            @if (problem()) {
              <p class="form__problem" role="alert">{{ problem() }}</p>
            }

            <footer class="form__footer">
              <button class="gi-button" type="button" [disabled]="saving()" (click)="close()">
                Cancelar
              </button>
              <button class="gi-button gi-button--primary" type="submit" [disabled]="saving()">
                {{ saving() ? 'Guardando…' : 'Guardar experiencia' }}
              </button>
            </footer>
          </form>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }

    .skills { display: flex; flex-direction: column; gap: 0.85rem; }

    .skills__note { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    .skills__kicker {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
    }

    .skills__list, .skills__plain {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .skills__block {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--gestia-border);
    }

    .skills__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }

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

    /* Al editar, la experiencia no se cambia: se retira y se acredita la otra. */
    .field__fixed { margin: 0; color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }

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
export class EmployeeSkills {
  private readonly formBuilder = inject(FormBuilder);

  readonly requirements = input.required<readonly EligibilityRequirement[]>();
  readonly skills = input.required<readonly EmployeeSkill[]>();
  /** Las experiencias activas del catálogo de la organización. */
  readonly catalogSkills = input.required<readonly GiCatalogOption[]>();
  /** El día operativo del servidor. No se lee del reloj del navegador. */
  readonly today = input.required<string>();
  readonly expiringWithinDays = input(30);
  readonly canWrite = input(false);
  readonly saving = input(false);

  readonly save = output<EmployeeSkillFormValue>();
  readonly deactivate = output<string>();
  readonly createSkill = output<GiCatalogCreation>();

  protected readonly stateLabel = skillStateLabel;
  protected readonly tone = skillStateTone;
  protected readonly formatDate = formatOperationalDate;

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<EmployeeSkill | null>(null);
  protected readonly problem = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    idSkillCatalogItem: ['', [Validators.required]],
    acquiredDate: [''],
    expiresDate: [''],
    notes: ['', [Validators.maxLength(1000)]],
  });

  protected readonly rows = computed(() =>
    employeeSkillRequirementRows(
      this.requirements(),
      this.skills(),
      this.today(),
      this.expiringWithinDays(),
    ),
  );

  protected readonly activas = computed(() => this.skills().filter((item) => item.active));

  protected openCreate(): void {
    this.editing.set(null);
    this.problem.set('');
    this.form.reset({ idSkillCatalogItem: '', acquiredDate: '', expiresDate: '', notes: '' });
    this.editorOpen.set(true);
  }

  protected openEdit(item: EmployeeSkill): void {
    this.editing.set(item);
    this.problem.set('');
    this.form.reset({
      idSkillCatalogItem: item.idSkillCatalogItem,
      acquiredDate: item.acquiredDate ?? '',
      expiresDate: item.expiresDate ?? '',
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

    const valor = this.form.getRawValue();

    if (!valor.idSkillCatalogItem) {
      this.problem.set('Elige la experiencia del catálogo.');
      return;
    }

    if (valor.acquiredDate && valor.expiresDate && valor.expiresDate < valor.acquiredDate) {
      this.problem.set('El vencimiento no puede ser anterior a la fecha de acreditación.');
      return;
    }

    this.problem.set('');
    this.save.emit({
      idEmployeeSkill: this.editing()?.idEmployeeSkill ?? null,
      idSkillCatalogItem: valor.idSkillCatalogItem,
      acquiredDate: valor.acquiredDate || null,
      expiresDate: valor.expiresDate || null,
      notes: valor.notes.trim() || null,
    });
  }

  protected detail(state: string, expires: string | null): string {
    if (state === 'Missing') {
      return 'Esta persona no tiene acreditada la experiencia que la regla exige.';
    }

    if (!expires) {
      return 'Acreditada, sin fecha de vencimiento.';
    }

    return state === 'Expired'
      ? `Venció el ${formatOperationalDate(expires)}.`
      : `Vence el ${formatOperationalDate(expires)}.`;
  }
}
