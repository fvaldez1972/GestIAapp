import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AssignOption, EmployeeAssignDialog, EmployeeAssignValue } from './employee-assign-dialog';

const CLIENTES: readonly AssignOption[] = [
  { id: 'c-1', name: 'Meridiano Cines' },
  { id: 'c-2', name: 'Torre Poniente' },
];

const SERVICIOS: readonly AssignOption[] = [{ id: 's-1', name: 'Control de acceso' }];
const POSICIONES: readonly AssignOption[] = [{ id: 'p-1', name: 'P-02 · Guardia de noche' }];

@Component({
  imports: [EmployeeAssignDialog],
  template: `
    <app-employee-assign-dialog
      [open]="abierta()"
      employeeName="Adrián Escobar Escobar"
      [clients]="clientes()"
      [services]="servicios()"
      [positions]="posiciones()"
      operationalToday="2026-09-24"
      [saving]="guardando()"
      [problem]="problema()"
      (clientChange)="clientesElegidos.set([...clientesElegidos(), $event])"
      (serviceChange)="serviciosElegidos.set([...serviciosElegidos(), $event])"
      (save)="guardadas.set([...guardadas(), $event])"
      (cancel)="cancelaciones.set(cancelaciones() + 1)"
    />
  `,
})
class Anfitrion {
  readonly abierta = signal(true);
  readonly clientes = signal<readonly AssignOption[]>(CLIENTES);
  readonly servicios = signal<readonly AssignOption[]>([]);
  readonly posiciones = signal<readonly AssignOption[]>([]);
  readonly guardando = signal(false);
  readonly problema = signal('');
  readonly clientesElegidos = signal<string[]>([]);
  readonly serviciosElegidos = signal<string[]>([]);
  readonly guardadas = signal<EmployeeAssignValue[]>([]);
  readonly cancelaciones = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  /** Elige una opción del desplegable número `indice`, por el texto que enseña. */
  const elegir = (indice: number, etiqueta: string) => {
    const select = raiz.querySelectorAll('gi-select')[indice];
    select.querySelector<HTMLButtonElement>('button[role="combobox"]')!.click();
    fixture.detectChanges();

    const opcion = Array.from(select.querySelectorAll<HTMLElement>('.gi-select__option')).find((o) =>
      o.textContent!.includes(etiqueta),
    )!;
    opcion.click();
    fixture.detectChanges();
  };

  const boton = (texto: string) =>
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('.asig__boton')).find((b) =>
      b.textContent!.trim().startsWith(texto),
    )!;

  const fecha = () => raiz.querySelector<HTMLInputElement>('#asig-desde')!;

  return { fixture, raiz, host: fixture.componentInstance, elegir, boton, fecha };
}

/** Deja la ventana con cliente, servicio y posición elegidos, que es lo mínimo para asignar. */
function completar(t: ReturnType<typeof montar>) {
  t.elegir(0, 'Meridiano Cines');
  t.host.servicios.set(SERVICIOS);
  t.fixture.detectChanges();

  t.elegir(1, 'Control de acceso');
  t.host.posiciones.set(POSICIONES);
  t.fixture.detectChanges();

  t.elegir(2, 'Guardia de noche');
}

describe('Asignar a una posición desde el expediente', () => {
  const metodos = ['showModal', 'close'] as const;
  const originales = metodos.map((metodo) =>
    Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, metodo),
  );

  beforeEach(() => {
    // jsdom no implementa el diálogo modal. Se sustituye por algo que abra y cierre de verdad, para
    // que el formulario quede en el árbol y las pruebas puedan elegir en él.
    for (const metodo of metodos) {
      Object.defineProperty(HTMLDialogElement.prototype, metodo, {
        configurable: true,
        writable: true,
        value(this: HTMLDialogElement) {
          this.open = metodo === 'showModal';
        },
      });
    }

    TestBed.configureTestingModule({ imports: [Anfitrion] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();

    // Se devuelve lo que había: otro archivo de pruebas puede estar comprobando justo que el
    // navegador no lo implementa, y el reparto de archivos entre procesos cambia de una corrida a
    // otra.
    metodos.forEach((metodo, i) => {
      const original = originales[i];
      if (original) {
        Object.defineProperty(HTMLDialogElement.prototype, metodo, original);
      } else {
        delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[metodo];
      }
    });
  });

  /** La fecha sale del día operativo del servidor: en UTC el día cambia seis horas antes. */
  it('la fecha empieza en el día operativo, no en el reloj del navegador', () => {
    expect(montar().fecha().value).toBe('2026-09-24');
  });

  /**
   * Un botón apagado sin motivo se lee como que la aplicación se rompió. Se nombra un campo, el
   * primero que falta, en el orden en que se llenan.
   */
  it('mientras falte algo, el botón dice qué falta', () => {
    const t = montar();

    expect(t.boton('Asignar').disabled).toBe(true);
    expect(t.raiz.querySelector('#asig-falta')!.textContent).toContain('el cliente');

    t.elegir(0, 'Meridiano Cines');
    t.host.servicios.set(SERVICIOS);
    t.fixture.detectChanges();

    expect(t.raiz.querySelector('#asig-falta')!.textContent).toContain('el servicio');

    t.elegir(1, 'Control de acceso');
    t.host.posiciones.set(POSICIONES);
    t.fixture.detectChanges();

    expect(t.raiz.querySelector('#asig-falta')!.textContent).toContain('la posición');
  });

  /**
   * <b>La cascada se limpia sola.</b>
   *
   * <p>Sin esto se puede guardar la posición de un servicio junto al servicio de otro: los tres
   * identificadores viajan juntos y el desplegable de abajo conserva lo que ya tenía elegido, así
   * que el servidor recibiría una combinación que nadie eligió.</p>
   */
  it('cambiar de cliente vacía el servicio y la posición', () => {
    const t = montar();
    completar(t);

    expect(t.boton('Asignar').disabled).toBe(false);

    t.elegir(0, 'Torre Poniente');

    expect(t.boton('Asignar').disabled).toBe(true);
    expect(t.raiz.querySelector('#asig-falta')!.textContent).toContain('el servicio');
    expect(t.host.clientesElegidos()).toEqual(['c-1', 'c-2']);
  });

  /**
   * <b>La marca de titular sale del tipo, y esta prueba es lo que lo fija.</b>
   *
   * <p>El alta de Servicios lleva el tipo y una casilla <c>isPrimary</c> por separado, y eso deja
   * guardar un «Apoyo» marcado como titular: dos campos que pueden contradecirse sobre el mismo
   * hecho. Las dos mitades se necesitan —si la marca fuera siempre verdadera, o siempre falsa,
   * una sola de ellas seguiría pasando—.</p>
   */
  it('«Titular» es lo que enciende la marca de titular, y sólo «Titular»', () => {
    const apoyo = montar();
    completar(apoyo);
    apoyo.boton('Asignar').click();

    expect(apoyo.host.guardadas()[0].assignmentType).toBe('Support');
    expect(apoyo.host.guardadas()[0].isPrimary).toBe(false);

    const titular = montar();
    completar(titular);
    titular.elegir(3, 'Titular');
    titular.boton('Asignar').click();

    expect(titular.host.guardadas()[0].assignmentType).toBe('Primary');
    expect(titular.host.guardadas()[0].isPrimary).toBe(true);
  });

  /** Lo que se manda son identificadores, no nombres: renombrar un cliente no mueve la asignación. */
  it('manda los tres identificadores y la fecha', () => {
    const t = montar();
    completar(t);
    t.boton('Asignar').click();

    expect(t.host.guardadas()[0]).toEqual({
      idClient: 'c-1',
      idService: 's-1',
      idPosition: 'p-1',
      assignmentType: 'Support',
      startDate: '2026-09-24',
      isPrimary: false,
    });
  });

  /**
   * Cada apertura empieza en blanco. Lo elegido en la anterior era de otra persona, y dejarlo
   * puesto asignaría a quien abre la ventana a la posición que se miró la vez pasada.
   */
  it('al volver a abrirse no conserva lo elegido antes', () => {
    const t = montar();
    completar(t);

    t.host.abierta.set(false);
    t.fixture.detectChanges();
    t.host.abierta.set(true);
    t.fixture.detectChanges();

    expect(t.boton('Asignar').disabled).toBe(true);
    expect(t.raiz.querySelector('#asig-falta')!.textContent).toContain('el cliente');
  });

  /** Lo que el servidor contesta al rechazar se enseña tal cual: es quien manda sobre elegibilidad. */
  it('enseña el rechazo del servidor', () => {
    const t = montar((host) => host.problema.set('La persona no cumple el perfil de la posición.'));

    expect(t.raiz.querySelector('.asig__problema')!.textContent).toContain('no cumple el perfil');
  });
});
