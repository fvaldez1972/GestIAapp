import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef, Input, ViewChild, signal, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppIcon } from '../../../../shared/ui/app-icon/app-icon';
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
      Input(signalInput)(AppIcon.prototype, 'name');
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
    expect(request.request.params.get('pageSize')).toBe('10');
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
});
