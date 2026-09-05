import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

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
