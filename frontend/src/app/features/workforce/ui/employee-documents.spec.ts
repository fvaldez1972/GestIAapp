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
      [canWrite]="canWrite()"
      (cargar)="pedidos.push($event)"
    />
  `,
})
class Anfitrion {
  readonly requirements = signal<readonly EligibilityRequirement[]>([
    requirementFixture(),
    requirementFixture({
      idEligibilityRequirement: 'r2',
      idRequiredCatalogItem: 'cat-domicilio',
      requiredCatalogItemName: 'Comprobante de domicilio',
      requiredDocumentType: 'ProofOfAddress',
      name: 'Comprobante de domicilio',
    }),
  ]);
  readonly documents = signal<readonly EmployeeDocument[]>([documentFixture()]);
  readonly hoy = signal(HOY);
  readonly umbral = signal(30);
  readonly canWrite = signal(true);
  readonly pedidos: string[] = [];
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    filas: () => Array.from(raiz.querySelectorAll<HTMLElement>('.req')),
    acciones: () =>
      Array.from(raiz.querySelectorAll<HTMLButtonElement>('.req__accion')).map((b) =>
        b.textContent!.trim(),
      ),
    pulsar: (texto: string) =>
      Array.from(raiz.querySelectorAll<HTMLButtonElement>('.req__accion'))
        .find((b) => b.textContent!.trim() === texto)!
        .click(),
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
    // La línea se acortó el 23 de septiembre de 2026 por densidad: lo que no puede perderse es el
    // umbral, porque sin él «Por vencer» es una etiqueta que nadie sabe medir.
  });

  /** La vigencia se mide contra el día operativo del servidor, no contra el reloj del navegador. */
  it('un documento que caduca dentro del umbral queda por vencer, y fuera queda al día', () => {
    const { estados } = montar((host) =>
      host.documents.set([
        documentFixture({ expiresDate: '2026-09-20' }),
        documentFixture({
          idEmployeeDocument: 'd2',
          idDocumentCategoryCatalogItem: 'cat-domicilio',
          documentCategoryName: 'Comprobante de domicilio',
          documentType: 'ProofOfAddress',
          expiresDate: '2026-12-31',
        }),
      ]),
    );

    expect(estados()).toEqual(['Por vencer', 'Al día']);
  });

  /**
   * La fecha sigue estando, en su columna.
   *
   * <p>Iba dentro de la frase —«Venció el 31 ago 2026.»— y desde el 23 de septiembre de 2026 va en
   * una columna propia: repetir la fecha en la oración hacía la fila larga y obligaba a leer un
   * texto para encontrar un dato que es una fecha. Lo que no puede pasar es que se pierda.</p>
   */
  it('un documento caducado queda vencido y dice cuándo venció', () => {
    const { estados, filas } = montar((host) =>
      host.documents.set([documentFixture({ expiresDate: '2026-08-31' })]),
    );

    expect(estados()[0]).toBe('Vencido');
    expect(filas()[0].textContent).toContain('Vigencia: 31 ago 2026');
    expect(filas()[0].textContent).toContain('El documento venció');
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
        documentFixture({
          idEmployeeDocument: 'd3',
          idDocumentCategoryCatalogItem: 'cat-licencia',
          documentCategoryName: 'Licencia de conducir',
          documentType: 'DriverLicense',
        }),
      ]),
    );

    // Van plegados desde el 23 de septiembre de 2026: son archivos que la organización no exige,
    // así que no compiten por la atención con los que sí. Lo que se defiende no cambió: que estén
    // aparte y que se diga que no cuentan para la vigencia.
    const extra = raiz.querySelector('.otros')!;

    expect(extra.textContent).toContain('Licencia de conducir');
    expect(extra.textContent).toContain('No cuentan para la vigencia');
    expect(extra.querySelector('summary')?.textContent).toContain('Otros documentos');
  });

  /**
   * Los obligatorios arriba y los informativos abajo, cada uno con su rótulo.
   *
   * <p>Iban en una sola lista y se distinguían por una etiqueta pequeña que decía «no bloquea»: con
   * doce requisitos había que leer fila por fila para saber cuáles impiden asignar a la persona.
   * Ahora el orden lo dice sin leer, y cada bloque explica qué pasa si falta.</p>
   */
  it('separa los obligatorios de los informativos, y dice qué pasa con cada uno', () => {
    const { raiz } = montar((host) =>
      host.requirements.set([
        requirementFixture({ requiredDocumentType: 'VoterId', isRequiredEffective: true }),
        requirementFixture({ requiredDocumentType: 'Curp', isRequiredEffective: false }),
      ]),
    );

    const rotulos = Array.from(raiz.querySelectorAll('.bloque__titulo')).map((e) => e.textContent?.trim());
    expect(rotulos).toContain('Documentos obligatorios');
    expect(rotulos).toContain('Documentos informativos');

    // Y el orden: lo que impide trabajar va primero.
    expect(rotulos.indexOf('Documentos obligatorios')).toBeLessThan(rotulos.indexOf('Documentos informativos'));

    expect(raiz.textContent).toContain('no se puede asignar a esta persona');
    expect(raiz.textContent).toContain('No son obligatorios para asignar');
  });

  /** El control: con sólo obligatorios no se dibuja el rótulo del otro bloque. */
  it('no dibuja el bloque informativo cuando no hay ninguno', () => {
    const { raiz } = montar((host) =>
      host.requirements.set([requirementFixture({ isRequiredEffective: true })]),
    );

    const rotulos = Array.from(raiz.querySelectorAll('.bloque__titulo')).map((e) => e.textContent?.trim());
    expect(rotulos).toContain('Documentos obligatorios');
    expect(rotulos).not.toContain('Documentos informativos');
  });

  // ── La salida de cada requisito ──────────────────────────────────────────────────────────

  /**
   * El hueco que cerró esto: la pantalla decía «Sin cargar» y no dejaba hacer nada con esa
   * información. Había que bajar al bloque del expediente y volver a buscar el tipo a mano.
   */
  it('un requisito sin cubrir ofrece cargarlo, y emite su tipo', () => {
    const { acciones, pulsar, host } = montar();

    expect(acciones()).toEqual(['Cargar']);

    pulsar('Cargar');
    // Lo que emite es el identificador de la categoría del catálogo, que es lo que el alta
    // necesita desde la conversión del 19 de septiembre de 2026.
    expect(host.pedidos).toEqual(['cat-domicilio']);
  });

  /** Lo que ya está cubierto no ofrece nada: no hay nada que hacer con él. */
  it('un requisito al día no ofrece accion', () => {
    const { filas, acciones } = montar();

    expect(filas().length).toBe(2);
    expect(acciones()).toHaveLength(1);
  });

  /** Con un documento que existe pero no cuenta, la acción es reemplazar, no cargar. */
  it('un rechazado ofrece reemplazar en lugar de cargar', () => {
    const { acciones } = montar((host) =>
      host.documents.set([documentFixture({ status: 'Rejected', expiresDate: '2028-01-01' })]),
    );

    expect(acciones()).toContain('Reemplazar');
  });

  /** Sin permiso de escritura no se ofrece: el servidor lo rechazaría igual. */
  it('sin permiso de escritura no aparece ninguna accion', () => {
    const { acciones } = montar((host) => host.canWrite.set(false));

    expect(acciones()).toEqual([]);
  });
});
