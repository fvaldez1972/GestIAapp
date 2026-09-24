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
      [categories]="categorias()"
      (cargar)="pedidos.push($event)"
      (agregar)="agregados.set(agregados() + 1)"
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
  readonly categorias = signal<
    readonly { readonly idCatalogItem: string; readonly name: string; readonly isRequired?: boolean | null }[]
  >([]);
  readonly agregados = signal(0);
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
    componente: fixture.debugElement.children[0].componentInstance as unknown as {
      busqueda: { set(valor: string): void };
      estadoFiltro: { set(valor: string): void };
    },
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
  /**
   * La nota dice la consecuencia, y ya no habla de fechas.
   *
   * <p>El 23 de septiembre de 2026 se retiró de la ficha todo lo que mostraba vigencias: el umbral,
   * las fechas de vencimiento y las frases que las explicaban. Lo que queda es qué pasa si falta un
   * obligatorio, que es la razón por la que la lista existe.</p>
   */
  /**
   * <b>Buscar y filtrar, arriba y sobre la lista que se mira primero.</b>
   *
   * <p>La barra vivía entre las dos listas —debajo de los requisitos y encima de los archivos—, y
   * ahí no servía: no pertenecía del todo a ninguna. Ahora filtra la lista de requisitos, que es
   * lo que la pestaña enseña.</p>
   *
   * <p>Las tres afirmaciones se necesitan: que el buscador acote, que el estado acote, y que sin
   * nada puesto no se acote nada. Sin la tercera, «filtra» se cumpliría igual si la lista se
   * hubiera quedado vacía por cualquier otro motivo.</p>
   */
  it('el buscador y el estado acotan la lista de requisitos', () => {
    const { raiz, fixture, componente } = montar((host) =>
      host.categorias.set([
        { idCatalogItem: 'cat-antecedentes', name: 'Constancia de antecedentes', isRequired: true },
        { idCatalogItem: 'cat-domicilio', name: 'Comprobante de domicilio', isRequired: true },
        { idCatalogItem: 'cat-militar', name: 'Cartilla militar', isRequired: true },
      ]),
    );

    expect(raiz.querySelectorAll('.req').length).toBe(3);

    componente.busqueda.set('cartilla');
    fixture.detectChanges();
    expect(raiz.querySelectorAll('.req').length).toBe(1);

    // Los tres están sin cargar, así que el estado se comprueba con los dos extremos: el que los
    // tiene todos y uno que no tiene ninguno. Con un solo valor no se distinguiría filtrar de no
    // filtrar.
    componente.busqueda.set('');
    componente.estadoFiltro.set('Missing');
    fixture.detectChanges();
    expect(raiz.querySelectorAll('.req').length).toBe(3);

    componente.estadoFiltro.set('UpToDate');
    fixture.detectChanges();
    expect(raiz.querySelectorAll('.req').length).toBe(0);

    componente.estadoFiltro.set('');
    fixture.detectChanges();
    expect(raiz.querySelectorAll('.req').length).toBe(3);
  });

  /**
   * <b>La lista sale del catálogo, no de las reglas de elegibilidad.</b>
   *
   * <p>Se recorrían las reglas, así que un catálogo de cinco tipos enseñaba dos filas y los otros
   * tres no aparecían en ninguna pestaña: sus archivos sólo asomaban en el expediente de abajo,
   * todos juntos. La marca de obligatorio o informativo ya venía del catálogo; lo que faltaba era
   * listar el catálogo entero.</p>
   *
   * <p>Las dos mitades se necesitan: sin la segunda, «salen cinco» se cumpliría igual si todos
   * cayeran en la misma pestaña, que es lo contrario de lo que se quiere.</p>
   */
  it('lista los tipos del catálogo, repartidos por la marca del catálogo', () => {
    const { raiz, fixture } = montar((host) =>
      host.categorias.set([
        { idCatalogItem: 'cat-antecedentes', name: 'Constancia de antecedentes', isRequired: true },
        { idCatalogItem: 'cat-domicilio', name: 'Comprobante de domicilio', isRequired: true },
        { idCatalogItem: 'cat-ine', name: 'INE', isRequired: false },
        { idCatalogItem: 'cat-rfc', name: 'RFC', isRequired: false },
        { idCatalogItem: 'cat-nss', name: 'NSS', isRequired: false },
      ]),
    );

    const pestanas = Array.from(raiz.querySelectorAll<HTMLButtonElement>('.subtab'));
    expect(pestanas.map((p) => p.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Obligatorios 2',
      'Informativos 3',
    ]);

    // Los dos con regla salen en obligatorios; los tres que el catálogo no exige, en informativos.
    expect(raiz.querySelectorAll('.req').length).toBe(2);

    pestanas[1].click();
    fixture.detectChanges();

    expect(Array.from(raiz.querySelectorAll('.req__name')).map((n) => n.textContent!.trim().split(' ')[0])).toEqual([
      'INE',
      'RFC',
      'NSS',
    ]);
  });

  /**
   * <b>La marca del catálogo clasifica; la regla de elegibilidad es la que bloquea.</b>
   *
   * <p>Un tipo marcado obligatorio al que nadie le creó su regla se pide igual, pero hoy no impide
   * asignar a nadie. La fila lo dice en vez de prometer un bloqueo que no existe. La segunda
   * afirmación es el control: el que sí tiene regla no lleva la marca.</p>
   */
  it('un obligatorio del catálogo sin regla de elegibilidad se señala', () => {
    const { raiz } = montar((host) =>
      host.categorias.set([
        // Éste tiene regla: la fila por omisión del anfitrión lo exige.
        { idCatalogItem: 'cat-domicilio', name: 'Comprobante de domicilio', isRequired: true },
        // Y éste no: está en el catálogo marcado obligatorio y nadie le creó la regla.
        { idCatalogItem: 'cat-militar', name: 'Cartilla militar', isRequired: true },
      ]),
    );

    const filas = Array.from(raiz.querySelectorAll('.req'));
    const conMarca = filas.filter((f) => f.textContent!.includes('sin regla'));

    expect(conMarca).toHaveLength(1);
    expect(conMarca[0].textContent).toContain('Cartilla militar');
  });

  /**
   * <b>Sin banda de aviso.</b>
   *
   * <p>La llevó unas horas el 24 de septiembre de 2026 y salió por petición: ocupaba cuatro
   * renglones encima de la lista para repetir lo que las propias pestañas ya separan. La segunda
   * afirmación es la que hace valer la primera: sin ella, «no hay banda» se cumpliría igual si la
   * pestaña entera hubiera dejado de dibujarse.</p>
   */
  it('la pestaña no pone una banda de aviso encima de la lista', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.banda')).toBeNull();
    expect(raiz.querySelector('.seccion__titulo')!.textContent!.trim()).toBe('Documentos obligatorios');
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
  /**
   * Un documento caducado queda vencido, y el rótulo lo dice **sin la fecha**.
   *
   * <p>La ficha dejó de mostrar vigencias el 23 de septiembre de 2026. El estado se conserva
   * —es lo que decide si la persona puede trabajar— pero ni la fecha ni la frase que la explicaba
   * aparecen ya.</p>
   */
  it('un documento caducado queda vencido, sin enseñar la fecha', () => {
    const { estados, filas } = montar((host) =>
      host.documents.set([documentFixture({ expiresDate: '2026-08-31' })]),
    );

    expect(estados()[0]).toBe('Vencido');
    expect(filas()[0].textContent).not.toContain('31 ago 2026');
    expect(filas()[0].textContent).not.toContain('Vigencia');
    expect(filas()[0].textContent).not.toContain('venció');
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

  /**
   * <b>Sin «Otros documentos».</b>
   *
   * <p>Era un plegado al final con los archivos que la organización no exige. Salió el 24 de
   * septiembre de 2026, y el usuario dio la razón: «o son obligatorios o son informativos». Un
   * tercer montón sin regla detrás sólo añadía un sitio más donde mirar; los archivos siguen
   * enteros en el expediente de abajo, que es donde se consultan y se descargan.</p>
   */
  it('no arma un tercer montón con los documentos que nadie exige', () => {
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

    expect(raiz.querySelector('.otros')).toBeNull();
    expect(raiz.textContent).not.toContain('Otros documentos');
    // El control: la pestaña sí dibuja su lista de requisitos, así que la ausencia de arriba no
    // es que el componente se haya quedado en blanco.
    expect(raiz.querySelectorAll('.req').length).toBeGreaterThan(0);
  });

  /**
   * Los obligatorios arriba y los informativos abajo, cada uno con su rótulo.
   *
   * <p>Iban en una sola lista y se distinguían por una etiqueta pequeña que decía «no bloquea»: con
   * doce requisitos había que leer fila por fila para saber cuáles impiden asignar a la persona.
   * Ahora el orden lo dice sin leer, y cada bloque explica qué pasa si falta.</p>
   */
  /**
   * Obligatorios e informativos son **dos pestañas**, no dos bloques apilados.
   *
   * <p>Lo eran hasta el 23 de septiembre de 2026, y con sus dos títulos y sus dos párrafos había
   * que desplazar para llegar al segundo. No son la misma cosa —uno impide asignar y el otro sólo
   * deja constancia—, y separarlos en pestañas dice esa diferencia con la estructura.</p>
   */
  it('separa los obligatorios de los informativos en dos pestañas', () => {
    const { raiz, fixture } = montar((host) =>
      host.requirements.set([
        requirementFixture({ requiredDocumentType: 'VoterId', isRequiredEffective: true }),
        requirementFixture({ requiredDocumentType: 'Curp', isRequiredEffective: false }),
      ]),
    );

    const pestanas = Array.from(raiz.querySelectorAll<HTMLButtonElement>('.subtab'));
    expect(pestanas.map((p) => p.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Obligatorios 1',
      'Informativos 1',
    ]);

    // Arranca en obligatorios, que son los que impiden asignar.
    expect(pestanas[0].classList).toContain('is-active');
    expect(raiz.querySelector('.seccion__titulo')!.textContent!.trim()).toBe('Documentos obligatorios');

    pestanas[1].click();
    fixture.detectChanges();

    expect(raiz.querySelector('.seccion__titulo')!.textContent!.trim()).toBe('Documentos informativos');
  });

  /**
   * <b>La insignia «N por atender» salió de la pestaña el 24 de septiembre de 2026, por petición.</b>
   *
   * <p>Las dos afirmaciones se necesitan: sin la segunda, «no dice por atender» se cumpliría igual
   * si la pestaña hubiera perdido también su cuenta, que es lo que dice cuántos requisitos hay.</p>
   */
  it('la pestaña cuenta sus requisitos y ya no avisa de cuántos faltan', () => {
    const { raiz } = montar((host) =>
      host.requirements.set([
        requirementFixture({ requiredDocumentType: 'VoterId', isRequiredEffective: true }),
        requirementFixture({ requiredDocumentType: 'Curp', isRequiredEffective: true }),
      ]),
    );

    expect(raiz.textContent).not.toContain('por atender');
    expect(raiz.querySelector('.subtab__count')!.textContent!.trim()).toBe('2');
  });

  /**
   * El encabezado de la lista lleva la salida al lado, en las dos pestañas.
   *
   * <p>El botón vivía suelto más abajo, dentro del expediente de archivos, lejos de la lista a la
   * que se le suma algo. La segunda mitad es la que importa: sin permiso de escritura no se ofrece
   * una salida que el servidor rechazaría.</p>
   */
  it('cada pestaña encabeza su lista y ofrece agregar, sólo a quien puede escribir', () => {
    const { raiz, fixture, host } = montar((h) =>
      h.requirements.set([
        requirementFixture({ requiredDocumentType: 'VoterId', isRequiredEffective: true }),
        requirementFixture({ requiredDocumentType: 'Curp', isRequiredEffective: false }),
      ]),
    );

    expect(raiz.querySelector('.seccion__titulo')!.textContent!.trim()).toBe('Documentos obligatorios');

    raiz.querySelector<HTMLButtonElement>('.seccion__accion')!.click();
    expect(host.agregados()).toBe(1);

    Array.from(raiz.querySelectorAll<HTMLButtonElement>('.subtab'))[1].click();
    fixture.detectChanges();

    expect(raiz.querySelector('.seccion__titulo')!.textContent!.trim()).toBe('Documentos informativos');
    expect(raiz.querySelector('.seccion__accion')).not.toBeNull();

    host.canWrite.set(false);
    fixture.detectChanges();

    expect(raiz.querySelector('.seccion__accion')).toBeNull();
  });

  /** El control: con sólo obligatorios no se dibuja el rótulo del otro bloque. */
  /**
   * Sin informativos la pestaña sigue, y dice que está vacía.
   *
   * <p>Esconderla haría que la pantalla cambiara de forma entre dos personas de la misma
   * organización, y quien no la viera no sabría si es que no hay o es que no existe.</p>
   */
  it('con cero informativos la pestaña sigue, en cero y diciendo por qué', () => {
    const { raiz, fixture } = montar((host) =>
      host.requirements.set([requirementFixture({ isRequiredEffective: true })]),
    );

    const pestanas = Array.from(raiz.querySelectorAll<HTMLButtonElement>('.subtab'));
    expect(pestanas[1].textContent!.replace(/\s+/g, ' ').trim()).toBe('Informativos 0');

    pestanas[1].click();
    fixture.detectChanges();

    expect(raiz.querySelector('.docs__vacio')!.textContent).toContain('no define ningún documento informativo');
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
