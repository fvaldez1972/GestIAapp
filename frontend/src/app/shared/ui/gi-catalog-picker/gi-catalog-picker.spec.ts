import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { GiCatalogCreation, GiCatalogOption, GiCatalogPicker } from './gi-catalog-picker';

function valor(name: string, id = name): GiCatalogOption {
  return { idCatalogItem: id, name };
}

const PUESTOS = [valor('Guardia de acceso', 'p1'), valor('Supervisor de sitio', 'p2')];

@Component({
  imports: [GiCatalogPicker],
  template: `
    <gi-catalog-picker
      [options]="options()"
      [value]="value()"
      [canWrite]="canWrite()"
      label="Puesto"
      catalogLabel="el catálogo de puestos"
      (valueChange)="elegidos.set([...elegidos(), $event])"
      (create)="creados.set([...creados(), $event])"
    />
  `,
})
class Anfitrion {
  readonly options = signal<readonly GiCatalogOption[]>(PUESTOS);
  readonly value = signal('');
  readonly canWrite = signal(true);
  readonly elegidos = signal<string[]>([]);
  readonly creados = signal<GiCatalogCreation[]>([]);
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
    escribir: (texto: string) => {
      const input = raiz.querySelector<HTMLInputElement>('.pick__input')!;
      input.value = texto;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    crear: () => raiz.querySelector<HTMLButtonElement>('.pick__crear'),
    opciones: () => Array.from(raiz.querySelectorAll('.pick__opcion')).map((n) => n.textContent!.trim()),
  };
}

describe('GiCatalogPicker', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  it('filtra sobre lo que ya hay', () => {
    const f = montar();

    f.escribir('super');

    expect(f.opciones()).toEqual(['Supervisor de sitio']);
  });

  /**
   * El punto de la pieza: que el catálogo vacío no sea una pared. Antes decía «Sin opciones
   * activas» y ahí se acababa; había que salir, ir a Catálogos, crear el valor y volver a empezar.
   */
  it('con el catálogo vacío ofrece crear lo que se escriba', () => {
    const f = montar((h) => h.options.set([]));

    f.escribir('Jefe de turno');

    expect(f.raiz.textContent).toContain('No tienes «Jefe de turno» en el catálogo de puestos');
    f.crear()!.click();

    expect(f.host.creados()).toEqual([{ name: 'Jefe de turno' }]);
  });

  describe('lo casi igual', () => {
    /**
     * Crear «Guardia» y «guardia» como dos entradas sería peor que no tener la función, así que lo
     * que colapsa exacto no se ofrece crear: se selecciona el que ya está.
     */
    it.each([
      ['guardia de acceso'],
      ['GUARDIA DE ACCESO'],
      ['  Guardia   de   acceso  '],
      ['Guardía de acceso'],
    ])('«%s» no ofrece crear: ya existe', (escrito) => {
      const f = montar();

      f.escribir(escrito);

      expect(f.raiz.textContent).toContain('«Guardia de acceso» ya está en el catálogo');
      expect(f.crear()).toBeNull();
    });

    /** Y seleccionarlo es un clic, no un error que haya que entender. */
    it('el que ya existe se selecciona desde el propio aviso', () => {
      const f = montar();

      f.escribir('guardia de acceso');
      f.raiz.querySelector<HTMLButtonElement>('.pick__elegir--sugerido')!.click();

      expect(f.host.elegidos().at(-1)).toBe('p1');
    });

    /**
     * La franja del medio sugiere y no bloquea: dos puestos parecidos pueden ser legítimamente dos
     * puestos. Lo que se cuida es el orden, no el permiso.
     */
    it('lo parecido ofrece primero el que existe y después, discreto, crear uno nuevo', () => {
      const f = montar();

      f.escribir('Guardia de acceso B');

      expect(f.raiz.textContent).toContain('¿Querías «Guardia de acceso»?');

      const botones = Array.from(f.raiz.querySelectorAll('.pick__aviso button'));
      expect(botones[0].textContent).toContain('Usar el que existe');
      expect(botones[1].textContent).toContain('Crear «Guardia de acceso B» como valor nuevo');
      expect(botones[1].classList).toContain('pick__crear--discreto');
    });
  });

  /**
   * Sin permiso de escritura la acción no se dibuja —no se dibuja gris—, que es la forma de decir
   * que no del resto de las pantallas rehechas.
   */
  it('sin permiso de escritura no ofrece crear, y dice a quién pedirlo', () => {
    const f = montar((h) => {
      h.options.set([]);
      h.canWrite.set(false);
    });

    f.escribir('Jefe de turno');

    expect(f.crear()).toBeNull();
    expect(f.raiz.textContent).toContain('Pídelo a quien administre los catálogos');
  });

  /** Lo que se ve y lo que vale no pueden decir cosas distintas. */
  it('escribir deshace la selección anterior', () => {
    const f = montar((h) => h.value.set('p1'));

    f.escribir('Sup');

    expect(f.host.elegidos().at(-1)).toBe('');
  });

  it('elegir de la lista emite el identificador, nunca el nombre', () => {
    const f = montar();

    f.escribir('super');
    f.raiz.querySelector<HTMLButtonElement>('.pick__elegir')!.click();

    expect(f.host.elegidos().at(-1)).toBe('p2');
  });
});
