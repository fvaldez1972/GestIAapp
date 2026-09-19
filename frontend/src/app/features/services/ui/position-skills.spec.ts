import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiCatalogOption } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';
import { PositionSkillRequest, PositionSkillToggle, PositionSkills } from './position-skills';

const CCTV = 'sk-cctv';
const MANEJO = 'sk-manejo';

const regla = (overrides: Partial<EligibilityRequirement> = {}): EligibilityRequirement => ({
  idEligibilityRequirement: 'r1',
  idOrganization: 'o1',
  targetType: 'Position',
  idClient: null,
  clientName: null,
  idService: null,
  serviceName: null,
  idPosition: 'p1',
  positionName: 'Caseta poniente',
  requirementType: 'Skill',
  idRequiredCatalogItem: CCTV,
  requiredCatalogItemName: 'Manejo de CCTV',
  requiredDocumentType: null,
  requiredEvaluationType: null,
  name: 'Experiencia de CCTV',
  description: null,
  isBlocking: true,
  active: true,
  ...overrides,
});

@Component({
  imports: [PositionSkills],
  template: `
    <app-position-skills
      [catalogSkills]="catalogo()"
      [requirements]="requirements()"
      [pending]="pending()"
      [canWrite]="canWrite()"
      [saving]="saving()"
      (add)="agregadas.push($event)"
      (remove)="quitadas.push($event)"
      (removePending)="quitadasPendientes.push($event)"
      (toggleBlocking)="alternadas.push($event)"
    />
  `,
})
class Anfitrion {
  readonly catalogo = signal<readonly GiCatalogOption[]>([
    { idCatalogItem: CCTV, name: 'Manejo de CCTV' },
    { idCatalogItem: MANEJO, name: 'Licencia de manejo' },
  ]);
  readonly requirements = signal<readonly EligibilityRequirement[]>([]);
  readonly pending = signal<readonly PositionSkillRequest[]>([]);
  readonly canWrite = signal(true);
  readonly saving = signal(false);
  readonly agregadas: PositionSkillRequest[] = [];
  readonly quitadas: string[] = [];
  readonly quitadasPendientes: string[] = [];
  readonly alternadas: PositionSkillToggle[] = [];
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const componente = fixture.debugElement.children[0].componentInstance as PositionSkills;

  return {
    fixture,
    raiz: fixture.nativeElement as HTMLElement,
    host: fixture.componentInstance,
    componente: componente as unknown as {
      agregar(): void;
      bloquea: { set(valor: boolean): void };
      elegida: { set(valor: string): void; (): string };
      available(): readonly GiCatalogOption[];
    },
    boton: (texto: string) =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.skill button'))
        .find((b) => b.textContent!.trim() === texto)!,
    filas: () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.skill'),
      ),
  };
}

describe('El perfil requerido de una posición', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  /** Sin experiencias exigidas no se finge un perfil: se dice que cualquiera puede cubrirla. */
  it('sin experiencias lo dice sin inventar un requisito', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('Ninguna experiencia exigida');
  });

  it('lista las experiencias ya exigidas por su nombre de catálogo', () => {
    const { filas } = montar((host) => host.requirements.set([regla()]));

    expect(filas()).toHaveLength(1);
    expect(filas()[0].textContent).toContain('Manejo de CCTV');
    expect(filas()[0].textContent).toContain('Impide asignar a quien no la tenga');
  });

  /** La distinción entre bloquear y dejar constancia se dice, porque el sistema la respeta. */
  it('una experiencia informativa dice que sólo deja constancia', () => {
    const { filas } = montar((host) => host.requirements.set([regla({ isBlocking: false })]));

    expect(filas()[0].textContent).toContain('Sólo deja constancia');
  });

  /** Agregar emite por identificador, con la marca de bloqueo elegida. */
  it('al agregar emite la experiencia por identificador', () => {
    const { componente, host } = montar();

    componente.elegida.set(CCTV);
    componente.agregar();

    expect(host.agregadas).toEqual([
      { idSkillCatalogItem: CCTV, name: 'Manejo de CCTV', isBlocking: true },
    ]);
  });

  /**
   * La casilla se lee al agregar, no al elegir la experiencia.
   *
   * <p>Antes la regla se creaba en el momento de elegir del catálogo, y la casilla está al lado:
   * quien la desmarcaba después lo hacía cuando la regla ya existía como bloqueante, y no cambiaba
   * nada. QA lo reportó como «quitas la opción y no se guarda». Esta prueba hace el gesto en el
   * orden natural —primero la experiencia, después la casilla— y exige que valga el segundo.</p>
   */
  it('respeta la casilla aunque se desmarque después de elegir la experiencia', () => {
    const { componente, host } = montar();

    componente.elegida.set(MANEJO);
    componente.bloquea.set(false);
    componente.agregar();

    expect(host.agregadas[0]).toEqual({
      idSkillCatalogItem: MANEJO,
      name: 'Licencia de manejo',
      isBlocking: false,
    });
  });

  /** Elegir del catálogo no crea nada por sí solo: hace falta el gesto de agregar. */
  it('elegir la experiencia no la agrega todavía', () => {
    const { componente, host } = montar();

    componente.elegida.set(CCTV);

    expect(host.agregadas).toEqual([]);
  });

  /** El selector se limpia para poder sumar varias sin borrar a mano la anterior. */
  it('el selector queda vacío después de agregar', () => {
    const { componente } = montar();

    componente.elegida.set(CCTV);
    componente.agregar();

    expect(componente.elegida()).toBe('');
  });

  /** Y una regla ya puesta puede cambiar de modo sin quitarla y volver a ponerla. */
  it('alterna una regla guardada entre bloqueante e informativa', () => {
    const { boton, host } = montar((h) => h.requirements.set([regla()]));

    boton('Sólo dejar constancia').click();

    expect(host.alternadas).toEqual([
      { key: 'r1', idSkillCatalogItem: CCTV, name: 'Manejo de CCTV', isBlocking: false, pending: false },
    ]);
  });

  it('alterna una pendiente sin tocar el servidor', () => {
    const { boton, host } = montar((h) =>
      h.pending.set([{ idSkillCatalogItem: CCTV, name: 'Manejo de CCTV', isBlocking: false }]),
    );

    boton('Que impida asignar').click();

    expect(host.alternadas[0]).toMatchObject({ idSkillCatalogItem: CCTV, isBlocking: true, pending: true });
  });

  /** Lo ya pedido no se vuelve a ofrecer: dos reglas de lo mismo dirían lo mismo dos veces. */
  it('no ofrece una experiencia que ya está pedida, ni guardada ni pendiente', () => {
    const guardada = montar((host) => host.requirements.set([regla()]));
    expect(guardada.componente.available().map((o) => o.idCatalogItem)).toEqual([MANEJO]);

    const pendiente = montar((host) =>
      host.pending.set([{ idSkillCatalogItem: MANEJO, name: 'Licencia de manejo', isBlocking: true }]),
    );
    expect(pendiente.componente.available().map((o) => o.idCatalogItem)).toEqual([CCTV]);
  });

  /**
   * Al dar de alta una posición todavía no hay identificador al que colgar la regla, así que lo
   * elegido se marca como pendiente y se dice que se guardará con la posición.
   */
  it('lo pendiente se distingue de lo guardado y se anuncia', () => {
    const { raiz, filas } = montar((host) =>
      host.pending.set([{ idSkillCatalogItem: CCTV, name: 'Manejo de CCTV', isBlocking: true }]),
    );

    expect(filas()[0].textContent).toContain('se guarda al guardar la posición');
    expect(raiz.textContent).toContain('1 se guardarán con la posición');
  });

  it('quitar una guardada emite el identificador de la regla', () => {
    const { boton, host } = montar((h) => h.requirements.set([regla()]));

    boton('Quitar').click();

    expect(host.quitadas).toEqual(['r1']);
    expect(host.quitadasPendientes).toEqual([]);
  });

  it('quitar una pendiente emite el identificador de catálogo', () => {
    const { boton, host } = montar((h) =>
      h.pending.set([{ idSkillCatalogItem: CCTV, name: 'Manejo de CCTV', isBlocking: true }]),
    );

    boton('Quitar').click();

    expect(host.quitadasPendientes).toEqual([CCTV]);
    expect(host.quitadas).toEqual([]);
  });

  /** Sin permiso de escritura no se dibuja ni el alta ni el quitar. */
  it('sin permiso de escritura sólo se lee', () => {
    const { raiz } = montar((host) => {
      host.canWrite.set(false);
      host.requirements.set([regla()]);
    });

    expect(raiz.querySelector('gi-catalog-picker')).toBeNull();
    expect(raiz.querySelectorAll('button')).toHaveLength(0);
  });
});
