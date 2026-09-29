import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { plusCode } from '../../util/plus-code';

export type GiMapPoint = { readonly latitude: number; readonly longitude: number };

/**
 * El campo de ubicación: un mapa donde se marca el punto.
 *
 * <p>Los mosaicos son de OpenStreetMap, que no cobra y pide atribución visible; la atribución va
 * puesta y no se quita. Se carga Leaflet de forma diferida para que el resto de la aplicación no
 * cargue un mapa que casi ninguna pantalla usa.</p>
 */
@Component({
  selector: 'gi-map-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mapa">
      <div class="mapa__lienzo" #lienzo [attr.aria-label]="'Mapa para marcar la ubicación'"></div>

      @if (fallo()) {
        <p class="mapa__fallo" role="status">
          No se pudo cargar el mapa. Se puede capturar la ubicación a mano.
          <!-- El motivo, para que reportarlo no exija abrir la consola del navegador. -->
          @if (motivo()) {
            <small class="mapa__motivo">{{ motivo() }}</small>
          }
        </p>
      }

      <p class="mapa__datos">
        @if (point(); as punto) {
          <span class="mapa__coords">{{ punto.latitude.toFixed(6) }}, {{ punto.longitude.toFixed(6) }}</span>
          <span class="mapa__plus">Plus code {{ codigo() }}</span>
          @if (!disabled()) {
            <button class="mapa__quitar" type="button" (click)="limpiar()">Quitar la ubicación</button>
          }
        } @else {
          <span class="mapa__vacio">Sin ubicación marcada. Haz clic en el mapa para ponerla.</span>
        }
      </p>
    </div>
  `,
  styles: `
    .mapa { display: grid; gap: 0.4rem; }

    .mapa__lienzo {
      height: 16rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface-soft);
    }

    .mapa__fallo { margin: 0; color: var(--gestia-danger); font-size: 11.5px; }
    .mapa__motivo { display: block; color: var(--gestia-muted); font-size: 11px; }

    .mapa__datos { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.55rem; margin: 0; }
    .mapa__coords { color: var(--gestia-text); font-size: 12px; font-weight: 600; }
    .mapa__plus { color: var(--gestia-muted); font-size: 11.5px; }
    .mapa__vacio { color: var(--gestia-muted); font-size: 11.5px; }

    .mapa__quitar {
      padding: 0.1rem 0.5rem;
      border: 1px solid var(--gestia-border);
      border-radius: var(--gestia-radius);
      background: var(--gestia-surface);
      color: var(--gestia-text);
      font: inherit;
      font-size: 11px;
      cursor: pointer;
    }

    .mapa__quitar:focus-visible { outline: 2px solid var(--gestia-cyan); outline-offset: 1px; }
  `,
})
export class GiMapPicker implements AfterViewInit, OnDestroy {
  readonly point = input<GiMapPoint | null>(null);
  readonly disabled = input(false);
  readonly pointChange = output<GiMapPoint | null>();

  protected readonly fallo = signal(false);
  protected readonly codigo = computed(() => {
    const punto = this.point();
    return punto ? plusCode(punto.latitude, punto.longitude) : '';
  });

  private readonly lienzo = viewChild.required<ElementRef<HTMLDivElement>>('lienzo');
  private mapa: unknown = null;
  private marcador: unknown = null;
  private leaflet: typeof import('leaflet') | null = null;

  /** Lo que dijo el error, para no tener que adivinarlo. */
  protected readonly motivo = signal('');

  constructor() {
    effect(() => {
      const punto = this.point();

      if (this.leaflet && this.mapa) {
        this.dibujar(punto);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      // Leaflet es CommonJS, y eso cambia la forma de lo que devuelve el import.
      //
      // El paquete no trae módulo ESM, así que el empaquetador lo envuelve y la API queda bajo
      // `default` en vez de en la raíz. `L.map` era `undefined` y la llamada moría con «n.map is
      // not a function», que el catch se tragaba: en pantalla sólo quedaba «no se pudo cargar el
      // mapa». Se toma `default` cuando existe, y la raíz si algún día el paquete pasa a ESM.
      const modulo = await import('leaflet');
      const L = (modulo as unknown as { default?: typeof modulo }).default ?? modulo;
      this.leaflet = L;

      const inicial = this.point();
      const mapa = L.map(this.lienzo().nativeElement, { attributionControl: true }).setView(
        [inicial?.latitude ?? 19.4326, inicial?.longitude ?? -99.1332],
        inicial ? 17 : 5,
      );

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(mapa);

      mapa.on('click', (evento) => {
        if (this.disabled()) {
          return;
        }

        this.pointChange.emit({
          latitude: Number(evento.latlng.lat.toFixed(6)),
          longitude: Number(evento.latlng.lng.toFixed(6)),
        });
      });

      this.mapa = mapa;
      this.dibujar(inicial);
    } catch (error) {
      // El motivo se dice en voz alta. Un catch mudo aqui costo una sesion entera de diagnostico:
      // la pantalla decia "no se pudo cargar el mapa" y no habia forma de saber por que.
      console.error('[gi-map-picker] el mapa no arranco:', error);
      this.motivo.set(error instanceof Error ? error.message : String(error));
      this.fallo.set(true);
    }
  }

  ngOnDestroy(): void {
    (this.mapa as { remove?: () => void } | null)?.remove?.();
  }

  protected limpiar(): void {
    this.pointChange.emit(null);
  }

  private dibujar(punto: GiMapPoint | null): void {
    const L = this.leaflet;
    const mapa = this.mapa as import('leaflet').Map | null;

    if (!L || !mapa) {
      return;
    }

    if (this.marcador) {
      mapa.removeLayer(this.marcador as import('leaflet').Marker);
      this.marcador = null;
    }

    if (punto) {
      this.marcador = L.marker([punto.latitude, punto.longitude]).addTo(mapa);
      mapa.setView([punto.latitude, punto.longitude], Math.max(mapa.getZoom(), 15));
    }
  }
}
