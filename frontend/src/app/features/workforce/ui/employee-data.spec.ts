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
describe('Los datos de una persona · aviso de vencimiento', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }));

  afterEach(() => TestBed.resetTestingModule());

  it('avisa de los documentos por vencer y lleva a la pestaña', () => {
    const { raiz, host, fixture } = montar((anfitrion) =>
      anfitrion.fila.set(employeeFixture({ expiringDocuments: 2 })),
    );

    const aviso = raiz.querySelector('.aviso')!;
    expect(aviso).not.toBeNull();
    expect(aviso.textContent).toContain('2 documentos');
    expect(aviso.textContent).toContain('30 días');

    // Y dice que la persona sigue trabajando: un aviso sobre un expediente correcto que no lo
    // aclare se lee como si ya hubiera un problema.
    expect(aviso.textContent).toContain('Puede seguir trabajando');

    raiz.querySelector<HTMLButtonElement>('.aviso__accion')!.click();
    fixture.detectChanges();
    expect(host.aDocumentos()).toBe(1);
  });

  /**
   * El control: sin documentos por vencer no hay aviso.
   *
   * <p>Sin esta mitad, «avisa» no distinguiría avisar cuando toca de avisar siempre, que llenaría
   * de ruido las fichas que están bien —que son la mayoría—.</p>
   */
  it('no avisa cuando no hay ninguno por vencer', () => {
    const { raiz } = montar((anfitrion) =>
      anfitrion.fila.set(employeeFixture({ expiringDocuments: 0 })),
    );

    expect(raiz.querySelector('.aviso')).toBeNull();
  });
});
