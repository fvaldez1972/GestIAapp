import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiCatalogOption } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';
import { PositionSkillRequest, PositionSkills } from './position-skills';

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
  name: 'Habilidad de CCTV',
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
      elegir(id: string): void;
      bloquea: { set(valor: boolean): void };
      available(): readonly GiCatalogOption[];
      elegida(): string;
    },
    filas: () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.skill'),
      ),
  };
}

describe('El perfil requerido de una posición', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  /** Sin habilidades exigidas no se finge un perfil: se dice que cualquiera puede cubrirla. */
  it('sin habilidades lo dice sin inventar un requisito', () => {
    const { raiz } = montar();

    expect(raiz.textContent).toContain('Ninguna habilidad exigida');
  });

  it('lista las habilidades ya exigidas por su nombre de catálogo', () => {
    const { filas } = montar((host) => host.requirements.set([regla()]));

    expect(filas()).toHaveLength(1);
    expect(filas()[0].textContent).toContain('Manejo de CCTV');
    expect(filas()[0].textContent).toContain('Impide asignar a quien no la tenga');
  });

  /** La distinción entre bloquear y dejar constancia se dice, porque el sistema la respeta. */
  it('una habilidad informativa dice que sólo deja constancia', () => {
    const { filas } = montar((host) => host.requirements.set([regla({ isBlocking: false })]));

    expect(filas()[0].textContent).toContain('Sólo deja constancia');
  });

  /** Elegir del catálogo emite por identificador, con la marca de bloqueo elegida. */
  it('al elegir emite la habilidad por identificador', () => {
    const { componente, host } = montar();

    componente.elegir(CCTV);

    expect(host.agregadas).toEqual([
      { idSkillCatalogItem: CCTV, name: 'Manejo de CCTV', isBlocking: true },
    ]);
  });

  it('respeta la casilla de bloqueo al emitir', () => {
    const { componente, host } = montar();

    componente.bloquea.set(false);
    componente.elegir(MANEJO);

    expect(host.agregadas[0]).toEqual({
      idSkillCatalogItem: MANEJO,
      name: 'Licencia de manejo',
      isBlocking: false,
    });
  });

  /** El selector se limpia para poder sumar varias sin borrar a mano la anterior. */
  it('el selector queda vacío después de agregar', () => {
    const { componente } = montar();

    componente.elegir(CCTV);

    expect(componente.elegida()).toBe('');
  });

  /** Lo ya pedido no se vuelve a ofrecer: dos reglas de lo mismo dirían lo mismo dos veces. */
  it('no ofrece una habilidad que ya está pedida, ni guardada ni pendiente', () => {
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
    const { raiz, host } = montar((h) => h.requirements.set([regla()]));

    raiz.querySelector<HTMLButtonElement>('.skill button')!.click();

    expect(host.quitadas).toEqual(['r1']);
    expect(host.quitadasPendientes).toEqual([]);
  });

  it('quitar una pendiente emite el identificador de catálogo', () => {
    const { raiz, host } = montar((h) =>
      h.pending.set([{ idSkillCatalogItem: CCTV, name: 'Manejo de CCTV', isBlocking: true }]),
    );

    raiz.querySelector<HTMLButtonElement>('.skill button')!.click();

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
