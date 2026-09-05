import { ChangeDetectionStrategy, Component, OnInit, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { devAssert } from '../dev-assert';

/**
 * Por qué no hay nada. Las cuatro razones no son intercambiables y por eso son cuatro variantes y
 * no un texto libre: cada una lleva a un sitio distinto.
 */
export type GiEmptyVariant =
  /** El usuario no tiene el permiso. No hay nada que ofrecerle aquí. */
  | 'no-permission'
  /** No hay registros todavía. Se ofrece crear el primero. */
  | 'no-data'
  /** Hay registros, pero ninguno pasa los filtros. Se ofrece quitarlos. */
  | 'no-results'
  /** Falta algo que se obtiene en otro módulo. Se ofrece el enlace a ese módulo. */
  | 'missing-prerequisite';

type TextoPorOmision = { readonly title: string; readonly description: string };

const POR_OMISION: Record<GiEmptyVariant, TextoPorOmision> = {
  'no-permission': {
    title: 'No tienes acceso a esta información',
    description: 'Pídele a quien administra tu organización que te otorgue el permiso.',
  },
  'no-data': {
    title: 'Todavía no hay nada aquí',
    description: 'Cuando se registre el primero, aparecerá en esta lista.',
  },
  'no-results': {
    title: 'Ningún resultado con estos filtros',
    description: 'Hay registros, pero ninguno coincide con lo que estás buscando.',
  },
  'missing-prerequisite': {
    title: 'Falta un paso antes',
    description: 'Esta pantalla necesita información que se registra en otro módulo.',
  },
};

/**
 * Estado vacío.
 *
 * <b>Explica por qué no hay nada y ofrece la acción que lo resuelve.</b> Un vacío que sólo dice
 * «sin resultados» deja al usuario adivinando si el filtro está mal, si le falta permiso o si de
 * verdad no hay nada, que son tres problemas con tres soluciones distintas.
 *
 * <p>La variante que más importa es <c>missing-prerequisite</c>, porque es la única que manda a
 * otro módulo: no se resuelve donde se ve. Por eso su enlace es obligatorio y el componente lo
 * exige en desarrollo en vez de dibujar un vacío sin salida.</p>
 */
@Component({
  selector: 'gi-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="gi-empty" [class]="'gi-empty--' + variant()" role="status">
      <p class="gi-empty__title">{{ title() || textos().title }}</p>
      <p class="gi-empty__description">{{ description() || textos().description }}</p>

      @if (link(); as destino) {
        <a class="gi-empty__action" [routerLink]="destino">{{ actionLabel() || 'Ir al módulo' }}</a>
      } @else if (actionLabel(); as etiqueta) {
        <button class="gi-empty__action" type="button" (click)="action.emit()">{{ etiqueta }}</button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .gi-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      padding: 2.25rem 1.25rem;
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      text-align: center;
    }

    .gi-empty__title {
      margin: 0;
      color: var(--gestia-text);
      font-size: 12.5px;
      font-weight: 600;
    }

    .gi-empty__description {
      margin: 0;
      max-width: 44ch;
      color: var(--gestia-muted);
      font-size: 12px;
      font-weight: 400;
    }

    .gi-empty__action {
      margin-top: 0.5rem;
      display: inline-flex;
      align-items: center;
      min-height: var(--gestia-control-height);
      padding: 0 0.9rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-cyan-dark);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }

    .gi-empty__action:hover { border-color: var(--gestia-cyan-dark); }
    .gi-empty__action:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 2px; }

    /* Sin permiso no se ofrece nada, así que el bloque se lee más apagado: no hay qué hacer. */
    .gi-empty--no-permission .gi-empty__title { color: var(--gestia-muted); }
  `,
})
export class GiEmptyState implements OnInit {
  readonly variant = input.required<GiEmptyVariant>();
  /** Texto propio de la pantalla. Sin él se usa el de la variante. */
  readonly title = input('');
  readonly description = input('');
  readonly actionLabel = input('');
  /** Ruta del módulo donde se obtiene lo que falta. Obligatoria en `missing-prerequisite`. */
  readonly link = input<string | readonly unknown[] | null>(null);
  readonly action = output<void>();

  protected readonly textos = computed(() => POR_OMISION[this.variant()]);

  ngOnInit(): void {
    devAssert(
      this.variant() !== 'missing-prerequisite' || !!this.link(),
      'gi-empty-state: la variante "missing-prerequisite" necesita el enlace al módulo donde se ' +
        'obtiene lo que falta. Sin él, el vacío dice que falta algo y no dice dónde conseguirlo.',
    );

    devAssert(
      this.variant() !== 'no-permission' || !(this.actionLabel() || this.link()),
      'gi-empty-state: la variante "no-permission" no ofrece acción. Si al usuario le falta el ' +
        'permiso, no hay nada que pueda hacer desde aquí.',
    );
  }
}
