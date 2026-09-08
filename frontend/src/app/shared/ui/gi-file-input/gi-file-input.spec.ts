import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiFileInput } from './gi-file-input';

@Component({
  imports: [GiFileInput],
  template: `
    <gi-file-input
      label="Archivo"
      emptyLabel="Ningún archivo elegido"
      [disabled]="disabled()"
      (fileSelected)="elegido.set($event)"
    />
  `,
})
class Anfitrion {
  readonly disabled = signal(false);
  readonly elegido = signal<File | null>(null);
}

function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    nativo: () => raiz.querySelector<HTMLInputElement>('input[type="file"]')!,
  };
}

describe('GiFileInput', () => {
  afterEach(() => TestBed.resetTestingModule());

  /**
   * La razón de que esta pieza exista.
   *
   * <p>El control nativo dibuja su botón y su leyenda con texto del navegador —«Choose File», «No
   * file chosen»— y no hay atributo que lo cambie: el idioma lo decide el sistema de quien mira. En
   * una aplicación en español aparecía en inglés en medio de un formulario.</p>
   */
  it('la leyenda es nuestra y está en español', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('Elegir archivo');
    expect(raiz.textContent).toContain('Ningún archivo elegido');
    expect(raiz.textContent?.toLowerCase()).not.toContain('choose file');
    expect(raiz.textContent?.toLowerCase()).not.toContain('no file');
  });

  /**
   * El nativo sigue ahí, invisible y accesible.
   *
   * <p>Sustituirlo por un botón falso perdería el teclado, el lector de pantalla y el diálogo del
   * sistema. Se esconde a la vista, no del navegador.</p>
   */
  it('conserva el control nativo, con nombre accesible', () => {
    const { nativo } = montar();

    expect(nativo()).not.toBeNull();
    expect(nativo().getAttribute('aria-label')).toBe('Archivo');
    expect(nativo().hasAttribute('hidden')).toBe(false);
  });

  it('al elegir, entrega el archivo y enseña su nombre', () => {
    const { nativo, host, raiz, fixture } = montar();
    const archivo = new File(['contenido'], 'acta-constitutiva.pdf', { type: 'application/pdf' });

    Object.defineProperty(nativo(), 'files', { value: [archivo], configurable: true });
    nativo().dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.elegido()).toBe(archivo);
    expect(raiz.textContent).toContain('acta-constitutiva.pdf');
    expect(raiz.textContent).not.toContain('Ningún archivo elegido');
  });

  it('deshabilitado no deja elegir', () => {
    const { nativo, fixture, host } = montar();
    host.disabled.set(true);
    fixture.detectChanges();

    expect(nativo().disabled).toBe(true);
  });
});
