import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { devAssert } from '../dev-assert';

/**
 * Qué tan derecho está el candidato para tomar el turno.
 *
 * <p><b>Ninguno de los tres impide elegir</b>, y eso es una decisión, no un descuido:</p>
 *
 * <ul>
 * <li><b>`eligible`</b> — cumple el perfil y no tiene turno ese día.</li>
 * <li><b>`review`</b> — no sabemos su puesto. «No sabemos» no es «no cumple», así que se ofrece con
 * aviso y decide quien asigna. Antes esto bloqueaba, y bloqueaba por comparar texto libre: una
 * redacción distinta dejaba fuera a alguien capaz.</li>
 * <li><b>`overlap`</b> — ya tiene turno a esa hora. Se puede elegir; el hueco se mueve de una
 * posición a otra, y el aviso dice a cuál.</li>
 * </ul>
 */
export type GiCandidateStanding = 'eligible' | 'review' | 'overlap' | 'blocked' | 'unchecked';

export type GiCandidate = {
  readonly id: string;
  readonly name: string;
  /** El puesto por catálogo, o cómo se dice que no lo tiene. Nunca texto libre comparado. */
  readonly role: string;
  /** Si tiene turno ese día y cuál. Sale de los turnos publicados. */
  readonly availability: string;
  readonly standing: GiCandidateStanding;
  /**
   * Qué se pierde al elegirlo. Obligatorio cuando hay traslape.
   *
   * <p>«Hay traslape» no es un aviso: es un botón de continuar con otra redacción. Tiene que decir
   * qué posición queda corta y en qué turno.</p>
   */
  readonly consequence?: string;
};

/**
 * <p><b>«Elegible» es una afirmación, y sólo la puede hacer el servidor.</b> Durante un tiempo la
 * ponía el navegador: bastaba con que la asignación trajera puesto para marcar a alguien como
 * elegible, sin haber consultado ni un requisito. Las reglas de elegibilidad —documentos vigentes,
 * habilidades, evaluaciones— viven en el servidor y es él quien las hace cumplir; repetirlas de
 * memoria en la pantalla es exactamente lo que el principio 5 prohíbe, y además da una respuesta
 * distinta de la que va a dar el servidor cuando toque.</p>
 *
 * <p>Por eso hay dos etiquetas más. <b>«No cumple»</b> es el servidor diciendo que no, con el
 * motivo. <b>«Sin comprobar»</b> es la pantalla diciendo que todavía no ha preguntado o que la
 * consulta falló: no es lo mismo que «cumple», y fingir que sí lo es sería volver al mismo
 * defecto por otra puerta.</p>
 */
const PILDORA: Record<GiCandidateStanding, string> = {
  eligible: 'Elegible',
  review: 'Revisar puesto',
  overlap: 'Traslape',
  blocked: 'No cumple',
  unchecked: 'Sin comprobar',
};

/**
 * La lista de quién puede tomar un turno.
 *
 * <p><b>Nadie queda fuera de la lista por traslape ni por puesto desconocido.</b> El argumento es
 * el mismo del cierre del día: el supervisor a las 07:20 con un turno descubierto va a mover a
 * alguien de todos modos. Si el sistema no lo deja, lo mueve por teléfono y el sistema queda
 * mintiendo sobre dónde está la gente. Permitirlo y marcarlo conserva el dato; bloquearlo lo
 * expulsa.</p>
 *
 * <p><b>Con una condición, que es lo que esta pieza obliga: el aviso nombra la consecuencia.</b>
 * Un candidato con traslape sin decir qué queda corto rompe en desarrollo, porque una advertencia
 * que no dice qué se pierde no ayuda a decidir y se acepta sin leer.</p>
 *
 * <p>Sin candidatos no se dibuja una lista vacía: se dice qué falta y cómo resolverlo.</p>
 */
@Component({
  selector: 'gi-candidate-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gi-cand">
      <div class="gi-cand__head">
        <span class="gi-cand__title">{{ title() }}</span>
        <span class="gi-cand__count">{{ summary() }}</span>
      </div>

      @if (candidates().length === 0) {
        <div class="gi-cand__empty">
          <p class="gi-cand__empty-title">{{ emptyTitle() }}</p>
          <p class="gi-cand__empty-body">{{ emptyBody() }}</p>
          @if (emptyActionLabel()) {
            <button class="gi-cand__link" type="button" (click)="resolveEmpty.emit()">
              {{ emptyActionLabel() }}
            </button>
          }
        </div>
      } @else {
        <ul class="gi-cand__list">
          @for (candidate of candidates(); track candidate.id) {
            <li class="gi-cand__item">
              <div class="gi-cand__row">
                <span class="gi-cand__name">{{ candidate.name }}</span>
                <span class="gi-cand__pill" [class]="'gi-cand__pill--' + candidate.standing">
                  {{ pill(candidate) }}
                </span>
                <button class="gi-cand__choose" type="button" (click)="choose.emit(candidate)">
                  Elegir
                </button>
              </div>

              <p class="gi-cand__meta">{{ candidate.role }} · {{ candidate.availability }}</p>

              @if (candidate.consequence) {
                <p class="gi-cand__consequence" [class]="'gi-cand__consequence--' + candidate.standing">
                  {{ candidate.consequence }}
                </p>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .gi-cand {
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      overflow: hidden;
    }

    .gi-cand__head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
      background: var(--gestia-surface-soft);
    }

    .gi-cand__title { color: var(--gestia-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.07em; }
    .gi-cand__count { color: var(--gestia-muted); font-size: 11.5px; }

    .gi-cand__list { margin: 0; padding: 0; list-style: none; }

    .gi-cand__item {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      padding: 0.75rem 0.85rem;
      border-bottom: 1px solid var(--gestia-border);
    }

    .gi-cand__item:last-child { border-bottom: none; }

    .gi-cand__row { display: flex; align-items: center; gap: 0.65rem; }
    .gi-cand__name { flex: 1; min-width: 0; color: var(--gestia-text); font-size: 13px; font-weight: 600; }

    .gi-cand__pill {
      border: 1px solid currentcolor;
      border-radius: var(--gestia-radius-pill);
      padding: 0.15rem 0.45rem;
      font-size: 10.5px;
      font-weight: 600;
    }

    .gi-cand__pill--eligible { color: var(--gestia-success); }
    .gi-cand__pill--review { color: var(--gestia-warning); }
    .gi-cand__pill--overlap { color: var(--gestia-warning); }
    .gi-cand__pill--blocked { color: var(--gestia-danger); }
    .gi-cand__pill--unchecked { color: var(--gestia-muted); }

    .gi-cand__choose {
      height: 2.25rem;
      padding: 0 0.7rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .gi-cand__choose:focus-visible,
    .gi-cand__link:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }

    .gi-cand__meta { margin: 0; color: var(--gestia-muted); font-size: 12px; }

    .gi-cand__consequence { margin: 0; font-size: 11.5px; line-height: 1.45; }
    .gi-cand__consequence--review,
    .gi-cand__consequence--overlap { color: var(--gestia-warning); }
    .gi-cand__consequence--blocked { color: var(--gestia-danger); }
    .gi-cand__consequence--eligible,
    .gi-cand__consequence--unchecked { color: var(--gestia-muted); }

    .gi-cand__empty { padding: 1.1rem 0.85rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .gi-cand__empty-title { margin: 0; color: var(--gestia-text); font-size: 13px; font-weight: 600; }
    .gi-cand__empty-body { margin: 0; color: var(--gestia-muted); font-size: 12px; line-height: 1.5; }

    .gi-cand__link {
      align-self: flex-start;
      border: none;
      background: none;
      padding: 0;
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }
  `,
})
export class GiCandidatePicker implements OnInit {
  readonly candidates = input.required<readonly GiCandidate[]>();
  readonly title = input('CANDIDATOS');

  readonly emptyTitle = input('Nadie puede tomar este turno todavía');
  readonly emptyBody = input(
    'No hay personal activo asignado al servicio para esa fecha. Sin candidatos, la salida es declarar el turno sin cubrir.',
  );
  readonly emptyActionLabel = input('Asignar personal al servicio');

  readonly choose = output<GiCandidate>();
  readonly resolveEmpty = output<void>();

  protected pill(candidate: GiCandidate): string {
    return PILDORA[candidate.standing];
  }

  /** «4 · dos elegibles sin aviso». El resumen dice cuántos no traen pero. */
  protected summary(): string {
    const total = this.candidates().length;

    if (total === 0) {
      return 'ninguno';
    }

    // Sólo cuenta quien el servidor dijo que cumple. «Sin comprobar» no es «sin aviso»: es
    // precisamente un aviso, y meterlo en esta cuenta devolvería la afirmación que se quitó.
    const limpios = this.candidates().filter((candidate) => candidate.standing === 'eligible').length;

    return `${total} · ${limpios} sin aviso`;
  }

  ngOnInit(): void {
    for (const candidate of this.candidates()) {
      devAssert(
        candidate.standing !== 'overlap' || (candidate.consequence ?? '').trim().length > 0,
        `gi-candidate-picker: el candidato «${candidate.name}» tiene traslape y no dice qué queda ` +
          'corto al elegirlo. El traslape se permite a propósito, pero con la condición de que el ' +
          'aviso nombre la consecuencia: «hay traslape» a secas es un botón de continuar con otra ' +
          'redacción, y se acepta sin leer.',
      );

      devAssert(
        candidate.standing !== 'review' || (candidate.consequence ?? '').trim().length > 0,
        `gi-candidate-picker: el candidato «${candidate.name}» está marcado para revisar y no dice ` +
          'qué revisar. Un puesto desconocido no bloquea, pero quien asigna necesita saber qué le ' +
          'falta al expediente para decidir.',
      );

      devAssert(
        candidate.standing !== 'blocked' || (candidate.consequence ?? '').trim().length > 0,
        `gi-candidate-picker: el candidato «${candidate.name}» aparece como que no cumple y no dice ` +
          'qué requisito le falta. Decir «no cumple» sin el motivo deja a quien asigna sin nada que ' +
          'hacer al respecto, que es lo mismo que un botón apagado sin explicación.',
      );
    }

    devAssert(
      this.candidates().length > 0 || this.emptyActionLabel().trim().length > 0,
      'gi-candidate-picker: una lista vacía sin salida deja al usuario sin saber qué hacer. Si no ' +
        'hay candidatos, hay que decir qué falta y ofrecer cómo resolverlo.',
    );
  }
}
