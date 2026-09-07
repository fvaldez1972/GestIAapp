import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiExceptionRow, GiExceptionType } from './gi-exception-row';

@Component({
  imports: [GiExceptionRow],
  template: `
    <gi-exception-row
      [type]="type()"
      [subject]="subject()"
      [meta]="meta()"
      [planned]="planned()"
      [actual]="actual()"
      [actualNote]="actualNote()"
      [actionLabel]="actionLabel()"
      [disabledReason]="disabledReason()"
      [consequence]="consequence()"
      [badge]="badge()"
      (act)="acciones.set(acciones() + 1)"
    />
  `,
})
class Anfitrion {
  readonly type = signal<GiExceptionType>('absence');
  readonly subject = signal('Laura Menchaca Robledo');
  readonly meta = signal('P-01 Acceso principal · titular · 1 de 4 elementos');
  readonly planned = signal('07:00 – 19:00');
  readonly actual = signal('Sin registro de entrada');
  readonly actualNote = signal('Van 4 h 20 min del turno');
  readonly actionLabel = signal('Registrar incidencia');
  readonly disabledReason = signal('');
  readonly consequence = signal('');
  readonly badge = signal('');
  readonly acciones = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    pildora: () => raiz.querySelector('.gi-exc__pill')?.textContent?.trim() ?? null,
    boton: () => raiz.querySelector<HTMLButtonElement>('.gi-exc__button')!,
    texto: () => raiz.textContent ?? '',
  };
}

/** Un hueco es de la posición, no de una persona: su fila se arma distinta. */
function comoHueco(host: Anfitrion) {
  host.type.set('gap');
  host.subject.set('P-01 Acceso principal · cuarto elemento');
  host.meta.set('4 requeridos · 3 asignados');
  host.actual.set('Nadie a quién registrar');
  host.actualNote.set('');
  host.actionLabel.set('Ver en cobertura');
}

describe('GiExceptionRow', () => {
  /**
   * El tipo se lee sin color. Un borde rojo y uno ámbar son el mismo borde en escala de grises, y
   * aquí la diferencia decide si la acción es registrar una incidencia o ir a cobertura.
   */
  it('nombra el tipo con palabras en los tres casos', () => {
    const falta = montar();
    expect(falta.pildora()).toBe('FALTA');

    TestBed.resetTestingModule();
    const retardo = montar((h) => h.type.set('late'));
    expect(retardo.pildora()).toBe('RETARDO');

    TestBed.resetTestingModule();
    const hueco = montar(comoHueco);
    expect(hueco.pildora()).toBe('HUECO');
  });

  it('enseña lo planeado junto a lo real, que es de lo que se compone una excepción', () => {
    const { texto } = montar();

    expect(texto()).toContain('PLANEADO');
    expect(texto()).toContain('07:00 – 19:00');
    expect(texto()).toContain('REAL');
    expect(texto()).toContain('Sin registro de entrada');
    expect(texto()).toContain('Van 4 h 20 min del turno');
  });

  /**
   * La acción del hueco es secundaria y no es un detalle visual: en un hueco no hay persona, así
   * que ofrecerla con el mismo peso invitaría a registrar una asistencia que no existe.
   */
  it('la falta y el retardo llevan acción principal; el hueco, secundaria', () => {
    const falta = montar();
    expect(falta.boton().classList.contains('gi-exc__button--primary')).toBe(true);

    TestBed.resetTestingModule();
    const retardo = montar((h) => h.type.set('late'));
    expect(retardo.boton().classList.contains('gi-exc__button--primary')).toBe(true);

    TestBed.resetTestingModule();
    const hueco = montar(comoHueco);
    expect(hueco.boton().classList.contains('gi-exc__button--primary')).toBe(false);
    expect(hueco.boton().textContent!.trim()).toBe('Ver en cobertura');
  });

  it('la acción avisa a la pantalla cuando se usa', () => {
    const { boton, host } = montar();

    boton().click();

    expect(host.acciones()).toBe(1);
  });

  /**
   * Una acción inhabilitada tiene que decir por qué, y el texto va amarrado al botón para que
   * también lo oiga quien no lo ve.
   */
  it('si la acción no se puede usar, dice por qué y lo amarra al botón', () => {
    const { boton, raiz } = montar((h) =>
      h.disabledReason.set('El día está cerrado: para corregir hay que reabrirlo o registrar la incidencia con motivo.'),
    );

    expect(boton().disabled).toBe(true);

    const ayuda = raiz.querySelector('.gi-exc__why')!;
    expect(ayuda.textContent).toContain('El día está cerrado');
    expect(boton().getAttribute('aria-describedby')).toBe(ayuda.id);
  });

  it('cuando la acción sí se puede usar no deja el texto de ayuda colgando', () => {
    const { raiz, boton } = montar();

    expect(raiz.querySelector('.gi-exc__why')).toBeNull();
    expect(boton().getAttribute('aria-describedby')).toBeNull();
  });

  it('la consecuencia se dice bajo el renglón cuando la pantalla la pasa', () => {
    const { raiz } = montar((h) =>
      h.consequence.set('Una falta deja el turno al descubierto: desde la incidencia se cubre o se declara sin cubrir.'),
    );

    expect(raiz.querySelector('.gi-exc__consequence')!.textContent).toContain('al descubierto');
  });

  /** La marca de «posterior al cierre» es derivada, y la fila sólo la muestra. */
  it('muestra una marca extra sin confundirla con el tipo', () => {
    const { raiz, pildora } = montar((h) => h.badge.set('Posterior al cierre'));

    expect(raiz.querySelector('.gi-exc__badge')!.textContent!.trim()).toBe('Posterior al cierre');
    expect(pildora()).toBe('FALTA');
  });

  /**
   * Un hueco no continúa en incidencia: no hay persona a la que registrarle nada. Confundirlo es
   * fácil porque las tres filas se ven parecidas, y por eso rompe en desarrollo.
   */
  it('rompe en desarrollo si un hueco pretende continuar en incidencia', () => {
    expect(() =>
      montar((h) => {
        comoHueco(h);
        h.actionLabel.set('Registrar incidencia');
      }),
    ).toThrowError(/no continúa en incidencia/);
  });

  it('rompe en desarrollo si una excepción no ofrece qué hacer', () => {
    expect(() => montar((h) => h.actionLabel.set(''))).toThrowError(/trae su acción/);
  });

  it('rompe en desarrollo si falta lo planeado o lo real', () => {
    expect(() => montar((h) => h.planned.set(''))).toThrowError(/distancia entre lo planeado/);
    TestBed.resetTestingModule();
    expect(() => montar((h) => h.actual.set(''))).toThrowError(/distancia entre lo planeado/);
  });
});
