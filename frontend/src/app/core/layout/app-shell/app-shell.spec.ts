import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Component, OnDestroy } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { AppShell } from './app-shell';

/** Cuenta cuántas veces la monta y la destruye el enrutador. */
@Component({ template: 'pantalla' })
class PantallaDeModulo implements OnDestroy {
  static montajes = 0;
  static destrucciones = 0;

  constructor() {
    PantallaDeModulo.montajes += 1;
  }

  ngOnDestroy() {
    PantallaDeModulo.destrucciones += 1;
  }
}

const ALFA = { idOrganization: 'org-a', codeOrganization: 'ALFA', legalName: 'Alfa Seguridad Privada' };
const BETA = { idOrganization: 'org-b', codeOrganization: 'BETA', legalName: 'Beta Custodia' };
/** La que llega DESPUÉS de montar el shell: es la que delata si la lista se pide una sola vez. */
const GAMMA = { idOrganization: 'org-c', codeOrganization: 'GAMMA', legalName: 'Gamma Vigilancia' };

/** Los permisos que el menú consulta. El rol real trae más; ninguno de los otros abre entradas. */
const PERMISOS_QUE_EL_MENU_CONSULTA = [
  'USERS.READ',
  'CLIENTS.READ',
  'DOCUMENTS.READ',
  'CATALOGS.READ',
  'WORKFORCE.READ',
  'PLANNING.READ',
  'OPERATIONS.READ',
  'REPORTS.READ',
  'REQUESTS.READ',
  'AUDIT.READ',
];

/** Deja una sesión en el navegador antes de montar, como si el usuario ya hubiera entrado. */
function sesionEnCurso(permissions: readonly string[], organizations: readonly (typeof ALFA)[]) {
  localStorage.setItem(
    'gestia.auth.session',
    JSON.stringify({
      accessToken: 'token',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { idUser: 'user', email: 'admin@gestia.local', displayName: 'Renata Villaseñor' },
      organizations,
      permissions,
    }),
  );
}

describe('AppShell', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function montar(
    permissions: readonly string[],
    organizations: readonly (typeof ALFA)[],
    organizacionActiva?: string,
  ) {
    sesionEnCurso(permissions, organizations);

    if (organizacionActiva) {
      localStorage.setItem('gestia.auth.activeOrganizationId', organizacionActiva);
    }

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: PantallaDeModulo },
          // Una ruta hija de verdad: sin ella el enrutador no navega y `currentUrl` se queda en la
          // raíz, de modo que la prueba del submenú pasaría por la razón equivocada.
          { path: 'catalogos/puestos', component: PantallaDeModulo },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(AppShell);

    // El super admin pide la lista de organizaciones de la plataforma al construirse el shell.
    if (permissions.includes('PLATFORM.ADMIN')) {
      http.expectOne('/api/v1/organizations').flush([ALFA, BETA]);
    }

    // El shell ya no pide «system/info»: la barra de contexto dejó de llevar la fecha operativa,
    // y era su único lector dentro del cromo. Las pantallas que la necesitan siguen inyectando
    // SystemInfoService por su cuenta.
    http.expectNone('/api/v1/system/info');

    fixture.detectChanges();

    return { fixture, raiz: fixture.nativeElement as HTMLElement, componente: fixture.componentInstance };
  }

  const entradas = (raiz: HTMLElement) =>
    Array.from(raiz.querySelectorAll('.side-nav .menu-link .menu-text')).map((n) =>
      n.textContent?.trim(),
    );

  const gruposDelMenu = (raiz: HTMLElement) =>
    Array.from(raiz.querySelectorAll('.side-nav .menu-group')).map((n) => n.textContent?.trim());

  /** Selectores con estilo propio, nunca el nativo del sistema. El requisito es explícito. */
  it('no queda ningún select nativo en el shell', () => {
    const { raiz, componente } = montar(['PLATFORM.ADMIN'], [ALFA]);
    (componente as unknown as { toggleProfile(): void }).toggleProfile();

    expect(raiz.querySelector('select')).toBeNull();
  });

  /**
   * La franja de organización se retiró el 21 de septiembre de 2026 y la cabecera quedó primera.
   *
   * <p>Eran dos renglones fijos en las quince pantallas para decir quién eres y en qué organización
   * estás, que es algo que se consulta de vez en cuando. Se movió al menú de la cuenta.</p>
   */
  it('ya no hay franja de organización: la cabecera va primera', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA]);

    const contenido = raiz.querySelector('.page-content')!;
    const hijos = Array.from(contenido.children).map((n) => n.tagName.toLowerCase());

    expect(raiz.querySelector('app-context-bar')).toBeNull();
    expect(hijos[0]).toBe('header');
  });

  it('el menú lateral responde a los tres estados', () => {
    const fuera = montar(['PLATFORM.ADMIN'], [ALFA]);
    expect(entradas(fuera.raiz)).toEqual(['Inicio', 'Organizaciones', 'Seguridad']);

    TestBed.resetTestingModule();
    localStorage.clear();

    const dentro = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');
    expect(entradas(dentro.raiz)).toHaveLength(12);

    TestBed.resetTestingModule();
    localStorage.clear();

    const organizacion = montar(PERMISOS_QUE_EL_MENU_CONSULTA, [ALFA]);
    expect(entradas(organizacion.raiz)).toHaveLength(11);
    expect(entradas(organizacion.raiz)).not.toContain('Organizaciones');
  });

  /**
   * El menú vuelve a tener grupos.
   *
   * <b>Esta prueba estaba escrita al revés y se invirtió a propósito.</b> Se llamaba «el menú es
   * plano: ya no hay títulos de grupo» y aseguraba que no existiera ningún `.menu-group`, que era
   * la decisión de la tanda 1 —seguir el bosquejo, que dibuja una lista plana—. Los grupos
   * volvieron por decisión posterior, ya con las once entradas en pantalla. Se deja constancia
   * aquí para que nadie lea el historial al revés y crea que esto es una regresión.
   */
  it('el menú agrupa las entradas bajo sus encabezados', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    expect(gruposDelMenu(raiz)).toEqual(['Principal', 'Operación', 'Configuración']);

    // El encabezado no es un control: no se puede tabular hasta él ni activarlo.
    for (const grupo of Array.from(raiz.querySelectorAll('.side-nav .menu-group'))) {
      expect(grupo.tagName.toLowerCase()).toBe('h2');
      expect(grupo.hasAttribute('href')).toBe(false);
      expect(grupo.getAttribute('tabindex')).toBeNull();
    }
  });

  /** Cada lista dice de qué grupo es, para quien recorre el menú sin verlo. */
  it('cada lista del menú queda amarrada a su encabezado', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    const listas = Array.from(raiz.querySelectorAll('.side-nav .menu-list'));
    expect(listas).toHaveLength(3);

    for (const lista of listas) {
      const id = lista.getAttribute('aria-labelledby');
      expect(id).toBeTruthy();
      expect(raiz.querySelector(`#${id}`)?.classList.contains('menu-group')).toBe(true);
    }
  });

  /**
   * El grupo vacío no se dibuja. «Reportes y dashboards» existe declarado y sus dos entradas
   * están fuera de fase 1, así que el encabezado no debe aparecer: prometería una sección que la
   * aplicación no tiene.
   */
  it('no dibuja el encabezado de un grupo sin entradas visibles', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    expect(gruposDelMenu(raiz)).not.toContain('Reportes y dashboards');
    expect(raiz.querySelectorAll('.side-nav .menu-group').length).toBe(
      raiz.querySelectorAll('.side-nav .menu-list').length,
    );
  });

  /**
   * Con el menú cerrado, el cromo no nombra la organización; abierto, la nombra una vez.
   *
   * <p>La segunda mitad es la que importa: el dato no se perdió al quitar la franja, sólo cambió
   * de sitio. Sin ella, «ya no aparece» sería indistinguible de haberlo borrado.</p>
   */
  it('la organización se dice una sola vez, y dentro del menú de la cuenta', () => {
    const { raiz, fixture, componente } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');
    const nombra = () =>
      Array.from(raiz.querySelectorAll('*')).filter(
        (n) => n.children.length === 0 && n.textContent?.includes('Alfa Seguridad Privada'),
      );

    expect(nombra(), 'con el menú cerrado, el cromo no la nombra').toHaveLength(0);

    (componente as unknown as { toggleProfile(): void }).toggleProfile();
    fixture.detectChanges();

    expect(nombra()).toHaveLength(1);
    expect(raiz.querySelector('.account-menu')?.textContent).toContain('admin@gestia.local');
  });

  /**
   * Cambiar de organización sobrevivió al cambio de sitio.
   *
   * <p>La franja que se retiró era <b>el único lugar</b> donde un super admin podía cambiar de
   * organización y salir de ella. Quitarla sin esto habría dejado la sesión encerrada en la
   * organización activa, y nada en pantalla lo diría.</p>
   */
  it('desde el menú se puede cambiar de organización y salir de ella', () => {
    const { raiz, fixture, componente } = montar(['PLATFORM.ADMIN'], [ALFA, BETA], 'org-a');
    (componente as unknown as { toggleProfile(): void }).toggleProfile();
    fixture.detectChanges();

    const menu = raiz.querySelector('.account-menu')!;

    expect(menu.querySelector('gi-select'), 'el selector de organización').not.toBeNull();
    expect(menu.textContent).toContain('Salir de la organización');
    expect(menu.textContent).toContain('Cerrar sesión');
  });

  /**
   * Al desplegar la lista de organizaciones se vuelve a pedir al servidor.
   *
   * <p>Portada de la barra de contexto, que se retiró. Sin esto, la lista del super admin se carga
   * una sola vez al construir el shell, y una organización dada de alta después no aparece hasta
   * recargar la página entera. Y nada lo delata: el desplegable se abre con normalidad y
   * simplemente le falta una.</p>
   */
  it('al abrir el desplegable de organizaciones vuelve a pedir la lista', () => {
    const { raiz, fixture, componente } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');
    (componente as unknown as { toggleProfile(): void }).toggleProfile();
    fixture.detectChanges();

    expect(raiz.textContent).not.toContain('Gamma Vigilancia');

    raiz.querySelector<HTMLButtonElement>('.account-menu gi-select button')!.click();
    fixture.detectChanges();
    http.expectOne('/api/v1/organizations').flush([ALFA, BETA, GAMMA]);
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Gamma Vigilancia');
  });

  /**
   * Y si ese refresco falla, no se vacía la lista.
   *
   * <p>Quien abrió el desplegable quería cambiar de organización; dejarlo sin opciones porque la
   * petición no llegó es peor que enseñarle una lista que quizá no incluye la última.</p>
   */
  it('si el refresco de organizaciones falla, se queda con las que ya tenía', () => {
    const { raiz, fixture, componente } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');
    (componente as unknown as { toggleProfile(): void }).toggleProfile();
    fixture.detectChanges();

    raiz.querySelector<HTMLButtonElement>('.account-menu gi-select button')!.click();
    fixture.detectChanges();
    http.expectOne('/api/v1/organizations').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Alfa Seguridad Privada');
    expect(raiz.textContent).toContain('Beta Custodia');
  });

  /**
   * Con una sola organización se enseña el nombre y no se ofrece cambiarla.
   *
   * <p>Un selector de una opción es ruido, y además sugiere que se puede cambiar a algo. Salir
   * tampoco se ofrece: un admin de organización que «saliera» volvería a caer en la suya.</p>
   */
  it('con una sola organización no ofrece cambiarla ni salir de ella', () => {
    const { raiz, fixture, componente } = montar(['CLIENTS.READ'], [ALFA], 'org-a');
    (componente as unknown as { toggleProfile(): void }).toggleProfile();
    fixture.detectChanges();

    const menu = raiz.querySelector('.account-menu')!;

    expect(menu.textContent).toContain('Alfa Seguridad Privada');
    expect(menu.querySelector('gi-select')).toBeNull();
    expect(menu.textContent).not.toContain('Salir de la organización');
    expect(menu.textContent, 'cerrar sesión sí, siempre').toContain('Cerrar sesión');
  });

  /**
   * La cuenta está abajo a la izquierda, al pie del menú, y no arriba a la derecha.
   *
   * <p>Estuvo unas horas en la barra superior y el sitio no era el bueno: el nombre de quien está
   * dentro no es una acción de la página, es el ancla de la sesión, y donde se busca es al final de
   * la navegación. Esta prueba fija las dos mitades —que está en el pie y que NO está en la barra—
   * porque moverlo sin quitarlo del sitio anterior lo dejaría dos veces.</p>
   */
  it('la cuenta va al pie del menú lateral, no en la barra superior', () => {
    const { raiz } = montar(PERMISOS_QUE_EL_MENU_CONSULTA, [ALFA], 'org-a');

    expect(raiz.querySelector('.sidebar-foot .sidebar-account')).not.toBeNull();
    expect(raiz.querySelector('.app-header .sidebar-account')).toBeNull();
    expect(raiz.querySelector('.app-header .profile')).toBeNull();
  });

  /** Un botón sin texto visible tiene que decir qué hace por otro camino. */
  it('todo botón tiene nombre accesible, incluidos los de sólo icono', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    for (const boton of Array.from(raiz.querySelectorAll('button'))) {
      const nombre = boton.getAttribute('aria-label') ?? boton.textContent?.trim() ?? '';

      expect(nombre.length, `Botón sin nombre accesible: ${boton.className}`).toBeGreaterThan(0);
    }
  });

  it('todo enlace del menú lleva su texto y su dirección', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    // Los renglones que despliegan no son enlaces y no llevan dirección: se excluyen aquí y se
    // comprueban en la prueba siguiente, que es donde se dice qué sí tienen que tener.
    const enlaces = Array.from(raiz.querySelectorAll('.side-nav .menu-link:not(.menu-link--branch)'));

    expect(enlaces.length, 'tiene que quedar algún enlace de verdad que comprobar').toBeGreaterThan(0);

    for (const enlace of enlaces) {
      expect(enlace.querySelector('.menu-text')?.textContent?.trim()).toBeTruthy();
      expect(enlace.getAttribute('href')).toBeTruthy();
    }
  });

  /**
   * Una entrada con hijos despliega y **no navega**.
   *
   * <p>Hasta el 21 de septiembre de 2026 «Catálogos» era un enlace con un botón de galón al lado, y
   * se sentía como una trampa: quien lo pulsaba para ver la lista acababa en otra pantalla. Ahora
   * el renglón entero es el interruptor, así que es un <c>&lt;button&gt;</c> sin dirección y con
   * <c>aria-expanded</c>, que es lo que anuncia a un lector de pantalla que ahí hay algo que
   * abrir.</p>
   */
  it('la entrada con hijos despliega en vez de navegar', () => {
    const { raiz } = montar(PERMISOS_QUE_EL_MENU_CONSULTA, [ALFA], 'org-a');

    const rama = raiz.querySelector('.side-nav .menu-link--branch');

    expect(rama, 'Catálogos tiene hijos, así que tiene que ser una rama').toBeTruthy();
    expect(rama?.tagName).toBe('BUTTON');
    expect(rama?.getAttribute('href'), 'una rama no lleva a ninguna parte').toBeNull();
    expect(rama?.getAttribute('aria-expanded')).toBe('false');
    expect(rama?.querySelector('.menu-text')?.textContent?.trim()).toBe('Catálogos');
  });

  it('la navegación principal está anunciada como tal', () => {
    const { raiz } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');

    expect(raiz.querySelector('aside')?.getAttribute('aria-label')).toBe('Navegación principal');
  });

  /**
   * **El mecanismo por el que cambiar de organización cambia lo que se ve.**
   *
   * Heredar de la barra arregla de dónde sale el identificador de organización, no cuándo se piden
   * los datos: las pantallas cargan en `ngOnInit` y nadie las vuelve a llamar. Sin el remonte,
   * cambiar de organización dejaría en pantalla la tabla de la anterior mientras la franja dice
   * otra cosa, que es el defecto que apareció al verificar en el navegador.
   *
   * La destrucción importa tanto como el montaje: es la que cancela las peticiones en vuelo de la
   * organización que se deja. Dos pruebas de la pantalla de Servicios cuidaban esa garantía cuando
   * el cambio de organización vivía allí; se retiraron con ese mecanismo y la garantía vive aquí.
   */
  it('cambiar de organización destruye la pantalla abierta y monta una nueva', async () => {
    PantallaDeModulo.montajes = 0;
    PantallaDeModulo.destrucciones = 0;

    const { fixture } = montar(['PLATFORM.ADMIN'], [ALFA], 'org-a');
    const auth = TestBed.inject(AuthService);

    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();

    const despuesDeAbrir = PantallaDeModulo.montajes;
    expect(despuesDeAbrir).toBeGreaterThan(0);

    auth.setActiveOrganization('org-b');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(PantallaDeModulo.montajes).toBe(despuesDeAbrir + 1);
    expect(PantallaDeModulo.destrucciones).toBe(1);
  });

  /**
   * El submenú se abre solo cuando la página abierta cuelga de esa entrada.
   *
   * <p>Es lo que hace que el menú te enseñe dónde estás al llegar por un enlace o al recargar, sin
   * que nadie haya pulsado nada.</p>
   */
  it('despliega el submenú de la entrada dentro de la que estás', async () => {
    const { fixture } = montar(PERMISOS_QUE_EL_MENU_CONSULTA, [ALFA], 'org-a');
    const shell = fixture.componentInstance as unknown as {
      isSubmenuOpen(route: string): boolean;
      toggleSubmenu(route: string): void;
    };

    expect(shell.isSubmenuOpen('/catalogos'), 'en la raíz, cerrado').toBe(false);

    await TestBed.inject(Router).navigateByUrl('/catalogos/puestos');
    fixture.detectChanges();

    expect(shell.isSubmenuOpen('/catalogos'), 'dentro de un catálogo, abierto').toBe(true);
  });

  /**
   * Los bloques del submenú empiezan cerrados, salvo el de la página en la que estás.
   *
   * <p>Con dieciocho entradas, abrir los cinco bloques devuelve la lista larga que el submenú venía
   * a evitar. Cerrados, los cinco rótulos son un índice que cabe de un vistazo.</p>
   */
  it('los bloques del submenú empiezan cerrados, menos el de donde estás', async () => {
    const { fixture } = montar(PERMISOS_QUE_EL_MENU_CONSULTA, [ALFA], 'org-a');
    const shell = fixture.componentInstance as unknown as {
      isGroupOpen(route: string, group: string): boolean;
      toggleGroup(route: string, group: string): void;
    };

    expect(shell.isGroupOpen('/catalogos', 'Personal')).toBe(false);
    expect(shell.isGroupOpen('/catalogos', 'Clientes')).toBe(false);

    await TestBed.inject(Router).navigateByUrl('/catalogos/puestos');
    fixture.detectChanges();

    expect(shell.isGroupOpen('/catalogos', 'Personal'), 'Puestos vive en Personal').toBe(true);
    expect(shell.isGroupOpen('/catalogos', 'Clientes'), 'y sólo ése').toBe(false);
  });

  /** Y cada bloque se abre y se cierra por su cuenta, sin arrastrar a los demás. */
  it('un bloque se abre sin abrir los otros', () => {
    const { fixture } = montar(PERMISOS_QUE_EL_MENU_CONSULTA, [ALFA], 'org-a');
    const shell = fixture.componentInstance as unknown as {
      isGroupOpen(route: string, group: string): boolean;
      toggleGroup(route: string, group: string): void;
    };

    shell.toggleGroup('/catalogos', 'Operación');
    fixture.detectChanges();

    expect(shell.isGroupOpen('/catalogos', 'Operación')).toBe(true);
    expect(shell.isGroupOpen('/catalogos', 'Personal')).toBe(false);
  });

  /**
   * Y el control: lo que el usuario decide gana a dónde está.
   *
   * <p>Sin esto, «se abre cuando estás dentro» sería indistinguible de «se abre y no se puede
   * cerrar», que es el defecto que este estado de tres valores existe para evitar.</p>
   */
  it('si el usuario lo cierra, se queda cerrado aunque esté dentro', async () => {
    const { fixture } = montar(PERMISOS_QUE_EL_MENU_CONSULTA, [ALFA], 'org-a');
    const shell = fixture.componentInstance as unknown as {
      isSubmenuOpen(route: string): boolean;
      toggleSubmenu(route: string): void;
    };

    await TestBed.inject(Router).navigateByUrl('/catalogos/puestos');
    fixture.detectChanges();
    expect(shell.isSubmenuOpen('/catalogos')).toBe(true);

    shell.toggleSubmenu('/catalogos');
    fixture.detectChanges();

    expect(shell.isSubmenuOpen('/catalogos')).toBe(false);
  });
});
