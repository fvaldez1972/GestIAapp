import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { EmployeeJobPositionOption } from '../data-access/employee-list.models';
import { EmployeeForm, EmployeeFormValue } from './employee-form';

@Component({
  imports: [EmployeeForm],
  template: `
    <app-employee-form
      organizationId="o1"
      [jobPositions]="jobPositions()"
      [canWrite]="true"
      [today]="hoy()"
      (createJobPosition)="creados.set([...creados(), $event.name])"
      (save)="guardado.set($event)"
    />
  `,
})
class Anfitrion {
  readonly creados = signal<string[]>([]);
  readonly jobPositions = signal<readonly EmployeeJobPositionOption[]>([
    { idCatalogItem: 'jp-1', name: 'Guardia intramuros' },
    { idCatalogItem: 'jp-2', name: 'Supervisor de zona' },
  ]);
  readonly hoy = signal('2026-09-06');
  readonly guardado = signal<EmployeeFormValue | null>(null);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  const escribir = (id: string, valor: string) => {
    const campo = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const boton = (texto: string) =>
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('.button')).find(
      (b) => b.textContent!.trim() === texto,
    )!;

  return { fixture, raiz, host: fixture.componentInstance, escribir, boton };
}

describe('El alta de una persona', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }));

  afterEach(() => TestBed.resetTestingModule());

  /** No se le pide al usuario que invente un identificador: es un problema del sistema. */
  it('no pide código de empleado ni estado inicial', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('#ef-codigo')).toBeNull();
    expect(raiz.textContent).not.toContain('CÓDIGO');
  });

  /** Las dos salidas dicen qué deja cada una, en vez de un solo botón que decide en silencio. */
  it('ofrece guardar con puesto y guardar sin puesto', () => {
    const { boton } = montar();

    expect(boton('Guardar con puesto')).toBeDefined();
    expect(boton('Guardar sin puesto')).toBeDefined();
  });

  /** Un botón gris sin motivo obliga a adivinar qué falta. */
  it('con el formulario vacío escribe por qué no se puede guardar', () => {
    const { raiz, boton } = montar();

    expect(boton('Guardar sin puesto').disabled).toBe(true);
    const motivo = raiz.querySelector<HTMLElement>('#ef-falta-persona')!;
    expect(motivo.hidden).toBe(false);
    expect(motivo.textContent).toContain('nombre completo o la fecha de ingreso');
  });

  /** Sin fecha capturada vale la de hoy del servidor, nunca la del reloj del navegador. */
  it('con nombre basta para guardar sin puesto, y toma el día operativo del servidor', () => {
    const { escribir, boton, host } = montar();

    escribir('ef-nombre', 'Renata Villaseñor Cortés');
    expect(boton('Guardar sin puesto').disabled).toBe(false);

    boton('Guardar sin puesto').click();

    expect(host.guardado()?.hireDate).toBe('2026-09-06');
    expect(host.guardado()?.idJobPositionCatalogItem).toBe('');
  });

  /** «Guardar con puesto» exige el puesto, y lo dice. */
  it('sin puesto elegido, guardar con puesto queda bloqueado con su motivo', () => {
    const { escribir, boton, raiz } = montar();

    escribir('ef-nombre', 'Renata Villaseñor Cortés');

    expect(boton('Guardar con puesto').disabled).toBe(true);
    expect(raiz.querySelector<HTMLElement>('#ef-falta-puesto')!.hidden).toBe(false);
  });

  /**
   * <b>Esta prueba cambió de sentido el 7 de septiembre de 2026, y el cambio es el punto de la
   * tanda.</b> Antes comprobaba que, sin puestos en el catálogo, el alta mandara a Catálogos: había
   * que abandonar el formulario a medias, crear el puesto y volver a empezar. Ahora el catálogo
   * vacío no es una pared: se escribe el puesto aquí y se ofrece agregarlo.
   */
  it('sin puestos en el catálogo ofrece crear el primero sin salir del alta', () => {
    const { raiz, fixture } = montar((host) => host.jobPositions.set([]));

    const input = raiz.querySelector<HTMLInputElement>('#empleado-puesto')!;
    input.value = 'Jefe de turno';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(raiz.textContent).toContain('No tienes «Jefe de turno» en el catálogo de puestos');

    raiz.querySelector<HTMLButtonElement>('.pick__crear')!.click();
    fixture.detectChanges();

    // El formulario sólo dice qué se pidió: crearlo es escritura a otro módulo y la resuelve la
    // pantalla, que además tiene que recargar el catálogo.
    expect(fixture.componentInstance.creados()).toEqual(['Jefe de turno']);
  });

  /** Todo campo lleva su etiqueta ligada: sin `for` el rótulo no pertenece a nada. */
  it('cada campo de texto tiene su etiqueta ligada', () => {
    const { raiz } = montar();

    const campos = Array.from(raiz.querySelectorAll<HTMLInputElement>('.field input'));

    expect(campos.length).toBeGreaterThan(0);

    for (const campo of campos) {
      expect(raiz.querySelector(`label[for="${campo.id}"]`)).not.toBeNull();
    }
  });
});
