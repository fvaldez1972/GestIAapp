import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ShiftSegment } from '../../clients/data-access/client.models';
import { GiEmptyState } from '../../../shared/ui/gi-ui';

/** Los siete días, en el vocabulario del servidor y en el de la pantalla. */
export const DIAS_PATRON = [
  { value: 'Monday', label: 'Lunes' },
  { value: 'Tuesday', label: 'Martes' },
  { value: 'Wednesday', label: 'Miércoles' },
  { value: 'Thursday', label: 'Jueves' },
  { value: 'Friday', label: 'Viernes' },
  { value: 'Saturday', label: 'Sábado' },
  { value: 'Sunday', label: 'Domingo' },
] as const;

/** Lo que se pide al declarar o corregir un día del patrón. */
export type SegmentDraft = {
  readonly idShiftSegment: string | null;
  readonly dayOfWeek: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isOvernight: boolean;
  readonly requiredWorkerCount: number;
};

/**
 * Qué turnos declara una posición, día por día.
 *
 * <p><b>Los siete días se enseñan siempre, declarados o no.</b> Enseñar sólo los declarados
 * escondería justo lo que hay que revisar: un día vacío no se distingue de un día que nadie miró,
 * y la diferencia entre una semana de cinco días y una a la que se le olvidó el sábado se ve
 * únicamente si el sábado está a la vista.</p>
 *
 * <p><b>Un día sin segmento dice «Sin turno», no «Descanso».</b> El modelo no puede afirmar un
 * descanso: es la ausencia de una fila, y una ausencia no distingue una decisión de un olvido.</p>
 *
 * <p><b>Sólo semanal, y se dice por qué.</b> Un patrón guarda sus segmentos por día de la semana,
 * así que un 24×48 o un 4×2 no tienen dónde guardarse. La banda lo explica en lugar de dejar un
 * control apagado, que no informa de nada.</p>
 */
@Component({
  selector: 'app-pattern-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState],
  template: `
    <section class="patron">
      <header class="patron__head">
        <span class="patron__title">TURNOS QUE DECLARA {{ positionCode() }}</span>
        <span class="patron__resumen">{{ resumen() }}</span>
      </header>

      @if (!hasPattern()) {
        <gi-empty-state
          variant="missing-prerequisite"
          title="Esta posición no tiene patrón"
          [description]="sinPatron"
          [actionLabel]="canWrite() ? 'Crear el patrón' : ''"
          (action)="createPattern.emit()"
        />
      } @else {
        <ul class="patron__dias">
          @for (dia of dias; track dia.value) {
            <li class="patron__dia" [class.patron__dia--vacio]="!segmentOf(dia.value)">
              <span class="patron__nombre">{{ dia.label }}</span>

              @if (segmentOf(dia.value); as segmento) {
                <span class="patron__horario">{{ horario(segmento) }}</span>
                <span class="patron__gente">
                  {{ segmento.requiredWorkerCount }}
                  {{ segmento.requiredWorkerCount === 1 ? 'elemento' : 'elementos' }}
                </span>
                @if (segmento.isOvernight) {
                  <span class="patron__marca">Cruza la medianoche</span>
                }
                @if (canWrite()) {
                  <span class="patron__acciones">
                    <button type="button" class="patron__link" (click)="edit.emit(borrador(segmento))">
                      Corregir
                    </button>
                    <button type="button" class="patron__link" (click)="removeSegment.emit(segmento)">
                      Quitar
                    </button>
                  </span>
                }
              } @else {
                <span class="patron__vacio">Sin turno</span>
                @if (canWrite()) {
                  <span class="patron__acciones">
                    <button type="button" class="patron__link" (click)="edit.emit(nuevo(dia.value))">
                      Declarar turno
                    </button>
                  </span>
                }
              }
            </li>
          }
        </ul>

        <p class="patron__nota">
          <strong>Fase 1 declara patrones semanales.</strong> Un patrón guarda sus segmentos por día
          de la semana, así que un ciclo de tres o seis días —un 24×48, un 4×2— no tiene dónde
          guardarse todavía. No es que la pantalla no lo ofrezca: es que el modelo no lo puede
          expresar, y fingirlo daría una semana que no se cumple.
        </p>

        <p class="patron__nota">
          Un día sin segmento dice <strong>Sin turno</strong> y no «Descanso»: hoy la ausencia de un
          segmento no distingue una decisión de un olvido, así que llamarlo descanso afirmaría algo
          que nadie declaró.
        </p>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .patron {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    .patron__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .patron__title { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; }
    .patron__resumen { color: var(--gestia-muted); font-size: 11.5px; }

    .patron__dias { margin: 0; padding: 0; list-style: none; }

    .patron__dia {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.6rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      font-size: 12.5px;
    }

    .patron__nombre { width: 6rem; color: var(--gestia-text); font-weight: 600; }
    .patron__horario { color: var(--gestia-text); font-weight: 600; }
    .patron__gente { color: var(--gestia-muted); }
    .patron__vacio { color: var(--gestia-muted); }

    .patron__marca {
      border: 1px solid var(--gestia-muted);
      border-radius: var(--gestia-radius-pill);
      padding: 0.1rem 0.4rem;
      color: var(--gestia-muted);
      font-size: 10.5px;
      font-weight: 600;
    }

    .patron__dia--vacio { background: var(--gestia-surface-soft); }

    .patron__acciones { margin-left: auto; display: flex; gap: 0.75rem; }

    .patron__link {
      border: none;
      background: none;
      padding: 0;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .patron__link:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .patron__nota {
      margin: 0;
      padding: 0.7rem 0.85rem;
      border-top: 1px solid var(--gestia-border);
      color: var(--gestia-muted);
      font-size: 11.5px;
      line-height: 1.55;
    }

    .patron__nota strong { color: var(--gestia-text); }
  `,
})
export class PatternEditor {
  readonly positionCode = input.required<string>();
  readonly segments = input.required<readonly ShiftSegment[]>();
  readonly hasPattern = input(true);
  readonly canWrite = input(false);

  readonly createPattern = output<void>();
  readonly edit = output<SegmentDraft>();
  readonly removeSegment = output<ShiftSegment>();

  protected readonly dias = DIAS_PATRON;

  protected readonly sinPatron =
    'El patrón es lo que declara qué turnos tiene la posición cada día. Sin él la posición no ' +
    'proyecta nada, y la semana publicada no la va a incluir.';

  protected readonly resumen = computed(() => {
    const declarados = this.activos().length;

    if (declarados === 0) {
      return 'ningún día declarado';
    }

    return `${declarados} de 7 días declarados`;
  });

  private readonly activos = computed(() => this.segments().filter((segment) => segment.active));

  protected segmentOf(dayOfWeek: string): ShiftSegment | null {
    return this.activos().find((segment) => segment.dayOfWeek === dayOfWeek) ?? null;
  }

  /** `07:00:00 – 19:00:00` se lee `07:00 – 19:00`. Los segundos no dicen nada de un turno. */
  protected horario(segment: ShiftSegment): string {
    return `${segment.startTime.slice(0, 5)} – ${segment.endTime.slice(0, 5)}`;
  }

  protected borrador(segment: ShiftSegment): SegmentDraft {
    return {
      idShiftSegment: segment.idShiftSegment,
      dayOfWeek: segment.dayOfWeek,
      startTime: segment.startTime.slice(0, 5),
      endTime: segment.endTime.slice(0, 5),
      isOvernight: segment.isOvernight,
      requiredWorkerCount: segment.requiredWorkerCount,
    };
  }

  /**
   * Un día nuevo empieza vacío de horario.
   *
   * <p>Proponer «07:00 – 19:00» porque es lo común haría que se aceptara sin mirar, y el turno
   * quedaría declarado con un horario que nadie eligió. La cuenta de gente sí arranca en 1, que no
   * es una suposición sobre el turno sino el mínimo que hace que un turno exista.</p>
   */
  protected nuevo(dayOfWeek: string): SegmentDraft {
    return {
      idShiftSegment: null,
      dayOfWeek,
      startTime: '',
      endTime: '',
      isOvernight: false,
      requiredWorkerCount: 1,
    };
  }
}
