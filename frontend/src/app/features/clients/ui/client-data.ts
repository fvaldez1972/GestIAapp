import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatOperationalDate, formatOperationalInstant } from '../../../shared/util/operational-date';
import { ClientListItem, ClientZone } from '../data-access/client.models';

/**
 * La pestaña de Datos.
 *
 * <p>El bloque de ubicación dice «Estado · Municipio» y no «Zona»: <b>la zona no existe en el
 * modelo</b> —ni el cliente ni la zona la tienen— y lo que se muestra sale de la zona principal,
 * que sí existe. Se rotula como tal para que nadie lo confunda con un dato del cliente.</p>
 *
 * <p><b>La ficha empieza diciendo de quién es.</b> Antes lo primero era «RAZÓN SOCIAL» con su valor
 * debajo, del mismo tamaño y el mismo peso que los otros once campos: había que leer para saber a
 * qué registro pertenecía lo que se estaba viendo, y todo pesaba igual aunque no todo importe
 * igual.</p>
 */
@Component({
  selector: 'app-client-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="data">
      <header class="hero">
        <div class="hero__quien">
          <h3 class="hero__nombre">{{ client().legalName }}</h3>
          <p class="hero__alias">{{ client().tradeName || 'Sin nombre comercial' }}</p>
        </div>
        <div class="hero__sellos">
          <span class="sello">{{ client().codeClient }}</span>
          <span class="sello sello--rfc">{{ client().rfc }}</span>
          <span class="sello" [class.sello--ok]="client().active" [class.sello--baja]="!client().active">
            {{ client().active ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
      </header>

      <!--
        Las tres cifras que deciden si el cliente puede operar. El hueco se marca en el borde y no
        sólo en el número: se ve antes de leerlo, y debajo dice qué impide.
      -->
      <section class="cifras" aria-label="Resumen del cliente">
        <article class="cifra" [class.cifra--falta]="client().zoneCount === 0">
          <span class="cifra__dato">{{ zoneLabel() }}</span>
          <span class="cifra__que">{{ client().zoneCount === 1 ? 'Zona' : 'Zonas' }}</span>
          @if (client().zoneCount === 0) {
            <span class="cifra__pero">Sin zona no se le pueden crear servicios</span>
          }
        </article>
        <article class="cifra" [class.cifra--falta]="client().contactCount === 0">
          <span class="cifra__dato">{{ contactLabel() }}</span>
          <span class="cifra__que">{{ client().contactCount === 1 ? 'Contacto' : 'Contactos' }}</span>
          @if (client().contactCount === 0) {
            <span class="cifra__pero">Nadie a quien llamar si pasa algo</span>
          }
        </article>
        <article class="cifra">
          <span class="cifra__dato">{{ client().serviceCount }}</span>
          <span class="cifra__que">{{ client().serviceCount === 1 ? 'Servicio' : 'Servicios' }}</span>
        </article>
      </section>

      <section class="tarjeta">
        <!--
          «Dónde opera», no «la zona principal». El modelo no tiene jerarquía entre zonas: lo que
          se enseñaba como principal era la primera por nombre, y con dos zonas en sitios distintos
          eso afirma una ubicación que el cliente sólo tiene a medias.
        -->
        <h4 class="tarjeta__kicker">Dónde opera</h4>

        @if (client().zoneLocationCount > 1) {
          <p class="nota">
            Tiene {{ client().zoneCount }} zonas en {{ client().zoneLocationCount }} ubicaciones.
            Abajo va la primera por nombre; están todas en la pestaña de Zonas.
          </p>
        }

        @if (client().mainZoneName) {
          <dl class="campos campos--tres">
            <div class="campo">
              <dt>Zona</dt>
              <dd>{{ client().mainZoneName }}</dd>
            </div>
            <div class="campo">
              <dt>Estado</dt>
              <dd>{{ client().mainZoneState }}</dd>
            </div>
            <div class="campo">
              <dt>Municipio</dt>
              <dd>{{ client().mainZoneMunicipality }}</dd>
            </div>
          </dl>

          @if (mainZone(); as zone) {
            <p class="domicilio">
              <span class="domicilio__rotulo">Domicilio</span>
              <span class="domicilio__texto">{{ address(zone) }}</span>
            </p>
          }

        } @else {
          <p class="falta">
            No hay ubicación porque el cliente todavía no tiene zona. La zona es lo que permite
            crearle servicios.
          </p>
        }
      </section>

      <section class="tarjeta">
        <h4 class="tarjeta__kicker">Registro</h4>
        <dl class="campos campos--dos">
          <div class="campo">
            <dt>Alta</dt>
            <dd>{{ createdAt() }}</dd>
          </div>
          <div class="campo">
            <dt>Código</dt>
            <dd>{{ client().codeClient }}</dd>
          </div>
        </dl>
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }

    /* Dos columnas cuando hay sitio. La ficha se abre en una ventana de 1040 px y las tarjetas
       venian apiladas en una sola columna de 620 px, asi que sobraban 400 px de blanco a la derecha
       y la ficha no cabia de alto. En pantalla angosta vuelven a apilarse. */
    .data { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; align-content: start; }

    /* La cabecera y las cifras cruzan las dos columnas: son el encabezado de la ficha. */
    .hero, .cifras { grid-column: 1 / -1; }

    @media (width < 60rem) {
      .data { grid-template-columns: minmax(0, 1fr); }
    }

    .hero {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.6rem 1rem;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
    }

    .hero__quien { min-width: 0; }
    .hero__nombre { margin: 0; color: var(--gestia-navy); font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
    .hero__alias { margin: 0.1rem 0 0; color: var(--gestia-muted); font-size: 11.5px; }

    .hero__sellos { display: flex; flex-wrap: wrap; gap: 0.35rem; }

    .sello {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      padding: 0.15rem 0.5rem;
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .sello--rfc { color: var(--gestia-text); }

    .sello--ok {
      border-color: color-mix(in srgb, var(--gestia-success) 40%, var(--gestia-border));
      background: color-mix(in srgb, var(--gestia-success) 10%, var(--gestia-surface));
      color: var(--gestia-success);
    }

    .sello--baja {
      border-color: color-mix(in srgb, var(--gestia-muted) 40%, var(--gestia-border));
      color: var(--gestia-muted);
    }

    .cifras { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }

    .cifra {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      padding: 0.7rem 0.75rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .cifra__dato { color: var(--gestia-navy); font-size: 22px; font-weight: 700; line-height: 1.1; }

    .cifra__que {
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .cifra__pero { margin-top: 0.15rem; color: var(--gestia-warning); font-size: 10.5px; line-height: 1.35; }

    .cifra--falta {
      border-color: color-mix(in srgb, var(--gestia-warning) 45%, var(--gestia-border));
      background: color-mix(in srgb, var(--gestia-warning) 7%, var(--gestia-surface));
    }

    .cifra--falta .cifra__dato { color: var(--gestia-warning); font-size: 13px; }

    .tarjeta {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: var(--gestia-card-padding);
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .tarjeta__kicker {
      margin: 0;
      color: var(--gestia-navy);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .campos { display: grid; gap: 0.7rem 1rem; margin: 0; }
    .campos--dos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .campos--tres { grid-template-columns: repeat(3, minmax(0, 1fr)); }

    .campo { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }

    .campo dt {
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .campo dd { margin: 0; color: var(--gestia-text); font-size: 12.5px; font-weight: 600; overflow-wrap: anywhere; }

    .domicilio {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      margin: 0;
      padding: 0.6rem 0.7rem;
      border-left: 3px solid var(--gestia-cyan);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .domicilio__rotulo {
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .domicilio__texto { color: var(--gestia-text); font-size: 12px; }

    .nota { margin: 0; color: var(--gestia-muted); font-size: 11px; }
    .falta { margin: 0; color: var(--gestia-warning); font-size: 11.5px; font-weight: 600; line-height: 1.45; }

    @media (width < 45rem) {
      .cifras { grid-template-columns: minmax(0, 1fr); }
      .campos--dos, .campos--tres { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class ClientData {
  readonly client = input.required<ClientListItem>();
  readonly zones = input<readonly ClientZone[]>([]);

  protected readonly createdAt = computed(() =>
    formatOperationalInstant(this.client().createdAt).split(' a las ')[0] ||
    formatOperationalDate(this.client().createdAt.slice(0, 10)),
  );

  /** Cero zonas se dice con palabras, no con un cero que parecería estar en orden. */
  protected readonly zoneLabel = computed(() =>
    this.client().zoneCount === 0 ? 'Ninguna' : String(this.client().zoneCount),
  );

  /** Y lo mismo con los contactos: un cero se lee como un dato, «Ninguno» como un pendiente. */
  protected readonly contactLabel = computed(() =>
    this.client().contactCount === 0 ? 'Ninguno' : String(this.client().contactCount),
  );

  protected readonly mainZone = computed(() =>
    this.zones().find((zone) => zone.name === this.client().mainZoneName) ?? this.zones()[0],
  );

  protected address(zone: ClientZone): string {
    return [
      [zone.street, zone.exteriorNumber].filter(Boolean).join(' '),
      zone.neighborhood,
      zone.municipality,
      zone.state,
      zone.postalCode,
    ]
      .filter((part) => !!part)
      .join(', ');
  }
}
