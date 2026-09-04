import { HttpErrorResponse } from '@angular/common/http';
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
  protected readonly supportDialogOpen = signal(false);
  protected readonly supportOrganizationId = signal('');
  protected readonly supportReason = signal('');
  protected readonly supportDurationMinutes = signal(60);
  protected readonly supportSaving = signal(false);
  protected readonly supportError = signal('');
  protected readonly breadcrumbs = computed(() => this.resolveBreadcrumbs(this.currentUrl()));
  protected readonly pageTitle = computed(() => this.breadcrumbs().at(-1) ?? 'GestIA');
  protected readonly isPlatformAdmin = computed(() =>
    this.auth.session()?.permissions.includes('PLATFORM.ADMIN') ?? false,
  );
  protected readonly requiresSupport = computed(() => {
    const path = this.currentUrl().split('?')[0];
    const scopedRoutes = ['/clientes', '/servicios', '/personal', '/catalogos', '/configuracion', '/documentos', '/planeacion', '/operacion', '/solicitudes', '/reportes', '/auditoria'];
    return this.isPlatformAdmin() && !this.auth.isSupportModeActive() && scopedRoutes.some(route => path === route || path.startsWith(`${route}/`));
  });
  protected readonly userScope = computed(() =>
    this.isPlatformAdmin() ? 'Super Admin BKT' : 'Admin de organización',
  );
  protected readonly workspaceLabel = computed(() =>
    this.isPlatformAdmin() ? 'Espacio de plataforma' : 'Espacio de trabajo',
  );
  protected readonly workspaceName = computed(() =>
    this.isPlatformAdmin()
      ? this.auth.supportSession()?.organizationName ?? 'Gobierno de GestIA'
      : this.auth.activeOrganization()?.legalName ?? 'Sin organización',
  );
  protected readonly supportExpiresLabel = computed(() => {
    const expiresAt = this.auth.supportSession()?.expiresAt;
    return expiresAt
      ? new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(new Date(expiresAt))
      : '';
  });
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
      this.auth.loadCurrentSupportSession().subscribe({ error: () => this.auth.clearSupportSession() });
    }
  }

  protected logout() {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  protected openSupportDialog() {
    const current = this.auth.supportSession();
    this.supportOrganizationId.set(current?.idOrganization ?? this.auth.platformOrganizations()[0]?.idOrganization ?? '');
    this.supportReason.set('');
    this.supportDurationMinutes.set(60);
    this.supportError.set('');
    this.supportDialogOpen.set(true);
  }

  protected closeSupportDialog() {
    if (!this.supportSaving()) {
      this.supportDialogOpen.set(false);
    }
  }

  protected startSupport() {
    const idOrganization = this.supportOrganizationId();
    const reason = this.supportReason().trim();
    if (!idOrganization || reason.length < 10) {
      this.supportError.set('Selecciona una organización y captura un motivo de al menos 10 caracteres.');
      return;
    }

    this.supportSaving.set(true);
    this.supportError.set('');
    this.auth.startSupportSession({ idOrganization, reason, durationMinutes: this.supportDurationMinutes() }).subscribe({
      next: () => {
        this.supportSaving.set(false);
        this.supportDialogOpen.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (error: HttpErrorResponse) => {
        this.supportSaving.set(false);
        this.supportError.set(error.error?.detail ?? 'No se pudo iniciar el modo soporte.');
      },
    });
  }

  protected endSupport() {
    const request = this.auth.endSupportSession();
    if (!request) {
      return;
    }

    this.supportSaving.set(true);
    request.subscribe({
      next: () => {
        this.supportSaving.set(false);
        void this.router.navigateByUrl('/');
      },
      error: () => {
        this.supportSaving.set(false);
        this.supportError.set('No se pudo cerrar la sesión de soporte.');
      },
    });
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

          if (item.hideForPlatformAdmin && isPlatformAdmin && !(item.availableInSupport && this.auth.isSupportModeActive())) {
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
