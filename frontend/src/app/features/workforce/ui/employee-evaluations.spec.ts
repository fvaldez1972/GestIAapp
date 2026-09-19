import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';
import { EmployeeEvaluation } from '../data-access/workforce.models';
import { EmployeeEvaluationFormValue, EmployeeEvaluations } from './employee-evaluations';
import { evaluationFixture, requirementFixture } from './employee-fixtures';

const HOY = '2026-09-16';

const reglaDeEvaluacion = (overrides: Partial<EligibilityRequirement> = {}) =>
  requirementFixture({
    requirementType: 'Evaluation',
    idRequiredCatalogItem: 'cat-poligrafo',
    requiredCatalogItemName: 'Polígrafo',
    requiredDocumentType: null,
    requiredEvaluationType: 'Polygraph',
    name: 'Polígrafo vigente',
    ...overrides,
  });

@Component({
  imports: [EmployeeEvaluations],
  template: `
    <app-employee-evaluations
      [requirements]="requirements()"
      [evaluations]="evaluations()"
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
  readonly requirements = signal<readonly EligibilityRequirement[]>([reglaDeEvaluacion()]);
  readonly evaluations = signal<readonly EmployeeEvaluation[]>([]);
  readonly hoy = signal(HOY);
  readonly umbral = signal(30);
  readonly canWrite = signal(true);
  readonly saving = signal(false);
  readonly guardadas: EmployeeEvaluationFormValue[] = [];
  readonly retiradas: string[] = [];
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;
  const componente = fixture.debugElement.children[0].componentInstance as EmployeeEvaluations;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    componente: componente as unknown as {
      openCreate(): void;
      openEdit(item: EmployeeEvaluation): void;
      submit(): void;
      form: { patchValue(valor: Record<string, unknown>): void };
      problem(): string;
    },
    estados: () => Array.from(raiz.querySelectorAll('.req__state')).map((n) => n.textContent!.trim()),
    filas: () => Array.from(raiz.querySelectorAll<HTMLElement>('.req')),
    registros: () => Array.from(raiz.querySelectorAll<HTMLElement>('.row')),
  };
}

describe('La pestaña de evaluaciones', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * La razón por la que esta pestaña existe: hasta ahora el servidor exigía evaluaciones aprobadas
   * para asignar y ninguna pantalla permitía registrarlas.
   */
  it('un requisito sin evaluación aparece como hueco, no se omite', () => {
    const { filas, estados } = montar();

    expect(filas().length).toBe(1);
    expect(estados()).toEqual(['Sin registrar']);
    expect(filas()[0].textContent).toContain('No hay ninguna evaluación registrada de este tipo');
  });

  /** El resultado manda sobre la fecha: es la misma regla que aplica el servidor al asignar. */
  it('una evaluación no aprobada con vencimiento futuro no se dice Al día', () => {
    const { estados, filas } = montar((host) =>
      host.evaluations.set([evaluationFixture({ result: 'NotApproved', expiresDate: '2027-12-31' })]),
    );

    expect(estados()).toEqual(['No aprobada']);
    expect(filas()[0].textContent).toContain('no se aprobó');
  });

  it('una pendiente se dice Sin resolver, y una no concluyente lo explica', () => {
    expect(montar((h) => h.evaluations.set([evaluationFixture({ result: 'Pending' })])).estados())
      .toEqual(['Sin resolver']);

    const noConcluyente = montar((h) =>
      h.evaluations.set([evaluationFixture({ result: 'Inconclusive' })]),
    );
    expect(noConcluyente.estados()).toEqual(['Sin resolver']);
    expect(noConcluyente.filas()[0].textContent).toContain('no concluyente');
  });

  /** Aprobada con observaciones cuenta igual que aprobada: así lo decide el servidor. */
  it('aprobada y aprobada con observaciones quedan al día', () => {
    expect(montar((h) => h.evaluations.set([evaluationFixture()])).estados()).toEqual(['Al día']);
    expect(
      montar((h) =>
        h.evaluations.set([evaluationFixture({ result: 'ApprovedWithObservations' })]),
      ).estados(),
    ).toEqual(['Al día']);
  });

  /** La vigencia se mide contra el día operativo del servidor, no contra el reloj del navegador. */
  it('una aprobada que caduca dentro del umbral queda por vencer, y fuera queda al día', () => {
    expect(
      montar((h) => h.evaluations.set([evaluationFixture({ expiresDate: '2026-10-01' })])).estados(),
    ).toEqual(['Por vencer']);

    expect(
      montar((h) => h.evaluations.set([evaluationFixture({ expiresDate: '2026-12-31' })])).estados(),
    ).toEqual(['Al día']);

    expect(
      montar((h) => h.evaluations.set([evaluationFixture({ expiresDate: '2026-09-15' })])).estados(),
    ).toEqual(['Vencida']);
  });

  /** Sin requisitos no se inventa un expediente en orden: se dice que la organización no exige. */
  it('sin requisitos declarados lo dice y manda a Catálogos', () => {
    const { raiz } = montar((host) => host.requirements.set([]));

    expect(raiz.textContent).toContain('todavía no exige ninguna evaluación');
  });

  it('lista las evaluaciones registradas con su resultado y su vencimiento', () => {
    const { registros } = montar((host) =>
      host.evaluations.set([evaluationFixture({ expiresDate: '2027-08-10' })]),
    );

    expect(registros().length).toBe(1);
    expect(registros()[0].textContent).toContain('Polígrafo');
    expect(registros()[0].textContent).toContain('Aprobada');
    expect(registros()[0].textContent).toContain('folio POL-0099');
  });

  /** Sin permiso de escritura no se dibuja el alta: el servidor la rechazaría de todas formas. */
  it('sin permiso de escritura no ofrece registrar ni editar', () => {
    const { raiz } = montar((host) => {
      host.canWrite.set(false);
      host.evaluations.set([evaluationFixture()]);
    });

    const botones = Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent!.trim());
    expect(botones).toEqual([]);
  });

  it('el alta emite el tipo, el resultado y las fechas', () => {
    const { componente, host, fixture } = montar();

    componente.openCreate();
    fixture.detectChanges();
    componente.form.patchValue({
      evaluationType: 'Polygraph',
      result: 'Approved',
      evaluatedDate: '2026-09-10',
      expiresDate: '2027-09-10',
      certificateNumber: ' POL-1234 ',
      notes: '  ',
    });
    componente.submit();

    expect(host.guardadas).toEqual([
      {
        idEmployeeEvaluation: null,
        evaluationType: 'Polygraph',
        result: 'Approved',
        evaluatedDate: '2026-09-10',
        expiresDate: '2027-09-10',
        certificateNumber: 'POL-1234',
        notes: null,
      },
    ]);
  });

  /** Editar manda el identificador, para que la pantalla use PUT y no agregue una segunda fila. */
  it('editar emite el identificador de la evaluación', () => {
    const { componente, host, fixture } = montar((h) =>
      h.evaluations.set([evaluationFixture({ result: 'Pending' })]),
    );

    componente.openEdit(evaluationFixture({ result: 'Pending' }));
    fixture.detectChanges();
    componente.form.patchValue({ result: 'Approved' });
    componente.submit();

    expect(host.guardadas[0].idEmployeeEvaluation).toBe('v1');
    expect(host.guardadas[0].result).toBe('Approved');
  });

  /** El alta propone el día operativo del servidor, nunca `new Date()`. */
  it('el alta propone la fecha de evaluación con el día del servidor', () => {
    const { componente, host, fixture } = montar();

    componente.openCreate();
    fixture.detectChanges();
    componente.form.patchValue({ evaluationType: 'Polygraph', result: 'Approved' });
    componente.submit();

    expect(host.guardadas[0].evaluatedDate).toBe(HOY);
  });

  it('no guarda con un vencimiento anterior a la fecha de evaluación', () => {
    const { componente, host, fixture } = montar();

    componente.openCreate();
    fixture.detectChanges();
    componente.form.patchValue({
      evaluationType: 'Polygraph',
      result: 'Approved',
      evaluatedDate: '2026-09-10',
      expiresDate: '2026-09-01',
    });
    componente.submit();

    expect(host.guardadas).toEqual([]);
    expect(componente.problem()).toContain('no puede ser anterior');
  });

  it('no guarda sin tipo ni resultado', () => {
    const { componente, host, fixture } = montar();

    componente.openCreate();
    fixture.detectChanges();
    componente.form.patchValue({ evaluationType: '', result: '' });
    componente.submit();

    expect(host.guardadas).toEqual([]);
    expect(componente.problem()).toContain('obligatorios');
  });

  /** Se desactiva, nunca se borra: una evaluación registrada es historia del expediente. */
  it('retirar emite el identificador, no borra en la pantalla', () => {
    const { raiz, host } = montar((h) => h.evaluations.set([evaluationFixture()]));

    const quitar = Array.from(raiz.querySelectorAll('button')).find(
      (b) => b.textContent!.trim() === 'Quitar',
    )!;
    quitar.click();

    expect(host.retiradas).toEqual(['v1']);
  });
});
