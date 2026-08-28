import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { AppIcon } from '../../../shared/ui/app-icon/app-icon';
import { LayoutService } from '../layout.service';
import { GESTIA_NAVIGATION, NavigationGroup } from '../navigation';

@Component({
  selector: 'app-shell',
  imports: [AppIcon, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  private readonly currentUrl = signal(this.router.url);
  protected readonly navigation = computed(() => this.filterNavigation(GESTIA_NAVIGATION));
  protected readonly breadcrumbs = computed(() => this.resolveBreadcrumbs(this.currentUrl()));

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }

  protected logout() {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  private filterNavigation(groups: readonly NavigationGroup[]) {
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.permission || this.auth.hasPermission(item.permission)),
      }))
      .filter((group) => group.items.length > 0);
  }

  private resolveBreadcrumbs(url: string) {
    if (url === '/' || url.startsWith('/?')) {
      return ['Inicio'];
    }

    if (url.startsWith('/clientes')) {
      return ['Gestión', 'Clientes'];
    }

    if (url.startsWith('/solicitudes')) {
      return ['Gestión', 'Solicitudes'];
    }

    if (url.startsWith('/personal')) {
      return ['Gestión', 'Personal'];
    }

    if (url.startsWith('/planeacion')) {
      return ['Gestión', 'Planeación'];
    }

    if (url.startsWith('/operacion/asistencia')) {
      return ['Operación', 'Asistencia'];
    }

    if (url.startsWith('/operacion/incidencias')) {
      return ['Operación', 'Incidencias'];
    }

    if (url.startsWith('/operacion/cobertura')) {
      return ['Operación', 'Cobertura'];
    }

    if (url.startsWith('/seguridad')) {
      return ['Control', 'Seguridad'];
    }

    if (url.startsWith('/reportes')) {
      return ['Control', 'Reportes'];
    }

    return ['GestIA'];
  }
}
