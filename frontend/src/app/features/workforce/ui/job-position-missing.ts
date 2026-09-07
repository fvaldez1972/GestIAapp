import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GiEmptyState } from '../../../shared/ui/gi-ui';

/**
 * Lo que se ve cuando la organización todavía no tiene puestos en su catálogo.
 *
 * <p>Es un prerrequisito, no un error: sin puestos catalogados se puede dar de alta gente, pero
 * nadie podrá compararla contra el perfil de una posición, porque esa comparación es por
 * identificador de catálogo. Decirlo aquí evita que se descubra al fallar la asignación.</p>
 */
@Component({
  selector: 'app-job-position-missing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState],
  template: `
    <gi-empty-state
      variant="missing-prerequisite"
      title="Esta organización no tiene puestos en su catálogo"
      description="El puesto de una persona se elige del catálogo, porque la elegibilidad se compara por identificador y no por el texto del puesto. Se puede dar de alta sin él, pero su expediente queda incompleto."
      link="/catalogos"
      actionLabel="Ir a Catálogos"
    />
  `,
  styles: `
    :host { display: block; }
  `,
})
export class JobPositionMissing {}
