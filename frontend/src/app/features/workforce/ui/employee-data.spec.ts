import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmployeeListItem } from '../data-access/employee-list.models';
import { EmployeeData } from './employee-data';
import { employeeFixture } from './employee-fixtures';

@Component({
  imports: [EmployeeData],
  template: `
    <app-employee-data
      [row]="fila()"
      [expiringWithinDays]="30"
      (openDocuments)="aDocumentos.set(aDocumentos() + 1)"
    />
  `,
})
class Anfitrion {
  readonly fila = signal<EmployeeListItem>(employeeFixture());
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
