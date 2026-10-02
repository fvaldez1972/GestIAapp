import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { reponerDialogoDeJsdom } from '../../../../testing/jsdom-dialog';
import { GiDayClosure, GiDaySnapshot, GiDayState, GI_REASON_MIN_LENGTH } from './gi-day-closure';

const FOTO_LIMPIA: GiDaySnapshot = {
  expectedShifts: 18,
  attendanceRecords: 18,
  pendingAttendance: 0,
  openIncidents: 0,
  coverageRecords: 1,
};

@Component({
  imports: [GiDayClosure],
  template: `
    <gi-day-closure
      [state]="state()"
      [closedByName]="closedByName()"
      [closedAt]="closedAt()"
      [reopenedByName]="reopenedByName()"
      [reopenedAt]="reopenedAt()"
      [snapshot]="snapshot()"
      [canWrite]="canWrite()"
      (closeDay)="cierres.set([...cierres(), $event])"
      (reopenDay)="reaperturas.set([...reaperturas(), $event])"
    />
  `,
})
class Anfitrion {
  readonly state = signal<GiDayState>('open');
  readonly closedByName = signal('Renata Villaseñor');
  readonly closedAt = signal('09 sep 2026, 21:14');
  readonly reopenedByName = signal('Renata Villaseñor');
  readonly reopenedAt = signal('10 sep 2026, 08:02');
  readonly snapshot = signal<GiDaySnapshot>(FOTO_LIMPIA);
  readonly canWrite = signal(true);
  readonly cierres = signal<(string | null)[]>([]);
  readonly reaperturas = signal<string[]>([]);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;

  /**
   * Los botones se buscan por zona y no sólo por texto: «Cerrar el día» aparece dos veces a
   * propósito —el de la barra abre el diálogo, el del diálogo confirma— y buscarlo suelto encuentra
   * siempre el primero. Un `find` por texto habría hecho pasar pruebas que no probaban nada.
   */
  const enZona = (zona: string) => (texto: string) =>
    Array.from(raiz.querySelectorAll(`${zona} button`)).find(
      (b) => b.textContent?.trim() === texto,
    ) as HTMLButtonElement | undefined ?? null;

  const boton = enZona('.gi-day');
  const botonDialogo = enZona('dialog');

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    chip: () => raiz.querySelector('.gi-day__chip')?.textContent?.trim() ?? null,
    rastro: () => raiz.querySelector('.gi-day__trail')?.textContent?.trim() ?? null,
    boton,
    botonDialogo,
    escribirMotivo: (texto: string) => {
      const campo = raiz.querySelector<HTMLTextAreaElement>('#gi-day-reopen-title ~ .gi-day__field textarea')!;
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
  };
}

describe('GiDayClosure', () => {
  beforeEach(() => reponerDialogoDeJsdom());

  /**
   * El estado se lee sin color. Un chip que sólo cambia de tinte no se distingue en escala de
   * grises ni con daltonismo, y el estado del día decide si corregir pide motivo.
   */
  it('nombra el estado con palabras en los tres casos', () => {
    const abierto = montar();
    expect(abierto.chip()).toBe('DÍA ABIERTO');

    TestBed.resetTestingModule();
    const cerrado = montar((host) => host.state.set('closed'));
    expect(cerrado.chip()).toBe('DÍA CERRADO');

    TestBed.resetTestingModule();
    const reabierto = montar((host) => host.state.set('reopened'));
    expect(reabierto.chip()).toBe('DÍA REABIERTO');
  });

  it('un día abierto no dice quién lo cerró, porque nadie lo cerró', () => {
    const { rastro } = montar();

    expect(rastro()).toBeNull();
  });

  it('un día cerrado dice quién y cuándo; uno reabierto dice quién lo reabrió', () => {
    const cerrado = montar((host) => host.state.set('closed'));
    expect(cerrado.rastro()).toBe('Cerró Renata Villaseñor, 09 sep 2026, 21:14');

    TestBed.resetTestingModule();
    const reabierto = montar((host) => host.state.set('reopened'));
    expect(reabierto.rastro()).toBe('Reabrió Renata Villaseñor, 10 sep 2026, 08:02');
  });

  /**
   * Reabrir un día ya reabierto no existe: `OperationDayClosure.Reopen` sale sin hacer nada si el
   * estado ya es reabierto. Ofrecer el botón prometería algo que el servidor ignora en silencio.
   */
  it('ofrece cerrar sólo si está abierto, y reabrir sólo si está cerrado', () => {
    const abierto = montar();
    expect(abierto.boton('Cerrar el día')).not.toBeNull();
    expect(abierto.boton('Reabrir el día')).toBeNull();

    TestBed.resetTestingModule();
    const cerrado = montar((host) => host.state.set('closed'));
    expect(cerrado.boton('Cerrar el día')).toBeNull();
    expect(cerrado.boton('Reabrir el día')).not.toBeNull();

    TestBed.resetTestingModule();
    const reabierto = montar((host) => host.state.set('reopened'));
    expect(reabierto.boton('Cerrar el día')).toBeNull();
    expect(reabierto.boton('Reabrir el día')).toBeNull();
  });

  it('sin permiso de escritura no ofrece ninguna acción, pero sí muestra el estado', () => {
    const { boton, chip } = montar((host) => host.canWrite.set(false));

    expect(boton('Cerrar el día')).toBeNull();
    expect(chip()).toBe('DÍA ABIERTO');
  });

  /**
   * La foto se enseña ANTES de confirmar. Estos cinco números son lo que queda fijo para conciliar
   * con el cliente; verlos cuando ya no se pueden cambiar no sirve de nada.
   */
  it('el diálogo de cierre enseña la foto antes de confirmar', () => {
    const { raiz, boton, fixture } = montar();

    boton('Cerrar el día')!.click();
    fixture.detectChanges();

    const foto = raiz.querySelector('.gi-day__snapshot')!.textContent!;
    expect(foto).toContain('Turnos esperados');
    expect(foto).toContain('18');
    expect(foto).toContain('Coberturas');
  });

  /**
   * Cerrar con pendientes se permite, y el aviso dice la consecuencia. «Hay pendientes» sería un
   * botón de continuar con otra redacción.
   */
  it('permite cerrar con pendientes y nombra qué se congela', () => {
    const { raiz, boton, botonDialogo, fixture, host } = montar((h) =>
      h.snapshot.set({ ...FOTO_LIMPIA, pendingAttendance: 3, openIncidents: 1 }),
    );

    boton('Cerrar el día')!.click();
    fixture.detectChanges();

    const aviso = raiz.querySelector('.gi-day__consequence')!.textContent!;
    expect(aviso).toContain('3 asistencias sin capturar');
    expect(aviso).toContain('1 incidencia sigue abierta');
    expect(aviso).toContain('exigir motivo');

    // Y se puede cerrar igual: el aviso informa, no bloquea.
    botonDialogo('Cerrar el día')!.click();
    fixture.detectChanges();
    expect(host.cierres()).toHaveLength(1);
  });

  it('sin pendientes no inventa un aviso', () => {
    const { raiz, boton, fixture } = montar();

    boton('Cerrar el día')!.click();
    fixture.detectChanges();

    expect(raiz.querySelector('.gi-day__consequence')).toBeNull();
  });

  it('la nota del cierre es opcional y viaja como nula cuando se deja vacía', () => {
    const { boton, botonDialogo, fixture, host } = montar();

    boton('Cerrar el día')!.click();
    fixture.detectChanges();
    botonDialogo('Cerrar el día')!.click();

    expect(host.cierres()).toEqual([null]);
  });

  /**
   * El motivo va vacío y sin sugerencia. Un motivo propuesto por el sistema se acepta sin leer, y
   * entonces la bitácora guarda la sugerencia en lugar de la razón de la persona.
   */
  it('el motivo de la reapertura empieza vacío', () => {
    const { raiz, boton, fixture } = montar((host) => host.state.set('closed'));

    boton('Reabrir el día')!.click();
    fixture.detectChanges();

    const campos = raiz.querySelectorAll<HTMLTextAreaElement>('textarea');
    for (const campo of Array.from(campos)) {
      expect(campo.value).toBe('');
      expect(campo.getAttribute('placeholder') ?? '').not.toContain('Se reabre');
    }
  });

  /**
   * Una acción inhabilitada tiene que decir por qué. El sistema lo prohíbe explícitamente, y aquí
   * el porqué además es accionable: falta escribir.
   */
  it('reabrir queda inhabilitado mientras el motivo es corto, y dice cuánto falta', () => {
    const { raiz, boton, botonDialogo, fixture, escribirMotivo, host } = montar((h) =>
      h.state.set('closed'),
    );

    boton('Reabrir el día')!.click();
    fixture.detectChanges();

    expect(botonDialogo('Reabrir')!.disabled).toBe(true);
    expect(raiz.querySelector('.gi-day__help')!.textContent).toContain(String(GI_REASON_MIN_LENGTH));

    escribirMotivo('corto');
    expect(botonDialogo('Reabrir')!.disabled).toBe(true);

    escribirMotivo('Faltó capturar dos asistencias del turno nocturno.');
    expect(botonDialogo('Reabrir')!.disabled).toBe(false);
    expect(raiz.querySelector('.gi-day__help')).toBeNull();

    botonDialogo('Reabrir')!.click();
    expect(host.reaperturas()).toEqual(['Faltó capturar dos asistencias del turno nocturno.']);
  });

  it('el mínimo del motivo es el mismo que exige el servidor', () => {
    expect(GI_REASON_MIN_LENGTH).toBe(10);
  });

  /**
   * Un cierre sin nombre no se puede auditar. El servidor siempre manda `ClosedByName`, así que si
   * llega vacío es que la pantalla no lo está leyendo, y eso se ve mejor rompiendo en desarrollo
   * que dibujando «Cerró , 09 sep».
   */
  it('rompe en desarrollo si un día cerrado no dice quién lo cerró', () => {
    expect(() =>
      montar((host) => {
        host.state.set('closed');
        host.closedByName.set('');
      }),
    ).toThrowError(/quién lo cerró/);
  });

  it('rompe en desarrollo si un día reabierto no dice quién lo reabrió', () => {
    expect(() =>
      montar((host) => {
        host.state.set('reopened');
        host.reopenedByName.set('');
      }),
    ).toThrowError(/quién lo reabrió/);
  });
});
