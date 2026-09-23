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
 * <p>Un documento por vencer sólo se veía entrando a su pestaña, y es justo lo que hay que resolver
 * antes de que la persona deje de poder trabajar: el expediente no se rompe hoy, se rompe el día
 * que caduque. El aviso lo pone delante al abrir la ficha, que es donde se llega primero.</p>
 */
/**
 * La ficha ya no avisa de vencimientos.
 *
 * <p>El 23 de septiembre de 2026 se retiró de la ficha todo lo que mostraba vigencias, incluido el
 * aviso que encabezaba la pestaña de Datos. La prueba que había aquí comprobaba que ese aviso
 * apareciera; ahora comprueba lo contrario, y con su control: <b>ni siquiera con documentos por
 * vencer se dibuja</b>, que es lo que distingue haberlo quitado de que no se esté probando.</p>
 */
describe('Los datos de una persona · sin avisos de vencimiento', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }));

  afterEach(() => TestBed.resetTestingModule());

  it('no dibuja aviso aunque haya documentos por vencer', () => {
    const { raiz } = montar((anfitrion) =>
      anfitrion.fila.set(employeeFixture({ expiringDocuments: 2 })),
    );

    expect(raiz.querySelector('.aviso')).toBeNull();
    expect(raiz.textContent).not.toContain('próximos a vencer');

    // El control de que la ficha sí se montó y la prueba está mirando algo: el nombre está.
    expect(raiz.textContent).toContain('Identificación');
  });
});
