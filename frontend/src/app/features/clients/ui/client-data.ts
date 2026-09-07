import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatOperationalDate, formatOperationalInstant } from '../../../shared/util/operational-date';
import { ClientListItem, ClientSite } from '../data-access/client.models';

/**
 * La pestaña de Datos.
 *
 * <p>El bloque de ubicación dice «Estado · Municipio» y no «Zona»: <b>la zona no existe en el
 * modelo</b> —ni el cliente ni la sede la tienen— y lo que se muestra sale de la sede principal,
 * que sí existe. Se rotula como tal para que nadie lo confunda con un dato del cliente.</p>
 */
@Component({
  selector: 'app-client-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="data">
      <section class="data__block">
        <h3 class="data__kicker">IDENTIFICACIÓN</h3>
        <dl class="data__grid data__grid--two">
          <div class="data__field data__field--wide">
            <dt>RAZÓN SOCIAL</dt>
            <dd>{{ client().legalName }}</dd>
          </div>
          <div class="data__field">
            <dt>NOMBRE CORTO</dt>
            <dd>{{ client().tradeName || 'Sin nombre comercial' }}</dd>
          </div>
          <div class="data__field">
            <dt>RFC</dt>
            <dd>{{ client().rfc }}</dd>
          </div>
        </dl>
      </section>

      <section class="data__block">
        <h3 class="data__kicker">UBICACIÓN DE LA SEDE PRINCIPAL</h3>
        @if (client().mainSiteName) {
          <dl class="data__grid data__grid--three">
            <div class="data__field">
              <dt>SEDE</dt>
              <dd>{{ client().mainSiteName }}</dd>
            </div>
            <div class="data__field">
              <dt>ESTADO</dt>
              <dd>{{ client().mainSiteState }}</dd>
            </div>
            <div class="data__field">
              <dt>MUNICIPIO</dt>
              <dd>{{ client().mainSiteMunicipality }}</dd>
            </div>
          </dl>
          <p class="data__note">Estado y municipio salen de la sede. No se administran aquí.</p>
        } @else {
          <p class="data__missing">
            No hay ubicación porque el cliente todavía no tiene sede. La sede es lo que permite
            crearle servicios.
          </p>
        }
      </section>

      <section class="data__block">
        <h3 class="data__kicker">REGISTRO</h3>
        <dl class="data__grid data__grid--three">
          <div class="data__field">
            <dt>ALTA</dt>
            <dd>{{ createdAt() }}</dd>
          </div>
          <div class="data__field">
            <dt>SEDES</dt>
            <dd [class.data__warning]="client().siteCount === 0">{{ siteLabel() }}</dd>
          </div>
          <div class="data__field">
            <dt>SERVICIOS</dt>
            <dd>{{ client().serviceCount }}</dd>
          </div>
        </dl>
      </section>

      @if (mainSite(); as site) {
        <p class="data__main">
          <span class="data__main-title">Sede principal · {{ site.name }}</span>
          <span class="data__main-body">{{ address(site) }}</span>
        </p>
      }
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

    .data__grid { display: grid; gap: 0.75rem 1rem; margin: 0; }
    .data__grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .data__grid--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }

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

    .data__warning { color: var(--gestia-warning); }

    .data__note, .data__missing { margin: 0; color: var(--gestia-muted); font-size: 11.5px; }
    .data__missing { color: var(--gestia-warning); font-weight: 600; }

    .data__main {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      margin: 0;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .data__main-title { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .data__main-body { color: var(--gestia-muted); font-size: 12px; }

    @media (width < 45rem) {
      .data__grid--two, .data__grid--three { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class ClientData {
  readonly client = input.required<ClientListItem>();
  readonly sites = input<readonly ClientSite[]>([]);

  protected readonly createdAt = computed(() =>
    formatOperationalInstant(this.client().createdAt).split(' a las ')[0] ||
    formatOperationalDate(this.client().createdAt.slice(0, 10)),
  );

  /** Cero sedes se dice con palabras, no con un cero que parecería estar en orden. */
  protected readonly siteLabel = computed(() =>
    this.client().siteCount === 0 ? 'Ninguna' : String(this.client().siteCount),
  );

  protected readonly mainSite = computed(() =>
    this.sites().find((site) => site.name === this.client().mainSiteName) ?? this.sites()[0],
  );

  protected address(site: ClientSite): string {
    return [
      [site.street, site.exteriorNumber].filter(Boolean).join(' '),
      site.neighborhood,
      site.municipality,
      site.state,
      site.postalCode,
    ]
      .filter((part) => !!part)
      .join(', ');
  }
}
