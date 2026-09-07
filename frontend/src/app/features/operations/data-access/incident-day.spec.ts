import { Incident, OperationDayClosure } from '../../clients/data-access/client.models';
import { buildIncidentDay, openIncidents } from './incident-day';

const DIA = '2026-09-10';

const incidencia = (id: string, extra: Partial<Incident> = {}): Incident => ({
  idIncident: id,
  idService: 'srv-1',
  idScheduledShift: 't-1',
  idEmployee: 'emp-1',
  employeeCode: 'EMP-1',
  employeeName: 'Laura Menchaca',
  incidentDate: DIA,
  incidentType: 'ROBO-01',
  severity: 'High',
  status: 'Open',
  description: 'Se detectó faltante en el almacén.',
  resolutionNotes: null,
  active: true,
  createdAt: '2026-09-10T15:00:00Z',
  rowVersion: 'AAAAAAAAB9E=',
  ...extra,
});

const cierre = (extra: Partial<OperationDayClosure> = {}): OperationDayClosure => ({
  idOperationDayClosure: 'cl-1',
  idOrganization: 'org-1',
  idService: 'srv-1',
  operationDate: DIA,
  expectedShifts: 18,
  attendanceRecords: 18,
  pendingAttendance: 0,
  openIncidents: 1,
  coverageRecords: 0,
  notes: null,
  status: 'Closed',
  closedAt: '2026-09-10T21:00:00Z',
  closedByName: 'Renata Villaseñor',
  reopenedAt: null,
  reopenedByName: null,
  reopenReason: null,
  active: true,
  rowVersion: 'AAAAAAAAB9E=',
  ...extra,
});

const CATALOGO = new Map([['ROBO-01', 'Robo o faltante']]);

const dia = (options: {
  incidents?: readonly Incident[];
  reasons?: ReadonlyMap<string, string>;
  closure?: OperationDayClosure | null;
}) =>
  buildIncidentDay({
    incidents: options.incidents ?? [],
    reasons: options.reasons ?? CATALOGO,
    closure: options.closure ?? null,
    date: DIA,
  });

describe('buildIncidentDay', () => {
  /**
   * Los tres conceptos que se parecen llevan nombres que no se pueden confundir. El motivo del
   * HECHO sale del catálogo; el de la CORRECCIÓN va a la bitácora y no vive en esta fila.
   */
  it('el motivo del hecho se enseña con su nombre del catálogo, no con el código', () => {
    const [fila] = dia({ incidents: [incidencia('i-1')] });

    expect(fila.factReasonCode).toBe('ROBO-01');
    expect(fila.factReasonLabel).toBe('Robo o faltante');
  });

  /**
   * El hecho ocurrió con ese motivo, y que alguien haya desactivado el valor después no lo borra.
   * Un guion en su lugar dejaría el expediente diciendo menos de lo que sabe.
   */
  it('si el motivo ya no está en el catálogo, enseña el código y no un guion', () => {
    const [fila] = dia({ incidents: [incidencia('i-1')], reasons: new Map() });

    expect(fila.factReasonLabel).toBe('ROBO-01');
  });

  it('no mezcla incidencias de otro día ni desactivadas', () => {
    const filas = dia({
      incidents: [
        incidencia('i-1'),
        incidencia('i-2', { incidentDate: '2026-09-09' }),
        incidencia('i-3', { active: false }),
      ],
    });

    expect(filas.map((row) => row.idIncident)).toEqual(['i-1']);
  });

  describe('la marca de posterior al cierre', () => {
    /** Es derivada: se compara el instante de creación contra el del cierre. Sin columna. */
    it('marca la que se creó después de cerrar el día', () => {
      const [fila] = dia({
        incidents: [incidencia('i-1', { createdAt: '2026-09-10T22:30:00Z' })],
        closure: cierre(),
      });

      expect(fila.afterClosure).toBe(true);
    });

    it('no marca la que ya existía cuando se cerró', () => {
      const [fila] = dia({
        incidents: [incidencia('i-1', { createdAt: '2026-09-10T15:00:00Z' })],
        closure: cierre(),
      });

      expect(fila.afterClosure).toBe(false);
    });

    it('sin cierre no marca nada', () => {
      const [fila] = dia({ incidents: [incidencia('i-1')], closure: null });

      expect(fila.afterClosure).toBe(false);
    });

    /**
     * Un día reabierto se reabrió justamente para poder seguir registrando, así que decir
     * «posterior al cierre» ahí sería señalar algo que ya se autorizó.
     */
    it('un día reabierto no marca nada, aunque la incidencia sea posterior', () => {
      const [fila] = dia({
        incidents: [incidencia('i-1', { createdAt: '2026-09-10T22:30:00Z' })],
        closure: cierre({ status: 'Reopened' }),
      });

      expect(fila.afterClosure).toBe(false);
    });
  });
});

describe('openIncidents', () => {
  it('las abiertas son las que siguen sin resolver, y son las que el cierre cuenta', () => {
    const filas = dia({
      incidents: [
        incidencia('i-1', { status: 'Open' }),
        incidencia('i-2', { status: 'InReview' }),
        incidencia('i-3', { status: 'Resolved' }),
        incidencia('i-4', { status: 'Cancelled' }),
      ],
    });

    expect(openIncidents(filas).map((row) => row.idIncident)).toEqual(['i-1', 'i-2']);
  });
});
