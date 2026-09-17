import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AttendanceGap, AttendanceRow } from '../data-access/attendance-day';
import { AttendanceExceptions, ExceptionPick } from './attendance-exceptions';

const fila = (
  id: string,
  employeeName: string,
  status: AttendanceRow['status'],
  extra: Partial<AttendanceRow> = {},
): AttendanceRow => ({
  idScheduledShift: id,
  idPosition: 'pos-1',
  idEmployee: `emp-${id}`,
  employeeName,
  employeeCode: 'EMP-1',
  positionCode: 'P-01',
  positionName: 'Acceso principal',
  planned: '07:00 – 19:00',
  actual: status === 'Absent' ? 'Sin registro de entrada' : '07:52 – 19:00',
  status,
  minutesLate: status === 'Late' ? 52 : 0,
  record: null,
  ...extra,
});

const hueco = (idPosition: string): AttendanceGap => ({
  idPosition,
  positionCode: idPosition.toUpperCase(),
  positionName: 'Rondín perimetral',
  requiredWorkerCount: 4,
  scheduledCount: 3,
});

@Component({
  imports: [AttendanceExceptions],
  template: `
    <app-attendance-exceptions
      [rows]="rows()"
      [gaps]="gaps()"
      [shiftCount]="shiftCount()"
      [dayClosed]="dayClosed()"
      (pick)="elegidas.set([...elegidas(), $event])"
      (gapPick)="huecos.set([...huecos(), $event.idPosition])"
    />
  `,
})
class Anfitrion {
  readonly rows = signal<readonly AttendanceRow[]>([]);
  readonly gaps = signal<readonly AttendanceGap[]>([]);
  readonly shiftCount = signal(18);
  readonly dayClosed = signal(false);
  readonly elegidas = signal<ExceptionPick[]>([]);
  readonly huecos = signal<string[]>([]);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    pildoras: () => Array.from(raiz.querySelectorAll('.gi-exc__pill')).map((p) => p.textContent?.trim()),
    sujetos: () => Array.from(raiz.querySelectorAll('.gi-exc__name')).map((n) => n.textContent?.trim()),
    acciones: () =>
      Array.from(raiz.querySelectorAll<HTMLButtonElement>('.gi-exc__button')).map((b) =>
        b.textContent?.trim(),
      ),
    badges: () => Array.from(raiz.querySelectorAll('.gi-exc__badge')).map((b) => b.textContent?.trim()),
  };
}

/** Un día con las tres cosas: una falta, un hueco y un retardo. */
function conTodo(host: Anfitrion) {
  host.rows.set([
    fila('t-1', 'Jorge Iván Peñaloza', 'Late'),
    fila('t-2', 'Laura Menchaca', 'Absent'),
    fila('t-3', 'Ana Sofía Rentería', 'Present'),
  ]);
  host.gaps.set([hueco('p-04')]);
}

describe('AttendanceExceptions', () => {
  /**
   * El orden es por lo que deja turnos al descubierto, no cronológico. Por hora, un retardo de las
   * 07:05 iría antes que una falta de las 07:00, y quien abre la pantalla a media mañana necesita
   * ver primero lo que todavía puede resolver.
   */
  it('ordena por lo que deja al descubierto: falta, hueco, retardo', () => {
    const { pildoras } = montar(conTodo);

    expect(pildoras()).toEqual(['FALTA', 'HUECO', 'RETARDO']);
  });

  it('no mete en la lista lo que salió bien', () => {
    const { sujetos } = montar(conTodo);

    expect(sujetos()).not.toContain('Ana Sofía Rentería');
  });

  /**
   * El hueco no continúa en la misma pantalla: no hay persona a la que corregirle nada. El
   * componente compartido rompe en desarrollo si se confunden, así que esto además comprueba que no
   * se confundieron.
   *
   * <p>La falta y el retardo llevan a <b>corregir la asistencia</b>, que es lo que abre el panel.
   * Antes el rótulo decía «Registrar incidencia» y abría otra cosa; la incidencia se registra en su
   * propia pantalla, donde además se cierra cubriendo el turno o declarándolo sin cubrir.</p>
   */
  it('la falta y el retardo llevan a corregir la asistencia; el hueco, a cobertura', () => {
    const { acciones } = montar(conTodo);

    expect(acciones()).toEqual([
      'Corregir la asistencia',
      'Ver en cobertura',
      'Corregir la asistencia',
    ]);
  });

  it('avisa qué excepción de persona se eligió, con su tipo', () => {
    const { raiz, host } = montar(conTodo);

    raiz.querySelectorAll<HTMLButtonElement>('.gi-exc__button')[0].click();

    expect(host.elegidas()).toHaveLength(1);
    expect(host.elegidas()[0].kind).toBe('absence');
    expect(host.elegidas()[0].row.employeeName).toBe('Laura Menchaca');
  });

  it('el hueco avisa por su propia salida, que es otra pantalla', () => {
    const { raiz, host } = montar(conTodo);

    raiz.querySelectorAll<HTMLButtonElement>('.gi-exc__button')[1].click();

    expect(host.huecos()).toEqual(['p-04']);
    expect(host.elegidas()).toEqual([]);
  });

  it('el retardo dice cuántos minutos, que es lo que lo documenta', () => {
    const { raiz } = montar(conTodo);

    expect(raiz.textContent).toContain('52 min de retardo');
  });

  /**
   * Un cero aquí es información: el día salió como se planeó. No es lo mismo que no tener datos, y
   * por eso lo dice con esas palabras.
   */
  it('sin excepciones lo dice como cero real, no como lista vacía', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.exc__limpio')!.textContent).toContain('Cero real');
    expect(raiz.querySelector('.exc__limpio')!.textContent).toContain('No es que falten datos');
  });

  /**
   * Una incidencia sobre un día cerrado se permite, marcada. La falta ocurrió, y si el sistema no la
   * deja registrar se registra fuera del sistema.
   */
  it('con el día cerrado marca las excepciones como posteriores al cierre, sin bloquearlas', () => {
    const { badges, acciones, raiz } = montar((host) => {
      conTodo(host);
      host.dayClosed.set(true);
    });

    expect(badges()).toEqual(['Posterior al cierre', 'Posterior al cierre']);
    expect(acciones()).toContain('Corregir la asistencia');

    for (const boton of Array.from(raiz.querySelectorAll<HTMLButtonElement>('.gi-exc__button'))) {
      expect(boton.disabled).toBe(false);
    }
  });

  it('con el día abierto no marca nada', () => {
    const { badges } = montar(conTodo);

    expect(badges()).toEqual([]);
  });

  /** El hueco no es de una persona, así que no lleva la marca del cierre. */
  it('el hueco no se marca como posterior al cierre', () => {
    const { raiz } = montar((host) => {
      host.gaps.set([hueco('p-04')]);
      host.dayClosed.set(true);
    });

    expect(raiz.querySelectorAll('.gi-exc__badge')).toHaveLength(0);
  });
});
