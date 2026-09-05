import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GiEmptyState } from '../../../shared/ui/gi-ui';
import { ClientContact } from '../data-access/client.models';

/**
 * La pestaña de Contactos.
 *
 * <p>Un contacto sin sede asignada no es un error: hay contactos comerciales que valen para todo
 * el cliente. Se dice cuál es cuál en lugar de esconderlo, porque quien busca a quién llamar en
 * una sede necesita distinguirlos.</p>
 */
@Component({
  selector: 'app-client-contacts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiEmptyState],
  template: `
    <section class="contacts">
      @if (contacts().length === 0) {
        <gi-empty-state
          variant="no-data"
          title="Este cliente todavía no tiene contactos"
          description="Un contacto dice a quién llamar cuando algo pasa en la sede. Se registra desde la sede a la que pertenece."
          [actionLabel]="canWrite() ? 'Agregar contacto' : ''"
          (action)="add.emit()"
        />
      } @else {
        <ul class="contacts__list">
          @for (contact of contacts(); track contact.idClientContact) {
            <li class="contact">
              <span class="contact__main">
                <span class="contact__name">{{ contact.fullName }}</span>
                @if (contact.isPrimary) {
                  <span class="contact__pill">Principal</span>
                }
              </span>
              <span class="contact__role">{{ contact.jobTitle || 'Sin puesto registrado' }}</span>
              <span class="contact__where">
                {{ contact.clientSiteName || 'Contacto del cliente, no de una sede' }}
              </span>
              <span class="contact__reach">{{ reach(contact) }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host { display: block; }

    .contacts__list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }

    .contact {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.7rem 0;
      border-bottom: 1px solid var(--gestia-border);
    }

    .contact:last-child { border-bottom: 0; }

    .contact__main { display: flex; align-items: center; gap: 0.45rem; }

    .contact__name { color: var(--gestia-text); font-size: 12.5px; font-weight: 600; }

    .contact__pill {
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--gestia-cyan-dark);
      border-radius: var(--gestia-radius-pill);
      color: var(--gestia-cyan-dark);
      font-size: 10.5px;
      font-weight: 600;
    }

    .contact__role, .contact__where, .contact__reach { color: var(--gestia-muted); font-size: 11.5px; }
  `,
})
export class ClientContacts {
  readonly contacts = input.required<readonly ClientContact[]>();
  readonly canWrite = input(false);
  readonly add = output<void>();

  /** Cómo se le llega. Sin ninguno, se dice: un contacto sin forma de contacto no sirve. */
  protected reach(contact: ClientContact): string {
    const vias = [contact.mobilePhone, contact.phone, contact.email].filter((via) => !!via);
    return vias.length ? vias.join(' · ') : 'Sin teléfono ni correo registrados';
  }
}
