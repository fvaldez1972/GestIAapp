import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { GiSelect, GiSelectOption } from '../../../shared/ui/gi-select/gi-select';

/**
 * La barra de contexto.
 *
 * <b>Es el único lugar de la aplicación donde vive el contexto de organización.</b> Antes el
 * cambio de organización estaba en un `<select>` nativo de la topbar, mezclado con el botón de
 * perfil, y cada pantalla de módulo volvía a preguntar por la organización con su propio selector.
 * De ahí venía que la franja dijera una organización y la pantalla mostrara otra.
 *
 * Lleva la organización activa y las acciones de cambiar y salir, y nada más.
 *
 * <b>La fecha operativa se retiró de aquí el 6 de septiembre de 2026.</b> Era un rótulo del cromo:
 * se repetía igual en las quince pantallas y no decía nada sobre lo que se estaba mirando. La
 * fecha se queda donde es contenido —la barra de día de Asistencia, la de semana de Planeación, el
 * subtítulo de Inicio—, porque ahí sí dice contra qué día o qué semana se está trabajando.
 *
 * El día operativo lo sigue diciendo el servidor y se sigue usando para todos los cálculos: doce
 * pantallas inyectan <c>SystemInfoService</c> por su cuenta. Esta barra nunca fue su fuente, sólo
 * uno más de sus lectores.
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
            (opened)="refrescarOrganizaciones()"
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
    </div>
  `,
  styles: `
    /* La topbar que va debajo es pegajosa con z-index 40, y por orden de documento ganaba: la
       lista del selector se abría por detrás de ella y el clic no llegaba. Se descubrió al
       verificar en el navegador contra la demo, no en las pruebas. El 46 la deja por encima de la
       topbar y por debajo del sidebar móvil, que es 50. */
    :host {
      display: block;
      position: relative;
      z-index: 46;
    }

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

    /* El margen automático lo llevaba la fecha, que era el último elemento. Sin ella, es el botón
       el que tiene que empujarse al otro extremo en lugar de quedarse pegado al selector. */
    .context-bar__exit {
      margin-left: auto;
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
    }
  `,
})
export class ContextBar {
  protected readonly auth = inject(AuthService);

  /**
   * Vuelve a pedir la lista al desplegarla.
   *
   * <p>La lista del super admin se cargaba <b>una sola vez</b>, al construir el shell, asi que una
   * organizacion dada de alta despues no aparecia aqui hasta recargar la pagina entera. Peor aun,
   * no habia nada que lo delatara: el desplegable se abria con normalidad y simplemente le faltaba
   * una.</p>
   *
   * <p>Si la peticion falla no se enseña error ni se vacia nada: se quedan las opciones que ya
   * habia. Quien abrio el desplegable queria cambiar de organizacion, y dejarlo sin lista porque el
   * refresco no llego seria peor que enseñarle una que quiza no incluye la ultima.</p>
   */
  protected refrescarOrganizaciones() {
    if (!this.auth.isPlatformAdmin()) {
      return;
    }

    this.auth.loadPlatformOrganizations().subscribe({ error: () => undefined });
  }

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
}
