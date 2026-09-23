import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnChanges, Output, EventEmitter, forwardRef, inject, signal, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription } from 'rxjs';
import { CatalogApiService } from '../../../features/catalogs/data-access/catalog-api.service';
import { GeoPlace, GeographyApiService } from '../../../features/catalogs/data-access/geography-api.service';
import { BusinessCatalogItemType, CatalogItem } from '../../../features/catalogs/data-access/catalog.models';

/** Lo que el desplegable pinta: lo que se guarda y lo que se lee. */
export interface CatalogOption {
  readonly value: string;
  readonly label: string;
}

const GEOGRAFIA: readonly BusinessCatalogItemType[] = ['Country', 'State', 'City'];

/**
 * Un desplegable de catálogo, con dos fuentes.
 *
 * <p><b>País, estado y municipio salen de la geografía compartida</b>; todo lo demás, del catálogo
 * de la organización. Hasta el 22 de septiembre de 2026 los tres eran filas de
 * BusinessCatalogItems repetidas una vez por empresa, y este componente pedía el catálogo entero y
 * recorría el árbol de padres en el navegador para quedarse con los hijos del país elegido. Ahora
 * la cascada la resuelve el servidor: se le pide el país y devuelve sus estados.</p>
 *
 * <p><b>El país se guarda por clave y el resto por nombre.</b> No es un capricho: la columna
 * CountryCode es de dos caracteres y ahí va «MX», mientras que State y Municipality guardan el
 * nombre visible. Mandar el nombre del país a una columna de dos caracteres es lo que hacía la
 * versión anterior de este desplegable, y el guardado fallaba en el servidor.</p>
 */
@Component({
  selector: 'app-catalog-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CatalogSelect), multi: true }],
  template: `
    <select class="gi-input" [attr.aria-label]="label" [value]="value()" [disabled]="disabled() || loading()" (change)="select($any($event.target).value)" (blur)="touched()">
      <option value="" [selected]="!value()">{{ loading() ? 'Cargando...' : 'Selecciona ' + label.toLowerCase() }}</option>
      @if (value() && !hasCurrent()) { <option [value]="value()" selected disabled>{{ useId ? 'Valor anterior no disponible' : value() + ' (valor anterior)' }}</option> }
      @for (option of options(); track option.value) { <option [value]="option.value" [selected]="option.value === value()">{{ option.label }}</option> }
    </select>
    @if (error()) { <small role="alert">No se pudieron cargar las opciones.</small><button type="button" (click)="load()">Reintentar</button> }
    @else if (!loading() && !options().length) { <small>{{ vacio() }}</small> }
  `,
  styles: [':host { display: block; min-width: 0; width: 100%; } select { width: 100%; } small { display: block; color: #65738a; font-size: .75rem; margin-top: .25rem; }'],
})
export class CatalogSelect implements ControlValueAccessor, OnChanges {
  @Input({ required: true }) organizationId = '';
  @Input({ required: true }) type: BusinessCatalogItemType = 'Country';
  @Input() label = 'Valor';
  @Input() country = '';
  @Input() state = '';
  /** Guardar el identificador del catálogo en vez de su nombre. La geografía no lo usa: ahí el país va por clave y el resto por nombre. */
  @Input() useId = false;
  @Output() selectionChange = new EventEmitter<string>();
  private readonly api = inject(CatalogApiService);
  private readonly geography = inject(GeographyApiService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private cargada = '';
  private readonly revision = signal(0);
  readonly values = signal<readonly CatalogItem[]>([]);
  readonly places = signal<readonly GeoPlace[]>([]);
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly loading = signal(false);
  readonly error = signal(false);
  private change: (value: string) => void = () => {};
  touched: () => void = () => {};

  readonly options = computed<readonly CatalogOption[]>(() => {
    this.revision();
    if (this.esGeografia()) {
      return this.places().map(lugar => ({
        value: this.type === 'Country' ? lugar.code : lugar.name,
        label: lugar.name,
      }));
    }
    return this.values()
      .filter(item => item.active && item.type === this.type)
      .map(item => ({ value: this.useId ? item.idCatalogItem : item.name, label: item.name }));
  });

  readonly hasCurrent = computed(() => this.options().some(option => option.value === this.value()));

  /**
   * Qué decir cuando la lista está vacía.
   *
   * <p><b>«Sin opciones activas» era verdad y era la cosa equivocada.</b> En el municipio aparecía
   * mientras no se hubiera elegido estado —que es el estado normal de una cascada recién abierta— y
   * hacía creer que el sistema no tiene municipios. Se reportó como defecto crítico por eso.</p>
   *
   * <p>Ahora distingue las dos situaciones: falta elegir lo de arriba, o de verdad no hay nada.</p>
   */
  readonly vacio = computed(() => {
    this.revision();
    if (this.type === 'State' && !this.country) return 'Elige primero el país';
    if (this.type === 'City' && !this.state) return 'Elige primero el estado';
    return 'Sin opciones activas';
  });

  private esGeografia(): boolean {
    return GEOGRAFIA.includes(this.type);
  }

  /**
   * Qué petición identifica lo que hay que traer.
   *
   * <p>Se compara como texto para decidir si hace falta volver a pedir. Antes sólo se miraba la
   * organización, que bastaba cuando la geografía venía en el mismo paquete que el resto del
   * catálogo; ahora cambiar de país tiene que volver a pedir los estados.</p>
   */
  private clave(): string {
    if (this.type === 'Country') return 'geo:country';
    if (this.type === 'State') return 'geo:state:' + this.country;
    if (this.type === 'City') return 'geo:city:' + this.country + ':' + this.state;
    return 'cat:' + this.organizationId;
  }

  ngOnChanges(): void {
    this.revision.update(value => value + 1);
    if (this.clave() !== this.cargada) this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.cargada = this.clave();
    this.values.set([]);
    this.places.set([]);
    this.error.set(false);
    if (this.esGeografia()) {
      const peticion = this.peticionGeografia();
      if (!peticion) { this.loading.set(false); return; }
      this.loading.set(true);
      this.request = peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: lugares => { this.places.set(lugares); this.loading.set(false); },
        error: () => { this.error.set(true); this.loading.set(false); },
      });
      return;
    }
    if (!this.organizationId) { this.loading.set(false); return; }
    this.loading.set(true);
    this.request = this.api.listOptions(this.organizationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: values => { this.values.set(values); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  /** Sin país no hay estados que pedir, y sin estado no hay municipios: la cascada se queda vacía, no falla. */
  private peticionGeografia(): Observable<readonly GeoPlace[]> | null {
    if (this.type === 'Country') return this.geography.listCountries();
    if (!this.country) return null;
    if (this.type === 'State') return this.geography.listStates(this.country);
    if (!this.state) return null;
    return this.geography.listMunicipalities(this.country, this.state);
  }

  select(value: string): void { this.value.set(value); this.change(value); this.touched(); this.selectionChange.emit(value); }
  writeValue(value: string | null): void { this.value.set(value ?? ''); }
  registerOnChange(fn: (value: string) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }
}
