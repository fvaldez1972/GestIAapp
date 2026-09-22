import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AttendanceRecord } from '../../clients/data-access/client.models';
import { GiSelectOption } from '../../../shared/ui/gi-ui';
import { AttendanceRow } from '../data-access/attendance-day';
import { AttendanceDraft, AttendanceForm } from './attendance-form';

const registro = (extra: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  idAttendanceRecord: 'att-1',
  idScheduledShift: 't-1',
  idEmployee: 'emp-1',
  employeeCode: 'EMP-1',
  employeeName: 'Laura Menchaca',
  attendanceDate: '2026-09-10',
  status: 'Present',
  actualStartTime: '06:54:00',
  actualEndTime: '19:03:00',
  minutesLate: 0,
  notes: null,
  active: true,
  rowVersion: 'AAAAAAAAB9E=',
  ...extra,
});

const fila = (record: AttendanceRecord | null): AttendanceRow => ({
  idScheduledShift: 't-1',
  idPosition: 'pos-1',
  idEmployee: 'emp-1',
  employeeName: 'Laura Menchaca',
  employeeCode: 'EMP-1',
  positionCode: 'P-01',
  positionName: 'Acceso principal',
  planned: '07:00 – 19:00',
  actual: record ? '06:54 – 19:03' : 'Sin capturar',
  status: record?.status ?? null,
  minutesLate: record?.minutesLate ?? 0,
  record,
});

const AUTORIZACION: GiSelectOption = { value: 'apr-1', label: 'AUT-004 · corrección de asistencia' };

@Component({
  imports: [AttendanceForm],
  template: `
    <app-attendance-form
      [row]="row()"
      [dayClosed]="dayClosed()"
      [approvals]="approvals()"
      [saving]="saving()"
      (save)="guardados.set([...guardados(), $event])"
      (cancel)="cancelaciones.set(cancelaciones() + 1)"
      (requestApproval)="solicitudes.set(solicitudes() + 1)"
    />
  `,
})
class Anfitrion {
  readonly row = signal<AttendanceRow>(fila(null));
  readonly dayClosed = signal(false);
  readonly approvals = signal<readonly GiSelectOption[]>([]);
  readonly saving = signal(false);
  readonly guardados = signal<AttendanceDraft[]>([]);
  readonly cancelaciones = signal(0);
  readonly solicitudes = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;
  const inputs = () => Array.from(raiz.querySelectorAll<HTMLInputElement>('.asis__campo input'));
  const areas = () => Array.from(raiz.querySelectorAll<HTMLTextAreaElement>('textarea'));

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    bloques: () => Array.from(raiz.querySelectorAll('.asis__titulo')).map((t) => t.textContent?.trim()),
    guardar: () => raiz.querySelector<HTMLButtonElement>('.asis__guardar')!,
    problema: () => raiz.querySelector('.asis__problema')?.textContent?.trim() ?? null,
    escribirHora: (indice: number, valor: string) => {
      inputs()[indice].value = valor;
      inputs()[indice].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    escribirTexto: (indice: number, valor: string) => {
      areas()[indice].value = valor;
      areas()[indice].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    areas,
  };
}

describe('AttendanceForm', () => {
  describe('captura por primera vez', () => {
    it('no pide autorización ni motivo: capturar no es corregir', () => {
      const { bloques } = montar();

      expect(bloques()).toEqual(['Lo que pasó en el turno']);
    });

    it('guarda con la hora tecleada', () => {
      const f = montar();

      f.escribirHora(0, '07:05');
      f.guardar().click();

      expect(f.host.guardados()[0].actualStartTime).toBe('07:05');
      expect(f.host.guardados()[0].idApprovalRequest).toBeNull();
      expect(f.host.guardados()[0].correctionReason).toBeNull();
    });

    it('no deja guardar una asistencia sin hora de entrada, y dice qué hacer si no vino', () => {
      const { guardar, problema } = montar();

      expect(guardar().disabled).toBe(true);
      expect(problema()).toContain('marca que no se presentó');
    });
  });

  describe('la autorización y el motivo son cosas distintas', () => {
    /**
     * La condición de cada uno es distinta, y eso es lo que prueba que no son lo mismo: la
     * autorización se pide cuando los datos CAMBIARON; el motivo, cuando el DÍA ESTÁ CERRADO.
     */
    it('un día abierto con cambio pide autorización y no motivo', () => {
      const f = montar((h) => {
        h.row.set(fila(registro()));
        h.approvals.set([AUTORIZACION]);
      });

      f.escribirHora(0, '08:30');

      expect(f.bloques()).toEqual(['Lo que pasó en el turno', 'Autorización para corregir']);
    });

    it('un día cerrado sin cambio pide motivo y no autorización', () => {
      const { bloques } = montar((h) => {
        h.row.set(fila(registro()));
        h.dayClosed.set(true);
      });

      expect(bloques()).toEqual(['Lo que pasó en el turno', 'Motivo de la corrección']);
    });

    it('un día cerrado con cambio pide las dos, en bloques separados', () => {
      const f = montar((h) => {
        h.row.set(fila(registro()));
        h.dayClosed.set(true);
        h.approvals.set([AUTORIZACION]);
      });

      f.escribirHora(0, '08:30');

      expect(f.bloques()).toEqual([
        'Lo que pasó en el turno',
        'Autorización para corregir',
        'Motivo de la corrección',
      ]);
    });

    /** Guardar lo mismo que ya estaba no es corregir, y no debe pedir permiso. */
    it('sin cambios no pide autorización aunque sea una corrección', () => {
      const { bloques } = montar((h) => {
        h.row.set(fila(registro()));
        h.approvals.set([AUTORIZACION]);
      });

      expect(bloques()).toEqual(['Lo que pasó en el turno']);
    });

    /** Cada bloque dice qué es, para que nadie escriba en uno creyendo que es el otro. */
    it('cada bloque explica su propio papel', () => {
      const f = montar((h) => {
        h.row.set(fila(registro()));
        h.dayClosed.set(true);
        h.approvals.set([AUTORIZACION]);
      });

      f.escribirHora(0, '08:30');

      const permiso = f.raiz.querySelector('.asis__bloque--permiso')!.textContent!;
      expect(permiso).toContain('permiso previo');
      expect(permiso).toContain('No es la explicación del cambio');

      const motivo = f.raiz.querySelector('.asis__bloque--motivo')!.textContent!;
      expect(motivo).toContain('qué se hizo y por qué');
      expect(motivo).toContain('No sustituye a la autorización');
    });

    it('viajan en campos distintos al guardar', () => {
      const f = montar((h) => {
        h.row.set(fila(registro()));
        h.dayClosed.set(true);
        h.approvals.set([AUTORIZACION]);
      });

      f.escribirHora(0, '08:30');
      // El primer textarea es el de notas; el segundo, el del motivo.
      f.escribirTexto(1, 'Se corrigió la entrada con el registro del reloj checador.');

      // La autorización se elige con gi-select, así que se simula su elección desde el componente.
      const selectBoton = f.raiz.querySelectorAll<HTMLButtonElement>('gi-select button')[1];
      selectBoton.click();
      f.fixture.detectChanges();
      f.raiz.querySelector<HTMLElement>('[role="option"]')?.click();
      f.fixture.detectChanges();

      f.guardar().click();

      const guardado = f.host.guardados()[0];
      expect(guardado.correctionReason).toBe(
        'Se corrigió la entrada con el registro del reloj checador.',
      );
      expect(guardado.idApprovalRequest).not.toBe(guardado.correctionReason);
    });
  });

  describe('cuando falta la autorización', () => {
    it('lo dice y ofrece solicitarla, en vez de dejar el desplegable vacío', () => {
      const f = montar((h) => h.row.set(fila(registro())));

      f.escribirHora(0, '08:30');

      expect(f.raiz.querySelector('.asis__falta')!.textContent).toContain(
        'hay ninguna autorización aprobada que apunte a este registro',
      );
      f.raiz.querySelector<HTMLButtonElement>('.asis__link')!.click();
      expect(f.host.solicitudes()).toBe(1);
    });

    it('no deja guardar, y el porqué va amarrado al botón', () => {
      const f = montar((h) => h.row.set(fila(registro())));

      f.escribirHora(0, '08:30');

      expect(f.guardar().disabled).toBe(true);
      expect(f.problema()).toContain('no hay ninguna para este registro');
      expect(f.guardar().getAttribute('aria-describedby')).toBe('asis-problema');
    });
  });

  describe('el motivo', () => {
    it('empieza vacío y sin sugerencia', () => {
      const f = montar((h) => {
        h.row.set(fila(registro()));
        h.dayClosed.set(true);
      });

      expect(f.areas()[1].value).toBe('');
    });

    it('pide un mínimo y dice cuánto falta', () => {
      const f = montar((h) => {
        h.row.set(fila(registro()));
        h.dayClosed.set(true);
      });

      f.escribirTexto(1, 'corto');

      expect(f.guardar().disabled).toBe(true);
      expect(f.raiz.querySelector('#asis-motivo')!.textContent).toContain('Van 5');
    });
  });

  describe('la falta', () => {
    /**
     * Una falta con hora de entrada es una contradicción que el reporte heredaría sin poder
     * explicarla, así que cambiar a falta limpia las horas.
     */
    it('al marcar que no se presentó, las horas dejan de pedirse y se limpian', () => {
      const f = montar();

      f.escribirHora(0, '07:05');

      const select = f.raiz.querySelector<HTMLButtonElement>('gi-select button')!;
      select.click();
      f.fixture.detectChanges();
      const opciones = Array.from(f.raiz.querySelectorAll<HTMLElement>('[role="option"]'));
      opciones.find((o) => o.textContent?.includes('No se presentó'))!.click();
      f.fixture.detectChanges();

      expect(f.raiz.textContent).toContain('Una falta no lleva horas');
      f.guardar().click();

      expect(f.host.guardados()[0].status).toBe('Absent');
      expect(f.host.guardados()[0].actualStartTime).toBeNull();
      expect(f.host.guardados()[0].minutesLate).toBe(0);
    });
  });

  /**
   * Corregir parte de lo que dice el registro, no de una hoja en blanco: empezar vacío obligaría a
   * reescribir lo que no se está cambiando, y cualquier olvido se guardaría como una corrección que
   * nadie hizo.
   */
  it('al corregir, el formulario arranca con lo que ya estaba capturado', () => {
    // El registro es de un retardo: los minutos sólo existen con ese estado.
    const { raiz } = montar((h) => h.row.set(fila(registro({ status: 'Late', minutesLate: 12 }))));

    const inputs = Array.from(raiz.querySelectorAll<HTMLInputElement>('.asis__campo input'));
    expect(inputs[0].value).toBe('06:54');
    expect(inputs[1].value).toBe('19:03');
    expect(inputs[2].value).toBe('12');
  });

  it('mientras guarda no deja guardar otra vez', () => {
    const f = montar((h) => h.saving.set(true));

    f.escribirHora(0, '07:00');

    expect(f.guardar().disabled).toBe(true);
  });

  it('cancelar avisa y no guarda nada', () => {
    const f = montar();

    f.raiz.querySelector<HTMLButtonElement>('.asis__cancelar')!.click();

    expect(f.host.cancelaciones()).toBe(1);
    expect(f.host.guardados()).toEqual([]);
  });
});

/**
 * Los minutos de retardo pertenecen a un retardo.
 *
 * <p>Salió recorriendo el portal: se podía guardar «Asistió» con cinco minutos de retardo. El
 * registro quedaba escrito con esos minutos, no contaba como excepción, y no aparecía en ningún
 * contador. Un dato que se contradice a sí mismo y que además nadie ve.</p>
 */
describe('AttendanceForm · los minutos son del retardo', () => {
  afterEach(() => TestBed.resetTestingModule());

  const minutos = (raiz: HTMLElement) =>
    Array.from(raiz.querySelectorAll<HTMLElement>('.asis__campo span'))
      .some((etiqueta) => etiqueta.textContent?.includes('Minutos de retardo'));

  it('con «Asistió» no se piden', () => {
    const { raiz } = montar((h) => h.row.set(fila(registro({ status: 'Present' }))));

    expect(minutos(raiz)).toBe(false);
  });

  it('con «Llegó tarde» sí', () => {
    const { raiz } = montar((h) => h.row.set(fila(registro({ status: 'Late', minutesLate: 7 }))));

    expect(minutos(raiz)).toBe(true);
  });

  it('un registro guardado como «Asistió» no arrastra minutos de un estado que ya no tiene', () => {
    const { raiz } = montar((h) =>
      h.row.set(fila(registro({ status: 'Present', minutesLate: 12 }))),
    );

    expect(minutos(raiz)).toBe(false);
    expect(raiz.textContent).not.toContain('12');
  });
});
