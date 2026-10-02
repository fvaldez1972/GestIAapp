import { Observable, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ServicePosition, ShiftSegment } from '../../clients/data-access/client.models';

/** Lo que hace falta del servidor para resolver los segmentos. Se pide así para poder probarlo. */
export type SegmentSource = {
  listShiftPatterns(
    organizationId: string,
    idClient: string,
    idService: string,
    idPosition: string,
  ): Observable<readonly { readonly idShiftPattern: string; readonly active: boolean }[]>;

  listShiftSegments(
    organizationId: string,
    idClient: string,
    idService: string,
    idPosition: string,
    idShiftPattern: string,
  ): Observable<readonly ShiftSegment[]>;
};

/**
 * Los segmentos del patrón activo de cada posición, en un solo mapa.
 *
 * <p><b>Son dos consultas encadenadas por posición y por eso vive aquí y no en la pantalla.</b> El
 * servidor expone patrones y segmentos por separado, así que la proyección de la semana necesita
 * primero el patrón activo de cada posición y después sus segmentos. Ese encadenado dentro del
 * orquestador son cuarenta líneas de fontanería en medio de la lógica de la pantalla, y sin forma
 * de probarlo sin montar la pantalla entera.</p>
 *
 * <p><b>Una posición sin patrón activo no entra en el mapa</b>, y esa ausencia es información: es
 * lo que `buildPlanningWeek` lee como «nadie declaró nada» para pintar la semana como
 * <i>sin declarar</i> en vez de como una semana de descansos.</p>
 *
 * <p>Un fallo al leer una posición no tumba a las demás: se trata como «sin patrón», que es lo que
 * el usuario ya vería si el patrón no existiera, en lugar de dejar la semana entera en blanco por
 * una consulta.</p>
 */
export function loadActiveSegments(
  api: SegmentSource,
  options: {
    readonly organizationId: string;
    readonly idClient: string;
    readonly idService: string;
    readonly positions: readonly ServicePosition[];
  },
): Observable<ReadonlyMap<string, readonly ShiftSegment[]>> {
  const { organizationId, idClient, idService, positions } = options;

  if (positions.length === 0) {
    return of(new Map());
  }

  return forkJoin(
    positions.map((position) =>
      api
        .listShiftPatterns(organizationId, idClient, idService, position.idPosition)
        .pipe(catchError(() => of([]))),
    ),
  ).pipe(
    switchMap((patronesPorPosicion) => {
      const conPatron = positions
        .map((position, i) => ({
          idPosition: position.idPosition,
          pattern: patronesPorPosicion[i].find((pattern) => pattern.active) ?? null,
        }))
        .filter((item): item is { idPosition: string; pattern: { idShiftPattern: string; active: boolean } } =>
          item.pattern !== null,
        );

      if (conPatron.length === 0) {
        return of(new Map<string, readonly ShiftSegment[]>());
      }

      return forkJoin(
        conPatron.map((item) =>
          api
            .listShiftSegments(
              organizationId,
              idClient,
              idService,
              item.idPosition,
              item.pattern.idShiftPattern,
            )
            .pipe(catchError(() => of([] as readonly ShiftSegment[]))),
        ),
      ).pipe(
        switchMap((segmentosPorPosicion) =>
          of(new Map(conPatron.map((item, i) => [item.idPosition, segmentosPorPosicion[i]]))),
        ),
      );
    }),
  );
}
