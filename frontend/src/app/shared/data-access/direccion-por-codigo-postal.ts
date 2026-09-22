import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import {
  GeographyApiService,
  PostalCodeNeighborhood,
} from '../../features/catalogs/data-access/geography-api.service';
import { GiSelectOption } from '../ui/gi-ui';

/** El valor con el que el desplegable de colonia dice «ninguna de éstas»: no es una colonia. */
export const OTRA_COLONIA = '__otra__';

/** Lo que cualquier formulario con domicilio guarda de la geografía. */
export type DireccionGeografica = {
  readonly countryCode: string;
  readonly postalCode: string;
  readonly neighborhood: string;
  readonly state: string;
  readonly municipality: string;
};

/**
 * El domicilio que resuelve el código postal, compartido por los formularios que lo capturan.
 *
 * <p><b>Es un servicio y no un componente, y eso es deliberado.</b> Lo que hay que compartir es el
 * comportamiento —qué pasa al escribir cinco dígitos, qué pasa cuando no están en el padrón, cómo
 * se ofrece la colonia—, no la distribución de los campos en pantalla: la zona de un cliente pone
 * el código postal junto a la calle y el expediente de una persona lo pone en otro lado. Un
 * componente compartido habría obligado a las dos pantallas a la misma rejilla.</p>
 *
 * <p>Se provee <b>por componente</b> (en su arreglo <c>providers</c>), no en la raíz: cada
 * formulario abierto tiene su propio domicilio a medio escribir.</p>
 *
 * <p><b>Los tres desplegables no son un respaldo de adorno.</b> El padrón de SEPOMEX se publica
 * cada tanto y los fraccionamientos nuevos tardan en entrar, así que el código postal no puede ser
 * la única forma de contestar; y el día que haya un país que no sea México tampoco habrá padrón
 * que consultar.</p>
 */
@Injectable()
export class DireccionPorCodigoPostal {
  private readonly geography = inject(GeographyApiService);
  private readonly destroyRef = inject(DestroyRef);
  private consulta?: Subscription;

  /** México por omisión: es donde opera todo lo capturado hasta hoy, y evita un campo vacío. */
  readonly countryCode = signal('MX');
  readonly postalCode = signal('');
  readonly neighborhood = signal('');
  readonly state = signal('');
  readonly municipality = signal('');

  /** Las colonias del código postal escrito. Vacío mientras no haya un código que resuelva. */
  readonly colonias = signal<readonly PostalCodeNeighborhood[]>([]);
  readonly buscando = signal(false);
  readonly sinPadron = signal(false);
  /** El escape del desplegable: la colonia que el padrón no trae se escribe. */
  readonly coloniaLibre = signal(false);

  /**
   * Las colonias del código postal, con la salida al final.
   *
   * <p>«Otra» va siempre, y no es una colonia: es la forma de contestar cuando el padrón no trae
   * la que se busca.</p>
   */
  readonly opcionesDeColonia = computed<readonly GiSelectOption[]>(() => {
    const colonias = this.colonias();
    if (!colonias.length) return [];
    return [
      ...colonias.map((colonia) => ({ value: colonia.name, label: colonia.name })),
      { value: OTRA_COLONIA, label: 'Otra: escribirla' },
    ];
  });

  /** Si la colonia se elige de una lista o se escribe. */
  readonly coloniaEnLista = computed(() => this.opcionesDeColonia().length > 0 && !this.coloniaLibre());

  /** Lo capturado, tal como lo guarda quien lo pida. */
  valor(): DireccionGeografica {
    return {
      countryCode: this.countryCode(),
      postalCode: this.postalCode().trim(),
      neighborhood: this.neighborhood().trim(),
      state: this.state().trim(),
      municipality: this.municipality().trim(),
    };
  }

  /**
   * El código postal manda en la dirección.
   *
   * <p>Se escriben cinco dígitos y se resuelven país, estado, municipio y la lista de colonias,
   * que es como funciona cualquier formulario mexicano.</p>
   *
   * <p><b>Lo que no encuentra no se borra.</b> Un código que no resuelve deja el estado y el
   * municipio como estaban: quien está corrigiendo el teléfono de un expediente viejo no puede
   * perder su domicilio por teclear mal un dígito.</p>
   */
  onPostalCode(valor: string): void {
    const codigo = (valor ?? '').replace(/\D/g, '').slice(0, 5);
    this.postalCode.set(codigo);
    this.consulta?.unsubscribe();
    this.sinPadron.set(false);

    if (codigo.length !== 5) {
      this.buscando.set(false);
      return;
    }

    this.buscando.set(true);
    this.consulta = this.geography
      .lookupPostalCode(codigo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resuelto) => {
          this.buscando.set(false);
          this.countryCode.set(resuelto.countryCode);
          this.state.set(resuelto.state.name);
          this.municipality.set(resuelto.municipality.name);
          this.colonias.set(resuelto.neighborhoods);

          // La colonia ya escrita se conserva si es una de las del código; si no, se limpia para
          // que se elija. Conservar una colonia de otro código postal sería peor que vaciar.
          const escrita = this.plegado(this.neighborhood());
          const coincide = resuelto.neighborhoods.some((c) => this.plegado(c.name) === escrita);
          this.coloniaLibre.set(false);
          if (!coincide) {
            this.neighborhood.set('');
          }
        },
        error: () => {
          this.buscando.set(false);
          this.sinPadron.set(true);
          this.colonias.set([]);
          this.coloniaLibre.set(false);
        },
      });
  }

  /** «Otra» no es una colonia: es la salida al campo de texto. */
  onColonia(valor: string): void {
    if (valor === OTRA_COLONIA) {
      this.coloniaLibre.set(true);
      this.neighborhood.set('');
      return;
    }
    this.neighborhood.set(valor);
  }

  /** Cambiar de estado invalida el municipio elegido: pertenecía al estado anterior. */
  onState(valor: string): void {
    this.state.set(valor);
    this.municipality.set('');
  }

  /** Y cambiar de país invalida los dos de abajo, por la misma razón. */
  onCountry(valor: string): void {
    this.countryCode.set(valor);
    this.state.set('');
    this.municipality.set('');
  }

  /**
   * Carga un domicilio ya guardado, sin consultar el código postal.
   *
   * <p>Abrir algo para editarlo no resuelve el código: el domicilio ya está guardado y volver a
   * resolverlo podría reescribirlo solo, sin que nadie lo pidiera. La consulta sale cuando alguien
   * escribe el código, que es cuando hay una intención detrás.</p>
   */
  cargar(direccion: {
    readonly countryCode?: string | null;
    readonly postalCode?: string | null;
    readonly neighborhood?: string | null;
    readonly state?: string | null;
    readonly municipality?: string | null;
  }): void {
    this.olvidar();
    this.countryCode.set(direccion.countryCode || 'MX');
    this.postalCode.set(direccion.postalCode ?? '');
    this.neighborhood.set(direccion.neighborhood ?? '');
    this.state.set(direccion.state ?? '');
    this.municipality.set(direccion.municipality ?? '');
  }

  limpiar(): void {
    this.cargar({});
  }

  /**
   * Lo que el código postal había resuelto deja de valer al abrir otro domicilio.
   *
   * <p>Sin esto, las colonias del código anterior seguirían en el desplegable del siguiente, que
   * es una lista de colonias de otro municipio ofrecida como si fuera la buena.</p>
   */
  olvidar(): void {
    this.consulta?.unsubscribe();
    this.colonias.set([]);
    this.buscando.set(false);
    this.sinPadron.set(false);
    this.coloniaLibre.set(false);
  }

  /** Sin acentos, sin espacios de sobra y en mayúsculas, sólo para comparar. */
  private plegado(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }
}
