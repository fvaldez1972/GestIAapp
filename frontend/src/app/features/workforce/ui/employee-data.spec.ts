import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmployeeListItem } from '../data-access/employee-list.models';
import { Employee } from '../data-access/workforce.models';
import { EmployeeData } from './employee-data';
import { employeeFixture } from './employee-fixtures';

@Component({
  imports: [EmployeeData],
  template: `
    <app-employee-data
      [row]="fila()"
      [employee]="detalle()"
      [canWrite]="puedeEscribir()"
      [expiringWithinDays]="30"
      (openDocuments)="aDocumentos.set(aDocumentos() + 1)"
    />
  `,
})
class Anfitrion {
  readonly fila = signal<EmployeeListItem>(employeeFixture());
  readonly detalle = signal<Employee | null>(null);
  readonly puedeEscribir = signal(false);
  readonly aDocumentos = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  return { fixture, raiz: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

/**
 * El aviso de documentos por vencer, en la pestaña de Datos.
 *
 * <p>Salió el 23 de septiembre de 2026, con todo lo de vigencias, y volvió el 24 por petición.
 * Vuelve <b>sólo como aviso</b>: no reaparecen las fechas en las filas de requisito ni la píldora
 * con el detalle. Lo que hacía falta era enterarse al abrir la ficha, que es donde se llega
 * primero; un documento por vencer sólo se veía entrando a su pestaña, y es justo lo que hay que
 * resolver antes de que la persona deje de poder trabajar: el expediente no se rompe hoy, se rompe
 * el día que caduque.</p>
 */
describe('Los datos de una persona · el aviso de lo que está por vencer', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * Las dos mitades se necesitan. Sin la segunda, «avisa» se cumpliría igual con un aviso que
   * estuviera siempre puesto, diciendo «0 requisitos vencen» a quien no tiene ninguno: eso ocupa
   * el mismo sitio que un aviso de verdad y obliga a leer el número para saber que no hay nada
   * que hacer.
   */
  it('avisa cuando hay requisitos por vencer, y calla cuando no los hay', () => {
    const conAviso = montar((anfitrion) =>
      anfitrion.fila.set(employeeFixture({ expiringDocuments: 2 })),
    );

    expect(conAviso.raiz.querySelector('.porvencer')).not.toBeNull();
    expect(conAviso.raiz.textContent).toContain('2 requisitos de esta persona vencen');

    const sinAviso = montar((anfitrion) =>
      anfitrion.fila.set(employeeFixture({ expiringDocuments: 0 })),
    );

    expect(sinAviso.raiz.querySelector('.porvencer')).toBeNull();
    // El control de que la ficha sí se montó y la prueba está mirando algo.
    expect(sinAviso.raiz.textContent).toContain('Identificación');
  });

  /** El aviso lleva a donde se resuelve: si no, dice que algo pasa y deja buscar dónde. */
  it('el aviso lleva a la pestaña de Documentos', () => {
    const { raiz, host } = montar((anfitrion) =>
      anfitrion.fila.set(employeeFixture({ expiringDocuments: 1 })),
    );

    raiz.querySelector<HTMLButtonElement>('.porvencer__action')!.click();

    expect(host.aDocumentos()).toBe(1);
  });

  /**
   * Volvió el aviso, no las fechas. La decisión del 23 sigue en pie para todo lo demás: la ficha no
   * escribe cuándo vence cada documento ni cuántos van vencidos.
   */
  it('avisar no reintroduce las fechas de vencimiento', () => {
    const { raiz } = montar((anfitrion) =>
      anfitrion.fila.set(employeeFixture({ expiringDocuments: 2, expiredDocuments: 3 })),
    );

    expect(raiz.textContent).not.toContain('vencido');
    expect(raiz.textContent).not.toContain('Vigencia');
  });
});

/**
 * El nombre en la ficha, desde RQ-06.
 *
 * <p>Se ven las tres partes y no sólo el nombre completo. Un reparto equivocado —«Empleado con» ·
 * «perfil» · «ACENTO»— se lee igual de bien en una sola línea, así que mostrar sólo el derivado
 * dejaría invisible justo lo que hay que corregir.</p>
 */
describe('Los datos de una persona · el nombre en tres partes', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * <b>El control son las etiquetas.</b> Sin comprobar que existen «Apellido paterno» y «Apellido
   * materno», una ficha que siguiera pintando sólo el nombre completo pasaría la prueba: el texto
   * «Villaseñor» aparecería igual dentro de la línea completa.
   */
  it('muestra las tres partes con su etiqueta', () => {
    const { raiz } = montar((anfitrion) =>
      anfitrion.detalle.set({
        firstName: 'Renata',
        lastNamePaternal: 'Villaseñor',
        lastNameMaternal: 'Cortés',
      } as Employee),
    );

    const identificacion = raiz.querySelector<HTMLElement>('.data__block--principal')!;

    expect(identificacion.textContent).toContain('Apellido paterno');
    expect(identificacion.textContent).toContain('Apellido materno');
    expect(identificacion.textContent).toContain('Renata');
    expect(identificacion.textContent).toContain('Villaseñor');
    expect(identificacion.textContent).toContain('Cortés');
  });

  /**
   * Quien tiene un solo apellido no tiene un campo pendiente. La ficha lo dice con esas palabras
   * para que nadie lo «complete» inventando un segundo apellido.
   */
  it('dice «Sin apellido materno» cuando no hay, en vez de «Sin dato capturado»', () => {
    const { raiz } = montar((anfitrion) =>
      anfitrion.detalle.set({
        firstName: 'Renata',
        lastNamePaternal: 'Villaseñor',
        lastNameMaternal: null,
      } as Employee),
    );

    expect(raiz.querySelector('.data__block--principal')!.textContent).toContain(
      'Sin apellido materno',
    );
  });

  /**
   * Corregir el nombre necesita permiso de escritura. <b>El control es la primera mitad</b>: sin
   * ella, un botón que estuviera siempre puesto pasaría igual.
   */
  it('ofrece editar el nombre sólo a quien puede escribir', () => {
    const soloLectura = montar();
    expect(soloLectura.raiz.textContent).not.toContain('Editar nombre');

    const conPermiso = montar((anfitrion) => anfitrion.puedeEscribir.set(true));
    expect(conPermiso.raiz.textContent).toContain('Editar nombre');
  });
});
