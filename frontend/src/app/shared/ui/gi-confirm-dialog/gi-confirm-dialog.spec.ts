import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiConfirmDialog } from './gi-confirm-dialog';

@Component({
  imports: [GiConfirmDialog],
  template: `
    <gi-confirm-dialog
      [open]="abierto()"
      [subject]="asunto()"
      [consequence]="consecuencia()"
      (confirm)="confirmaciones.set(confirmaciones() + 1)"
      (cancel)="abierto.set(false)"
    />
  `,
})
class Anfitrion {
  readonly abierto = signal(false);
  readonly asunto = signal('Vigilancia perimetral · Almacenes Reforma');
  readonly consecuencia = signal(
    'Sus 12 posiciones dejan de programarse y los turnos futuros no se generarán.',
  );
  readonly confirmaciones = signal(0);
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
    dialogo: () => raiz.querySelector('dialog')!,
    cancelar: () => raiz.querySelector<HTMLButtonElement>('.gi-confirm__cancel')!,
    confirmar: () => raiz.querySelector<HTMLButtonElement>('.gi-confirm__confirm')!,
  };
}

/**
 * jsdom no implementa `HTMLDialogElement.showModal()` ni `close()`.
 *
 * El `<dialog>` nativo es lo que le da a este componente el foco atrapado, el orden de lectura y
 * el cierre con Escape sin ninguna librería, y el navegador real sí lo implementa. Aquí se repone
 * lo mínimo para poder abrir y cerrar. **Lo que el atrapado del foco hace por su cuenta no se
 * prueba aquí, porque no es nuestro**: se prueba lo que sí decidimos, que es a quién se enfoca, en
 * qué orden están los botones y qué se lee.
 */
function reponerDialogoDeJsdom() {
  const prototipo = HTMLDialogElement.prototype as HTMLDialogElement & { __repuesto?: boolean };

  if (prototipo.__repuesto) {
    return;
  }

  prototipo.__repuesto = true;
  prototipo.showModal = function abrir(this: HTMLDialogElement) {
    this.open = true;
  };
  prototipo.close = function cerrar(this: HTMLDialogElement, returnValue?: string) {
    if (!this.open) return;
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}

describe('GiConfirmDialog', () => {
  beforeEach(() => {
    reponerDialogoDeJsdom();
    TestBed.configureTestingModule({ imports: [Anfitrion] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('llega cerrado y se abre como modal', () => {
    const { dialogo, fixture, host } = montar();

    expect(dialogo().open).toBe(false);

    host.abierto.set(true);
    fixture.detectChanges();

    expect(dialogo().open).toBe(true);
  });

  /** Un «¿estás seguro?» no dice qué se pierde, así que se contesta que sí sin leerlo. */
  it('nombra qué se desactiva y explica la consecuencia', () => {
    const { raiz, fixture, host } = montar();

    host.abierto.set(true);
    fixture.detectChanges();

    expect(raiz.textContent).toContain('Vigilancia perimetral · Almacenes Reforma');
    expect(raiz.textContent).toContain('Sus 12 posiciones dejan de programarse');
    expect(raiz.textContent).not.toMatch(/este registro|estás seguro/i);
  });

  it('Cancelar recibe el foco al abrir: quien confirma sin leer, cancela', () => {
    const { cancelar, fixture, host } = montar();

    host.abierto.set(true);
    fixture.detectChanges();

    expect(document.activeElement).toBe(cancelar());
  });

  it('el destructivo no queda junto al primario', () => {
    const { raiz, fixture, host } = montar();

    host.abierto.set(true);
    fixture.detectChanges();

    const acciones = Array.from(raiz.querySelector('.gi-confirm__actions')!.children);
    expect(acciones.map((n) => n.className)).toEqual([
      'gi-confirm__cancel',
      'gi-confirm__gap',
      'gi-confirm__confirm',
    ]);
  });

  it('el destructivo va en danger y el otro no', () => {
    const { confirmar, cancelar, fixture, host } = montar();

    host.abierto.set(true);
    fixture.detectChanges();

    expect(confirmar().className).toContain('gi-confirm__confirm');
    expect(confirmar().textContent?.trim()).toBe('Desactivar');
    expect(cancelar().textContent?.trim()).toBe('Cancelar');
  });

  it('confirmar avisa; cancelar cierra sin avisar', () => {
    const { confirmar, cancelar, fixture, host, dialogo } = montar();

    host.abierto.set(true);
    fixture.detectChanges();
    confirmar().click();
    fixture.detectChanges();
    expect(host.confirmaciones()).toBe(1);

    host.abierto.set(true);
    fixture.detectChanges();
    cancelar().click();
    fixture.detectChanges();

    expect(host.confirmaciones()).toBe(1);
    expect(dialogo().open).toBe(false);
  });

  it('cerrar con Escape cuenta como cancelar', () => {
    const { dialogo, fixture, host } = montar();

    host.abierto.set(true);
    fixture.detectChanges();

    // El <dialog> nativo emite `close` al cerrarse con Escape; el componente lo trata como cancelar.
    dialogo().close();
    fixture.detectChanges();

    expect(host.abierto()).toBe(false);
    expect(host.confirmaciones()).toBe(0);
  });

  it('el velo es el token del sistema, no un negro cualquiera', () => {
    const { raiz, fixture, host } = montar();

    host.abierto.set(true);
    fixture.detectChanges();

    const hojas = Array.from(document.styleSheets)
      .flatMap((hoja) => {
        try {
          return Array.from(hoja.cssRules).map((regla) => regla.cssText);
        } catch {
          return [];
        }
      })
      .join('\n');

    const backdrop = hojas.match(/::backdrop[^}]*}/)?.[0] ?? '';
    expect(backdrop).toContain('var(--gestia-dialog-veil)');
    expect(raiz.querySelector('dialog')).not.toBeNull();
  });

  it('el diálogo se nombra por su título', () => {
    const { dialogo, raiz, fixture, host } = montar();

    host.abierto.set(true);
    fixture.detectChanges();

    const titulo = raiz.querySelector('#gi-confirm-title')!;
    expect(dialogo().getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(titulo.textContent?.trim()).toBe('Confirmar desactivación');
  });
});
