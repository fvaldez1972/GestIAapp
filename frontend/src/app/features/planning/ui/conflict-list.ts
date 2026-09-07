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
    <section class="conf">
      <header class="conf__head">
        <span class="conf__title">ANTES DE PUBLICAR</span>
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
              <p class="conf__detalle">{{ conflict.detail }}</p>
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
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    .conf__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .conf__title { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; }
    .conf__resumen { color: var(--gestia-muted); font-size: 11.5px; }

    .conf__lista { margin: 0; padding: 0; list-style: none; }

    .conf__item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.7rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
    }

    .conf__item:last-child { border-bottom: none; }
    .conf__item--blocking { border-left: 3px solid var(--gestia-danger); }

    .conf__fila { display: flex; align-items: center; gap: 0.5rem; }
    .conf__nombre { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .conf__detalle { margin: 0; color: var(--gestia-muted); font-size: 11.5px; line-height: 1.5; }

    .conf__pill {
      border: 1px solid currentcolor;
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.45rem;
      font-size: 10.5px;
      font-weight: 600;
      flex: none;
    }

    .conf__pill--stop { color: var(--gestia-danger); }
    .conf__pill--warn { color: var(--gestia-warning); }
    .conf__pill--ok { color: var(--gestia-success); }

    .conf__limpio {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin: 0;
      padding: 0.85rem;
      color: var(--gestia-muted);
      font-size: 12px;
      line-height: 1.5;
    }
  `,
})
export class ConflictList {
  readonly conflicts = input.required<readonly PlanningConflict[]>();

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
