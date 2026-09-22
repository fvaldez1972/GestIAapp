import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { PlatformPage } from './platform-page';

const ORGANIZACION = {
  idOrganization: 'org-a',
  codeOrganization: 'ORG-01',
  legalName: 'Seguridad Vanguardia',
  rfc: 'BCS140726356',
  active: true,
};

const OTRA = {
  idOrganization: 'org-b',
  codeOrganization: 'ORG-02',
  legalName: 'Transnacional del Bajío',
  rfc: 'TDB010203XYZ',
  active: true,
};

const ROL_ADMIN = {
  idRole: 'rol-1',
  codeRole: 'ORGANIZATION_ADMIN',
  name: 'Admin de organización',
  description: null,
  isSystem: true,
  active: true,
  permissions: [],
};

/**
 * El alta de organización del Super Admin.
 *
 * <p>Lo que se fija aquí es el formulario tal como quedó tras la revisión: <b>el código ya no se
 * pide</b> —lo genera el servidor con la forma <c>ORG-01</c>, como el de cliente—, el nombre va
 * antes que el RFC, y el alta no está abierta de entrada sino detrás de un botón.</p>
 */
describe('Plataforma · alta de organización', () => {
  afterEach(() => TestBed.resetTestingModule());

  function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            operationalOrganizationId: signal('org-a'),
            activeOrganization: () => ORGANIZACION,
            hasPermission: () => true,
            session: () => ({ permissions: [], isPlatformAdmin: true }),
            isPlatformAdmin: () => true,
          },
        },
      ],
    });

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PlatformPage);
    fixture.detectChanges();

    // Las cuatro peticiones que la pantalla lanza al entrar. Se responden por funcion y no por
    // cadena literal: algunas llevan parametros y la comparacion exacta no las encontraria.
    http.match((r) => r.url.endsWith('/organizations')).forEach((r) => r.flush([ORGANIZACION, OTRA]));
    http.match((r) => r.url.endsWith('/organizations/governance')).forEach((r) =>
      r.flush([
        { organization: ORGANIZACION, clients: [], usersCount: 0, adminsCount: 0 },
        { organization: OTRA, clients: [], usersCount: 0, adminsCount: 0 },
      ]),
    );
    http.match((r) => r.url.endsWith('/users')).forEach((r) => r.flush([]));
    http.match((r) => r.url.endsWith('/roles')).forEach((r) => r.flush([ROL_ADMIN]));
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const boton = (texto: string) =>
      Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);

    return { fixture, http, raiz, boton };
  }

  /**
   * El formulario ocupaba media pantalla siempre, abierto sobre el directorio. Dar de alta una
   * empresa pasa de vez en cuando; leer el directorio es a lo que se entra.
   *
   * <p>Y el boton vive <b>en la cabecera de la pantalla</b>, con las demas acciones. Dentro de la
   * tarjeta del alta quedaba a media pagina: para dar de alta una organizacion habia que bajar
   * hasta encontrarlo, y quien entraba no veia que se pudiera.</p>
   */
  it('el alta no está abierta de entrada, y el botón que la abre está en la cabecera', () => {
    const { raiz, boton, fixture } = montar();

    // El marcador es la ventana, no la etiqueta del campo: «Nombre de la organización» tambien
    // aparece en la vista de lectura de la ficha, asi que buscarla no distingue nada.
    expect(raiz.querySelector('.modal-backdrop')).toBeNull();

    const abrir = boton('Nueva organización');
    expect(abrir).toBeDefined();
    expect(abrir!.closest('.hero-actions')).not.toBeNull();

    abrir!.click();
    fixture.detectChanges();

    expect(raiz.querySelector('.modal-backdrop')).not.toBeNull();
    expect(raiz.textContent).toContain('Alta de organización');
  });

  /**
   * Se apaga en vez de desaparecer. Que se esfume el boton que acabas de pulsar deja dudando si se
   * pulso o si algo fallo; apagado se ve que es el que esta en curso.
   */
  it('con el alta abierta el botón sigue ahí, apagado', () => {
    const { boton, fixture } = montar();

    boton('Nueva organización')!.click();
    fixture.detectChanges();

    const abrir = boton('Nueva organización');
    expect(abrir).toBeDefined();
    expect(abrir!.disabled).toBe(true);
  });

  /**
   * El alta se abre <b>encima</b>, no dentro de la columna.
   *
   * <p>Desplegarla donde vivia dejaba el formulario empujando el directorio y la ficha de la
   * organizacion elegida: se quitaba el desorden de tenerla siempre abierta, pero seguia
   * disputandole el sitio a lo que se estaba consultando.</p>
   */
  it('el alta se abre en una ventana emergente, no dentro de la columna', () => {
    const { raiz, boton, fixture } = montar();

    expect(raiz.querySelector('.modal-backdrop')).toBeNull();

    boton('Nueva organización')!.click();
    fixture.detectChanges();

    const ventana = raiz.querySelector('.modal-backdrop .modal[role="dialog"]');
    expect(ventana).not.toBeNull();
    expect(ventana!.getAttribute('aria-modal')).toBe('true');
    // El formulario vive dentro de la ventana, no en la tarjeta del directorio.
    expect(ventana!.querySelector('form.creation-form')).not.toBeNull();
    expect(raiz.querySelector('.platform-registry form.creation-form')).toBeNull();
  });

  /**
   * La ficha apilaba cinco bloques: datos editables, alta de admin, lista de admins, lista de
   * clientes y una nota. Para leer quien es el responsable habia que pasar por encima de un
   * formulario vacio.
   */
  it('la ficha separa por pestañas lo que se edita de lo que se consulta', () => {
    const { raiz, fixture } = montar();

    const pestanas = Array.from(raiz.querySelectorAll('.detail-tabs [role="tab"]')).map((n) =>
      n.textContent!.trim(),
    );
    expect(pestanas).toEqual(['Responsables', 'Clientes']);

    // No hay pestaña de datos: el nombre y el RFC ya los dice la cabecera, a dos centimetros.
    expect(raiz.textContent).not.toContain('Datos de la organización');
    expect(raiz.textContent).toContain('Responsables de la organización');

    const clientes = Array.from(
      raiz.querySelectorAll<HTMLButtonElement>('.detail-tabs [role="tab"]'),
    ).find((b) => b.textContent?.trim() === 'Clientes')!;
    clientes.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Clientes dentro de la organización');
    expect(raiz.textContent).not.toContain('Responsables de la organización');
  });

  /** Y el alta de admin sigue la misma regla que la de organización: ventana, no incrustada. */
  it('crear admin también abre en ventana, y no estorba a la lista de responsables', () => {
    const { raiz, boton, fixture } = montar();

    const responsables = Array.from(
      raiz.querySelectorAll<HTMLButtonElement>('.detail-tabs [role="tab"]'),
    ).find((b) => b.textContent?.trim() === 'Responsables')!;
    responsables.click();
    fixture.detectChanges();

    // La lista se lee sin un formulario encima.
    expect(raiz.querySelector('.modal-backdrop')).toBeNull();

    boton('Crear admin')!.click();
    fixture.detectChanges();

    const ventana = raiz.querySelector('.modal-backdrop .modal[role="dialog"]');
    expect(ventana).not.toBeNull();
    expect(ventana!.textContent).toContain('Crear admin para esta organización');
  });

  /**
   * La pestaña Datos <b>enseña</b>; editar es otra cosa y se pide aparte.
   *
   * <p>Antes los tres campos eran cajas de texto siempre listas para escribir: consultar el RFC de
   * una organizacion y cambiarlo se veian igual, y no habia forma de leer sin tener el cursor a un
   * clic de modificar.</p>
   */
  /**
   * La ficha enseña el nombre y el RFC <b>una sola vez</b>, en su cabecera.
   *
   * <p>Hubo una pestaña «Datos» que los repetia dos centimetros mas abajo, y encima con un boton de
   * desactivar suelto al lado. Editarlos se pide desde la cabecera, junto a las demas acciones de
   * la ficha.</p>
   */
  it('la ficha no repite el nombre ni el RFC en una pestaña aparte', () => {
    const { raiz, boton } = montar();

    expect(raiz.querySelector('.detail-facts')).toBeNull();
    expect(raiz.textContent).not.toContain('Datos de la organización');
    // El RFC aparece en la cabecera de la ficha y en la fila del directorio, no una tercera vez.
    expect((raiz.textContent!.match(/BCS140726356/g) ?? []).length).toBe(2);

    const editar = boton('Editar');
    expect(editar).toBeDefined();
    expect(editar!.closest('.platform-detail .section-heading')).not.toBeNull();
  });

  /**
   * El codigo no se enseña en ningun sitio de esta pantalla.
   *
   * <p>Lo pone el servidor al dar de alta y no se captura ni se corrige desde aqui. Enseñarlo como
   * un dato mas —en la ficha, en el subtitulo y en cada fila del directorio— invitaba a tratarlo
   * como algo que se decide. Sigue existiendo y sigue siendo unico; lo que se quito es su
   * presencia en la pantalla.</p>
   */
  it('el código de la organización no aparece en la pantalla', () => {
    const { raiz } = montar();

    expect(raiz.textContent).not.toContain('ORG-01');
    expect(raiz.textContent).not.toContain('Código');
  });

  /** Y editar abre en ventana, como las dos altas: en esta pantalla los formularios no se incrustan. */
  it('«Editar» abre los campos en una ventana, con los valores de hoy', async () => {
    const { raiz, boton, fixture } = montar();

    boton('Editar')!.click();
    fixture.detectChanges();
    // `ngModel` escribe el valor en el input en un microtask, no en el mismo ciclo de deteccion.
    await fixture.whenStable();
    fixture.detectChanges();

    const ventana = raiz.querySelector('.modal-backdrop .modal[role="dialog"]');
    expect(ventana).not.toBeNull();

    // Los mismos campos y el mismo orden que el alta: nombre y luego RFC, sin codigo.
    const etiquetas = Array.from(ventana!.querySelectorAll('label > span')).map((n) =>
      n.textContent!.trim(),
    );
    expect(etiquetas.slice(0, 2)).toEqual(['Nombre de la organización', 'RFC']);

    // Y la baja va dentro del formulario, no en un boton suelto que se aplicaba solo.
    const baja = ventana!.querySelector('input[name="editOrganizationInactive"]') as HTMLInputElement;
    expect(baja).not.toBeNull();
    expect(baja.checked).toBe(false);

    const nombre = ventana!.querySelector('input[name="editOrganizationLegalName"]') as HTMLInputElement;
    expect(nombre.value).toBe('Seguridad Vanguardia');
  });

  /**
   * Marcar la casilla desactiva al guardar; el estado solo viaja si cambio.
   *
   * <p>La baja era un boton suelto que se aplicaba solo, al margen del formulario. Ahora va con los
   * demas cambios: se ve en que estado va a quedar antes de confirmar, y se deshace cerrando sin
   * guardar.</p>
   *
   * <p>Que el estado <b>solo</b> viaje cuando cambia importa tanto como lo primero: mandarlo
   * siempre dejaria en la auditoria un cambio de estado cada vez que alguien corrige una letra del
   * nombre.</p>
   */
  it('la casilla de baja se aplica al guardar, encadenada tras el cambio de datos', async () => {
    const { raiz, boton, fixture, http } = montar();

    boton('Editar')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const baja = raiz.querySelector('input[name="editOrganizationInactive"]') as HTMLInputElement;
    baja.checked = true;
    baja.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    boton('Guardar cambios')!.click();
    fixture.detectChanges();

    // Primero se guardan el nombre y el RFC…
    const guardado = http.expectOne(
      (r) => r.method === 'PUT' && r.url.endsWith(`/organizations/${ORGANIZACION.idOrganization}`),
    );
    // …y el codigo no viaja: el servidor conserva el que ya tiene.
    expect(guardado.request.body.codeOrganization).toBeUndefined();
    guardado.flush(ORGANIZACION);
    fixture.detectChanges();

    // …y despues la baja, encadenada.
    http
      .expectOne(
        (r) => r.method === 'DELETE' && r.url.endsWith(`/organizations/${ORGANIZACION.idOrganization}`),
      )
      .flush(null);
  });

  /**
   * El buscador del directorio filtra por nombre y por RFC.
   *
   * <p>El RFC entra porque es lo unico que distingue a dos organizaciones con nombres parecidos, y
   * es el dato con el que llega una factura o un contrato. La comparacion ignora acentos y
   * mayusculas: quien busca «Bajío» no deberia tener que acertar el acento.</p>
   */
  it('el directorio se puede buscar por nombre y por RFC', async () => {
    const { raiz, fixture } = montar();

    const buscar = raiz.querySelector('input[name="organizationSearch"]') as HTMLInputElement;
    expect(buscar).not.toBeNull();

    const escribir = async (texto: string) => {
      buscar.value = texto;
      buscar.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const filas = () =>
      Array.from(raiz.querySelectorAll('.organization-row strong')).map((n) => n.textContent!.trim());

    expect(filas()).toHaveLength(2);

    // Por nombre, sin acento y en minusculas.
    await escribir('bajio');
    expect(filas()).toEqual(['Transnacional del Bajío']);

    // Por RFC.
    await escribir('BCS1407');
    expect(filas()).toEqual(['Seguridad Vanguardia']);
  });

  /** Una lista vacia por la busqueda no es una lista vacia: no es lo mismo que no haya ninguna. */
  it('sin coincidencias lo dice, en vez de decir que no hay organizaciones', async () => {
    const { raiz, fixture } = montar();

    const buscar = raiz.querySelector('input[name="organizationSearch"]') as HTMLInputElement;
    buscar.value = 'zzzzz';
    buscar.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Ninguna organización coincide');
    expect(raiz.textContent).not.toContain('Sin organizaciones registradas');
  });

  /**
   * La tira de indicadores se retiro de la cabecera.
   *
   * <p>Repetia en cuatro recuadros lo que el directorio y la ficha ya dicen, y empujaba hacia abajo
   * las dos cosas a las que se entra: la lista de organizaciones y el detalle de la elegida.</p>
   */
  it('ya no lleva la tira de indicadores', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.platform-kpis')).toBeNull();
    expect(raiz.textContent).not.toContain('Rol para alta');
  });

  /**
   * El nombre de cada organizacion se lee en el color del texto, no en el del error.
   *
   * <p>Al retirar unos estilos que ya no tenian dueño se borro el cierre de una lista de
   * selectores, y <c>.organization-row strong</c> quedo colgando: se fusiono con la regla del
   * mensaje de error que venia debajo y los nombres del directorio se pintaron en rojo. Compilaba
   * igual, que es lo peor del caso, y solo se veia mirando la pantalla.</p>
   */
  it('los nombres del directorio no se pintan con el color de error', () => {
    const { raiz } = montar();

    const nombre = raiz.querySelector('.organization-row strong');
    expect(nombre).not.toBeNull();
    // La regla rota fusionaba el nombre con `.campo-error`, que ademas lo hacia `display: block`
    // con un margen superior. Si vuelve a pasar, esta clase reaparece en el mismo bloque.
    expect(nombre!.classList.contains('campo-error')).toBe(false);
    expect(getComputedStyle(nombre!).color).not.toBe('rgb(220, 38, 38)');
  });

  /** La leyenda de «Separación de niveles» se retiro: ocupaba sitio sin decir nada accionable. */
  it('ya no lleva la leyenda de separación de niveles', () => {
    const { raiz } = montar();

    expect(raiz.textContent).not.toContain('Separación de niveles');
  });

  /** El encabezado del alta entra y sale con el formulario: solo, anunciaba algo que no estaba. */
  it('el título del alta no se queda solo cuando el formulario está cerrado', () => {
    const { raiz, boton, fixture } = montar();

    expect(raiz.textContent).not.toContain('Alta de organización');

    boton('Nueva organización')!.click();
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Alta de organización');
  });

  /**
   * El código no se pide. Lo genera el servidor, y pedírselo a quien da de alta una empresa le
   * hacía inventar una convención que el sistema ya tiene.
   */
  it('el primer paso pide el nombre y luego el RFC, y no pide código', () => {
    const { raiz, boton, fixture } = montar();
    boton('Nueva organización')!.click();
    fixture.detectChanges();

    // Acotado a la ventana: la ficha de la derecha tiene su propio formulario de edicion, con
    // Codigo y Nombre legal, y un selector por clase los mezclaria con los del alta.
    const etiquetas = Array.from(
      raiz.querySelectorAll('.modal form.creation-form label span'),
    ).map((n) => n.textContent!.trim());

    expect(etiquetas).toEqual(['Nombre de la organización', 'RFC']);
    expect(raiz.querySelector('input[name="newOrganizationCode"]')).toBeNull();
  });

  /** El paso dos ya se llama «2. Administrador» arriba; repetirlo dentro gastaba una línea. */
  it('el segundo paso no repite un título, y la contraseña no se llama temporal', async () => {
    const { raiz, boton, fixture } = montar();
    boton('Nueva organización')!.click();
    fixture.detectChanges();

    // `ngModel` registra sus controles en un microtask, asi que hay que dejar que se vacie antes de
    // escribir: sin esto el formulario todavia no tiene controles, el valor no llega a la señal y
    // el paso se queda pidiendo los campos obligatorios que si estan llenos.
    await fixture.whenStable();

    const nombre = raiz.querySelector('input[name="newOrganizationLegalName"]') as HTMLInputElement;
    nombre.value = 'Empresa de prueba';
    nombre.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    boton('Continuar')!.click();
    fixture.detectChanges();

    expect(raiz.querySelector('form.creation-form legend')).toBeNull();
    expect(raiz.textContent).toContain('Contraseña');
    expect(raiz.textContent).not.toContain('Contraseña temporal');
  });
});
