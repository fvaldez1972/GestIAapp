import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Overview } from './overview.models';

@Injectable({ providedIn: 'root' })
export class OverviewApiService {
  private readonly http = inject(HttpClient);

  /**
   * Todo lo que la portada necesita, en una sola petición.
   *
   * <p>Antes eran ocho llamadas en paralelo que además no respondían a lo que la pantalla nueva
   * pregunta. La primera impresión del producto no puede ser una espera.</p>
   *
   * <p>Lo que vuelve ya viene recortado por permiso: un paso sin destino, un indicador que no
   * aparece. <b>Eso lo decide el servidor</b>, así que aquí no hay nada que filtrar.</p>
   */
  getOverview(organizationId: string) {
    return this.http.get<Overview>('/api/v1/overview', {
      params: new HttpParams().set('organizationId', organizationId),
    });
  }
}
