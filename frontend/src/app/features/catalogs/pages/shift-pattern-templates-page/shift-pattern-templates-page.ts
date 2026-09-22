import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { ShiftPatternTemplates } from '../../ui/shift-pattern-templates/shift-pattern-templates';

/**
 * Patrones de turno, con ruta propia dentro del submenú de Catálogos.
 *
 * <p><b>No es la página genérica de catálogo, y no puede serlo.</b> Los dieciséis catálogos
 * simples son una lista de nombre, descripción, orden y estado. Un patrón tiene ciclo, días y
 * horas: siete renglones con hora de entrada, hora de salida y descanso, más la vigencia. Meterlo
 * en la página genérica habría significado llenarla de casos especiales para una sola de las
 * dieciocho entradas.</p>
 *
 * <p><b>Y tampoco es una pantalla nueva.</b> El componente que dibuja y edita los patrones ya
 * existía y sigue siendo el mismo; lo único que cambia es que ahora tiene su propia dirección en
 * vez de vivir dentro de la pantalla larga. Por eso esta página es tan corta: su trabajo es darle
 * un encabezado y la organización de trabajo.</p>
 */
@Component({
  selector: 'app-shift-pattern-templates-page',
  imports: [ShiftPatternTemplates],
  template: `
    <header class="pat-head gi-card">
      <span class="eyebrow">Catálogos</span>
      <h1>Patrones de turno</h1>
      <p class="pat-head__lead">
        La forma de la semana que una posición propone: qué días se trabaja, a qué hora y cuáles se
        descansan. Es la referencia del patrón, no la semana que se trabaja de verdad: eso se decide
        al planear.
      </p>
    </header>

    @if (organizationId(); as organizacion) {
      <app-shift-pattern-templates [organizationId]="organizacion" [canWrite]="canWrite()" />
    } @else {
      <p class="pat-empty">Elige una organización en la barra superior para ver sus patrones.</p>
    }
  `,
  styles: `
    :host { display: block; max-width: 76rem; }

    .pat-head { margin-bottom: 1rem; }
    .pat-head h1 { margin: 0.15rem 0 0; }

    .pat-head__lead {
      max-width: 52rem;
      margin: 0.35rem 0 0;
      color: var(--gestia-muted);
      font-size: 12.5px;
    }

    .pat-empty { color: var(--gestia-muted); font-size: 12.5px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShiftPatternTemplatesPage {
  private readonly auth = inject(AuthService);

  protected readonly organizationId = this.auth.operationalOrganizationId;
  protected readonly canWrite = computed(() => this.auth.hasPermission('CATALOGS.WRITE'));
}
