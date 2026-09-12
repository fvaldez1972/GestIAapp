import { Observable, of, throwError } from 'rxjs';
import { ServicePosition, ShiftSegment } from '../../clients/data-access/client.models';
import { SegmentSource, loadActiveSegments } from './active-segments';

const posicion = (id: string): ServicePosition => ({
  idPosition: id,
  idService: 'srv-1',
  codePosition: id.toUpperCase(),
  name: `Posición ${id}`,
  requiredWorkerCount: 2,
  requiredSkillProfile: null,
  notes: null,
  active: true,
  monthlyPrice: 0,
  currencyCode: 'MXN',
  isTaxIncluded: false,
});

const segmento = (idShiftPattern: string, dayOfWeek: string): ShiftSegment => ({
  idShiftSegment: `seg-${idShiftPattern}-${dayOfWeek}`,
  idShiftPattern,
  dayOfWeek,
  startTime: '07:00:00',
  endTime: '19:00:00',
  isOvernight: false,
  requiredWorkerCount: 2,
  durationMinutes: 720,
  notes: null,
  active: true,
});

/** Un servidor de mentira que devuelve lo que le digan, y anota qué le preguntaron. */
function servidor(options: {
  patterns: Record<string, readonly { idShiftPattern: string; active: boolean }[]>;
  segments?: Record<string, readonly ShiftSegment[]>;
  fallaEnPatrones?: readonly string[];
  fallaEnSegmentos?: readonly string[];
}) {
  const preguntas: string[] = [];

  const api: SegmentSource = {
    listShiftPatterns: (_org, _client, _service, idPosition) => {
      preguntas.push(`patrones:${idPosition}`);

      return options.fallaEnPatrones?.includes(idPosition)
        ? (throwError(() => new Error('cayó')) as Observable<never>)
        : of(options.patterns[idPosition] ?? []);
    },
    listShiftSegments: (_org, _client, _service, idPosition, idShiftPattern) => {
      preguntas.push(`segmentos:${idPosition}`);

      return options.fallaEnSegmentos?.includes(idPosition)
        ? (throwError(() => new Error('cayó')) as Observable<never>)
        : of(options.segments?.[idShiftPattern] ?? []);
    },
  };

  return { api, preguntas };
}

function resolver(api: SegmentSource, positions: readonly ServicePosition[]) {
  let resultado: ReadonlyMap<string, readonly ShiftSegment[]> | null = null;

  loadActiveSegments(api, {
    organizationId: 'org-1',
    idClient: 'cli-1',
    idService: 'srv-1',
    positions,
  }).subscribe((mapa) => (resultado = mapa));

  return resultado!;
}

describe('loadActiveSegments', () => {
  it('devuelve los segmentos del patrón activo de cada posición', () => {
    const { api } = servidor({
      patterns: {
        'p-1': [{ idShiftPattern: 'pat-1', active: true }],
        'p-2': [{ idShiftPattern: 'pat-2', active: true }],
      },
      segments: {
        'pat-1': [segmento('pat-1', 'Monday')],
        'pat-2': [segmento('pat-2', 'Tuesday')],
      },
    });

    const mapa = resolver(api, [posicion('p-1'), posicion('p-2')]);

    expect([...mapa.keys()]).toEqual(['p-1', 'p-2']);
    expect(mapa.get('p-1')![0].dayOfWeek).toBe('Monday');
    expect(mapa.get('p-2')![0].dayOfWeek).toBe('Tuesday');
  });

  it('de varios patrones toma el activo, no el primero', () => {
    const { api } = servidor({
      patterns: {
        'p-1': [
          { idShiftPattern: 'viejo', active: false },
          { idShiftPattern: 'pat-1', active: true },
        ],
      },
      segments: { 'pat-1': [segmento('pat-1', 'Friday')], viejo: [segmento('viejo', 'Monday')] },
    });

    const mapa = resolver(api, [posicion('p-1')]);

    expect(mapa.get('p-1')![0].dayOfWeek).toBe('Friday');
  });

  /**
   * La ausencia es información: es lo que `buildPlanningWeek` lee como «nadie declaró nada» para
   * pintar la semana como sin declarar en vez de como una semana de descansos.
   */
  it('una posición sin patrón activo no entra en el mapa', () => {
    const { api, preguntas } = servidor({
      patterns: { 'p-1': [{ idShiftPattern: 'viejo', active: false }] },
    });

    const mapa = resolver(api, [posicion('p-1')]);

    expect(mapa.has('p-1')).toBe(false);
    // Y no se le piden segmentos a un patrón que no existe.
    expect(preguntas).toEqual(['patrones:p-1']);
  });

  it('sin posiciones no le pregunta nada al servidor', () => {
    const { api, preguntas } = servidor({ patterns: {} });

    const mapa = resolver(api, []);

    expect(mapa.size).toBe(0);
    expect(preguntas).toEqual([]);
  });

  /**
   * Un fallo en una posición no tumba a las demás. Dejar la semana entera en blanco por una
   * consulta escondería las once posiciones que sí se pudieron leer.
   */
  it('si falla el patrón de una posición, las demás siguen', () => {
    const { api } = servidor({
      patterns: {
        'p-1': [{ idShiftPattern: 'pat-1', active: true }],
        'p-2': [{ idShiftPattern: 'pat-2', active: true }],
      },
      segments: { 'pat-2': [segmento('pat-2', 'Sunday')] },
      fallaEnPatrones: ['p-1'],
    });

    const mapa = resolver(api, [posicion('p-1'), posicion('p-2')]);

    expect(mapa.has('p-1')).toBe(false);
    expect(mapa.get('p-2')![0].dayOfWeek).toBe('Sunday');
  });

  it('si fallan los segmentos de una posición, queda vacía y no rota', () => {
    const { api } = servidor({
      patterns: { 'p-1': [{ idShiftPattern: 'pat-1', active: true }] },
      fallaEnSegmentos: ['p-1'],
    });

    const mapa = resolver(api, [posicion('p-1')]);

    expect(mapa.get('p-1')).toEqual([]);
  });
});
