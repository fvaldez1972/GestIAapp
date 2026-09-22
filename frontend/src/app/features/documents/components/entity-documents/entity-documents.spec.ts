import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef, Input, ViewChild, signal, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppIcon } from '../../../../shared/ui/app-icon/app-icon';
import { GiCatalogPicker } from '../../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { GiFileInput } from '../../../../shared/ui/gi-file-input/gi-file-input';
import { GiSelect } from '../../../../shared/ui/gi-select/gi-select';
import { BusinessDocument } from '../../data-access/document.models';
import { EntityDocuments } from './entity-documents';

describe('EntityDocuments', () => {
  let fixture: ComponentFixture<EntityDocuments>;
  let component: EntityDocuments;
  let http: HttpTestingController;
  let fixtureCreated = false;
  let httpInitialized = false;
  const permissions = signal(['DOCUMENTS.READ', 'DOCUMENTS.WRITE']);
  const dialogMethods = ['showModal', 'close'] as const;
  const dialogDescriptors = dialogMethods.map(method => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method));

  beforeAll(async () => {
    if (Object.getOwnPropertyDescriptor(EntityDocuments, 'ɵcmp')?.get) {
      // Direct Vitest skips Angular's signal initializer transform; supply its JIT metadata locally.
      const signalInput = { isSignal: true, required: true };
      for (const name of ['organizationId', 'ownerType', 'ownerId', 'ownerLabel']) {
        Input(signalInput)(EntityDocuments.prototype, name);
      }
      // Opcionales: el mismo descriptor, sin `required`.
      for (const name of ['simple', 'categories', 'documentTypes', 'openAdd', 'presetDocumentType']) {
        Input({ isSignal: true, required: false } as never)(EntityDocuments.prototype, name);
      }
      Input(signalInput)(AppIcon.prototype, 'name');
      // Las piezas hijas del formulario: se registran porque las pruebas del desplegable son las
      // primeras que dibujan el editor, y hasta ahora nadie habia pasado por sus entradas.
      for (const name of ['label', 'options']) {
        Input(signalInput)(GiSelect.prototype, name);
      }
      for (const name of ['value', 'placeholder', 'disabled']) {
        Input({ isSignal: true, required: false } as never)(GiSelect.prototype, name);
      }
      Input(signalInput)(GiCatalogPicker.prototype, 'options');
      for (const name of ['value', 'label', 'catalogLabel', 'canWrite', 'disabled', 'inputId']) {
        Input({ isSignal: true, required: false } as never)(GiCatalogPicker.prototype, name);
      }
      Input(signalInput)(GiFileInput.prototype, 'label');
      for (const name of ['accept', 'disabled', 'hint', 'emptyLabel']) {
        Input({ isSignal: true, required: false } as never)(GiFileInput.prototype, name);
      }
      const signalQuery = { isSignal: true, read: ElementRef };
      ViewChild('historyDialog', signalQuery)(EntityDocuments.prototype, 'historyDialog');
    }
    // Resolve the production HTML and CSS before TestBed inspects the component definition.
    await resolveComponentResources(async url => {
      // Load Node resources only in JIT runs; the Angular runner already inlines these files.
      const moduleName = 'node:fs/promises';
      const { readFile } = await import(/* @vite-ignore */ moduleName) as {
        readFile(path: URL, encoding: 'utf8'): Promise<string>;
      };
      return readFile(new URL(url, import.meta.url), 'utf8');
    });
    // jsdom has no native dialog implementation; browsers provide focus trapping and Escape handling.
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
      close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
    });
  });
  afterAll(() => dialogMethods.forEach((method, index) => {
    const descriptor = dialogDescriptors[index];
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, method, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, method);
  }));
  const document: BusinessDocument = {
    idBusinessDocument: 'document-1', idOrganization: 'org-1', ownerType: 'Client', ownerId: 'client-1',
    ownerLabel: 'Acme', title: 'Contrato', category: 'Contrato', status: 'PendingReview', issuedDate: null,
    expiresDate: null, isExpired: false, storageReference: 'business-documents/file.pdf', isSensitive: false,
    notes: null, reviewNotes: null, reviewedAt: null, reviewedByName: null, active: true,
    createdAt: '2026-09-03T12:00:00Z', updatedAt: null,
  };
  const page = (items: readonly BusinessDocument[] = [document], totalCount = items.length) => ({
    items, totalCount, page: 1, pageSize: 10, totalPages: Math.ceil(totalCount / 10),
  });
  const botones = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map(
      (b) => b.textContent!.replace(/\s+/g, ' ').trim(),
    );

  const listRequest = () => http.expectOne(request => request.url === '/api/v1/documents' && request.method === 'GET');
  const flushList = (items: readonly BusinessDocument[] = [document], totalCount = items.length) => {
    listRequest().flush(page(items, totalCount));
    fixture.detectChanges();
  };
  const chooseFile = (file = new File(['pdf'], 'contract.pdf', { type: 'application/pdf' })) => {
    // Ahora el control entrega el archivo, no el evento: el nativo queda dentro de gi-file-input.
    component['selectFile'](file);
  };
  const createForm = () => {
    component['openEditor']('create');
    component['form'].patchValue({ title: ' New document ', category: ' Contract ' });
    chooseFile();
  };

  beforeEach(() => {
    fixtureCreated = false;
    httpInitialized = false;
    permissions.set(['DOCUMENTS.READ', 'DOCUMENTS.WRITE']);
    TestBed.configureTestingModule({
      imports: [EntityDocuments],
      providers: [provideHttpClient(), provideHttpClientTesting(), {
        provide: AuthService, useValue: { hasPermission: (permission: string) => permissions().includes(permission) },
      }],
    });
    fixture = TestBed.createComponent(EntityDocuments);
    fixtureCreated = true;
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    httpInitialized = true;
    fixture.componentRef.setInput('organizationId', 'org-1');
    fixture.componentRef.setInput('ownerType', 'Client');
    fixture.componentRef.setInput('ownerId', 'client-1');
    fixture.componentRef.setInput('ownerLabel', 'Acme');
    fixture.detectChanges();
  });

  afterEach(() => {
    try {
      if (fixtureCreated) fixture.destroy();
      if (httpInitialized) http.verify();
    } finally {
      TestBed.resetTestingModule();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('scopes and paginates requests, ignoring records from another owner', () => {
    const request = listRequest();
    expect(request.request.params.get('organizationId')).toBe('org-1');
    expect(request.request.params.get('ownerType')).toBe('Client');
    expect(request.request.params.get('ownerId')).toBe('client-1');
    // Cinco, no diez: esto vive en un panel de detalle y con diez la lista crecia hasta empujar
    // el navegador de paginas fuera de la vista.
    expect(request.request.params.get('pageSize')).toBe('5');
    request.flush(page([document, { ...document, ownerId: 'other', title: 'Other owner' }], 11));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Other owner');
    fixture.nativeElement.querySelector('[aria-label="Pagina siguiente"]').click();
    const next = listRequest();
    expect(next.request.params.get('page')).toBe('2');
    next.flush({ ...page([document], 11), page: 2 });
  });

  it('clears loading after failure and allows retry to an empty result', () => {
    listRequest().flush({}, { status: 500, statusText: 'Failed' });
    fixture.detectChanges();
    expect(component['loading']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
    component['load']();
    flushList([]);
    expect(fixture.nativeElement.textContent).toContain('No hay documentos');
    expect(component['listError']()).toBe('');
  });

  it('cancels stale context requests and discards the open editor', () => {
    const oldRequest = listRequest();
    component['openEditor']('create');
    component['form'].patchValue({ title: 'Previous owner' });
    fixture.componentRef.setInput('ownerId', 'client-2');
    fixture.detectChanges();
    expect(oldRequest.cancelled).toBe(true);
    expect(component['mode']()).toBeNull();
    const request = listRequest();
    expect(request.request.params.get('ownerId')).toBe('client-2');
    request.flush(page([]));
    component['save']();
    http.expectNone(request => request.method === 'POST');
  });

  it('stops requests and hides documents when READ is revoked', () => {
    const request = listRequest();
    permissions.set(['DOCUMENTS.WRITE']);
    fixture.detectChanges();
    expect(request.cancelled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No tienes permiso');
    component['openEditor']('create');
    component['download'](document);
    component['openHistory'](document);
    http.expectNone(() => true);
  });

  it('enforces WRITE in handlers and omits mutation controls for readers', () => {
    flushList();
    permissions.set(['DOCUMENTS.READ']);
    fixture.detectChanges();
    flushList();
    component['openEditor']('edit', document);
    component['save']();
    component['review']();
    component['archive']();
    expect(component['mode']()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Agregar documento');
    expect(fixture.nativeElement.textContent).not.toContain('Archivar');
    http.expectNone(request => request.method !== 'GET');
  });

  it('keeps sensitive metadata and actions restricted without SENSITIVE.READ', () => {
    const sensitive = { ...document, isSensitive: true, title: 'Private title', notes: 'Private notes' };
    flushList([sensitive]);
    expect(fixture.nativeElement.textContent).toContain('Documento restringido');
    expect(fixture.nativeElement.textContent).not.toContain('Private');
    component['download'](sensitive);
    component['openHistory'](sensitive);
    component['openEditor']('edit', sensitive);
    http.expectNone(() => true);
  });

  it.each([
    { extra: ['DOCUMENTS.SENSITIVE.WRITE'], read: false, write: false },
    { extra: ['DOCUMENTS.SENSITIVE.READ'], read: true, write: false },
    { extra: ['DOCUMENTS.SENSITIVE.READ', 'DOCUMENTS.SENSITIVE.WRITE'], read: true, write: true },
  ])('applies independent sensitive permission gates: $extra', ({ extra, read, write }) => {
    flushList();
    permissions.set(['DOCUMENTS.READ', 'DOCUMENTS.WRITE', ...extra]);
    fixture.detectChanges();
    // Changing only SENSITIVE.WRITE while READ is absent cannot grant additional access.
    const reload = http.match(request => request.url === '/api/v1/documents');
    reload.forEach(request => request.flush(page([{ ...document, isSensitive: true }])));
    const sensitive = { ...document, isSensitive: true };
    expect(component['canAccess'](sensitive)).toBe(read);
    expect(component['canEdit'](sensitive)).toBe(write);
    component['openEditor']('edit', sensitive);
    expect(component['mode']()).toBe(write ? 'edit' : null);
  });

  it('blocks sensitive creation without permission and sensitive downgrades even with permission', () => {
    flushList();
    createForm();
    component['form'].controls.isSensitive.setValue(true);
    component['save']();
    http.expectNone(request => request.method === 'POST');
    permissions.set(['DOCUMENTS.READ', 'DOCUMENTS.WRITE', 'DOCUMENTS.SENSITIVE.READ', 'DOCUMENTS.SENSITIVE.WRITE']);
    fixture.detectChanges();
    flushList([{ ...document, isSensitive: true }]);
    component['openEditor']('edit', { ...document, isSensitive: true });
    component['form'].controls.isSensitive.setValue(false);
    component['save']();
    expect(component['actionError']()).toContain('conservar');
    http.expectNone(request => request.method === 'PUT');
  });

  it('uploads then creates with immutable context and a pending review status', () => {
    flushList();
    createForm();
    expect(component['form'].contains('ownerId')).toBe(false);
    expect(component['form'].contains('storageReference')).toBe(false);
    component['save']();
    component['save']();
    const upload = http.expectOne(request => request.url === '/api/v1/documents/upload');
    expect(upload.request.params.get('organizationId')).toBe('org-1');
    expect(upload.request.body.get('file').name).toBe('contract.pdf');
    upload.flush({ storageReference: 'business-documents/new.pdf', originalFileName: 'contract.pdf', size: 3, contentType: 'application/pdf' });
    const create = http.expectOne('/api/v1/documents');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toMatchObject({
      idOrganization: 'org-1', ownerType: 'Client', ownerId: 'client-1', title: 'New document', category: 'Contract',
      status: 'PendingReview', storageReference: 'business-documents/new.pdf',
    });
    create.flush(document);
    flushList();
    expect(component['busy']()).toBe(false);
    expect(component['mode']()).toBeNull();
  });

  it('reuses the successful upload when saving metadata is retried', () => {
    flushList();
    createForm();
    component['save']();
    http.expectOne(request => request.url === '/api/v1/documents/upload').flush({ storageReference: 'business-documents/new.pdf' });
    http.expectOne('/api/v1/documents').flush({}, { status: 500, statusText: 'Failed' });
    expect(component['busy']()).toBe(false);
    component['save']();
    http.expectNone(request => request.url === '/api/v1/documents/upload');
    http.expectOne('/api/v1/documents').flush(document);
    flushList();
  });

  it('validates blank titles, inverted dates, missing files and file sizes before upload', () => {
    flushList();
    component['openEditor']('create');
    component['form'].patchValue({ title: '  ', category: 'Contract' });
    component['save']();
    expect(component['form'].invalid).toBe(true);
    component['form'].patchValue({ title: 'Contract', issuedDate: '2026-09-03', expiresDate: '2026-09-02' });
    component['save']();
    expect(component['actionError']()).toContain('vencimiento');
    component['form'].patchValue({ expiresDate: '' });
    component['save']();
    expect(component['actionError']()).toContain('Selecciona');
    chooseFile(new File([], 'empty.pdf'));
    expect(component['actionError']()).toContain('30 MB');
    const large = new File(['x'], 'large.pdf');
    Object.defineProperty(large, 'size', { value: 30 * 1024 * 1024 + 1 });
    chooseFile(large);
    component['save']();
    http.expectNone(request => request.method === 'POST');
  });

  it('edits metadata preserving the owner and file without a second upload', () => {
    flushList();
    component['openEditor']('edit', document);
    component['form'].patchValue({ title: 'Changed' });
    component['save']();
    const update = http.expectOne('/api/v1/documents/document-1');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toMatchObject({ ownerId: 'client-1', ownerType: 'Client', storageReference: document.storageReference });
    update.flush(document);
    flushList();
  });

  it('requires rejection notes and sends a dedicated review request', () => {
    flushList();
    component['openEditor']('review', document);
    component['reviewForm'].setValue({ status: 'Rejected', notes: '   ' });
    component['review']();
    http.expectNone('/api/v1/documents/document-1/review');
    component['reviewForm'].controls.notes.setValue(' Missing signature ');
    component['review']();
    const review = http.expectOne('/api/v1/documents/document-1/review');
    expect(review.request.body).toEqual({ idOrganization: 'org-1', status: 'Rejected', reviewNotes: 'Missing signature' });
    review.flush({ ...document, status: 'Rejected' });
    flushList();
  });

  it('archives only after confirmation and refreshes the list', () => {
    flushList();
    component['openEditor']('archive', document);
    http.expectNone(request => request.method === 'DELETE');
    component['archive']();
    const archive = http.expectOne(request => request.method === 'DELETE');
    expect(archive.request.url).toBe('/api/v1/documents/document-1');
    expect(archive.request.params.get('organizationId')).toBe('org-1');
    archive.flush(null);
    flushList([]);
  });

  it('loads and retries history within the same organization', () => {
    flushList();
    component['openHistory'](document);
    const history = http.expectOne(request => request.url.endsWith('/history'));
    expect(history.request.params.get('organizationId')).toBe('org-1');
    history.flush({}, { status: 500, statusText: 'Failed' });
    expect(component['historyLoading']()).toBe(false);
    component['loadHistory']();
    http.expectOne(request => request.url.endsWith('/history')).flush([{
      idBusinessDocumentEvent: 'event-1', action: 'Created', status: 'PendingReview', notes: 'Uploaded',
      actorName: 'Reviewer', occurredAt: '2026-09-03T12:00:00Z',
      beforeSnapshot: JSON.stringify({ Title: 'Old title', StorageReference: 'private/path' }),
      afterSnapshot: JSON.stringify({ Title: 'New title', StorageReference: 'private/new-path' }),
    }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Reviewer');
    expect(fixture.nativeElement.querySelector('dialog table').textContent).toContain('Old title');
    expect(fixture.nativeElement.querySelector('dialog table').textContent).toContain('New title');
    expect(fixture.nativeElement.querySelector('dialog').textContent).not.toContain('private/');
    component['closeHistory']();
    expect(component['history']()).toEqual([]);
  });

  it('downloads exclusively through the API even when storageReference is an unsafe URL', () => {
    const unsafe = { ...document, storageReference: 'javascript:alert(1)' };
    flushList([unsafe]);
    component['download'](unsafe);
    const download = http.expectOne(request => request.url.endsWith('/download'));
    expect(download.request.params.get('organizationId')).toBe('org-1');
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob([]));
    expect(component['actionError']()).toContain('no contiene datos');
    expect(fixture.nativeElement.querySelector('a[href], iframe, object, embed')).toBeNull();
  });

  it('downloads nonempty content as an attachment and releases the local blob URL', () => {
    flushList();
    vi.useFakeTimers();
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:local-download');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', class extends URL {
      static override createObjectURL = createObjectURL;
      static override revokeObjectURL = revokeObjectURL;
    });
    let link: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { link = this; });
    component['download']({ ...document, storageReference: 'https://untrusted.example/file.html' });
    http.expectOne(request => request.url.endsWith('/download')).flush(new Blob(['content'], { type: 'text/html' }), {
      headers: { 'Content-Disposition': "attachment; filename=contract.pdf; filename*=UTF-8''contract%20signed.pdf" },
    });
    expect(link?.href).toBe('blob:local-download');
    expect(link?.download).toBe('contract signed.pdf');
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/octet-stream');
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-download');
  });

  it('cancels an upload when the organization changes without creating for either context', () => {
    flushList();
    createForm();
    component['save']();
    const upload = http.expectOne(request => request.url.endsWith('/upload'));
    fixture.componentRef.setInput('organizationId', 'org-2');
    fixture.detectChanges();
    expect(upload.cancelled).toBe(true);
    const request = listRequest();
    expect(request.request.params.get('organizationId')).toBe('org-2');
    request.flush(page([]));
    expect(component['mode']()).toBeNull();
    expect(component['busy']()).toBe(false);
    http.expectNone(request => request.method === 'POST');
  });

  /**
   * El expediente del <b>cliente</b> pide menos que el del personal.
   *
   * <p>Historial, Revisar y Archivar existen para el expediente del personal, donde un documento se
   * valida o se rechaza y esa decisión manda sobre la elegibilidad para cubrir un turno. En el del
   * cliente no hay a quién le sirvan.</p>
   */
  it('en la variante simple solo deja descargar y editar', () => {
    fixture.componentRef.setInput('simple', true);
    fixture.detectChanges();
    flushList();

    const texto = botones().join(' | ');
    expect(texto).toContain('Descargar');
    expect(texto).toContain('Editar');
    expect(texto).not.toContain('Historial');
    expect(texto).not.toContain('Revisar');
    expect(texto).not.toContain('Archivar');
  });

  /** Y no repite «Agregar documento»: la ficha del cliente ya lo tiene en su cabecera. */
  it('en la variante simple no pone su propio «Agregar documento»', () => {
    fixture.componentRef.setInput('simple', true);
    fixture.detectChanges();
    flushList();

    expect(botones().some((b) => b.includes('Agregar documento'))).toBe(false);
  });

  /** En Personal siguen las cinco: ahi el componente vive solo y la revision sostiene la vigencia. */
  it('sin la variante simple conserva historial, revisar y archivar', () => {
    flushList();

    const texto = botones().join(' | ');
    expect(texto).toContain('Historial');
    expect(texto).toContain('Revisar');
    expect(texto).toContain('Archivar');
    expect(texto).toContain('Agregar documento');
  });

  // ── Los tipos de documento, cuando el expediente los declara ──────────────────────────────

  const tipos = [
    { code: 'CriminalRecordCertificate', label: 'Antecedentes no penales', isRequired: true },
    { code: 'ProofOfAddress', label: 'Comprobante de domicilio', isRequired: false },
  ];
  const conTipos = () => {
    fixture.componentRef.setInput('documentTypes', tipos);
    fixture.detectChanges();
  };

  /**
   * La categoria dejaba escribir cualquier cosa, y una escrita a mano no cumple ningun requisito:
   * las reglas de elegibilidad apuntan al tipo del sistema, no a un texto.
   */
  it('con tipos declarados cambia el texto libre por un selector', () => {
    conTipos();
    flushList();
    component['openEditor']('create');
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('gi-select')).not.toBeNull();
    expect(raiz.querySelector('input[formcontrolname="category"]')).toBeNull();
  });

  /** Y dice cuales exige la organizacion, que son los que destraban una asignacion. */
  it('marca en el selector los tipos que la organizacion exige', () => {
    conTipos();
    flushList();
    component['openEditor']('create');
    fixture.detectChanges();

    const opciones = component['typeOptions']();
    expect(opciones[0]).toMatchObject({ value: 'CriminalRecordCertificate', hint: 'Lo exige esta organizacion' });
    expect(opciones[1].hint).toBeUndefined();
  });

  /** El tipo manda la categoria: la columna que ya existe se sigue llenando con la etiqueta. */
  it('al elegir el tipo llena la categoria con su etiqueta', () => {
    conTipos();
    flushList();
    component['openEditor']('create');
    component['elegirTipo']('ProofOfAddress');

    expect(component['form'].controls.category.value).toBe('Comprobante de domicilio');
    expect(component['form'].controls.documentType.value).toBe('ProofOfAddress');
  });

  /**
   * El titulo sigue a la categoria mientras siga siendo la propuesta.
   *
   * <p>La primera version solo proponia el titulo si estaba vacio, asi que al cambiar de categoria
   * se quedaba el nombre de la anterior y el documento se guardaba mal nombrado. QA lo reporto el
   * 17 de septiembre de 2026.</p>
   */
  it('al cambiar de tipo el titulo propuesto se actualiza', () => {
    conTipos();
    flushList();
    component['openEditor']('create');

    component['elegirTipo']('ProofOfAddress');
    expect(component['form'].controls.title.value).toBe('Comprobante de domicilio');

    component['elegirTipo']('CriminalRecordCertificate');
    expect(component['form'].controls.title.value).toBe('Antecedentes no penales');
  });

  /** Pero lo que alguien escribio no se pisa: por eso se distingue la propuesta del texto propio. */
  it('respeta el titulo que se escribio a mano al cambiar de tipo', () => {
    conTipos();
    flushList();
    component['openEditor']('create');

    component['elegirTipo']('ProofOfAddress');
    component['form'].controls.title.setValue('Recibo de luz de agosto');
    component['elegirTipo']('CriminalRecordCertificate');

    expect(component['form'].controls.title.value).toBe('Recibo de luz de agosto');
  });

  /** Sin tipo no se guarda: sin el, la fila del requisito no se podria escribir. */
  it('no guarda si falta el tipo aunque haya archivo', () => {
    conTipos();
    flushList();
    component['openEditor']('create');
    component['form'].patchValue({ title: 'Comprobante', category: 'Comprobante' });
    chooseFile();
    component['save']();

    expect(component['actionError']()).toBe('Elige el tipo de documento.');
  });

  /**
   * El aviso hacia fuera es lo que mueve la bandera de vigencia: el archivo va a
   * `BusinessDocument` y la vigencia se calcula sobre `EmployeeDocument`, que es otra tabla.
   */
  it('avisa del tipo guardado para que el expediente registre el requisito', () => {
    conTipos();
    flushList();
    const avisos: unknown[] = [];
    component.documentSaved.subscribe((evento) => avisos.push(evento));

    component['openEditor']('create');
    component['elegirTipo']('CriminalRecordCertificate');
    component['form'].patchValue({ title: 'Carta', issuedDate: '2026-09-01', expiresDate: '2027-09-01' });
    chooseFile();
    component['save']();

    http.expectOne(request => request.url === '/api/v1/documents/upload')
      .flush({ storageReference: 'business-documents/new.pdf' });
    http.expectOne('/api/v1/documents').flush(document);
    flushList();

    // Y lleva el identificador del archivo que el servidor acaba de devolver: es lo que permite
    // ligar el requisito con el documento, en lugar de dejar las dos filas sin relacion.
    expect(avisos).toEqual([{
      documentType: 'CriminalRecordCertificate',
      issuedDate: '2026-09-01',
      expiresDate: '2027-09-01',
      idBusinessDocument: 'document-1',
    }]);
  });

  /** Y no avisa cuando el expediente no declara tipos: Clientes no tiene requisitos que mover. */
  it('sin tipos declarados no emite el aviso', () => {
    flushList();
    const avisos: unknown[] = [];
    component.documentSaved.subscribe((evento) => avisos.push(evento));

    createForm();
    component['save']();
    http.expectOne(request => request.url === '/api/v1/documents/upload')
      .flush({ storageReference: 'business-documents/new.pdf' });
    http.expectOne('/api/v1/documents').flush(document);
    flushList();

    expect(avisos).toEqual([]);
  });

  // ── La entrada que nadie ataba ────────────────────────────────────────────────────────────

  /**
   * El defecto de «Agregar documento» en Clientes: la pantalla ponía su señal en true y este
   * componente no tenía forma de enterarse, así que el botón no hacía nada. La variante simple no
   * dibuja su propio botón —la ficha del cliente ya lo tiene arriba—, de modo que sin esta entrada
   * no había ninguna manera de abrir el alta.
   */
  it('la variante simple abre el alta cuando la pantalla lo pide', () => {
    flushList();
    fixture.componentRef.setInput('simple', true);
    fixture.componentRef.setInput('categories', [{ idCatalogItem: 'c1', name: 'Contrato' }]);
    fixture.detectChanges();

    expect(component['mode']()).toBeNull();

    fixture.componentRef.setInput('openAdd', true);
    fixture.detectChanges();

    expect(component['mode']()).toBe('create');
  });

  /** Y avisa al cerrarse, para que quien abrió pueda bajar su bandera. */
  it('avisa al cerrar el alta que abrió la pantalla', () => {
    const cierres: unknown[] = [];
    component.closeAdd.subscribe(() => cierres.push(true));

    flushList();
    fixture.componentRef.setInput('simple', true);
    fixture.componentRef.setInput('categories', [{ idCatalogItem: 'c1', name: 'Contrato' }]);
    fixture.componentRef.setInput('openAdd', true);
    fixture.detectChanges();

    component['closeEditor']();

    expect(cierres).toHaveLength(1);
    expect(component['mode']()).toBeNull();
  });

  /** Una entrada desde fuera no puede tener menos guardas que el botón de dentro. */
  it('no abre el alta sin permiso de escritura', () => {
    flushList();
    permissions.set(['DOCUMENTS.READ']);
    fixture.detectChanges();
    flushList();
    fixture.componentRef.setInput('simple', true);
    fixture.componentRef.setInput('openAdd', true);
    fixture.detectChanges();

    expect(component['mode']()).toBeNull();
  });

  /**
   * El alta abierta desde la fila del requisito llega con el tipo puesto y el titulo propuesto.
   *
   * <p>La fila ya nombra el tipo: volver a pedirlo seria pedir dos veces el mismo dato, y teclear
   * el titulo a mano era escribir lo que la pantalla ya sabia.</p>
   */
  it('abre con el tipo preseleccionado y propone el titulo', () => {
    const tipos = [
      { code: 'Curp', label: 'CURP', isRequired: true },
      { code: 'ProofOfAddress', label: 'Comprobante de domicilio', isRequired: true },
    ];

    flushList();
    fixture.componentRef.setInput('documentTypes', tipos);
    fixture.componentRef.setInput('presetDocumentType', 'ProofOfAddress');
    fixture.componentRef.setInput('openAdd', true);
    fixture.detectChanges();

    expect(component['mode']()).toBe('create');
    expect(component['form'].controls.documentType.value).toBe('ProofOfAddress');
    expect(component['form'].controls.category.value).toBe('Comprobante de domicilio');
    expect(component['form'].controls.title.value).toBe('Comprobante de domicilio');
  });

  /** Un titulo ya escrito no se pisa: lo propuesto es una ayuda, no una imposicion. */
  it('no pisa un titulo que alguien ya escribio', () => {
    flushList();
    fixture.componentRef.setInput('documentTypes', [{ code: 'Curp', label: 'CURP', isRequired: true }]);
    fixture.detectChanges();

    component['openEditor']('create');
    component['form'].controls.title.setValue('CURP de Renata, reposicion');
    component['elegirTipo']('Curp');

    expect(component['form'].controls.title.value).toBe('CURP de Renata, reposicion');
    expect(component['form'].controls.category.value).toBe('CURP');
  });
});
