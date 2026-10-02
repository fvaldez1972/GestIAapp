import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  OverviewAttentionItem,
  attentionAction,
  attentionDetail,
  attentionTitle,
  attentionWhere,
} from '../data-access/overview.models';

type Fila = {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly where: string;
  readonly action: string;
  readonly route: string | null;
  readonly severity: 'danger' | 'warning';
};

/**
 * Lo que necesita atención hoy.
 *
 * <p>Ordenada por lo que deja turnos al descubierto: primero lo que ya dejó a alguien sin cubrir,
 * después lo que lo hará. Cada fila dice <b>dónde</b> se resuelve además de qué es, porque el
 * nombre del asunto no siempre nombra el módulo.</p>
 *
 * <p>Cuando no hay nada, la tarjeta lo dice con todas sus letras en lugar de desaparecer: una
 * pantalla que se encoge sin explicación deja al usuario preguntándose si falló la carga.</p>
 *
 * <p><b>Vacía por falta de asuntos y vacía por falta de datos no son lo mismo, y la lista no puede
 * decirlas igual.</b> «Nada pendiente hoy» es una afirmación: alguien revisó y no hay nada. En una
 * organización recién creada eso es falso —está todo pendiente— y sólo parece cierto porque el
 * sistema no tiene todavía con qué saberlo. Decirlo así convierte la ausencia de configuración en
 * una felicitación, que es la misma trampa que los indicadores evitan al distinguir el cero real
 * del «sin datos aún».</p>
 */
@Component({
  selector: 'app-attention-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="attention" aria-labelledby="atencion-titulo">
      <p class="attention__header">
        <span class="attention__kicker" id="atencion-titulo">NECESITA ATENCIÓN HOY</span>
        <span class="attention__note">{{ note() }}</span>
      </p>

      @if (rows().length) {
        <ul class="attention__rows">
          @for (row of rows(); track row.key) {
            <li class="attention__row">
              <span class="attention__dot" [class]="'attention__dot--' + row.severity" aria-hidden="true"></span>
              <span class="attention__body">
                <span class="attention__title">
                  {{ row.title }}
                  <!-- La severidad se lee, no sólo se ve por el color del punto. -->
                  <span class="attention__severity" [class]="'attention__severity--' + row.severity">
                    {{ row.severity === 'danger' ? 'Deja turnos al descubierto' : 'Va a estorbar' }}
                  </span>
                </span>
                <span class="attention__detail">{{ row.detail }}</span>
              </span>
              <span class="attention__where">{{ row.where }}</span>
              @if (row.route) {
                <a
                  class="attention__action"
                  [routerLink]="row.route"
                  [attr.aria-label]="row.action + ': ' + row.title"
                >{{ row.action }}</a>
              }
            </li>
          }
        </ul>
      } @else if (hasData()) {
        <p class="attention__clear">
          Nada pendiente hoy. Cuando algo deje un turno al descubierto, aparecerá aquí con su
          conteo y con el módulo donde se resuelve.
        </p>
      } @else {
        <p class="attention__clear">
          Todavía no hay con qué saberlo. Esta lista se llena con lo que va dejando la operación
          —posiciones sin titular, faltas sin incidencia, documentos vencidos—, y mientras no haya
          servicios, posiciones ni personal no puede afirmar que no quede nada pendiente.
        </p>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .attention {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .attention__header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin: 0;
      padding: 0.7rem var(--gestia-card-padding);
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .attention__kicker {
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.07em;
    }

    .attention__note { margin-left: auto; color: var(--gestia-muted); font-size: 11.5px; }

    .attention__rows { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

    .attention__row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.8rem var(--gestia-card-padding);
      border-bottom: 1px solid var(--gestia-border);
    }

    .attention__row:last-child { border-bottom: 0; }

    .attention__dot { flex: none; width: 8px; height: 8px; border-radius: 50%; }
    .attention__dot--danger { background: var(--gestia-danger); }
    .attention__dot--warning { background: var(--gestia-warning); }

    .attention__body { display: flex; flex: 1; flex-direction: column; gap: 0.2rem; min-width: 0; }

    .attention__title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      color: var(--gestia-text);
      font-size: 13px;
      font-weight: 600;
    }

    .attention__severity {
      padding: 0.05rem 0.3rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-pill);
      font-size: 10.5px;
    }

    .attention__severity--danger { border-color: var(--gestia-danger); color: var(--gestia-danger); }
    .attention__severity--warning { border-color: var(--gestia-warning); color: var(--gestia-warning); }

    .attention__detail { color: var(--gestia-muted); font-size: 11.5px; }

    .attention__where { flex: none; width: 11rem; color: var(--gestia-muted); font-size: 12px; }

    .attention__action {
      flex: none;
      color: var(--gestia-cyan-dark);
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
    }

    .attention__action:hover { text-decoration: underline; }

    .attention__action:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    .attention__clear { margin: 0; padding: var(--gestia-card-padding); color: var(--gestia-muted); font-size: 12.5px; }

    /* En pantallas estrechas la columna del módulo se va bajo el texto en lugar de estrujarlo. */
    @media (width < 60rem) {
      .attention__row { flex-wrap: wrap; }
      .attention__where { width: auto; }
    }
  `,
})
export class AttentionList {
  readonly items = input.required<readonly OverviewAttentionItem[]>();

  /**
   * Si el sistema pudo calcular algo. Lo decide la pantalla a partir de los indicadores, no esta
   * pieza: aquí sólo se redacta la diferencia entre no tener asuntos y no tener con qué saberlo.
   */
  readonly hasData = input.required<boolean>();

  protected readonly rows = computed<readonly Fila[]>(() =>
    [...this.items()]
      .sort((left, right) => severidad(right) - severidad(left))
      .map((item) => ({
        key: item.key,
        title: attentionTitle(item),
        detail: attentionDetail(item),
        where: attentionWhere(item),
        action: attentionAction(item),
        route: item.route,
        severity: item.severity === 'Danger' ? ('danger' as const) : ('warning' as const),
      })),
  );

  protected readonly note = computed(() => {
    const total = this.rows().length;

    if (total === 0) {
      return this.hasData() ? 'Sin asuntos abiertos' : 'Todavía sin nada que revisar';
    }

    const criticos = this.rows().filter((row) => row.severity === 'danger').length;
    const tipos = `${total} ${total === 1 ? 'tipo' : 'tipos'}`;

    return criticos > 0
      ? `${tipos}, ${criticos} de ellos dejando turnos al descubierto`
      : `${tipos}, ninguno deja turnos al descubierto todavía`;
  });
}

const severidad = (item: OverviewAttentionItem) => (item.severity === 'Danger' ? 1 : 0);
