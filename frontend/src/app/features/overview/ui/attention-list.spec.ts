import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverviewAttentionItem } from '../data-access/overview.models';
import { asunto } from './overview-fixtures';
import { AttentionList } from './attention-list';

@Component({
  imports: [AttentionList],
  template: `<app-attention-list [items]="items()" [hasData]="hasData()" />`,
})
class Anfitrion {
  readonly items = signal<readonly OverviewAttentionItem[]>([asunto()]);
  readonly hasData = signal(true);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    raiz,
    filas: () => Array.from(raiz.querySelectorAll('.attention__row')),
    titulos: () =>
      Array.from(raiz.querySelectorAll('.attention__title')).map((n) =>
        n.textContent!.replace(/\s+/g, ' ').trim(),
      ),
  };
}

describe('Lo que necesita atención hoy', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));

  afterEach(() => TestBed.resetTestingModule());

  /** Primero lo que ya dejó a alguien sin cubrir; después lo que lo hará. */
  it('ordena por lo que deja turnos al descubierto', () => {
    const { titulos } = montar((host) =>
      host.items.set([
        asunto({ key: 'ExpiredDocuments', severity: 'Warning', count: 1, serviceCount: 0 }),
        asunto({ key: 'PositionsWithoutPrimary', severity: 'Danger' }),
        asunto({ key: 'NextWeekUnpublished', severity: 'Warning', count: 1, serviceCount: 0 }),
      ]),
    );

    expect(titulos()[0]).toContain('3 posiciones sin titular en 2 servicios');
  });

  it('la severidad se lee, no sólo se ve por el color del punto', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.attention__dot--danger')?.getAttribute('aria-hidden')).toBe('true');
    expect(raiz.textContent).toContain('Deja turnos al descubierto');
  });

  it('cada fila dice dónde se resuelve, además de qué es', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.attention__where')?.textContent?.trim()).toBe('Servicios · Asignaciones');
    expect(raiz.querySelector<HTMLAnchorElement>('.attention__action')?.getAttribute('href'))
      .toBe('/servicios');
  });

  it('el destino se nombra con su asunto, no sólo «Asignar titular»', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.attention__action')?.getAttribute('aria-label'))
      .toContain('Asignar titular: 3 posiciones sin titular');
  });

  it('la vacante sin fecha lo dice, en vez de inventar una', () => {
    const { raiz } = montar((host) => host.items.set([asunto({ sinceDate: null })]));

    expect(raiz.textContent).toContain('Nunca han tenido titular');
  });

  /**
   * Cuando no hay nada, la tarjeta lo dice con todas sus letras. Desaparecer sin explicación deja
   * al usuario preguntándose si falló la carga.
   */
  it('sin asuntos, lo dice en lugar de desaparecer', () => {
    const { raiz, filas } = montar((host) => host.items.set([]));

    expect(filas()).toHaveLength(0);
    expect(raiz.textContent).toContain('Nada pendiente hoy');
    expect(raiz.textContent).toContain('Sin asuntos abiertos');
  });

  /**
   * El punto de la pieza. «Nada pendiente hoy» es una afirmación, y en una organización recién
   * creada es falsa: está todo pendiente, sólo que el sistema aún no tiene con qué saberlo.
   * Decirlo igual convierte la ausencia de configuración en una felicitación.
   */
  it('sin datos no se felicita: distingue no tener asuntos de no poder saberlo', () => {
    const { raiz } = montar((host) => {
      host.items.set([]);
      host.hasData.set(false);
    });

    expect(raiz.textContent).toContain('Todavía no hay con qué saberlo');
    expect(raiz.textContent).toContain('no puede afirmar que no quede nada pendiente');
    expect(raiz.textContent).not.toContain('Nada pendiente hoy');
    expect(raiz.textContent).not.toContain('Sin asuntos abiertos');
  });

  /** Sin datos pero con asuntos ya hay algo que decir, y se dice igual que siempre. */
  it('un asunto se pinta aunque los indicadores no se puedan calcular', () => {
    const { raiz, filas } = montar((host) => host.hasData.set(false));

    expect(filas()).toHaveLength(1);
    expect(raiz.textContent).not.toContain('Todavía no hay con qué saberlo');
  });

  /**
   * La fila que sustituye a los «conflictos de planeación» del bosquejo, que no pueden existir
   * porque el traslape se rechaza al guardar.
   */
  it('la semana siguiente en borrador se explica por lo que impide, no por lo que es', () => {
    const { raiz } = montar((host) =>
      host.items.set([
        asunto({ key: 'NextWeekUnpublished', severity: 'Warning', count: 1, serviceCount: 0, sinceDate: null }),
      ]),
    );

    expect(raiz.textContent).toContain('sigue en borrador');
    expect(raiz.textContent).toContain('no existen para asistencia ni cobertura');
  });
});
