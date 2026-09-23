import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmployeeListItem } from '../data-access/employee-list.models';
import { EmployeeTable } from './employee-table';
import { employeeFixture } from './employee-fixtures';

@Component({
  imports: [EmployeeTable],
  template: `
    <app-employee-table
      [employees]="employees()"
      [canWrite]="canWrite()"
      [compact]="compact()"
      (open)="abierto.set($event)"
      (action)="ultima.set($event.id)"
    />
  `,
})
class Anfitrion {
  readonly employees = signal<readonly EmployeeListItem[]>([
    employeeFixture(),
    employeeFixture({
      idEmployee: 'e2',
      codeEmployee: 'EMP-0002',
      fullName: 'Ignacio Berrones Aldama',
      status: 'OnLeave',
      idJobPositionCatalogItem: null,
      jobPositionName: null,
      jobTitle: 'Guardia',
      expiredDocuments: 1,
      missingDocuments: 1,
      documentHealth: 'Expired',
      municipality: null,
      state: null,
    }),
  ]);
  readonly canWrite = signal(true);
  readonly compact = signal(false);
  readonly abierto = signal<EmployeeListItem | null>(null);
  readonly ultima = signal('');
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    filas: () => Array.from(raiz.querySelectorAll<HTMLElement>('tbody tr')),
    encabezados: () =>
      Array.from(raiz.querySelectorAll('thead th')).map((n) => n.textContent!.trim()).filter(Boolean),
  };
}

describe('El listado de personal', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * La píldora existe para <b>no abrir la ficha</b>: dice si el expediente está cubierto.
   *
   * <p>Desde el 23 de septiembre de 2026 no dice por qué no lo está —eso obligaba a nombrar
   * vencimientos, que salieron de la pantalla— pero sigue distinguiendo las dos situaciones, que
   * es lo que decide si a la persona se le puede asignar.</p>
   */
  it('la columna de documentos distingue el expediente cubierto del que no', () => {
    const { filas } = montar();

    expect(filas()[0].querySelector('.pill')?.textContent?.trim()).toBe('Completo');
    // La segunda tiene un vencido y uno sin cargar: sigue sin estar cubierta.
    expect(filas()[1].querySelector('.pill')?.textContent?.trim()).toBe('Incompleto');
  });

  /** Un punto de color no se lee en escala de grises ni con un lector de pantalla. */
  it('cada estado lleva su palabra además del punto', () => {
    const { filas } = montar();

    expect(filas()[0].querySelector('.cell__status')?.textContent?.trim()).toContain('Activo');
    expect(filas()[1].querySelector('.cell__status')?.textContent?.trim()).toContain('Permiso');
    expect(filas()[0].querySelector('.cell__dot')).not.toBeNull();
  });

  /** El puesto heredado no bloquea, pero tampoco es un puesto comprobable. Se distingue. */
  it('el puesto sin catalogar se marca como tal', () => {
    const { filas } = montar();

    expect(filas()[0].textContent).toContain('Guardia intramuros');
    expect(filas()[1].textContent).toContain('Guardia · sin catalogar');
  });

  /** Sin domicilio no se inventa una ubicación ni se deja la celda vacía. */
  it('sin domicilio lo dice con palabras', () => {
    const { filas } = montar();

    expect(filas()[1].textContent).toContain('Sin domicilio registrado');
  });

  /**
   * Dos personas pueden llamarse igual. Sin el código, sus menús quedan indistinguibles para quien
   * navega con lector de pantalla.
   */
  it('el menú de fila lleva el nombre y el código en su nombre accesible', () => {
    const { filas } = montar();
    const boton = filas()[0].querySelector('gi-row-actions button');

    expect(boton?.getAttribute('aria-label')).toBe(
      'Acciones de Renata Villaseñor Cortés, EMP-0001',
    );
  });

  /**
   * El par duplicado que esta pantalla venía arrastrando: la fila ya abre la ficha y Documentos ya
   * es una de sus pestañas.
   */
  it('el menú no ofrece «Editar empleado» ni «Documentos»', () => {
    const { filas, fixture } = montar();
    const fila = filas()[0];
    fila.querySelector<HTMLElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    const opciones = Array.from(fila.querySelectorAll('[role="menuitem"]')).map((n) =>
      n.textContent!.trim(),
    );

    expect(opciones.some((texto) => texto.includes('Editar'))).toBe(false);
    expect(opciones.some((texto) => texto.includes('Documentos'))).toBe(false);
    expect(opciones.some((texto) => texto.includes('Asignar a una posición'))).toBe(true);
  });

  /**
   * El menú depende de la fila, y esto es lo que antes no pasaba.
   *
   * <p>La segunda persona del listado está en permiso. El menú era idéntico para todas, así que le
   * seguía ofreciendo «Registrar permiso» —que no hace nada— y no le ofrecía volver, aunque el
   * diálogo de permiso promete que «se puede reactivar» y el servidor sabe hacerlo desde siempre.
   * </p>
   */
  it('a quien está en permiso le ofrece reincorporarse, no volver a registrarlo', () => {
    const { filas, fixture } = montar();
    const enPermiso = filas()[1];
    enPermiso.querySelector<HTMLElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    const opciones = Array.from(enPermiso.querySelectorAll('[role="menuitem"]')).map((n) =>
      n.textContent!.trim(),
    );

    expect(opciones.some((texto) => texto.includes('Reincorporar'))).toBe(true);
    expect(opciones.some((texto) => texto.includes('Registrar permiso'))).toBe(false);
  });

  it('a quien está activa le ofrece el permiso, no la reincorporación', () => {
    const { filas, fixture } = montar();
    const activa = filas()[0];
    activa.querySelector<HTMLElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    const opciones = Array.from(activa.querySelectorAll('[role="menuitem"]')).map((n) =>
      n.textContent!.trim(),
    );

    expect(opciones.some((texto) => texto.includes('Registrar permiso'))).toBe(true);
    expect(opciones.some((texto) => texto.includes('Reincorporar'))).toBe(false);
  });

  /**
   * Sobre alguien dada de baja no cabe ninguna de las tres, y se enseñan apagadas con el motivo en
   * vez de desaparecer: un menú que cambia de tamaño según la fila deja a quien busca una acción
   * sin saber si no la tiene o si se equivocó de renglón.
   */
  it('a quien está dada de baja le apaga las tres acciones y dice por qué', () => {
    const { filas, fixture, host } = montar();
    host.employees.set([employeeFixture({ status: 'Terminated' })]);
    fixture.detectChanges();

    const fila = filas()[0];
    fila.querySelector<HTMLElement>('gi-row-actions button')!.click();
    fixture.detectChanges();

    const opciones = Array.from(fila.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));

    expect(opciones).toHaveLength(3);
    expect(opciones.every((boton) => boton.disabled)).toBe(true);
    expect(fila.textContent).toContain('Ya está dada de baja');
  });

  /**
   * Con la ficha abierta la tabla se comprime, pero sigue siendo una tabla.
   *
   * <p>Antes bajaba de seis columnas a dos —nombre y documentos—, así que abrir una ficha borraba
   * de la vista el puesto y el estado, que es justo lo que sirve para comparar a la persona
   * abierta con las de al lado. Lo que se va es lo que ocupa ancho sin intervenir en esa
   * comparación: la ubicación y la fecha de ingreso.</p>
   */
  it('comprimida conserva lo que sirve para comparar', () => {
    const { encabezados } = montar((host) => host.compact.set(true));

    expect(encabezados()).toContain('Persona');
    expect(encabezados()).toContain('Documentos');
    expect(encabezados()).toContain('Puesto');
    expect(encabezados()).toContain('Estado');
    expect(encabezados()).not.toContain('Ubicación');
    expect(encabezados()).not.toContain('Ingreso');
  });

  /**
   * La tabla tenía **dos** columnas encabezadas «Estado»: la geográfica y la laboral, una a cada
   * lado de «Ingreso». La misma palabra nombraba dos cosas sin relación.
   */
  it('no repite la palabra Estado en dos encabezados', () => {
    const { encabezados } = montar();
    const estados = encabezados().filter((encabezado) => encabezado === 'Estado');

    expect(estados).toHaveLength(1);
    expect(encabezados()).toContain('Ubicación');
  });
});
