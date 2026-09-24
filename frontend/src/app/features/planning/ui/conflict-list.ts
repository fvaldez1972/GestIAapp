import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PlanningConflict } from '../data-access/planning.models';

/**
 * Lo que hay que mirar antes de publicar.
 *
 * <p><b>Lo que no bloquea se enseña igual, y ésa es la razón de que esta lista exista.</b> Si sólo
 * mostrara lo que impide publicar, una semana con seis turnos a los que les falta gente se vería
 * idéntica a una semana perfecta, y se publicaría sin que nadie mirara los huecos. Publicarla es
 * legítimo —alguien tiene que cubrirlos, y publicar es lo que deja a Cobertura empezar—, pero no
 * debería ser una decisión que se toma sin verlos.</p>
 *
 * <p>Lo que bloquea va primero y dice que bloquea. Mezclarlos en una sola lista obligaría a leerla
 * entera para saber si se puede publicar.</p>
 *
 * <p>Cuando no hay nada, lo dice: <b>un cero aquí es información</b>, no ausencia de datos. La
 * semana se revisó y salió limpia, que no es lo mismo que no haberla revisado.</p>
 */
@Component({
  selector: 'app-conflict-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conf" [class.conf--flat]="flat()">
      <header class="conf__head">
        <h2 class="conf__title">Antes de publicar</h2>
        <span class="conf__resumen">{{ resumen() }}</span>
      </header>

      @if (conflicts().length === 0) {
        <p class="conf__limpio">
          <span class="conf__pill conf__pill--ok">Nada que revisar</span>
          La semana proyecta turnos en todas sus posiciones y ninguna se queda corta. Es un cero
          real: se revisó y salió limpia.
        </p>
      } @else {
        <ul class="conf__lista">
          @for (conflict of ordenados(); track conflict.id) {
            <li class="conf__item" [class.conf__item--blocking]="conflict.blocking">
              <span class="conf__fila">
                <span class="conf__pill" [class]="conflict.blocking ? 'conf__pill--stop' : 'conf__pill--warn'">
                  {{ conflict.blocking ? 'Impide publicar' : 'Conviene mirarlo' }}
                </span>
                <span class="conf__nombre">{{ conflict.title }}</span>
              </span>
              <!--
                Sin detalle no hay parrafo. Dos conflictos se quedaron solo con su titulo, y un
                <p> vacio seguiria ocupando su margen: el renglon se veria descuadrado respecto a
                los que si lo tienen.
              -->
              @if (conflict.detail) {
                <p class="conf__detalle">{{ conflict.detail }}</p>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .conf {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius-lg);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    /* Dentro de la tarjeta de cierre el listado no lleva contorno propio: eran dos recuadros
       pegados diciendo lo mismo, y el de dentro sólo servía para marcar una frontera que no
       existe —la lista y el botón de publicar son un solo acto—. */
    .conf--flat { border: none; border-radius: 0; }

    .conf__head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
    }

    .conf__title { margin: 0; color: var(--gestia-navy); font-size: 16px; font-weight: 600; }
    .conf__resumen { color: var(--gestia-muted); font-size: 12px; }

    .conf__lista { margin: 0; padding: 0; list-style: none; }

    .conf__item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.6rem 1rem;
      border-top: 1px solid var(--gestia-border);
    }

    /* Lo que impide publicar se marca en el costado del renglón, no sólo en la píldora. */
    .conf__item--blocking { box-shadow: inset 3px 0 0 var(--gestia-danger); }

    .conf__fila { display: flex; align-items: center; gap: 0.6rem; }
    .conf__nombre { color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .conf__detalle { margin: 0; color: var(--gestia-muted); font-size: 12px; line-height: 1.5; }

    /* La píldora lleva el color en el relleno, no en un contorno de un píxel, y se acompaña de
       una barra lateral en el renglón que sí impide publicar. */
    .conf__pill {
      border: 0;
      border-radius: var(--gestia-radius-chip);
      padding: 0.15rem 0.55rem;
      font-size: 10.5px;
      font-weight: 600;
      flex: none;
    }

    .conf__pill--stop { background: var(--gestia-danger-soft); color: var(--gestia-danger); }
    .conf__pill--warn { background: var(--gestia-warning-soft); color: var(--gestia-warning); }
    .conf__pill--ok { background: var(--gestia-success-soft); color: var(--gestia-success); }

    .conf__limpio {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin: 0;
      padding: 0.85rem 1rem;
      color: var(--gestia-muted);
      font-size: 12.5px;
      line-height: 1.5;
    }
  `,
})
export class ConflictList {
  readonly conflicts = input.required<readonly PlanningConflict[]>();

  /** Sin contorno propio, para componerlo dentro de la tarjeta de cierre de Planeación. */
  readonly flat = input(false);

  /** Lo que bloquea va primero: si no, hay que leer la lista entera para saber si se puede publicar. */
  protected readonly ordenados = computed(() =>
    [...this.conflicts()].sort((a, b) => Number(b.blocking) - Number(a.blocking)),
  );

  protected readonly resumen = computed(() => {
    const bloqueantes = this.conflicts().filter((c) => c.blocking).length;
    const avisos = this.conflicts().length - bloqueantes;

    if (bloqueantes === 0 && avisos === 0) {
      return 'sin observaciones';
    }

    const partes: string[] = [];

    if (bloqueantes > 0) {
      partes.push(`${bloqueantes} ${bloqueantes === 1 ? 'impide' : 'impiden'} publicar`);
    }

    if (avisos > 0) {
      partes.push(`${avisos} ${avisos === 1 ? 'aviso' : 'avisos'}`);
    }

    return partes.join(' · ');
  });
}
