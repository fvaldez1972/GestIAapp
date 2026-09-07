import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { formatOperationalDate } from '../../../shared/util/operational-date';
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
 * <p>No lleva botón de carga: el archivo se sube en el bloque de expediente que va debajo, en la
 * misma pestaña. Dos botones para una sola cosa es el par duplicado que esta pantalla venía
 * arrastrando.</p>
 */
@Component({
  selector: 'app-employee-documents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState],
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
        <p class="docs__note">
          {{ requirements().length }}
          {{ requirements().length === 1 ? 'requisito definido' : 'requisitos definidos' }} por esta
          organización, sobre los tipos de documento que el sistema reconoce. Se considera «por
          vencer» lo que caduca en {{ expiringWithinDays() }} días o menos.
        </p>

        <ul class="docs__list">
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

        @if (extras().length) {
          <div class="docs__extra">
            <h3 class="docs__kicker">OTROS DOCUMENTOS CARGADOS</h3>
            <p class="docs__note">
              Están en el expediente pero esta organización no los exige. No cuentan para la
              vigencia.
            </p>
            <ul class="docs__plain">
              @for (extra of extras(); track extra.idEmployeeDocument) {
                <li>{{ typeLabel(extra.documentType) }} · {{ expiry(extra.expiresDate) }}</li>
              }
            </ul>
          </div>
        }
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

    .req__body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }

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
  readonly requirements = input.required<readonly EligibilityRequirement[]>();
  readonly documents = input.required<readonly EmployeeDocument[]>();
  /** El día operativo del servidor. No se lee del reloj del navegador. */
  readonly today = input.required<string>();
  readonly expiringWithinDays = input(30);

  protected readonly stateLabel = requirementStateLabel;
  protected readonly tone = requirementStateTone;
  protected readonly typeLabel = documentTypeLabel;

  protected readonly rows = computed(() =>
    employeeRequirementRows(
      this.requirements(),
      this.documents(),
      this.today(),
      this.expiringWithinDays(),
    ),
  );

  /** Lo cargado que nadie exige. Se muestra aparte para que no se confunda con un requisito. */
  protected readonly extras = computed(() => {
    const exigidos = new Set(
      this.requirements()
        .map((item) => (item.requiredDocumentType ?? '').toLowerCase())
        .filter(Boolean),
    );

    return this.documents().filter(
      (document) => document.active && !exigidos.has(document.documentType.toLowerCase()),
    );
  });

  protected expiry(date: string | null): string {
    return date ? `vence el ${formatOperationalDate(date)}` : 'sin fecha de vencimiento';
  }

  protected detail(state: string, expires: string | null): string {
    if (state === 'Missing') {
      return 'No hay documento cargado para este requisito.';
    }

    if (!expires) {
      return 'Cargado, sin fecha de vencimiento.';
    }

    return state === 'Expired'
      ? `Venció el ${formatOperationalDate(expires)}.`
      : `Vence el ${formatOperationalDate(expires)}.`;
  }
}
