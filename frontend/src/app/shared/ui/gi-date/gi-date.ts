import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * El campo de fecha de GestIA.
 *
 * <p><b>Por qué no el nativo.</b> `input type="date"` escribe el orden que decide el idioma del
 * navegador, no el de la página: con Chrome en inglés muestra `mm/dd/yyyy` y no hay atributo ni CSS
 * que lo cambie —probado el 26 de septiembre de 2026 con `lang="es-MX"` en el propio input, sin
 * efecto—. En un sistema donde las fechas son operativas, leer 09/12 y no saber si es septiembre o
 * diciembre no es un detalle estético.</p>
 *
 * <p><b>El calendario nativo se conserva.</b> Detrás hay un `input type="date"` invisible al que se
 * le pide `showPicker()`: así el teclado, el lector de pantalla y el calendario del teléfono siguen
 * funcionando, y lo único que cambia es cómo se lee y se escribe la fecha.</p>
 *
 * <p>Implementa <c>ControlValueAccessor</c>, así que entra donde había un input con `ngModel` y
 * donde había uno con `formControlName`, sin tocar el formulario que lo hospeda. El valor que entra
 * y sale es siempre ISO —`aaaa-mm-dd`—, como antes.</p>
 */
@Component({
  selector: 'gi-date',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => GiDate), multi: true },
  ],
  template: `
    <div class="gi-date" [class.is-disabled]="deshabilitado()">
      <input
        #campo
        class="gi-date__text"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="10"
        placeholder="dd/mm/aaaa"
        [id]="inputId()"
        [attr.aria-label]="label()"
        [disabled]="deshabilitado()"
        [value]="texto()"
        (input)="escribir($any($event.target).value)"
        (blur)="salir()"
      />

      <button
        class="gi-date__boton"
        type="button"
        [disabled]="deshabilitado()"
        [attr.aria-label]="'Abrir calendario' + (label() ? ' de ' + label() : '')"
        (click)="abrirCalendario()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      </button>

      <!-- El calendario del sistema, sin dibujarse: sólo se le pide que se abra. -->
      <input
        class="gi-date__nativo"
        type="date"
        tabindex="-1"
        aria-hidden="true"
        #nativo
        [min]="min()"
        [max]="max()"
        [value]="valor() ?? ''"
        (change)="elegirDelCalendario($any($event.target).value)"
      />
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }

    .gi-date {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      box-sizing: border-box;
      width: 100%;
      height: var(--gestia-control-height);
      padding: 0 0.35rem 0 0.7rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
    }

    .gi-date:hover:not(.is-disabled) { border-color: var(--gestia-cyan); }
    .gi-date:focus-within { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
    .gi-date.is-disabled { background: var(--gestia-surface-soft); }

    .gi-date__text {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0;
      border: 0;
      background: none;
      color: var(--gestia-text);
      font: inherit;
      font-size: 12.5px;
      letter-spacing: 0.02em;
    }

    .gi-date__text:focus { outline: none; }
    .gi-date__text::placeholder { color: var(--gestia-muted); letter-spacing: 0.04em; }
    .gi-date__text:disabled { color: var(--gestia-muted); }

    .gi-date__boton {
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      padding: 0;
      border: 0;
      border-radius: var(--gestia-radius);
      background: none;
      color: var(--gestia-muted);
      cursor: pointer;
    }

    .gi-date__boton:hover:not(:disabled) {
      background: var(--gestia-surface-soft);
      color: var(--gestia-text);
    }

    .gi-date__boton:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
    .gi-date__boton:disabled { cursor: not-allowed; }

    .gi-date__boton svg {
      width: 1rem;
      height: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }

    /* Existe para abrir el calendario del sistema; no se ve ni recibe foco. */
    .gi-date__nativo {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      border: 0;
      opacity: 0;
      pointer-events: none;
    }
  `,
})
export class GiDate implements ControlValueAccessor {
  readonly label = input('');
  readonly inputId = input('');
  readonly min = input('');
  readonly max = input('');
  readonly disabled = input(false);

  /** El valor, para quien lo use suelto en vez de con un formulario. */
  readonly value = input<string | null>(null);
  readonly valueChange = output<string>();

  protected readonly valor = signal<string | null>(null);
  protected readonly texto = signal('');
  private readonly deshabilitadoPorForma = signal(false);

  protected readonly deshabilitado = () => this.disabled() || this.deshabilitadoPorForma();

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  private readonly nativo = viewChild.required<ElementRef<HTMLInputElement>>('nativo');

  private alCambiar: (valor: string | null) => void = () => {};
  private alTocar: () => void = () => {};

  constructor() {
    // Cuando se usa suelto, el valor entra por la entrada en vez de por writeValue.
    effect(() => {
      const desdeFuera = this.value();

      if (desdeFuera !== null && desdeFuera !== this.valor()) {
        this.valor.set(desdeFuera || null);
        this.texto.set(aTexto(desdeFuera));
      }
    });
  }

  writeValue(valor: string | null): void {
    this.valor.set(valor || null);
    this.texto.set(aTexto(valor));
  }

  registerOnChange(fn: (valor: string | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitadoPorForma.set(deshabilitado);
  }

  /**
   * Se escriben sólo dígitos y las barras se ponen solas.
   *
   * <p><b>El campo se reescribe a mano, y es lo que hace que las letras no se queden.</b> El
   * enlace <c>[value]</c> sólo repinta cuando la señal cambia, y al teclear una letra la señal
   * vale lo mismo antes y después —el texto limpio no cambió—, así que Angular no tocaba el DOM y
   * la letra seguía en pantalla aunque el valor nunca la hubiera aceptado.</p>
   */
  protected escribir(entrada: string): void {
    const campo = this.campo().nativeElement;
    const cursor = campo.selectionStart ?? entrada.length;
    // Los dígitos que hay antes del cursor son lo único que sobrevive al formateo, así que son la
    // referencia para volver a colocarlo: sin esto, corregir en medio manda el cursor al final.
    const digitosAntesDelCursor = entrada.slice(0, cursor).replace(/\D/g, '').length;

    const digitos = entrada.replace(/\D/g, '').slice(0, 8);
    const partes = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4, 8)].filter(Boolean);
    const formateado = partes.join('/');
    this.texto.set(formateado);

    if (campo.value !== formateado) {
      campo.value = formateado;
      const destino = trasElDigito(formateado, digitosAntesDelCursor);
      campo.setSelectionRange(destino, destino);
    }

    const iso = aIso(this.texto());

    if (iso !== this.valor()) {
      this.valor.set(iso);
      this.alCambiar(iso);
      this.valueChange.emit(iso ?? '');
    }
  }

  /** Al salir, lo que no es una fecha entera se descarta: media fecha no es un dato. */
  protected salir(): void {
    this.alTocar();
    this.texto.set(aTexto(this.valor()));
  }

  protected abrirCalendario(): void {
    if (this.deshabilitado()) {
      return;
    }

    const nativo = this.nativo().nativeElement;

    // showPicker existe desde Chrome 99; el respaldo es para navegadores que no lo traen.
    if (typeof nativo.showPicker === 'function') {
      nativo.showPicker();
      return;
    }

    nativo.focus();
    nativo.click();
  }

  protected elegirDelCalendario(iso: string): void {
    this.valor.set(iso || null);
    this.texto.set(aTexto(iso));
    this.alCambiar(iso || null);
    this.valueChange.emit(iso || '');
    this.alTocar();
  }
}

/** Dónde queda el cursor después de formatear: justo detrás del dígito número `cuantos`. */
function trasElDigito(texto: string, cuantos: number): number {
  if (cuantos <= 0) {
    return 0;
  }

  let vistos = 0;

  for (let i = 0; i < texto.length; i++) {
    if (texto[i] >= '0' && texto[i] <= '9') {
      vistos++;

      if (vistos === cuantos) {
        // Detrás de la barra cuando el dígito la precede: escribir el segundo número del día deja
        // el cursor listo para el mes, no atrapado antes del separador.
        return texto[i + 1] === '/' ? i + 2 : i + 1;
      }
    }
  }

  return texto.length;
}

/** De ISO a lo que se lee: `2026-09-26` → `26/09/2026`. */
function aTexto(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return '';
  }

  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** De lo que se escribe a ISO. Nulo mientras la fecha no esté completa y sea real. */
function aIso(texto: string): string | null {
  const partes = texto.split('/');

  if (partes.length !== 3 || partes[0].length !== 2 || partes[1].length !== 2 || partes[2].length !== 4) {
    return null;
  }

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const anio = Number(partes[2]);

  if (mes < 1 || mes > 12 || dia < 1 || anio < 1900) {
    return null;
  }

  // El día se comprueba contra el mes de verdad: el 31 de febrero no existe y no debe viajar.
  const fecha = new Date(anio, mes - 1, dia);

  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return null;
  }

  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}
