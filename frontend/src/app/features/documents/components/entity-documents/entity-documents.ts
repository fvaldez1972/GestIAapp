import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, inject,
  input, signal, untracked, viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription, finalize, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppIcon } from '../../../../shared/ui/app-icon/app-icon';
import { GiFileInput } from '../../../../shared/ui/gi-file-input/gi-file-input';
import { formatOperationalDate, formatOperationalInstant } from '../../../../shared/util/operational-date';
import { DocumentApiService } from '../../data-access/document-api.service';
import { documentStatusLabels, historyChanges } from './entity-document-history';
import {
  BusinessDocument, BusinessDocumentEvent, BusinessDocumentInput,
  BusinessDocumentOwnerType, BusinessDocumentStatus,
} from '../../data-access/document.models';

type OwnerContext = Pick<BusinessDocumentInput, 'idOrganization' | 'ownerType' | 'ownerId'>;
type EditorMode = 'create' | 'edit' | 'review' | 'archive';

@Component({
  selector: 'app-entity-documents',
  imports: [ReactiveFormsModule, AppIcon, GiFileInput],
  templateUrl: './entity-documents.html',
  styleUrl: './entity-documents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityDocuments implements OnDestroy {
  /**
   * El formato único de la aplicación, `04 sep 2026`. `DatePipe` no lo produce: sin `LOCALE_ID`
   * escribe en inglés y con `es-MX` escribe `4 sept 2026`, día sin cero y mes de cuatro letras.
   *
   * La fecha de vencimiento es un **día de negocio** y va por el formateador que no pasa por
   * `new Date`; la revisión es un **instante** y va por el que sí. Confundirlos correría el día,
   * que es la misma distinción que el servidor hace entre columnas `Date` y columnas `At`.
   */
  protected readonly formatDate = formatOperationalDate;
  protected readonly formatInstant = formatOperationalInstant;

  readonly organizationId = input.required<string>();
  readonly ownerType = input.required<BusinessDocumentOwnerType>();
  readonly ownerId = input.required<string>();
  readonly ownerLabel = input.required<string>();

  private readonly api = inject(DocumentApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly historyDialog = viewChild<ElementRef<HTMLDialogElement>>('historyDialog');
  private readonly selectorDeArchivo = viewChild(GiFileInput);
  private requests = new Subscription();
  private listRequest?: Subscription;
  private historyRequest?: Subscription;
  private editorContext: OwnerContext | null = null;
  private uploadedReference = '';
  private file: File | null = null;

  protected readonly context = computed<OwnerContext>(() => ({
    idOrganization: this.organizationId().trim(), ownerType: this.ownerType(), ownerId: this.ownerId().trim(),
  }));
  protected readonly validContext = computed(() => !!this.context().idOrganization && !!this.context().ownerId);
  protected readonly canRead = computed(() => this.auth.hasPermission('DOCUMENTS.READ'));
  protected readonly canWrite = computed(() => this.canRead() && this.auth.hasPermission('DOCUMENTS.WRITE'));
  protected readonly canAccessSensitive = computed(() => this.canRead() && this.auth.hasPermission('DOCUMENTS.SENSITIVE.READ'));
  protected readonly canWriteSensitive = computed(() => this.canWrite() && this.canAccessSensitive()
    && this.auth.hasPermission('DOCUMENTS.SENSITIVE.WRITE'));
  protected readonly documents = signal<readonly BusinessDocument[]>([]);
  protected readonly loading = signal(false);
  protected readonly listError = signal('');
  protected readonly actionError = signal('');
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);
  protected readonly pageSize = 10;
  protected readonly mode = signal<EditorMode | null>(null);
  protected readonly selected = signal<BusinessDocument | null>(null);
  protected readonly fileName = signal('');
  protected readonly historyDocument = signal<BusinessDocument | null>(null);
  protected readonly history = signal<readonly (BusinessDocumentEvent & { changes: ReturnType<typeof historyChanges> })[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly statusLabels = documentStatusLabels;
  protected readonly filters = this.fb.nonNullable.group({ search: [''], status: ['' as BusinessDocumentStatus | ''] });
  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(180)]],
    category: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
    issuedDate: [''], expiresDate: [''], isSensitive: [false], notes: ['', Validators.maxLength(1000)],
  });
  protected readonly reviewForm = this.fb.nonNullable.group({
    status: ['Validated' as 'Validated' | 'Rejected'], notes: ['', Validators.maxLength(1000)],
  });

  constructor() {
    effect(() => {
      this.context();
      this.canRead();
      this.canWrite();
      this.canAccessSensitive();
      this.canWriteSensitive();
      untracked(() => {
        this.requests.unsubscribe();
        this.requests = new Subscription();
        this.busy.set(false);
        this.closeEditor();
        this.closeHistory();
        this.filters.reset({ search: '', status: '' });
        this.page.set(1);
        this.message.set('');
        this.load();
      });
    });
  }

  ngOnDestroy() { this.requests.unsubscribe(); }

  protected load(page = this.page()) {
    this.listRequest?.unsubscribe();
    this.documents.set([]);
    this.listError.set('');
    this.totalCount.set(0);
    this.totalPages.set(1);
    if (!this.canRead() || !this.validContext()) {
      this.loading.set(false);
      return;
    }
    this.page.set(Math.max(1, page));
    this.loading.set(true);
    const context = this.context();
    const filters = this.filters.getRawValue();
    this.listRequest = this.api.listDocuments(
      context.idOrganization, context.ownerType, context.ownerId,
      filters.status, filters.search, this.page(), this.pageSize,
    ).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: result => {
        const lastPage = Math.max(1, result.totalPages);
        if (this.page() > lastPage) {
          this.load(lastPage);
          return;
        }
        this.documents.set(result.items.filter(document => this.belongsToContext(document)));
        this.totalCount.set(result.totalCount);
        this.totalPages.set(lastPage);
      },
      error: error => this.listError.set(this.errorMessage(error, 'No se pudieron cargar los documentos.')),
    });
    this.requests.add(this.listRequest);
  }

  protected applyFilters() {
    if (this.busy()) return;
    this.closeEditor();
    this.load(1);
  }

  protected canAccess(document: BusinessDocument) {
    return this.canRead() && this.belongsToContext(document)
      && (!document.isSensitive || this.canAccessSensitive());
  }

  protected canEdit(document: BusinessDocument) {
    return this.canWrite() && this.canAccess(document) && (!document.isSensitive || this.canWriteSensitive())
      && document.active && document.status !== 'Archived';
  }

  protected openEditor(mode: EditorMode, document: BusinessDocument | null = null) {
    if (!this.canWrite() || !this.validContext() || this.busy()) return;
    if (mode !== 'create' && (!document || !this.canEdit(document))) return;
    this.closeEditor();
    this.closeHistory();
    this.editorContext = { ...this.context() };
    this.selected.set(document);
    this.mode.set(mode);
    this.message.set('');
    if (document) {
      this.form.reset({
        title: document.title, category: document.category, issuedDate: document.issuedDate ?? '',
        expiresDate: document.expiresDate ?? '', isSensitive: document.isSensitive, notes: document.notes ?? '',
      });
    }
  }

  protected closeEditor() {
    if (this.busy()) return;
    this.mode.set(null);
    this.selected.set(null);
    this.editorContext = null;
    this.file = null;
    this.uploadedReference = '';
    this.fileName.set('');
    this.actionError.set('');
    this.form.reset();
    this.reviewForm.reset({ status: 'Validated', notes: '' });
  }

  protected selectFile(archivo: File | null) {
    if (this.busy() || !this.canWrite()) return;
    this.file = null;
    this.uploadedReference = '';
    this.fileName.set('');
    this.actionError.set('');
    if (!archivo) return;
    if (archivo.size === 0 || archivo.size > 30 * 1024 * 1024) {
      this.actionError.set('El archivo debe contener datos y no superar 30 MB.');
      this.selectorDeArchivo()?.reset();
      return;
    }
    this.file = archivo;
    this.fileName.set(archivo.name);
  }

  protected save() {
    if (!this.editorAllowed() || (this.mode() !== 'create' && this.mode() !== 'edit')) return;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid) {
      this.actionError.set('Revisa los campos obligatorios y sus limites de longitud.');
      return;
    }
    if (value.issuedDate && value.expiresDate && value.expiresDate < value.issuedDate) {
      this.actionError.set('El vencimiento no puede ser anterior a la emision.');
      return;
    }
    const selected = this.selected();
    if (value.isSensitive && !this.canWriteSensitive()) {
      this.actionError.set('No tienes permiso para guardar documentos sensibles.');
      return;
    }
    if (selected?.isSensitive && !value.isSensitive) {
      this.actionError.set('El documento debe conservar su clasificacion sensible.');
      return;
    }
    if (!selected && !this.file && !this.uploadedReference) {
      this.actionError.set('Selecciona un archivo.');
      return;
    }
    const context = { ...this.editorContext! };
    const reference$ = this.file && !this.uploadedReference
      ? this.api.uploadDocumentFile(this.file, this.organizationId()).pipe(
          tap(upload => { this.uploadedReference = upload.storageReference; }), map(upload => upload.storageReference))
      : of(this.uploadedReference || selected?.storageReference || '');
    this.runAction(reference$.pipe(switchMap(storageReference => {
      if (!storageReference.trim() || storageReference.length > 500) throw new Error('Invalid upload reference');
      const request: BusinessDocumentInput = {
        ...context, title: value.title.trim(), category: value.category.trim(),
        issuedDate: value.issuedDate || null, expiresDate: value.expiresDate || null,
        isSensitive: value.isSensitive, notes: value.notes.trim() || null, status: 'PendingReview', storageReference,
      };
      return selected ? this.api.updateDocument(selected.idBusinessDocument, request) : this.api.createDocument(request);
    })), 'Documento guardado. Pendiente de revision.');
  }

  protected review() {
    if (!this.editorAllowed() || this.mode() !== 'review') return;
    const selected = this.selected();
    if (!selected) return;
    this.reviewForm.markAllAsTouched();
    const value = this.reviewForm.getRawValue();
    if (this.reviewForm.invalid || (value.status === 'Rejected' && !value.notes.trim())) {
      this.actionError.set('El rechazo requiere un motivo. Las notas admiten hasta 1000 caracteres.');
      return;
    }
    this.runAction(this.api.reviewDocument(selected.idBusinessDocument, {
      idOrganization: this.editorContext!.idOrganization, status: value.status, reviewNotes: value.notes.trim() || null,
    }), value.status === 'Validated' ? 'Documento validado.' : 'Documento rechazado.');
  }

  protected archive() {
    if (!this.editorAllowed() || this.mode() !== 'archive') return;
    const selected = this.selected();
    if (!selected) return;
    this.runAction(this.api.deactivateDocument(this.editorContext!.idOrganization, selected.idBusinessDocument),
      'Documento archivado.');
  }

  protected openHistory(document: BusinessDocument) {
    if (!this.canAccess(document) || this.busy()) return;
    this.closeEditor();
    this.historyDocument.set(document);
    this.historyDialog()?.nativeElement.showModal();
    this.loadHistory();
  }

  protected loadHistory() {
    this.historyRequest?.unsubscribe();
    const document = this.historyDocument();
    if (!document || !this.canAccess(document)) return;
    this.history.set([]);
    this.historyError.set('');
    this.historyLoading.set(true);
    this.historyRequest = this.api.listHistory(this.context().idOrganization, document.idBusinessDocument)
      .pipe(finalize(() => this.historyLoading.set(false))).subscribe({
        next: events => this.history.set(events.map(event => ({ ...event, changes: historyChanges(event) }))),
        error: error => this.historyError.set(this.errorMessage(error, 'No se pudo cargar el historial.')),
      });
    this.requests.add(this.historyRequest);
  }

  protected closeHistory() {
    this.historyRequest?.unsubscribe();
    this.historyDialog()?.nativeElement.close();
    this.historyDocument.set(null);
    this.history.set([]);
    this.historyError.set('');
  }

  protected eventLabel(action: string) {
    const labels: Record<string, string> = {
      Created: 'Creado', Updated: 'Actualizado', Validated: 'Validado', Rejected: 'Rechazado',
      Reviewed: 'Revisado', Archived: 'Archivado',
    };
    return labels[action] ?? 'Cambio registrado';
  }

  protected download(document: BusinessDocument) {
    if (!this.canAccess(document) || this.busy()) return;
    this.actionError.set('');
    this.busy.set(true);
    this.requests.add(this.api.downloadDocument(this.context().idOrganization, document.idBusinessDocument)
      .pipe(finalize(() => this.busy.set(false))).subscribe({
        next: response => this.saveDownload(response, document.title),
        error: error => this.actionError.set(this.errorMessage(error, 'No se pudo descargar el archivo.')),
      }));
  }

  private belongsToContext(document: BusinessDocument) {
    const context = this.context();
    return document.idOrganization === context.idOrganization && document.ownerType === context.ownerType
      && document.ownerId === context.ownerId;
  }

  private editorAllowed() {
    const context = this.context();
    const selected = this.selected();
    return !this.busy() && this.canWrite() && this.validContext() && !!this.editorContext
      && this.editorContext.idOrganization === context.idOrganization
      && this.editorContext.ownerType === context.ownerType && this.editorContext.ownerId === context.ownerId
      && (!selected || this.canEdit(selected));
  }

  private runAction<T>(request: Observable<T>, message: string) {
    this.busy.set(true);
    this.actionError.set('');
    this.message.set('');
    this.requests.add(request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeEditor();
        this.message.set(message);
        this.load();
      },
      error: error => this.actionError.set(this.errorMessage(error, 'No se pudo completar la operacion. Intenta de nuevo.')),
    }));
  }

  private saveDownload(response: HttpResponse<Blob>, title: string) {
    if (!response.body?.size) {
      this.actionError.set('La descarga no contiene datos.');
      return;
    }
    // Never navigate to storageReference or render active content in the application origin.
    const blob = new Blob([response.body], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    const disposition = response.headers.get('Content-Disposition') ?? '';
    let filename = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(disposition)?.slice(1).find(Boolean)?.trim() || title;
    const encodedName = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)?.[1];
    if (encodedName) {
      try { filename = decodeURIComponent(encodedName.trim()); } catch { /* Keep the plain filename on malformed headers. */ }
    }
    link.href = url;
    link.download = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 180) || 'documento';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'No tienes permiso para esta operacion.';
      if (error.status === 404) return 'El documento o archivo ya no esta disponible.';
      if (error.status === 0) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
    }
    return fallback;
  }
}
