import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Employee } from '../data-access/workforce.models';
import { EmployeeName, EmployeeNameValue } from './employee-name';

/**
 * Sólo las tres partes del nombre: es lo único que este editor lee del expediente. El resto de las
 * cuarenta columnas no interviene, y escribirlas aquí no haría la prueba más cierta.
 */
function expediente(partes: Partial<Employee>): Employee {
  return partes as Employee;
}

@Component({
  imports: [EmployeeName],
  template: `
    <app-employee-name
      [employee]="detalle()"
      [saving]="guardando()"
      (guardar)="guardado.set($event)"
      (cancelar)="cancelado.set(cancelado() + 1)"
    />
  `,
})
class Anfitrion {
  readonly detalle = signal<Employee | null>(null);
  readonly guardando = signal(false);
  readonly guardado = signal<EmployeeNameValue | null>(null);
  readonly cancelado = signal(0);
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
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('.nom__button')).find(
      (b) => b.textContent!.trim() === texto,
    )!;

  const valor = (id: string) => raiz.querySelector<HTMLInputElement>(`#${id}`)!.value;

  return { fixture, raiz, host: fixture.componentInstance, escribir, boton, valor };
}

/**
 * El editor del nombre en tres partes (RQ-06).
 *
 * <p>Existe por la migración: el reparto automático acierta en el caso frecuente y falla en el raro,
 * y sin esta pantalla un nombre mal repartido se quedaría así para siempre.</p>
 */
describe('El nombre de una persona, en tres partes', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Corregir un nombre empieza por verlo. <b>El control es el estado inicial vacío</b>: si el
   * componente no cargara el expediente, los tres campos seguirían en blanco y la segunda mitad
   * fallaría.
   */
  it('carga las tres partes del expediente cuando llega', async () => {
    const { host, fixture, valor } = montar();

    expect(valor('en-nombre')).toBe('');

    host.detalle.set(
      expediente({ firstName: 'Renata', lastNamePaternal: 'Villaseñor', lastNameMaternal: 'Cortés' }),
    );
    // El expediente entra por un efecto, y ngModel escribe el campo en el ciclo siguiente.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(valor('en-nombre')).toBe('Renata');
    expect(valor('en-paterno')).toBe('Villaseñor');
    expect(valor('en-materno')).toBe('Cortés');
  });

  /** Lo que sale son las tres partes, nunca un nombre completo armado en el navegador. */
  it('emite las tres partes y no compone el nombre completo', () => {
    const { escribir, boton, host } = montar();

    escribir('en-nombre', '  Renata  ');
    escribir('en-paterno', 'Villaseñor');
    escribir('en-materno', 'Cortés');
    boton('Guardar nombre').click();

    const guardado = host.guardado()!;
    expect(guardado).toEqual({
      firstName: 'Renata',
      lastNamePaternal: 'Villaseñor',
      lastNameMaternal: 'Cortés',
    });
    expect(guardado).not.toHaveProperty('fullName');
  });

  /**
   * <b>El apellido materno es opcional; el paterno no.</b> Hay personas con un solo apellido.
   *
   * <p>Las dos primeras aserciones son el control: sin ellas, un editor que no exigiera nada
   * pasaría la tercera igual.</p>
   */
  it('exige nombre y apellido paterno, y guarda sin el materno', () => {
    const { escribir, boton, host } = montar();

    expect(boton('Guardar nombre').disabled).toBe(true);

    escribir('en-nombre', 'Renata');
    expect(boton('Guardar nombre').disabled).toBe(true);

    escribir('en-paterno', 'Villaseñor');
    expect(boton('Guardar nombre').disabled).toBe(false);

    boton('Guardar nombre').click();

    expect(host.guardado()).toEqual({
      firstName: 'Renata',
      lastNamePaternal: 'Villaseñor',
      lastNameMaternal: '',
    });
  });

  /** Un botón bloqueado sin motivo obliga a adivinar qué falta. */
  it('escribe por qué no se puede guardar, y calla cuando ya se puede', () => {
    const { raiz, escribir } = montar();

    const motivo = raiz.querySelector<HTMLElement>('.nom__reason')!;
    expect(motivo.hidden).toBe(false);
    expect(motivo.textContent).toContain('el apellido paterno');

    escribir('en-nombre', 'Renata');
    escribir('en-paterno', 'Villaseñor');

    expect(raiz.querySelector<HTMLElement>('.nom__reason')!.hidden).toBe(true);
  });

  /** Mientras el servidor responde no se puede volver a mandar ni cancelar a medias. */
  it('bloquea los dos botones mientras guarda', () => {
    const { boton, escribir, host, fixture } = montar();

    escribir('en-nombre', 'Renata');
    escribir('en-paterno', 'Villaseñor');
    expect(boton('Guardar nombre').disabled).toBe(false);

    host.guardando.set(true);
    fixture.detectChanges();

    expect(boton('Guardando…').disabled).toBe(true);
    expect(boton('Cancelar').disabled).toBe(true);
  });
});
