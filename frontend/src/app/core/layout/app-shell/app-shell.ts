import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { AppIcon } from '../../../shared/ui/app-icon/app-icon';
import { LayoutService } from '../layout.service';
import { GESTIA_NAVIGATION, NavigationGroup } from '../navigation';
import { ContextBar } from '../context-bar/context-bar';

@Component({
  selector: 'app-shell',
  imports: [AppIcon, ContextBar, RouterLink, RouterLinkActive, RouterOutlet],
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
  protected readonly pageTitle = computed(() => this.breadcrumbs().at(-1) ?? 'GestIA');
  protected readonly isPlatformAdmin = computed(() =>
    this.auth.session()?.permissions.includes('PLATFORM.ADMIN') ?? false,
  );
  /**
   * Rutas que operan dentro de una organización. El super admin llega a ellas sin haber
   * elegido ninguna, y en ese caso se le pide que la seleccione en lugar de mostrar la
   * pantalla vacía.
   */
  protected readonly requiresOrganization = computed(() => {
    const path = this.currentUrl().split('?')[0];
    const scopedRoutes = ['/clientes', '/servicios', '/personal', '/catalogos', '/configuracion', '/documentos', '/planeacion', '/operacion', '/solicitudes', '/reportes', '/auditoria'];
    return this.isPlatformAdmin() && !this.auth.activeOrganization() && scopedRoutes.some(route => path === route || path.startsWith(`${route}/`));
  });

  protected readonly userScope = computed(() =>
    this.isPlatformAdmin() ? 'Super Admin BKT' : 'Admin de organización',
  );
  protected readonly workspaceLabel = computed(() =>
    this.isPlatformAdmin() ? 'Espacio de plataforma' : 'Espacio de trabajo',
  );
  protected readonly workspaceName = computed(() =>
    this.auth.activeOrganization()?.legalName
      ?? (this.isPlatformAdmin() ? 'Gobierno de GestIA' : 'Sin organización'),
  );
  protected readonly userInitials = computed(() =>
    (this.auth.displayName() || 'GestIA')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));

    if (this.isPlatformAdmin()) {
      this.auth.loadPlatformOrganizations().subscribe({ error: () => undefined });
    }
  }

  protected logout() {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  private filterNavigation(groups: readonly NavigationGroup[]) {
    const isPlatformAdmin = this.auth.session()?.permissions.includes('PLATFORM.ADMIN') ?? false;

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.platformOnly && !isPlatformAdmin) {
            return false;
          }

          // El super admin ve el menú completo en cuanto entra a una organización.
          if (item.hideForPlatformAdmin && isPlatformAdmin && !this.auth.activeOrganization()) {
            return false;
          }

          return !item.permission || this.auth.hasPermission(item.permission);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }

  private resolveBreadcrumbs(url: string) {
    if (url.startsWith('/configuracion/documentos')) {
      return ['Configuración', 'Reglas documentales'];
    }
    if (url === '/' || url.startsWith('/?')) {
      return ['Inicio'];
    }

    if (url.startsWith('/clientes')) {
      return ['Configuración', 'Clientes'];
    }

    if (url.startsWith('/plataforma/organizaciones')) {
      return ['Configuración', 'Organizaciones'];
    }
    if (url.startsWith('/usuarios')) {
      return ['Configuración', 'Usuarios'];
    }

    if (url.startsWith('/servicios')) {
      return ['Configuración', 'Servicios'];
    }

    if (url.startsWith('/solicitudes')) {
      return ['Control', 'Solicitudes'];
    }

    if (url.startsWith('/personal')) {
      return ['Configuración', 'Personal'];
    }

    if (url.startsWith('/documentos')) {
      return ['Configuración', 'Documentos'];
    }

    if (url.startsWith('/catalogos')) {
      return ['Configuración', 'Catálogos'];
    }

    if (url.startsWith('/planeacion')) {
      return ['Operación', 'Planeación'];
    }

    if (url.startsWith('/monitor')) {
      return ['Operación', 'Monitor global'];
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

    if (url.startsWith('/auditoria')) {
      return ['Control', 'Auditoría'];
    }

    return ['GestIA'];
  }
}
