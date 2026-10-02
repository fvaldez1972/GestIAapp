import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { GiDate } from '../../../shared/ui/gi-date/gi-date';
import { FormsModule } from '@angular/forms';
import { PsychometricTest, TerminationExpirationGroup } from '../data-access/workforce.models';
import { formatOperationalDate } from '../../../shared/util/operational-date';

@Component({
  selector: 'app-employee-psychometric',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, GiDate],
  template: `
    <section class="psi">
      @if (vigente(); as prueba) {
        <p class="psi__estado">
          <span class="psi__check" aria-hidden="true">✓</span>
          <span class="psi__texto">Prueba psicométrica realizada y aprobada</span>
          <span class="psi__chip psi__chip--vigente">Vigente</span>
          <span class="psi__fecha">{{ fecha(prueba.approvedDate) }}</span>
        </p>
      } @else {
        <p class="psi__estado">
          <span class="psi__texto psi__texto--pendiente">Prueba psicométrica pendiente</span>
          @if (vencidas().length > 0) {
            <span class="psi__chip">Vencida por baja</span>
          }
        </p>

        @if (canWrite()) {
          <div class="psi__alta">
            <label class="field" for="psi-fecha">
              <span class="field__label">FECHA EN QUE SE REALIZÓ Y APROBÓ</span>
              <gi-date inputId="psi-fecha" [max]="today()" [ngModel]="approvedDate()" (ngModelChange)="approvedDate.set($event)" [ngModelOptions]="sueltos" />
            </label>
            <button
              class="psi__boton"
              type="button"
              [disabled]="saving() || !approvedDate()"
              (click)="registrar()"
            >
              {{ saving() ? 'Guardando…' : 'Marcar como aprobada' }}
            </button>
          </div>
        }
      }

      @if (problem()) {
        <p class="psi__problema" role="alert">{{ problem() }}</p>
      }

      @if (groups().length > 0) {
        <div class="psi__historial">
          <h4 class="psi__titulo">Vencido al causar baja</h4>

          @for (grupo of groups(); track grupo.endDate) {
            <section class="psi__grupo">
              <p class="psi__grupo-cabeza">
                <span class="psi__grupo-fecha">Baja del {{ fecha(grupo.endDate) }}</span>
                @if (grupo.terminationReason) {
                  <span class="psi__grupo-motivo">{{ grupo.terminationReason }}</span>
                }
              </p>

              @if (vacio(grupo)) {
                <p class="psi__grupo-vacio">Esta baja no venció ningún papel.</p>
              } @else {
                <ul class="psi__items">
                  @for (item of grupo.documents; track item.idItem) {
                    <li class="psi__item">
                      <span class="psi__item-tipo">Documento</span>
                      <span class="psi__item-nombre">{{ item.name }}</span>
                      <span class="psi__item-vigencia">
                        {{ item.originalExpiresDate ? 'vencía el ' + fecha(item.originalExpiresDate) : 'sin vigencia previa' }}
                      </span>
                    </li>
                  }
                  @for (item of grupo.evaluations; track item.idItem) {
                    <li class="psi__item">
                      <span class="psi__item-tipo">Evaluación</span>
                      <span class="psi__item-nombre">{{ item.name }}</span>
                      <span class="psi__item-vigencia">
                        {{ item.originalExpiresDate ? 'vencía el ' + fecha(item.originalExpiresDate) : 'sin vigencia previa' }}
                      </span>
                    </li>
                  }
                  @if (grupo.psychometricTestExpired) {
                    <li class="psi__item">
                      <span class="psi__item-tipo">Psicométrica</span>
                      <span class="psi__item-nombre">Prueba psicométrica</span>
                      <span class="psi__item-vigencia">
                        {{ grupo.psychometricTestApprovedDate ? 'aprobada el ' + fecha(grupo.psychometricTestApprovedDate) : '' }}
                      </span>
                    </li>
                  }
                </ul>
              }
            </section>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .psi { display: grid; gap: 0.6rem; }

    .psi__estado { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.45rem; margin: 0; }
    .psi__check { color: var(--gestia-success); font-size: 13px; font-weight: 700; }
    .psi__texto { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .psi__texto--pendiente { color: var(--gestia-muted); }
    .psi__fecha { color: var(--gestia-muted); font-size: 11.5px; }

    .psi__chip {
      padding: 0.05rem 0.4rem;
      border-radius: var(--gestia-radius-chip);
      background: var(--gestia-warning-soft);
      color: var(--gestia-text);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .psi__chip--vigente { background: var(--gestia-success-soft); }

    .psi__alta { display: flex; align-items: flex-end; gap: 0.55rem; flex-wrap: wrap; }

    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }

    .field__label {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .field input {
      box-sizing: border-box;
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

    .psi__boton {
      height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      cursor: pointer;
    }

    .psi__boton:disabled { opacity: 0.55; cursor: not-allowed; }
    .psi__boton:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .psi__problema { margin: 0; color: var(--gestia-danger); font-size: 11.5px; }

    .psi__historial { display: grid; gap: 0.5rem; }

    .psi__titulo {
      margin: 0;
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .psi__grupo {
      display: grid;
      gap: 0.3rem;
      padding: 0.45rem 0.6rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .psi__grupo-cabeza { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0; }
    .psi__grupo-fecha { color: var(--gestia-text); font-size: 12px; font-weight: 600; }
    .psi__grupo-motivo { color: var(--gestia-muted); font-size: 11.5px; }
    .psi__grupo-vacio { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }

    .psi__items { display: grid; gap: 0.2rem; margin: 0; padding: 0; list-style: none; }

    .psi__item {
      display: grid;
      grid-template-columns: 5.5rem 1fr auto;
      gap: 0.45rem;
      align-items: baseline;
    }

    .psi__item-tipo { color: var(--gestia-muted); font-size: 10.5px; text-transform: uppercase; }
    .psi__item-nombre { color: var(--gestia-text); font-size: 12px; min-width: 0; }
    .psi__item-vigencia { color: var(--gestia-muted); font-size: 11.5px; }

    @media (width < 45rem) {
      .psi__item { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class EmployeePsychometric {
  readonly tests = input<readonly PsychometricTest[]>([]);
  readonly groups = input<readonly TerminationExpirationGroup[]>([]);
  readonly today = input('');
  readonly canWrite = input(false);
  readonly saving = input(false);
  readonly problem = input('');

  readonly registrarPrueba = output<string>();

  protected readonly sueltos = { standalone: true };
  protected readonly approvedDate = signal('');

  protected readonly vigente = computed(() => this.tests().find((prueba) => prueba.isValid) ?? null);
  protected readonly vencidas = computed(() => this.tests().filter((prueba) => !prueba.isValid));

  protected fecha(valor: string): string {
    return formatOperationalDate(valor);
  }

  protected vacio(grupo: TerminationExpirationGroup): boolean {
    return (
      grupo.documents.length === 0 &&
      grupo.evaluations.length === 0 &&
      !grupo.psychometricTestExpired
    );
  }

  protected registrar(): void {
    if (this.approvedDate()) {
      this.registrarPrueba.emit(this.approvedDate());
    }
  }
}
