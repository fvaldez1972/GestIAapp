import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnChanges, Output, EventEmitter, forwardRef, inject, signal, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { CatalogApiService } from '../../../features/catalogs/data-access/catalog-api.service';
import { BusinessCatalogItemType, CatalogItem } from '../../../features/catalogs/data-access/catalog.models';
import { normalizeCatalogName } from '../../util/catalog-name';

@Component({
  selector: 'app-catalog-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CatalogSelect), multi: true }],
  template: `
    <select class="gi-input" [attr.aria-label]="label" [value]="value()" [disabled]="disabled() || loading()" (change)="select($any($event.target).value)" (blur)="touched()">
      <option value="" [selected]="!value()">{{ loading() ? 'Cargando...' : 'Selecciona ' + label.toLowerCase() }}</option>
      @if (value() && !hasCurrent()) { <option [value]="value()" selected disabled>{{ useId ? 'Valor anterior no disponible' : value() + ' (valor anterior)' }}</option> }
      @for (option of options(); track option.idCatalogItem) { <option [value]="optionValue(option)" [selected]="optionValue(option) === value()">{{ option.name }}</option> }
    </select>
    @if (error()) { <small role="alert">No se pudieron cargar las opciones.</small><button type="button" (click)="load()">Reintentar</button> }
    @else if (!loading() && !options().length) { <small>Sin opciones activas</small> }
  `,
  styles: [':host { display: block; min-width: 0; width: 100%; } select { width: 100%; } small { display: block; color: #65738a; font-size: .75rem; margin-top: .25rem; }'],
})
export class CatalogSelect implements ControlValueAccessor, OnChanges {
  @Input({ required: true }) organizationId = '';
  @Input({ required: true }) type: BusinessCatalogItemType = 'Country';
  @Input() label = 'Valor';
  @Input() country = '';
  @Input() state = '';
  @Input() useId = false;
  @Output() selectionChange = new EventEmitter<string>();
  private readonly api = inject(CatalogApiService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private loadedOrganization = '';
  private readonly revision = signal(0);
  readonly values = signal<readonly CatalogItem[]>([]);
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly loading = signal(false);
  readonly error = signal(false);
  private change: (value: string) => void = () => {};
  touched: () => void = () => {};
  readonly options = computed(() => {
    this.revision();
    const values = this.values();
    const byId = new Map(values.map(item => [item.idCatalogItem, item]));
    return values.filter(item => {
      if (!item.active || item.type !== this.type) return false;
      const parent = byId.get(item.idParentCatalogItem ?? '');
      // El pais se resuelve por nombre plegado, no por codigo: el catalogo ya no lleva codigo.
      // Se acepta ademas el ISO de dos letras que ClientSite y Employee guardan en CountryCode,
      // que es un estandar externo y no una clave de este catalogo. Todo esto desaparece en la
      // tanda de geografia, cuando las tres columnas pasen a ser claves foraneas.
      if (this.type === 'State') return !!parent?.active && this.esElPais(parent);
      if (this.type === 'City') {
        const country = byId.get(parent?.idParentCatalogItem ?? '');
        return !!parent?.active && normalizeCatalogName(parent.name) === normalizeCatalogName(this.state)
          && !!country?.active && this.esElPais(country);
      }
      return true;
    });
  });
  private esElPais(item: CatalogItem): boolean {
    const buscado = normalizeCatalogName(this.country);
    return normalizeCatalogName(item.name) === buscado || (buscado === 'MX' && normalizeCatalogName(item.name) === 'MEXICO');
  }

  readonly hasCurrent = computed(() => this.options().some(item => this.optionValue(item) === this.value()));
  optionValue(item: CatalogItem): string { return this.useId ? item.idCatalogItem : item.name; }
  ngOnChanges(): void {
    this.revision.update(value => value + 1);
    if (this.organizationId !== this.loadedOrganization) this.load();
  }
  load(): void {
    this.request?.unsubscribe();
    this.loadedOrganization = this.organizationId;
    this.values.set([]);
    this.error.set(false);
    if (!this.organizationId) { this.loading.set(false); return; }
    this.loading.set(true);
    this.request = this.api.listOptions(this.organizationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: values => { this.values.set(values); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }
  select(value: string): void { this.value.set(value); this.change(value); this.touched(); this.selectionChange.emit(value); }
  writeValue(value: string | null): void { this.value.set(value ?? ''); }
  registerOnChange(fn: (value: string) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }
}
