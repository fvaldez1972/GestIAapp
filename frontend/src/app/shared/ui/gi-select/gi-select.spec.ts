import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiSelect, GiSelectOption } from './gi-select';

const OPCIONES: readonly GiSelectOption[] = [
  { value: 'org-a', label: 'Alfa Seguridad Privada', hint: 'ALFA' },
  { value: 'org-b', label: 'Beta Custodia', hint: 'BETA' },
  { value: 'org-c', label: 'Gamma Vigilancia', hint: 'GAMMA' },
];

@Component({
  imports: [GiSelect],
  template: `
    <gi-select
      label="Organización"
      [options]="opciones"
      [value]="valor()"
      (valueChange)="valor.set($event)"
    />
  `,
})
class Anfitrion {
  readonly opciones = OPCIONES;
  readonly valor = signal('org-a');
}

function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;
  const trigger = () => raiz.querySelector('button')!;
  const opciones = () => Array.from(raiz.querySelectorAll<HTMLElement>('[role="option"]'));

  const teclear = (key: string) => {
    raiz
      .querySelector('gi-select')!
      .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  return { fixture, raiz, trigger, opciones, teclear };
}

describe('GiSelect', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));

  it('no usa el select nativo del sistema', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('select')).toBeNull();
    expect(raiz.querySelector('button')?.getAttribute('role')).toBe('combobox');
  });

  it('tiene nombre accesible aunque no haya etiqueta nativa que lo dé', () => {
    const { trigger } = montar();

    expect(trigger().getAttribute('aria-label')).toBe('Organización');
  });

  it('muestra la opción elegida y no el valor crudo', () => {
    const { trigger } = montar();

    expect(trigger().textContent).toContain('Alfa Seguridad Privada');
    expect(trigger().textContent).not.toContain('org-a');
  });

  it('anuncia si está abierto y qué opción está activa', () => {
    const { trigger, fixture } = montar();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-activedescendant')).toBeNull();

    trigger().click();
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    // Abre sobre la opción ya elegida, no sobre la primera de la lista.
    expect(trigger().getAttribute('aria-activedescendant')).toContain('option-0');
  });

  it('marca cuál es la opción seleccionada, no sólo cuál está bajo el cursor', () => {
    const { trigger, opciones, fixture } = montar();

    trigger().click();
    fixture.detectChanges();

    expect(opciones().map((o) => o.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });

  it('se opera con el teclado: abrir, bajar y elegir', () => {
    const { fixture, trigger, teclear } = montar();
    const anfitrion = fixture.componentInstance;

    teclear('ArrowDown');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    teclear('ArrowDown');
    teclear('Enter');

    expect(anfitrion.valor()).toBe('org-b');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('Inicio y Fin saltan a los extremos', () => {
    const { fixture, trigger, teclear } = montar();

    trigger().click();
    fixture.detectChanges();

    teclear('End');
    teclear('Enter');

    expect(fixture.componentInstance.valor()).toBe('org-c');
  });

  it('las flechas dan la vuelta en lugar de detenerse en el borde', () => {
    const { fixture, trigger, teclear } = montar();

    trigger().click();
    fixture.detectChanges();

    // Desde la primera, hacia arriba, se llega a la última.
    teclear('ArrowUp');
    teclear('Enter');

    expect(fixture.componentInstance.valor()).toBe('org-c');
  });

  it('Escape cierra sin cambiar la elección y devuelve el foco al control', () => {
    const { fixture, trigger, teclear } = montar();

    trigger().click();
    fixture.detectChanges();
    teclear('ArrowDown');
    teclear('Escape');

    expect(fixture.componentInstance.valor()).toBe('org-a');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('elegir con el ratón emite el valor y cierra', () => {
    const { fixture, trigger, opciones } = montar();

    trigger().click();
    fixture.detectChanges();
    opciones()[2].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.valor()).toBe('org-c');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('la lista queda enlazada al control por identificador', () => {
    const { fixture, trigger, raiz } = montar();

    trigger().click();
    fixture.detectChanges();

    const lista = raiz.querySelector('[role="listbox"]')!;
    expect(lista.id).toBe(trigger().getAttribute('aria-controls'));
    expect(lista.id).toBeTruthy();
  });
});
