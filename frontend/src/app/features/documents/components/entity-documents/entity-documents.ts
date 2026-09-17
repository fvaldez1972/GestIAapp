import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, inject,
  input, output, signal, untracked, viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription, finalize, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppIcon } from '../../../../shared/ui/app-icon/app-icon';
import { GiCatalogCreation, GiCatalogOption, GiCatalogPicker } from '../../../../shared/ui/gi-catalog-picker/gi-catalog-picker';
import { GiFileInput } from '../../../../shared/ui/gi-file-input/gi-file-input';
import { GiSelect, GiSelectOption } from '../../../../shared/ui/gi-select/gi-select';
import { formatOperationalDate, formatOperationalInstant } from '../../../../shared/util/operational-date';
import { DocumentApiService } from '../../data-access/document-api.service';
import { documentStatusLabels, historyChanges } from './entity-document-history';
import {
  BusinessDocument, BusinessDocumentEvent, BusinessDocumentInput,
  BusinessDocumentOwnerType, BusinessDocumentStatus,
} from '../../data-access/document.models';

type OwnerContext = Pick<BusinessDocumentInput, 'idOrganization' | 'ownerType' | 'ownerId'>;
type EditorMode = 'create' | 'edit' | 'review' | 'archive';

/** Un tipo de documento ofrecido en el desplegable, con la marca de si la organizacion lo exige. */
export type EntityDocumentTypeOption = {
  readonly code: string;
  readonly label: string;
  readonly isRequired: boolean;
};

/** Lo que se guardo, para quien tenga que registrarlo en otro lado. */
export type EntityDocumentSaved = {
  readonly documentType: string;
  readonly issuedDate: string | null;
  readonly expiresDate: string | null;
  /** El documento que se acaba de guardar, para que quien registre el requisito pueda ligarlo. */
  readonly idBusinessDocument: string;
};

@Component({
  selector: 'app-entity-documents',
  imports: [ReactiveFormsModule, AppIcon, GiFileInput, GiCatalogPicker, GiSelect],
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

  /**
   * El expediente del cliente pide menos que el del empleado.
   *
   * <p>Un documento de cliente se identifica con su categoria y su archivo: acta constitutiva,
   * poder notarial, comprobante de domicilio. El titulo era un segundo nombre para lo mismo, y las
   * fechas de emision y vencimiento y la marca de sensible no tienen aqui a quien le sirvan.</p>
   *
   * <p><b>En Personal no se quitan.</b> Alli el vencimiento no es decoracion: alimenta la vigencia
   * documental y la elegibilidad para cubrir un turno, y la marca de sensible decide quien puede
   * ver el archivo. Por eso esto es una variante y no un recorte del componente.</p>
   */
  readonly simple = input(false);

  /** Las categorias del catalogo, cuando la variante simple las usa en vez de texto libre. */
  readonly categories = input<readonly GiCatalogOption[]>([]);
  readonly createCategory = output<GiCatalogCreation>();

  /**
   * Los tipos de documento que el expediente reconoce. Vacio deja el campo como texto libre.
   *
   * <p>Personal los manda porque alli la categoria no es una etiqueta: es el tipo contra el que la
   * organizacion declara sus requisitos, y un texto escrito a mano no cumple ninguno. Clientes no
   * los manda, porque su categoria si es un catalogo editable de la organizacion.</p>
   */
  readonly documentTypes = input<readonly EntityDocumentTypeOption[]>([]);

  /**
   * Se emite al guardar, con el tipo elegido, para quien tenga que registrar el documento aparte.
   *
   * <p><b>Por que hace falta este aviso.</b> Este componente guarda un <c>BusinessDocument</c>, que
   * es el archivo con su historial y su revision. La vigencia documental de una persona y su
   * elegibilidad para cubrir un turno se calculan sobre <c>EmployeeDocument</c>, que es otra tabla.
   * Subir un archivo aqui no movia la bandera de alla porque nadie escribia la segunda fila.</p>
   *
   * <p><b>PENDIENTE, con fecha y forma.</b> Las dos filas quedan sin enlace: el
   * <c>EmployeeDocument</c> no apunta al archivo. <c>StorageReference</c> existe pero lo sirve una
   * ruta heredada del prototipo, y meter ahi el identificador del <c>BusinessDocument</c> seria
   * darle a una columna un significado que no tiene. El enlace honesto es una columna nueva
   * <c>IdBusinessDocument</c> en <c>EmployeeDocuments</c>, nulable y aditiva; se decidio dejarla
   * para despues de la demo del 17 de septiembre de 2026 en lugar de migrar la noche anterior.
   * Mientras no exista, el archivo se ve y se descarga en la lista de este mismo componente.</p>
   */
  readonly documentSaved = output<EntityDocumentSaved>();

  /**
   * Abre el alta desde fuera, para quien tiene el botón en su propia cabecera.
   *
   * <p><b>Existe porque faltaba y nadie lo notaba.</b> En la variante simple este componente no
   * dibuja su «Agregar documento» —la ficha del cliente ya lo tiene arriba, con las demás
   * acciones—, pero no había forma de decirle que lo abriera: la pantalla ponía su señal en
   * <c>true</c> y nadie la leía, así que el botón no hacía nada. Es la misma familia del defecto de
   * «Agregar contacto», del lado de la entrada en vez de la salida.</p>
   */
  readonly openAdd = input(false);

  /** Para que quien abrió pueda bajar su bandera al cerrarse el alta. */
  readonly closeAdd = output<void>();

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
  /** Si el alta abierta la pidió la pantalla de fuera, para avisarle al cerrarse y sólo entonces. */
  private abiertoDesdeFuera = false;
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
  /**
   * Cinco por página, no diez.
   *
   * <p>Esto vive dentro de un panel de detalle, no en una pantalla completa. Con diez, cada
   * documento ocupa cuatro renglones y cinco botones, así que la lista crecía hasta empujar el
   * navegador de páginas fuera de la vista y parecía que los documentos se acumulaban sin fin.</p>
   */
  protected readonly pageSize = 5;

  /** Cuántos documentos hay, para quien dibuje un contador fuera de este componente. */
  readonly totalChange = output<number>();
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
    title: ['', [Validators.pattern(/\S/), Validators.maxLength(180)]],
    category: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
    documentType: [''],
    issuedDate: [''], expiresDate: [''], isSensitive: [false], notes: ['', Validators.maxLength(1000)],
  });

  /** Con tipos declarados la categoria se elige; sin ellos se escribe, como hasta ahora. */
  protected readonly typed = computed(() => this.documentTypes().length > 0);

  /** El obligatorio se marca en el renglon secundario del selector, que ya existe para eso. */
  protected readonly typeOptions = computed<readonly GiSelectOption[]>(() =>
    this.documentTypes().map((tipo) => ({
      value: tipo.code,
      label: tipo.label,
      hint: tipo.isRequired ? 'Lo exige esta organizacion' : undefined,
    })),
  );

  /**
   * El tipo manda la categoria, no al reves.
   *
   * <p>La columna <c>Category</c> se sigue llenando con la etiqueta visible, que es lo que la lista
   * enseña y lo que el servidor ya exige. Asi el cambio no le da un significado nuevo a una columna
   * que ya tenia uno.</p>
   */
  protected elegirTipo(code: string): void {
    const tipo = this.documentTypes().find((item) => item.code === code);
    this.form.controls.documentType.setValue(tipo ? code : '');
    this.form.controls.category.setValue(tipo?.label ?? '');
  }

  /**
   * En la variante simple el titulo lo pone la categoria.
   *
   * <p>El servidor sigue exigiendolo y sigue siendo lo que se lee en la lista; lo que se quita es
   * pedirlo dos veces. Se resuelve al guardar y no al escribir, para que cambiar de categoria no
   * pise un titulo que alguien si haya escrito en la variante completa.</p>
   */
  /** La categoria elegida, como identificador del catalogo, para pintarla en el selector. */
  protected categoriaElegida(): string {
    const nombre = this.form.controls.category.value;
    return this.categories().find((c) => c.name === nombre)?.idCatalogItem ?? '';
  }

  /**
   * El documento guarda la categoria <b>por nombre</b>, no por identificador.
   *
   * <p>Es la columna que ya existe y lo que la lista enseña. Se apunta en el catalogo para que dos
   * personas no escriban la misma categoria de dos formas, pero renombrarla despues no reclasifica
   * lo ya cargado, y eso se dice en la pantalla de Catalogos.</p>
   */
  protected elegirCategoria(idCatalogItem: string): void {
    const nombre = this.categories().find((c) => c.idCatalogItem === idCatalogItem)?.name ?? '';
    this.form.controls.category.setValue(nombre);
  }

  protected tituloAGuardar(): string {
    const titulo = this.form.controls.title.value.trim();

    if (titulo) {
      return titulo;
    }

    return this.form.controls.category.value.trim();
  }
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

  /**
   * Abre el alta cuando la pantalla lo pide, y avisa al cerrarla.
   *
   * <p>Se comprueba el permiso y el contexto igual que en el botón propio: una entrada desde fuera
   * no puede ser una puerta con menos guardas que la de dentro.</p>
   */
  private readonly abrirDesdeFuera = effect(() => {
    const pedido = this.openAdd();

    untracked(() => {
      if (pedido && !this.mode() && this.canWrite() && this.validContext() && !this.busy()) {
        // Se marca **después** de abrir: `openEditor` empieza cerrando lo que hubiera, y con la
        // bandera ya puesta ese cierre interno emitiría un aviso de algo que nadie cerró.
        this.openEditor('create');
        this.abiertoDesdeFuera = true;
      }
    });
  });

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
        this.totalChange.emit(result.totalCount);
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
        title: document.title, category: document.category,
        // El documento no guarda el tipo: se reconoce por la etiqueta con la que se guardo la
        // categoria. Si no coincide con ninguno, el selector abre vacio y obliga a elegir, que es
        // mejor que proponer un tipo que nadie escribio.
        documentType: this.documentTypes().find((tipo) => tipo.label === document.category)?.code ?? '',
        issuedDate: document.issuedDate ?? '',
        expiresDate: document.expiresDate ?? '', isSensitive: document.isSensitive, notes: document.notes ?? '',
      });
    }
  }

  protected closeEditor() {
    if (this.busy()) return;
    if (this.abiertoDesdeFuera) {
      this.abiertoDesdeFuera = false;
      this.closeAdd.emit();
    }
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
    if (this.typed() && !value.documentType) {
      this.actionError.set('Elige el tipo de documento.');
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
        ...context, title: this.tituloAGuardar(), category: value.category.trim(),
        issuedDate: value.issuedDate || null, expiresDate: value.expiresDate || null,
        isSensitive: value.isSensitive, notes: value.notes.trim() || null, status: 'PendingReview', storageReference,
      };
      return selected ? this.api.updateDocument(selected.idBusinessDocument, request) : this.api.createDocument(request);
    })), 'Documento guardado. Pendiente de revision.', (guardado) => {
      if (!this.typed() || !value.documentType) return;

      // El identificador sale de la respuesta del servidor, no del que estaba seleccionado: al
      // crear no habia ninguno, y es justo el caso en que hay que ligar el archivo nuevo.
      const idBusinessDocument = guardado?.idBusinessDocument ?? selected?.idBusinessDocument ?? '';

      if (!idBusinessDocument) return;

      this.documentSaved.emit({
        documentType: value.documentType,
        issuedDate: value.issuedDate || null,
        expiresDate: value.expiresDate || null,
        idBusinessDocument,
      });
    });
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

  /**
   * <p><c>onSuccess</c> corre <b>antes</b> de <c>closeEditor()</c> a proposito: ese metodo limpia el
   * formulario, y quien avisa hacia fuera necesita lo que se acaba de guardar.</p>
   */
  private runAction<T>(request: Observable<T>, message: string, onSuccess?: (value: T) => void) {
    this.busy.set(true);
    this.actionError.set('');
    this.message.set('');
    this.requests.add(request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (value) => {
        this.busy.set(false);
        onSuccess?.(value);
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
