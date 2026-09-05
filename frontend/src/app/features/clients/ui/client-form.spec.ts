import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ClientForm, ClientFormValue } from './client-form';

@Component({
  imports: [ClientForm],
  template: `<app-client-form (save)="guardado.set($event)" />`,
})
class Anfitrion {
  readonly guardado = signal<{ value: ClientFormValue; withSite: boolean } | null>(null);
}

function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === texto,
    )!;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    boton,
    escribir: (id: string, valor: string) => {
      const campo = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
  };
}

describe('El alta de cliente', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Lo que la pantalla existe para hacer: <b>decir que la sede es obligatoria antes de guardar</b>,
   * no al fallar el alta del servicio dos pantallas después.
   */
  it('el bloque de sede dice para qué es, antes de guardar', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('SEDE · OBLIGATORIA PARA CREAR SERVICIOS');
    expect(raiz.textContent).toContain('Sin sede el cliente queda como expediente');
  });

  it('son dos salidas y cada una dice exactamente qué hace', () => {
    const { boton } = montar();

    expect(boton('Guardar sin sede')).toBeDefined();
    expect(boton('Guardar cliente y sede')).toBeDefined();
  });

  /** El expediente sin sede es válido: sólo pide lo del cliente. */
  it('guardar sin sede no exige los campos de sede', () => {
    const { boton, escribir, fixture, host } = montar();

    escribir('cf-razon', 'Textiles La Concepción, S.A. de C.V.');
    escribir('cf-rfc', 'TLC180423K72');
    fixture.detectChanges();

    expect(boton('Guardar sin sede').disabled).toBe(false);
    expect(boton('Guardar cliente y sede').disabled).toBe(true);

    boton('Guardar sin sede').click();
    fixture.detectChanges();

    expect(host.guardado()?.withSite).toBe(false);
    expect(host.guardado()?.value.legalName).toBe('Textiles La Concepción, S.A. de C.V.');
  });

  it('guardar con sede exige la dirección completa, y dice cuál falta', () => {
    const { raiz, boton, escribir } = montar();

    escribir('cf-razon', 'Distribuidora Peñasco del Norte, S.A. de C.V.');
    escribir('cf-rfc', 'DPN180423K72');
    escribir('cf-sede', 'Planta San Nicolás');

    const guardar = boton('Guardar cliente y sede');
    expect(guardar.disabled).toBe(true);

    const razon = raiz.querySelector(`#${guardar.getAttribute('aria-describedby')}`)!;
    expect(razon.textContent).toContain('su nombre, calle, municipio, estado y código postal');
  });

  it('con todo completo emite el cliente, la sede y el contacto', () => {
    const { boton, escribir, fixture, host } = montar();

    escribir('cf-razon', 'Distribuidora Peñasco del Norte, S.A. de C.V.');
    escribir('cf-corto', 'Peñasco');
    escribir('cf-rfc', 'dpn180423k72');
    escribir('cf-sede', 'Planta San Nicolás');
    escribir('cf-calle', 'Av. Universidad 2340');
    escribir('cf-cp', '66450');
    escribir('cf-municipio', 'San Nicolás de los Garza');
    escribir('cf-estado', 'Nuevo León');
    escribir('cf-cnombre', 'Aurora Ibáñez Zúñiga');
    escribir('cf-ctel', '81 2264 7710');
    fixture.detectChanges();

    boton('Guardar cliente y sede').click();
    fixture.detectChanges();

    const guardado = host.guardado()!;
    expect(guardado.withSite).toBe(true);
    // El RFC se normaliza: se compara en mayúsculas para la unicidad del servidor.
    expect(guardado.value.rfc).toBe('DPN180423K72');
    expect(guardado.value.site.municipality).toBe('San Nicolás de los Garza');
    expect(guardado.value.contact.fullName).toBe('Aurora Ibáñez Zúñiga');
  });

  /**
   * El bosquejo pedía el RFC opcional. No lo es: el servidor lo usa para la unicidad del cliente,
   * así que sin él no se puede guardar ni el expediente.
   */
  it('sin RFC no se puede guardar ni el expediente', () => {
    const { boton, escribir } = montar();

    escribir('cf-razon', 'Sólo razón social');

    expect(boton('Guardar sin sede').disabled).toBe(true);
  });

  /** El código y la fecha los pone el sistema: pedirlos sería pedirle al usuario que los invente. */
  it('no pide código de cliente ni fecha de alta', () => {
    const { raiz } = montar();

    expect(raiz.textContent).not.toMatch(/código de cliente/i);
    expect(raiz.querySelector('input[type="date"]')).toBeNull();
  });

  it('cada campo tiene su etiqueta asociada', () => {
    const { raiz } = montar();

    const campos = Array.from(raiz.querySelectorAll('input'));
    expect(campos.length).toBeGreaterThan(8);

    for (const campo of campos) {
      expect(raiz.querySelector(`label[for="${campo.id}"]`), `${campo.id} sin etiqueta`).not.toBeNull();
    }
  });
});
