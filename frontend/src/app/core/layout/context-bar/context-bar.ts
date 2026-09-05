import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { SystemInfoService } from '../../system/system-info.service';
import { GiSelect, GiSelectOption } from '../../../shared/ui/gi-select/gi-select';
import { formatOperationalDate } from '../../../shared/util/operational-date';

/**
 * La barra de contexto.
 *
 * <b>Es el único lugar de la aplicación donde vive el contexto de organización.</b> Antes el
 * cambio de organización estaba en un `<select>` nativo de la topbar, mezclado con el botón de
 * perfil, y cada pantalla de módulo volvía a preguntar por la organización con su propio selector.
 * De ahí venía que la franja dijera una organización y la pantalla mostrara otra.
 *
 * Lleva las tres cosas que el sistema cerrado le asigna: organización activa, fecha operativa, y
 * las acciones de cambiar y salir.
 *
 * <b>La fecha viene del servidor, no del navegador.</b> Calcularla aquí repondría el defecto que
 * el reloj operativo cerró en el backend: en UTC el día empieza entre seis y siete horas antes que
 * en México, así que a las 19:00 hora de Ciudad de México el navegador ya diría "mañana" y el
 * servidor seguiría diciendo "hoy". Si el servidor no responde, la barra dice que no sabe la
 * fecha; no inventa una.
 */
@Component({
  selector: 'app-context-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiSelect],
  template: `
    <div class="context-bar">
      <div class="context-bar__field">
        <span class="context-bar__label" id="context-bar-organization">Organización</span>
        @if (canSwitch()) {
          <gi-select
            class="context-bar__select"
            label="Cambiar de organización"
            [options]="options()"
            [value]="auth.activeOrganizationId()"
            [placeholder]="emptyLabel()"
            (valueChange)="auth.setActiveOrganization($event)"
          />
        } @else {
          <strong class="context-bar__value" aria-labelledby="context-bar-organization">
            {{ organizationName() }}
          </strong>
        }
      </div>

      @if (canLeave()) {
        <button
          class="context-bar__exit"
          type="button"
          aria-label="Salir de la organización"
          (click)="auth.clearActiveOrganization()"
        >
          Salir
        </button>
      }

      <div class="context-bar__field context-bar__field--date">
        <span class="context-bar__label" id="context-bar-date">Fecha operativa</span>
        <strong class="context-bar__value" aria-labelledby="context-bar-date">
          {{ operationDate() }}
        </strong>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }

    .context-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.6rem var(--gestia-page-gap);
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface);
    }

    .context-bar__field {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .context-bar__field--date {
      margin-left: auto;
      text-align: right;
    }

    .context-bar__label {
      color: var(--gestia-muted);
      font-size: 0.7rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .context-bar__value {
      color: var(--gestia-text);
      font-size: 0.9rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .context-bar__select { min-width: 16rem; max-width: 24rem; }

    .context-bar__exit {
      align-self: flex-end;
      min-height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      cursor: pointer;
    }

    .context-bar__exit:hover { border-color: var(--gestia-cyan-dark); }
    .context-bar__exit:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    @media (max-width: 40rem) {
      .context-bar { flex-wrap: wrap; gap: 0.6rem 1rem; }
      .context-bar__select { min-width: 0; width: 100%; }
      .context-bar__field--date { margin-left: auto; }
    }
  `,
})
export class ContextBar {
  protected readonly auth = inject(AuthService);
  private readonly systemInfo = inject(SystemInfoService);

  protected readonly options = computed<readonly GiSelectOption[]>(() =>
    this.auth.availableOrganizations().map((organization) => ({
      value: organization.idOrganization,
      label: organization.legalName,
      hint: organization.codeOrganization,
    })),
  );

  /**
   * Con un solo destino posible no hay nada que elegir, y un selector de una opción es ruido que
   * además sugiere que se puede cambiar a algo. El super admin siempre lo ve: para él, estar fuera
   * de toda organización es un estado válido al que tiene que poder volver.
   */
  protected readonly canSwitch = computed(
    () => this.auth.isPlatformAdmin() || this.auth.availableOrganizations().length > 1,
  );

  /**
   * Salir de la organización sin cerrar sesión sólo tiene sentido para el super admin. Un admin de
   * organización que "saliera" volvería a caer en la suya, así que el botón le prometería algo que
   * no puede cumplir.
   */
  protected readonly canLeave = computed(
    () => this.auth.isPlatformAdmin() && !!this.auth.activeOrganization(),
  );

  protected readonly emptyLabel = computed(() =>
    this.auth.availableOrganizations().length ? 'Sin organización' : 'Sin organizaciones',
  );

  protected readonly organizationName = computed(
    () => this.auth.activeOrganization()?.legalName ?? 'Sin organización',
  );

  protected readonly operationDate = computed(() =>
    formatOperationalDate(this.systemInfo.info()?.operationDate),
  );
}
