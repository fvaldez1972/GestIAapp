import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

export type SystemInfo = {
  readonly application: string;
  readonly apiVersion: string;
  readonly status: string;
  readonly persistence: string;
  /** Día operativo del servidor, como `yyyy-MM-dd`. */
  readonly operationDate: string;
  /** Identificador IANA del huso operativo, por ejemplo `America/Mexico_City`. */
  readonly timeZoneId: string;
};

/**
 * El día operativo, tal como lo ve el servidor.
 *
 * <b>No se calcula aquí, y ésa es toda la razón de que este servicio exista.</b> En UTC el día
 * empieza entre seis y siete horas antes que en México, así que un `new Date()` en el navegador
 * mostraría un día distinto del que el servidor usa para decidir vigencias y elegibilidad. Ese
 * defecto ya se cerró en el backend; calcular la fecha del lado del cliente lo repondría movido de
 * capa, y esta vez sin prueba que lo detecte.
 *
 * Si la consulta falla, la fecha queda vacía y la barra de contexto dice que no la sabe. Una
 * fecha inventada es peor que ninguna: quien la lee toma decisiones con ella.
 */
@Injectable({ providedIn: 'root' })
export class SystemInfoService {
  private readonly http = inject(HttpClient);
  private readonly infoState = signal<SystemInfo | null>(null);

  readonly info = this.infoState.asReadonly();

  /**
   * El día operativo, como `yyyy-MM-dd`. **Cadena vacía mientras el servidor no lo diga.**
   *
   * Las pantallas lo usan para el valor por omisión de sus filtros de fecha. Antes cada una hacía
   * `new Date().toISOString().slice(0, 10)`, que es el día **UTC**: a las 19:00 hora de Ciudad de
   * México del 4 de septiembre eso devuelve el 5, y la pantalla proponía el día siguiente todas
   * las tardes. Es el mismo defecto que el reloj operativo cerró en el servidor.
   *
   * Devuelve vacío, y no el día del navegador, cuando todavía no hay respuesta: un filtro vacío se
   * nota y se llena; un día equivocado se usa sin que nadie lo mire.
   */
  readonly operationDate = computed(() => this.infoState()?.operationDate ?? '');

  /** El huso operativo del servidor. Nadie debería volver a escribirlo a mano en el navegador. */
  readonly timeZoneId = computed(() => this.infoState()?.timeZoneId ?? '');

  constructor() {
    this.refresh();

    // Una sala de monitoreo deja la aplicación abierta toda la noche. Sin esto, la barra seguiría
    // mostrando el día de ayer hasta que alguien recargara.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        this.refresh();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
  }

  refresh() {
    this.http.get<SystemInfo>('/api/v1/system/info').subscribe({
      next: (info) => this.infoState.set(info),
      error: () => this.infoState.set(null),
    });
  }
}
