import { ChangeDetectionStrategy, Component, OnInit, computed, input, output } from '@angular/core';
import { devAssert } from '../../../shared/ui/dev-assert';
import { formatOperationalDate } from '../../../shared/util/operational-date';
import { PlanningConflict } from '../data-access/planning.models';

/**
 * Publicar la semana.
 *
 * <p><b>Publicar es lo que convierte un borrador en el plan contra el que se mide todo lo demás.</b>
 * Asistencia compara contra la versión publicada; Cobertura resuelve huecos de la versión
 * publicada. Por eso el panel dice qué se va a publicar antes de publicarlo, y no después.</p>
 *
 * <p><b>La versión publicada no se edita.</b> No es una regla de la pantalla: el servidor la hace
 * cumplir, y toda modificación posterior entra como incidencia trazable. Decirlo aquí evita la
 * sorpresa de publicar creyendo que se puede retocar.</p>
 *
 * <p><b>Cuando no se puede publicar, el botón dice por qué.</b> Un botón apagado sin explicación
 * se lee como que la aplicación se rompió, y quien lo ve no tiene forma de saber qué le falta.</p>
 */
@Component({
  selector: 'app-publish-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pub">
      <header class="pub__head">
        <span class="pub__title">AL PUBLICAR</span>
        @if (publishedLabel()) {
          <span class="pub__estado">{{ publishedLabel() }}</span>
        }
      </header>

      <div class="pub__cuerpo">
        <p class="pub__resumen">{{ resumen() }}</p>

        <p class="pub__aviso">
          La versión queda publicada e inmutable. Toda modificación posterior entra como incidencia
          trazable: el rol publicado no se edita.
        </p>

        @if (razon()) {
          <p class="pub__porque" id="pub-porque">{{ razon() }}</p>
        }

        <div class="pub__acciones">
          <button
            class="pub__boton"
            type="button"
            [disabled]="!!razon()"
            [attr.aria-describedby]="razon() ? 'pub-porque' : null"
            (click)="publish.emit()"
          >
            {{ publishedLabel() ? 'Publicar una versión nueva' : 'Publicar la semana' }}
          </button>
        </div>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }

    .pub {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    .pub__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .pub__title { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; }
    .pub__estado { color: var(--gestia-muted); font-size: 11.5px; }

    .pub__cuerpo { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.85rem; }

    .pub__resumen { margin: 0; color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }
    .pub__aviso { margin: 0; color: var(--gestia-muted); font-size: 11.5px; line-height: 1.5; }

    .pub__porque {
      margin: 0;
      padding: 0.5rem 0.6rem;
      border-left: 3px solid var(--gestia-danger);
      background: var(--gestia-canvas);
      color: var(--gestia-text);
      font-size: 11.5px;
      line-height: 1.5;
    }

    .pub__acciones { display: flex; justify-content: flex-end; padding-top: 0.25rem; }

    .pub__boton {
      height: var(--gestia-control-height);
      padding: 0 1rem;
      border: 1px solid var(--gestia-navy);
      border-radius: var(--gestia-radius);
      background: var(--gestia-navy);
      color: var(--gestia-surface);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .pub__boton[disabled] { opacity: 0.5; cursor: not-allowed; }
    .pub__boton:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
  `,
})
export class PublishPanel implements OnInit {
  readonly weekStart = input.required<string>();
  readonly weekEnd = input.required<string>();
  readonly shiftCount = input(0);
  readonly positionCount = input(0);

  readonly conflicts = input<readonly PlanningConflict[]>([]);
  readonly canWrite = input(false);

  /** Qué versión está publicada hoy, si hay alguna. Vacío significa que nadie ha publicado. */
  readonly publishedLabel = input('');

  readonly publish = output<void>();

  protected readonly resumen = computed(() => {
    const turnos = this.shiftCount();
    const posiciones = this.positionCount();

    return (
      `${turnos} ${turnos === 1 ? 'turno' : 'turnos'} en ` +
      `${posiciones} ${posiciones === 1 ? 'posición' : 'posiciones'}, ` +
      `del ${formatOperationalDate(this.weekStart())} al ${formatOperationalDate(this.weekEnd())}.`
    );
  });

  /**
   * Por qué no se puede publicar. Cadena vacía significa que sí se puede.
   *
   * <p>El orden importa: primero el permiso, que no se resuelve arreglando la semana. Decir «falta
   * declarar P-01» a quien no puede publicar lo mandaría a arreglar algo que igual no lo va a
   * dejar.</p>
   */
  protected readonly razon = computed(() => {
    if (!this.canWrite()) {
      return 'No tienes permiso para publicar. Pídeselo a quien administra tu organización.';
    }

    const bloqueantes = this.conflicts().filter((conflict) => conflict.blocking);

    if (bloqueantes.length === 0) {
      return '';
    }

    if (bloqueantes.length === 1) {
      return `No se puede publicar todavía: ${bloqueantes[0].title.toLowerCase()}.`;
    }

    return (
      `No se puede publicar todavía. ${bloqueantes.length} cosas lo impiden, y están arriba con ` +
      'lo que hay que hacer en cada una.'
    );
  });

  ngOnInit(): void {
    devAssert(
      !!this.weekStart() && !!this.weekEnd(),
      'app-publish-panel: publicar necesita saber qué semana se publica. Sin el rango, el resumen ' +
        'diría «Sin fecha» justo donde hay que confirmar lo que queda inmutable.',
    );
  }
}
