import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GiMetricCard } from '../../../shared/ui/gi-ui';

/**
 * Los tres números del día.
 *
 * <p><b>Sin planeación publicada no hay ceros: hay rayas.</b> Un cero dice «todo salió como se
 * planeó»; una raya dice «no hay plan contra el que medir». Enseñar el primero cuando corresponde el
 * segundo es la peor confusión posible en un tablero, porque afirma que todo está bien cuando en
 * realidad nadie ha publicado nada. Por eso los tres indicadores pasan a `pending` juntos, con la
 * acción que lo resuelve.</p>
 *
 * <p><b>Lo pendiente de capturar no cuenta como excepción.</b> Va en el apoyo del propio indicador,
 * porque son dos cosas distintas: una excepción es un hecho —alguien faltó, alguien llegó tarde— y
 * lo pendiente es trabajo del supervisor. Sumarlas haría que el número creciera al empezar el día y
 * bajara al capturar, justo al revés de lo que significa.</p>
 */
@Component({
  selector: 'app-attendance-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiMetricCard],
  template: `
    <div class="resumen">
      <gi-metric-card
        label="TURNOS DEL DÍA"
        [value]="shiftCount()"
        [state]="hasPlan() ? 'ready' : 'pending'"
        [hint]="turnosApoyo()"
        pendingLabel="Sin planeación publicada"
        [pendingActionLabel]="publishActionLabel()"
        (pendingAction)="publish.emit()"
      />

      <gi-metric-card
        label="EXCEPCIONES"
        [value]="exceptionCount()"
        [state]="hasPlan() ? 'ready' : 'pending'"
        [tone]="exceptionCount() > 0 ? 'danger' : 'success'"
        [pillLabel]="excepcionesPildora()"
        [hint]="excepcionesApoyo()"
        pendingLabel="Sin planeación publicada"
        [pendingActionLabel]="publishActionLabel()"
        (pendingAction)="publish.emit()"
      />

      <gi-metric-card
        label="COBERTURA DEL DÍA"
        [value]="coberturaValor()"
        [state]="hasPlan() ? 'ready' : 'pending'"
        [tone]="gapCount() > 0 ? 'warning' : 'neutral'"
        [pillLabel]="coberturaPildora()"
        [hint]="coberturaApoyo()"
        pendingLabel="Sin planeación publicada"
        [pendingActionLabel]="publishActionLabel()"
        (pendingAction)="publish.emit()"
      />
    </div>
  `,
  styles: `
    :host { display: block; }

    .resumen {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--gestia-page-gap);
    }

    @media (max-width: 60rem) {
      .resumen { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class AttendanceSummary {
  readonly shiftCount = input(0);
  readonly exceptionCount = input(0);
  readonly pendingCount = input(0);
  readonly gapCount = input(0);
  readonly missingWorkers = input(0);

  /** Si hay versión publicada para el día. Sin ella los tres números no significan nada. */
  readonly hasPlan = input(false);
  readonly canPublish = input(false);

  readonly publish = output<void>();

  /** Sin permiso no se ofrece la acción: el vacío sigue explicándose, pero sin puerta falsa. */
  protected readonly publishActionLabel = computed(() => (this.canPublish() ? 'Ir a Planeación' : ''));

  protected readonly turnosApoyo = computed(() =>
    this.pendingCount() === 0
      ? 'Todos capturados.'
      : `${this.pendingCount()} ${this.pendingCount() === 1 ? 'sigue' : 'siguen'} sin capturar.`,
  );

  /**
   * La píldora que acompaña al número. El color nunca va solo: la palabra va dentro.
   *
   * <p><b>«Cero real» exige que el día esté capturado entero.</b> Con turnos pendientes, cero
   * excepciones no significa que no las hubiera: significa que todavía no se sabe. Se reportó
   * viendo la pantalla decir «El día salió como se planeó» con la mitad del día sin capturar.</p>
   */
  protected readonly excepcionesPildora = computed(() => {
    if (this.exceptionCount() > 0) {
      return 'Cambian cobertura';
    }

    return this.pendingCount() === 0 ? 'Cero real' : 'Todavía no se sabe';
  });

  protected readonly excepcionesApoyo = computed(() => {
    if (this.exceptionCount() > 0) {
      return 'Faltas y retardos. Cada una trae su acción.';
    }

    return this.pendingCount() === 0
      ? 'El día salió como se planeó. Es información, no ausencia de datos.'
      : `Faltan ${this.pendingCount()} turnos por capturar: hasta entonces, el cero no dice que no hubo excepciones.`;
  });

  protected readonly coberturaValor = computed(() => {
    const cubiertos = this.shiftCount() - this.missingWorkers();

    return `${cubiertos} de ${this.shiftCount()}`;
  });

  protected readonly coberturaPildora = computed(() =>
    this.gapCount() === 0
      ? ''
      : `${this.gapCount()} ${this.gapCount() === 1 ? 'posición corta' : 'posiciones cortas'}`,
  );

  protected readonly coberturaApoyo = computed(() =>
    this.gapCount() === 0
      ? 'Todas las posiciones tienen la gente que piden.'
      : 'Falta gente asignada. Se resuelve en Cobertura, no aquí.',
  );
}
