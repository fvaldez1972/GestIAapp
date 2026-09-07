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
   * La píldora existe para <b>no abrir la ficha</b>. Si dijera sólo un número, habría que abrirla
   * para saber de qué era.
   */
  it('la vigencia documental dice cuántos y de qué, y gana el peor', () => {
    const { filas } = montar();

    expect(filas()[0].querySelector('.pill')?.textContent?.trim()).toBe('Al día');
    // Tiene un vencido y uno sin cargar: manda el vencido, que ya está bloqueando.
    expect(filas()[1].querySelector('.pill')?.textContent?.trim()).toBe('1 vencido');
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

  /** Con la ficha abierta la tabla se comprime; lo que queda es lo que identifica y lo urgente. */
  it('comprimida conserva el nombre y la vigencia documental', () => {
    const { encabezados } = montar((host) => host.compact.set(true));

    expect(encabezados()).toContain('Empleado');
    expect(encabezados()).toContain('Documentos');
    expect(encabezados()).not.toContain('Estado · Municipio');
  });
});
