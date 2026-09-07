import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlanningConflict } from '../data-access/planning.models';
import { ConflictList } from './conflict-list';
import { PublishPanel } from './publish-panel';

const BLOQUEA: PlanningConflict = {
  id: 'undeclared:p-1',
  title: 'P-01 no tiene ningún turno declarado',
  detail: 'Sin segmentos en su patrón, la posición no proyecta nada. Declara sus turnos o desactívala.',
  blocking: true,
};

const AVISA: PlanningConflict = {
  id: 'coverage-gaps',
  title: '3 turnos quedan con menos gente de la que piden',
  detail: 'Faltan 4 elementos en total. No impide publicar: publicar es lo que deja a Cobertura resolverlos.',
  blocking: false,
};

@Component({
  imports: [ConflictList],
  template: `<app-conflict-list [conflicts]="conflicts()" />`,
})
class AnfitrionLista {
  readonly conflicts = signal<readonly PlanningConflict[]>([]);
}

@Component({
  imports: [PublishPanel],
  template: `
    <app-publish-panel
      [weekStart]="weekStart()"
      [weekEnd]="weekEnd()"
      [shiftCount]="shiftCount()"
      [positionCount]="positionCount()"
      [conflicts]="conflicts()"
      [canWrite]="canWrite()"
      [publishedLabel]="publishedLabel()"
      (publish)="publicaciones.set(publicaciones() + 1)"
    />
  `,
})
class AnfitrionPanel {
  readonly weekStart = signal('2026-09-07');
  readonly weekEnd = signal('2026-09-13');
  readonly shiftCount = signal(27);
  readonly positionCount = signal(5);
  readonly conflicts = signal<readonly PlanningConflict[]>([]);
  readonly canWrite = signal(true);
  readonly publishedLabel = signal('');
  readonly publicaciones = signal(0);
}

function lista(conflicts: readonly PlanningConflict[]) {
  const fixture = TestBed.createComponent(AnfitrionLista);
  fixture.componentInstance.conflicts.set(conflicts);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;

  return {
    raiz,
    titulos: () => Array.from(raiz.querySelectorAll('.conf__nombre')).map((n) => n.textContent?.trim()),
    pildoras: () => Array.from(raiz.querySelectorAll('.conf__pill')).map((p) => p.textContent?.trim()),
    resumen: () => raiz.querySelector('.conf__resumen')?.textContent?.trim() ?? null,
  };
}

function panel(configurar: (host: AnfitrionPanel) => void = () => {}) {
  const fixture = TestBed.createComponent(AnfitrionPanel);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    boton: () => raiz.querySelector<HTMLButtonElement>('.pub__boton')!,
    porque: () => raiz.querySelector('.pub__porque')?.textContent?.trim() ?? null,
  };
}

describe('ConflictList', () => {
  /**
   * Lo que no bloquea se enseña igual. Si sólo se mostrara lo que impide publicar, una semana con
   * seis turnos cortos se vería idéntica a una perfecta y se publicaría sin que nadie los mirara.
   */
  it('enseña lo que bloquea y lo que sólo conviene mirar, distinguiéndolos', () => {
    const { titulos, pildoras } = lista([AVISA, BLOQUEA]);

    expect(titulos()).toEqual([BLOQUEA.title, AVISA.title]);
    expect(pildoras()).toEqual(['Impide publicar', 'Conviene mirarlo']);
  });

  it('lo que bloquea va primero, para no leer la lista entera', () => {
    const { titulos } = lista([AVISA, AVISA, BLOQUEA]);

    expect(titulos()![0]).toBe(BLOQUEA.title);
  });

  it('resume cuántos impiden y cuántos avisan', () => {
    expect(lista([BLOQUEA, AVISA]).resumen()).toBe('1 impide publicar · 1 aviso');
    expect(lista([AVISA]).resumen()).toBe('1 aviso');
    expect(lista([BLOQUEA, BLOQUEA]).resumen()).toBe('2 impiden publicar');
  });

  /** Un cero aquí es información: se revisó y salió limpia, que no es lo mismo que no revisarla. */
  it('sin nada que revisar lo dice como un cero real', () => {
    const { raiz, resumen } = lista([]);

    expect(resumen()).toBe('sin observaciones');
    expect(raiz.querySelector('.conf__limpio')!.textContent).toContain('Es un cero real');
  });
});

describe('PublishPanel', () => {
  it('dice qué se va a publicar antes de publicarlo', () => {
    const { raiz } = panel();

    expect(raiz.querySelector('.pub__resumen')!.textContent!.trim()).toBe(
      '27 turnos en 5 posiciones, del 07 sep 2026 al 13 sep 2026.',
    );
  });

  /** Publicar creyendo que se puede retocar después es la sorpresa que este aviso evita. */
  it('avisa que lo publicado no se edita', () => {
    const { raiz } = panel();

    expect(raiz.querySelector('.pub__aviso')!.textContent).toContain('no se edita');
  });

  it('publica cuando no hay nada que lo impida', () => {
    const { boton, porque, host } = panel();

    expect(boton().disabled).toBe(false);
    expect(porque()).toBeNull();

    boton().click();
    expect(host.publicaciones()).toBe(1);
  });

  /**
   * Un botón apagado sin explicación se lee como que la aplicación se rompió. El porqué va amarrado
   * al botón para que también lo oiga quien no lo ve.
   */
  it('cuando un conflicto lo impide, el botón dice cuál', () => {
    const { boton, porque, raiz } = panel((h) => h.conflicts.set([BLOQUEA]));

    expect(boton().disabled).toBe(true);
    expect(porque()).toContain('p-01 no tiene ningún turno declarado');
    expect(boton().getAttribute('aria-describedby')).toBe(raiz.querySelector('.pub__porque')!.id);
  });

  it('con varios conflictos remite a la lista en lugar de enumerarlos en el botón', () => {
    const { porque } = panel((h) => h.conflicts.set([BLOQUEA, { ...BLOQUEA, id: 'otro' }]));

    expect(porque()).toContain('2 cosas lo impiden');
    expect(porque()).toContain('están arriba');
  });

  it('los avisos que no bloquean no apagan el botón', () => {
    const { boton } = panel((h) => h.conflicts.set([AVISA]));

    expect(boton().disabled).toBe(false);
  });

  /**
   * El permiso manda sobre los conflictos: decirle «falta declarar P-01» a quien no puede publicar
   * lo mandaría a arreglar algo que igual no lo va a dejar.
   */
  it('sin permiso dice eso, y no lo que falta de la semana', () => {
    const { boton, porque } = panel((h) => {
      h.canWrite.set(false);
      h.conflicts.set([BLOQUEA]);
    });

    expect(boton().disabled).toBe(true);
    expect(porque()).toContain('No tienes permiso');
    expect(porque()).not.toContain('P-01');
  });

  it('si ya hay una versión publicada, la nombra y ofrece publicar otra', () => {
    const { raiz, boton } = panel((h) => h.publishedLabel.set('versión 2, publicada 07 sep 2026'));

    expect(raiz.querySelector('.pub__estado')!.textContent!.trim()).toBe(
      'versión 2, publicada 07 sep 2026',
    );
    expect(boton().textContent!.trim()).toBe('Publicar una versión nueva');
  });

  it('rompe en desarrollo si no sabe qué semana publica', () => {
    expect(() => panel((h) => h.weekStart.set(''))).toThrowError(/qué semana se publica/);
  });
});
