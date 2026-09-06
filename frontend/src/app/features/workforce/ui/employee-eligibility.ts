import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  EmployeeEligibility,
  eligibilityDetail,
  eligibilityTitle,
  employeeEligibility,
} from '../data-access/employee-list.models';

/**
 * La franja de elegibilidad de la ficha.
 *
 * <p><b>El bosquejo describía un defecto que ya no existe.</b> Dibujaba «no elegible porque las dos
 * cadenas difieren en una palabra»; desde F1 la comparación es por <b>identificador de catálogo</b>,
 * así que una diferencia de redacción ya no bloquea a nadie.</p>
 *
 * <p>Lo que sí pasa, y nadie ve, es lo contrario: <b>un nulo no bloquea</b>. Quien no tiene puesto
 * de catálogo se puede asignar igual, con el expediente incompleto. «No sabemos su puesto» no es
 * «no cumple el perfil», y tratarlos igual paralizaría a gente que sí puede trabajar; pero
 * callarlo deja pasar expedientes que nadie comprobó.</p>
 */
@Component({
  selector: 'app-employee-eligibility',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="band" [class]="'band--' + state()">
      <p class="band__head">
        <span class="band__badge">{{ title() }}</span>
        @if (positionName()) {
          <span class="band__where">para {{ positionName() }}</span>
        }
      </p>

      <dl class="band__pair">
        <div class="band__field">
          <dt>PUESTO DE LA PERSONA</dt>
          <dd [class.band__missing]="!employeeJobPosition()">
            {{ employeeJobPosition() || 'Sin puesto del catálogo' }}
          </dd>
        </div>
        @if (positionJobPosition()) {
          <div class="band__field">
            <dt>PUESTO QUE PIDE LA POSICIÓN</dt>
            <dd>{{ positionJobPosition() }}</dd>
          </div>
        }
      </dl>

      <p class="band__detail">{{ detail() }}</p>

      @if (state() !== 'eligible') {
        <p class="band__actions">
          <button class="band__action" type="button" (click)="fixJobPosition.emit()">
            {{ state() === 'blocked' ? 'Corregir el puesto' : 'Asignar un puesto del catálogo' }}
          </button>
          <button class="band__action" type="button" (click)="openCatalog.emit()">
            Ver el catálogo de puestos
          </button>
        </p>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .band {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .band--blocked { border-color: var(--gestia-danger); }
    .band--incomplete { border-color: var(--gestia-warning); }
    .band--eligible { border-color: var(--gestia-success); }

    .band__head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; margin: 0; }

    /* El estado se lee: la palabra va dentro, no sólo el color del borde. */
    .band__badge {
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .band--blocked .band__badge { border-color: var(--gestia-danger); color: var(--gestia-danger); }
    .band--incomplete .band__badge { border-color: var(--gestia-warning); color: var(--gestia-warning); }
    .band--eligible .band__badge { border-color: var(--gestia-success); color: var(--gestia-success); }

    .band__where { color: var(--gestia-muted); font-size: 12px; }

    .band__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem 1rem; margin: 0; }

    .band__field { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }

    .band__field dt {
      color: var(--gestia-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
    }

    .band__field dd { margin: 0; color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }

    .band__missing { color: var(--gestia-warning); }

    .band__detail { margin: 0; color: var(--gestia-text); font-size: 12px; }

    .band__actions { display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 0; }

    .band__action {
      height: var(--gestia-control-height);
      padding: 0 0.8rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .band__action:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    @media (width < 45rem) {
      .band__pair { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class EmployeeEligibilityBand {
  /** El puesto de catálogo de la persona. Nulo cuando no lo tiene. */
  readonly employeeJobPositionId = input<string | null>(null);
  readonly employeeJobPosition = input<string | null>(null);
  /** El puesto que pide la posición, cuando se mira contra una. */
  readonly positionJobPositionId = input<string | null>(null);
  readonly positionJobPosition = input<string | null>(null);
  readonly positionName = input<string | null>(null);

  readonly fixJobPosition = output<void>();
  readonly openCatalog = output<void>();

  protected readonly state = computed<EmployeeEligibility>(() =>
    employeeEligibility(this.positionJobPositionId(), this.employeeJobPositionId()),
  );

  protected readonly title = computed(() => eligibilityTitle(this.state()));

  protected readonly detail = computed(() =>
    eligibilityDetail(this.state(), this.employeeJobPosition(), this.positionJobPosition()),
  );
}
