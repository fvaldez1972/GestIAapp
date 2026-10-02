import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EligibilityRequirement, EmployeeSkill } from '../../catalogs/data-access/catalog.models';
import { GiCatalogOption } from '../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { EmployeeSkillFormValue, EmployeeSkills } from './employee-skills';
import { requirementFixture } from './employee-fixtures';

const HOY = '2026-09-16';
const CCTV = 'sk-cctv';

const reglaDeExperiencia = (overrides: Partial<EligibilityRequirement> = {}) =>
  requirementFixture({
    requirementType: 'Skill',
    requiredDocumentType: null,
    idRequiredCatalogItem: CCTV,
    requiredCatalogItemName: 'Manejo de CCTV',
    name: 'Experiencia de CCTV',
    ...overrides,
  });

const experiencia = (overrides: Partial<EmployeeSkill> = {}): EmployeeSkill => ({
  idEmployeeSkill: 'eh1',
  idEmployee: 'e1',
  idSkillCatalogItem: CCTV,
  skillName: 'Manejo de CCTV',
  acquiredDate: '2026-01-15',
  expiresDate: null,
  notes: null,
  active: true,
  ...overrides,
});

@Component({
  imports: [EmployeeSkills],
  template: `
    <app-employee-skills
      [requirements]="requirements()"
      [skills]="skills()"
      [catalogSkills]="catalogSkills()"
      [today]="hoy()"
      [expiringWithinDays]="umbral()"
      [canWrite]="canWrite()"
      [saving]="saving()"
      (save)="guardadas.push($event)"
      (deactivate)="retiradas.push($event)"
    />
  `,
})
class Anfitrion {
  readonly requirements = signal<readonly EligibilityRequirement[]>([reglaDeExperiencia()]);
  readonly skills = signal<readonly EmployeeSkill[]>([]);
  readonly catalogSkills = signal<readonly GiCatalogOption[]>([
    { idCatalogItem: CCTV, name: 'Manejo de CCTV' },
  ]);
  readonly hoy = signal(HOY);
  readonly umbral = signal(30);
  readonly canWrite = signal(true);
  readonly saving = signal(false);
  readonly guardadas: EmployeeSkillFormValue[] = [];
  readonly retiradas: string[] = [];
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;
  const componente = fixture.debugElement.children[0].componentInstance as EmployeeSkills;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    componente: componente as unknown as {
      openCreate(): void;
      openEdit(item: EmployeeSkill): void;
      submit(): void;
      form: { patchValue(valor: Record<string, unknown>): void };
      problem(): string;
    },
    estados: () => Array.from(raiz.querySelectorAll('.req__state')).map((n) => n.textContent!.trim()),
    filas: () => Array.from(raiz.querySelectorAll<HTMLElement>('.req')),
    registros: () => Array.from(raiz.querySelectorAll<HTMLElement>('.row')),

    /**
     * Despliega «Experiencia acreditada».
     *
     * <p>Lo acreditado vive detrás de un acordeón desde el 23 de septiembre de 2026, y el cuerpo
     * se quita del árbol al estar cerrado —no se esconde con CSS— para que no siga en el orden de
     * tabulación. Así que una prueba que mire la lista tiene que abrirla primero, igual que un
     * usuario.</p>
     */
    abrirAcreditadas: () => {
      raiz.querySelector<HTMLButtonElement>('gi-accordion .acc__toggle')!.click();
      fixture.detectChanges();
    },
  };
}

describe('La pestaña de experiencias', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Anfitrion] }));
  afterEach(() => TestBed.resetTestingModule());

  /**
   * La trampa que esta pestaña cierra: una regla de experiencia obligatoria que nadie podía cumplir,
   * porque ninguna pantalla otorgaba experiencias.
   */
  it('una experiencia exigida y no acreditada aparece como hueco', () => {
    const { filas, estados } = montar();

    expect(filas().length).toBe(1);
    expect(estados()).toEqual(['Sin acreditar']);
    expect(filas()[0].textContent).toContain('no tiene acreditada la experiencia');
  });

  /** Por identificador y no por nombre, como la compara el servidor. */
  it('una experiencia con otro identificador no cubre el requisito', () => {
    const { estados } = montar((host) =>
      host.skills.set([experiencia({ idSkillCatalogItem: 'sk-otra', skillName: 'Manejo de CCTV' })]),
    );

    expect(estados()).toEqual(['Sin acreditar']);
  });

  it('acreditada sin vencimiento queda acreditada', () => {
    const { estados, filas } = montar((host) => host.skills.set([experiencia()]));

    expect(estados()).toEqual(['Acreditada']);
    expect(filas()[0].textContent).toContain('sin fecha de vencimiento');
  });

  /** El vencimiento se respeta porque la elegibilidad del servidor ya lo respeta. */
  it('distingue por vencer de vencida, contra el día operativo del servidor', () => {
    expect(montar((h) => h.skills.set([experiencia({ expiresDate: '2026-10-01' })])).estados())
      .toEqual(['Por vencer']);
    expect(montar((h) => h.skills.set([experiencia({ expiresDate: '2026-12-31' })])).estados())
      .toEqual(['Acreditada']);
    expect(montar((h) => h.skills.set([experiencia({ expiresDate: '2026-09-15' })])).estados())
      .toEqual(['Vencida']);
  });

  /** Sin reglas, las experiencias sirven para buscar gente, no para bloquear. Se dice así. */
  it('sin experiencias exigidas lo dice sin fingir que el expediente está incompleto', () => {
    const { raiz } = montar((host) => host.requirements.set([]));

    expect(raiz.textContent).toContain('no exige ninguna experiencia');
    expect(raiz.textContent).toContain('sirven para encontrar a quién puede cubrir un turno');
  });

  it('lista lo acreditado con su fecha', () => {
    const { registros, abrirAcreditadas } = montar((host) =>
      host.skills.set([experiencia({ expiresDate: '2027-01-15' })]),
    );

    // Plegado no hay lista: ése es el punto del acordeón, y lo comprueba el control de abajo.
    expect(registros().length).toBe(0);

    abrirAcreditadas();

    expect(registros().length).toBe(1);
    expect(registros()[0].textContent).toContain('Manejo de CCTV');
    expect(registros()[0].textContent).toContain('acreditada el');
  });

  it('sin permiso de escritura no ofrece acreditar ni editar', () => {
    const { raiz, abrirAcreditadas } = montar((host) => {
      host.canWrite.set(false);
      host.skills.set([experiencia()]);
    });

    abrirAcreditadas();

    // El único botón que queda es el del propio acordeón, que sólo abre y cierra: no escribe nada.
    const botones = Array.from(raiz.querySelectorAll('button'))
      .filter((boton) => !boton.classList.contains('acc__toggle'))
      .map((boton) => boton.textContent!.trim());

    expect(botones).toEqual([]);
  });

  it('el alta emite la experiencia por identificador y las fechas', () => {
    const { componente, host, fixture } = montar();

    componente.openCreate();
    fixture.detectChanges();
    componente.form.patchValue({
      idSkillCatalogItem: CCTV,
      acquiredDate: '2026-09-01',
      expiresDate: '2027-09-01',
      notes: '  con constancia  ',
    });
    componente.submit();

    expect(host.guardadas).toEqual([
      {
        idEmployeeSkill: null,
        idSkillCatalogItem: CCTV,
        acquiredDate: '2026-09-01',
        expiresDate: '2027-09-01',
        notes: 'con constancia',
      },
    ]);
  });

  it('no guarda sin elegir la experiencia del catálogo', () => {
    const { componente, host, fixture } = montar();

    componente.openCreate();
    fixture.detectChanges();
    componente.submit();

    expect(host.guardadas).toEqual([]);
    expect(componente.problem()).toContain('Elige la experiencia');
  });

  it('no guarda con un vencimiento anterior a la acreditación', () => {
    const { componente, host, fixture } = montar();

    componente.openCreate();
    fixture.detectChanges();
    componente.form.patchValue({
      idSkillCatalogItem: CCTV,
      acquiredDate: '2026-09-10',
      expiresDate: '2026-09-01',
    });
    componente.submit();

    expect(host.guardadas).toEqual([]);
    expect(componente.problem()).toContain('no puede ser anterior');
  });

  /**
   * <b>Un desplegable, no un campo donde escribir.</b>
   *
   * <p>El buscador pedía teclear el nombre de algo que ya existe y está en una lista corta, y de
   * paso ofrecía darla de alta en el catálogo desde aquí. Las tres afirmaciones se necesitan: la
   * primera dice que hay una lista cerrada, la segunda que la lista es el catálogo de verdad —sin
   * ella, un desplegable vacío pasaría igual—, y la tercera que el alta al vuelo se fue con el
   * buscador, que es lo que hace que no se pueda escribir un nombre que no existe.</p>
   */
  it('la experiencia se elige de una lista cerrada, y ya no se da de alta desde aquí', () => {
    const { componente, fixture, raiz } = montar();

    componente.openCreate();
    fixture.detectChanges();

    raiz.querySelector<HTMLButtonElement>('gi-select button[role="combobox"]')!.click();
    fixture.detectChanges();

    const opciones = Array.from(raiz.querySelectorAll('gi-select .gi-select__option-label')).map((o) =>
      o.textContent!.trim(),
    );

    expect(opciones).toEqual(['Manejo de CCTV']);
    expect(raiz.querySelector('gi-catalog-picker')).toBeNull();
    expect(raiz.textContent).not.toContain('se agrega al catálogo');
  });

  /** Al editar no se cambia cuál es la experiencia: eso convertiría su historial en el de otra. */
  it('editar conserva la experiencia y manda su identificador', () => {
    const { componente, host, fixture, raiz } = montar((h) => h.skills.set([experiencia()]));

    componente.openEdit(experiencia());
    fixture.detectChanges();

    expect(raiz.querySelector('.field__fixed')!.textContent).toContain('Manejo de CCTV');
    expect(raiz.querySelector('gi-select')).toBeNull();

    componente.form.patchValue({ expiresDate: '2028-01-01' });
    componente.submit();

    expect(host.guardadas[0].idEmployeeSkill).toBe('eh1');
    expect(host.guardadas[0].expiresDate).toBe('2028-01-01');
  });

  it('retirar emite el identificador, no borra en la pantalla', () => {
    const { raiz, host, abrirAcreditadas } = montar((h) => h.skills.set([experiencia()]));

    abrirAcreditadas();

    Array.from(raiz.querySelectorAll('button'))
      .find((b) => b.textContent!.trim() === 'Quitar')!
      .click();

    expect(host.retiradas).toEqual(['eh1']);
  });
});
