import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Incident } from '../../clients/data-access/client.models';
import { GiSelectOption } from '../../../shared/ui/gi-ui';
import { IncidentDraft, IncidentRow } from '../data-access/incident-day';
import { IncidentForm } from './incident-form';

const MOTIVOS: readonly GiSelectOption[] = [
  { value: 'ROBO-01', label: 'Robo o faltante' },
  { value: 'FALTA-01', label: 'Falta sin aviso' },
];

const fila = (extra: Partial<IncidentRow> = {}): IncidentRow => ({
  idIncident: 'i-1',
  employeeName: 'Laura Menchaca',
  positionLabel: 'Laura Menchaca',
  factReasonCode: 'ROBO-01',
  factReasonLabel: 'Robo o faltante',
  severity: 'High',
  status: 'Open',
  description: 'Se detectó faltante en el almacén.',
  resolutionNotes: null,
  afterClosure: false,
  incident: {} as Incident,
  ...extra,
});

@Component({
  imports: [IncidentForm],
  template: `
    <app-incident-form
      [row]="row()"
      [reasons]="reasons()"
      [dayClosed]="dayClosed()"
      [saving]="saving()"
      (save)="guardados.set([...guardados(), $event])"
      (cancel)="cancelaciones.set(cancelaciones() + 1)"
      (openCatalog)="catalogos.set(catalogos() + 1)"
    />
  `,
})
class Anfitrion {
  readonly row = signal<IncidentRow | null>(null);
  readonly reasons = signal<readonly GiSelectOption[]>(MOTIVOS);
  readonly dayClosed = signal(false);
  readonly saving = signal(false);
  readonly guardados = signal<IncidentDraft[]>([]);
  readonly cancelaciones = signal(0);
  readonly catalogos = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;
  const areas = () => Array.from(raiz.querySelectorAll<HTMLTextAreaElement>('textarea'));

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    bloques: () => Array.from(raiz.querySelectorAll('.incf__titulo')).map((t) => t.textContent?.trim()),
    guardar: () => raiz.querySelector<HTMLButtonElement>('.incf__guardar')!,
    problema: () => raiz.querySelector('.incf__problema')?.textContent?.trim() ?? null,
    escribir: (indice: number, valor: string) => {
      areas()[indice].value = valor;
      areas()[indice].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    elegir: (indiceSelect: number, texto: string) => {
      raiz.querySelectorAll<HTMLButtonElement>('gi-select button')[indiceSelect].click();
      fixture.detectChanges();
      const opciones = Array.from(raiz.querySelectorAll<HTMLElement>('[role="option"]'));
      opciones.find((o) => o.textContent?.includes(texto))!.click();
      fixture.detectChanges();
    },
    areas,
  };
}

describe('IncidentForm', () => {
  describe('registrar una incidencia nueva', () => {
    it('no pide motivo de corrección: registrar no es corregir', () => {
      const { bloques } = montar();

      expect(bloques()).toEqual(['Qué pasó']);
    });

    /** El motivo del hecho se ELIGE del catálogo: nunca es texto libre. */
    it('el motivo del hecho sale del catálogo, no de un campo de texto', () => {
      const f = montar();

      expect(f.raiz.querySelectorAll('gi-select').length).toBeGreaterThan(0);
      f.elegir(0, 'Robo o faltante');
      f.escribir(0, 'Se detectó faltante en el almacén.');
      f.guardar().click();

      expect(f.host.guardados()[0].factReasonCode).toBe('ROBO-01');
      expect(f.host.guardados()[0].correctionReason).toBeNull();
    });

    it('sin motivos en el catálogo lo dice y ofrece llenarlo', () => {
      const f = montar((h) => h.reasons.set([]));

      expect(f.raiz.querySelector('.incf__falta')!.textContent).toContain('está vacío');
      f.raiz.querySelector<HTMLButtonElement>('.incf__link')!.click();
      expect(f.host.catalogos()).toBe(1);
      expect(f.problema()).toContain('No hay motivos en el catálogo');
    });

    it('pide describir qué ocurrió, no sólo el motivo', () => {
      const f = montar();

      f.elegir(0, 'Robo o faltante');

      expect(f.guardar().disabled).toBe(true);
      expect(f.problema()).toContain('Describe qué ocurrió');
    });
  });

  describe('los dos motivos no se confunden', () => {
    /**
     * El del hecho explica por qué ocurrió; el de la corrección, por qué se cambia el registro.
     * Fundirlos dejaría la bitácora diciendo «robo» donde debería decir qué se corrigió.
     */
    it('al corregir un día cerrado aparecen los dos, en bloques separados', () => {
      const { bloques } = montar((h) => {
        h.row.set(fila());
        h.dayClosed.set(true);
      });

      expect(bloques()).toEqual(['Qué pasó', 'Motivo de la corrección']);
    });

    it('cada bloque dice cuál es cuál', () => {
      const { raiz } = montar((h) => {
        h.row.set(fila());
        h.dayClosed.set(true);
      });

      expect(raiz.querySelector('.incf__ayuda')!.textContent).toContain('motivo del hecho');
      expect(raiz.querySelector('.incf__bloque--motivo')!.textContent).toContain(
        'no por qué ocurrió el hecho',
      );
    });

    it('viajan en campos distintos', () => {
      const f = montar((h) => {
        h.row.set(fila());
        h.dayClosed.set(true);
      });

      f.escribir(1, 'El reporte del cliente elevó la severidad del hecho.');
      f.guardar().click();

      const guardado = f.host.guardados()[0];
      expect(guardado.factReasonCode).toBe('ROBO-01');
      expect(guardado.correctionReason).toBe('El reporte del cliente elevó la severidad del hecho.');
    });

    /** El de la corrección es de esta edición, no del registro: arranca vacío siempre. */
    it('el motivo de la corrección arranca vacío aunque la incidencia ya exista', () => {
      const f = montar((h) => {
        h.row.set(fila());
        h.dayClosed.set(true);
      });

      expect(f.areas()[1].value).toBe('');
    });

    it('un día abierto no pide motivo de corrección', () => {
      const { bloques } = montar((h) => h.row.set(fila()));

      expect(bloques()).toEqual(['Qué pasó']);
    });
  });

  describe('cerrar la incidencia', () => {
    /** Cerrar sin decir cómo deja el expediente a medias. */
    it('resolverla pide decir cómo se resolvió', () => {
      const f = montar((h) => h.row.set(fila()));

      f.elegir(2, 'Resuelta');

      expect(f.raiz.textContent).toContain('Cómo se resolvió');
      expect(f.guardar().disabled).toBe(true);
      expect(f.problema()).toContain('cómo se resolvió');
    });

    it('cancelarla también lo pide: cerrar es cerrar', () => {
      const f = montar((h) => h.row.set(fila()));

      f.elegir(2, 'Cancelada');

      expect(f.guardar().disabled).toBe(true);
      expect(f.problema()).toContain('cómo se resolvió');
    });

    it('mientras sigue abierta no lo pide', () => {
      const f = montar((h) => h.row.set(fila()));

      expect(f.raiz.textContent).not.toContain('Cómo se resolvió');
      expect(f.guardar().disabled).toBe(false);
    });
  });

  it('al corregir arranca con lo que ya decía la incidencia', () => {
    const f = montar((h) => h.row.set(fila({ description: 'Texto original.' })));

    expect(f.areas()[0].value).toBe('Texto original.');
  });

  it('cancelar avisa y no guarda nada', () => {
    const f = montar((h) => h.row.set(fila()));

    f.raiz.querySelector<HTMLButtonElement>('.incf__cancelar')!.click();

    expect(f.host.cancelaciones()).toBe(1);
    expect(f.host.guardados()).toEqual([]);
  });
});
