import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EligibilityRequirement } from '../../catalogs/data-access/catalog.models';
import { EmployeeDocument } from '../data-access/workforce.models';
import { EmployeeDocuments } from './employee-documents';
import { documentFixture, requirementFixture } from './employee-fixtures';

const HOY = '2026-09-06';

@Component({
  imports: [EmployeeDocuments],
  template: `
    <app-employee-documents
      [requirements]="requirements()"
      [documents]="documents()"
      [today]="hoy()"
      [expiringWithinDays]="umbral()"
    />
  `,
})
class Anfitrion {
  readonly requirements = signal<readonly EligibilityRequirement[]>([
    requirementFixture(),
    requirementFixture({
      idEligibilityRequirement: 'r2',
      requiredDocumentType: 'ProofOfAddress',
      name: 'Comprobante de domicilio',
    }),
  ]);
  readonly documents = signal<readonly EmployeeDocument[]>([documentFixture()]);
  readonly hoy = signal(HOY);
  readonly umbral = signal(30);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    raiz,
    filas: () => Array.from(raiz.querySelectorAll<HTMLElement>('.req')),
    estados: () =>
      Array.from(raiz.querySelectorAll('.req__state')).map((n) => n.textContent!.trim()),
  };
}

describe('La pestaña de documentos', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }));

  afterEach(() => TestBed.resetTestingModule());

  /**
   * Se recorren los requisitos y no los documentos. Al revés, el requisito sin documento no tendría
   * renglón: desaparecería justo el caso que la pestaña existe para mostrar.
   */
  it('un requisito sin documento aparece como hueco, no se omite', () => {
    const { filas, estados } = montar();

    expect(filas().length).toBe(2);
    expect(estados()).toEqual(['Al día', 'Sin cargar']);
    expect(filas()[1].textContent).toContain('No hay documento cargado para este requisito');
  });

  /** El umbral se escribe en la pantalla; no se deja implícito en un color. */
  it('dice de quién son los requisitos y cuántos días cuentan como «por vencer»', () => {
    const { raiz } = montar();
    const nota = raiz.querySelector('.docs__note')!.textContent!.replace(/\s+/g, ' ');

    expect(nota).toContain('2 requisitos definidos por esta organización');
    expect(nota).toContain('30 días o menos');
  });

  /** La vigencia se mide contra el día operativo del servidor, no contra el reloj del navegador. */
  it('un documento que caduca dentro del umbral queda por vencer, y fuera queda al día', () => {
    const { estados } = montar((host) =>
      host.documents.set([
        documentFixture({ expiresDate: '2026-09-20' }),
        documentFixture({
          idEmployeeDocument: 'd2',
          documentType: 'ProofOfAddress',
          expiresDate: '2026-12-31',
        }),
      ]),
    );

    expect(estados()).toEqual(['Por vencer', 'Al día']);
  });

  it('un documento caducado queda vencido y dice cuándo venció', () => {
    const { estados, filas } = montar((host) =>
      host.documents.set([documentFixture({ expiresDate: '2026-08-31' })]),
    );

    expect(estados()[0]).toBe('Vencido');
    expect(filas()[0].textContent).toContain('Venció el 31 ago 2026');
  });

  /** Un documento dado de baja no cubre nada: aquí los registros no se borran, se desactivan. */
  it('un documento desactivado deja el requisito sin cubrir', () => {
    const { estados } = montar((host) =>
      host.documents.set([documentFixture({ active: false })]),
    );

    expect(estados()[0]).toBe('Sin cargar');
  });

  /**
   * Sin requisitos no se puede afirmar que un expediente esté en orden: se dice dónde se definen,
   * en lugar de mostrar una lista vacía que parecería un expediente completo.
   */
  it('sin requisitos manda a Catálogos en vez de decir que está al día', () => {
    const { raiz } = montar((host) => host.requirements.set([]));

    expect(raiz.querySelector('gi-empty-state')?.textContent).toContain(
      'todavía no exige ningún documento',
    );
    expect(raiz.querySelectorAll('.req').length).toBe(0);
  });

  /** Lo cargado que nadie exige no cuenta para la vigencia, y por eso va aparte. */
  it('separa los documentos que la organización no exige', () => {
    const { raiz } = montar((host) =>
      host.documents.set([
        documentFixture(),
        documentFixture({ idEmployeeDocument: 'd3', documentType: 'DriverLicense' }),
      ]),
    );

    const extra = raiz.querySelector('.docs__extra')!;

    expect(extra.textContent).toContain('Licencia de conducir');
    expect(extra.textContent).toContain('No cuentan para la vigencia');
  });

  /** Un requisito que no bloquea se pide igual; decirlo evita que se lea como opcional. */
  it('marca el requisito que no bloquea', () => {
    const { raiz } = montar((host) =>
      host.requirements.set([requirementFixture({ isBlocking: false })]),
    );

    expect(raiz.querySelector('.req__soft')?.textContent?.trim()).toBe('no bloquea');
  });
});
