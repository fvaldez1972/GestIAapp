import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { AppIcon } from '../../../shared/ui/app-icon/app-icon';
import { LayoutService } from '../layout.service';
import { visibleNavigation } from '../navigation';
import { ContextBar } from '../context-bar/context-bar';
import { GiConfirmDialog } from '../../../shared/ui/gi-confirm-dialog/gi-confirm-dialog';

@Component({
  selector: 'app-shell',
  imports: [AppIcon, ContextBar, GiConfirmDialog, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Las dos piezas del cromo: la barra de organización y la superior.
   *
   * <p>La de organización se pide con `read: ElementRef` a propósito. Una referencia de plantilla
   * sobre un componente devuelve <b>la instancia</b>, no el elemento, y entonces `nativeElement`
   * sería `undefined`: la medida caería al valor de reserva sin que nada fallara.</p>
   */
  private readonly contextBar = viewChild('contextBar', { read: ElementRef<HTMLElement> });
  private readonly appHeader = viewChild<ElementRef<HTMLElement>>('appHeader');
  protected readonly auth = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  private readonly currentUrl = signal(this.router.url);
  protected readonly confirmingLogout = signal(false);
  protected readonly navigation = computed(() =>
    visibleNavigation({
      isPlatformAdmin: this.isPlatformAdmin(),
      hasActiveOrganization: !!this.auth.activeOrganization(),
      hasPermission: (permission) => this.auth.hasPermission(permission),
    }),
  );
  protected readonly breadcrumbs = computed(() => this.resolveBreadcrumbs(this.currentUrl()));

  /**
   * Publica en `--gestia-chrome-bottom` cuánto ocupa el cromo con la página en reposo.
   *
   * <p><b>Por qué hace falta.</b> Los paneles laterales de Planeación, Seguridad y Auditoría son
   * `position: fixed` y se anclaban a `--gestia-topbar-height`, que son 72 px. Pero encima de la
   * barra superior va la de organización, así que con la página sin rodar el cromo termina en
   * 151 px, y esos 79 px de diferencia se comían la cabecera del panel. El botón de cerrar quedaba
   * <b>debajo</b> de la barra: no sólo invisible —<code>elementFromPoint</code> devolvía el botón
   * de perfil—, de modo que pulsar donde se veía «Cerrar» abría el diálogo de salir.</p>
   *
   * <p><b>Se mide en reposo a propósito.</b> La barra de organización rueda con la página, así que
   * el borde real se mueve entre 151 y 72. Seguirlo obligaría a re-medir en cada desplazamiento, y
   * bastaría con que una pantalla ruede en un contenedor propio para que el oyente se lo pierda y
   * el panel volviera a esconder su botón. Anclarlo al máximo —la suma de las dos barras— es
   * correcto siempre: nunca tapa. Lo que se paga es una franja vacía sobre el panel mientras la
   * página está rodada, que es cosmética y no atrapa a nadie.</p>
   */
  private publicarElBordeDelCromo(): void {
    afterNextRender(() => {
      const medir = () => {
        const header = this.appHeader()?.nativeElement;

        if (!header) {
          return;
        }

        const alto = (this.contextBar()?.nativeElement.offsetHeight ?? 0) + header.offsetHeight;
        document.documentElement.style.setProperty('--gestia-chrome-bottom', `${Math.round(alto)}px`);
      };

      medir();
      // Al cambiar el ancho, la barra de organización envuelve y crece. Ahí sí hay que re-medir.
      window.addEventListener('resize', medir, { passive: true });

      this.destroyRef.onDestroy(() => {
        window.removeEventListener('resize', medir);
        document.documentElement.style.removeProperty('--gestia-chrome-bottom');
      });
    });
  }
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
  protected readonly userInitials = computed(() =>
    (this.auth.displayName() || 'GestIA')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  constructor() {
    this.publicarElBordeDelCromo();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));

    if (this.isPlatformAdmin()) {
      this.auth.loadPlatformOrganizations().subscribe({ error: () => undefined });
    }
  }

  /** Pregunta antes. Un clic en el nombre no puede tirar la sesión sin decir nada. */
  protected askLogout() {
    this.confirmingLogout.set(true);
  }

  protected cancelLogout() {
    this.confirmingLogout.set(false);
  }

  protected logout() {
    this.confirmingLogout.set(false);
    this.auth.logout();
    void this.router.navigateByUrl('/login');
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
