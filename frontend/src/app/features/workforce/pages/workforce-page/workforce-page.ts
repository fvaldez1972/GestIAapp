import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import {
  GiCatalogCreation,
  GiConfirmDialog,
  GiDetailPanel,
  GiEmptyState,
  GiFilterBar,
  GiFilterGroup,
  GiTab,
  GiTabContent,
  GiTableState,
} from '../../../../shared/ui/gi-ui';
import { CatalogApiService } from '../../../catalogs/data-access/catalog-api.service';
import {
  EntityDocumentSaved,
  EntityDocuments,
} from '../../../documents/components/entity-documents/entity-documents';
import { EligibilityRequirement, EmployeeSkill, EmployeeSkillInput } from '../../../catalogs/data-access/catalog.models';
import { EmployeeListApiService } from '../../data-access/employee-list-api.service';
import {
  EmployeeAssignment,
  EmployeeDocumentFilter,
  EmployeeJobPositionOption,
  EmployeeListItem,
  EMPLOYEE_STATUS_OPTIONS,
  documentRequirementsNote,
  employeeDocumentBadge,
  employeeDocumentTypeOptions,
} from '../../data-access/employee-list.models';
import { WorkforceApiService } from '../../data-access/workforce-api.service';
import {
  Employee,
  EmployeeDocument,
  EmployeeDocumentInput,
  EmployeeDocumentType,
  EmployeeEvaluation,
  EmployeeEvaluationInput,
  EmployeeEvaluationResult,
  EmployeeEvaluationType,
  EmployeeStatus,
} from '../../data-access/workforce.models';
import { readServerProblem } from '../../../../shared/util/server-problem';
import { AdministrativeIncident } from '../../data-access/administrative-incident.models';
import {
  EmployeeAdministrativeIncidents,
  NewAdministrativeIncident,
} from '../../ui/employee-administrative-incidents';
import { EmployeeAssignments } from '../../ui/employee-assignments';
import { EmployeeData } from '../../ui/employee-data';
import { EmployeeDocuments } from '../../ui/employee-documents';
import {
  EmployeeEvaluationFormValue,
  EmployeeEvaluations,
} from '../../ui/employee-evaluations';
import { EmployeeForm, EmployeeFormValue } from '../../ui/employee-form';
import { EmployeeSkillFormValue, EmployeeSkills } from '../../ui/employee-skills';
import { EmployeeTable } from '../../ui/employee-table';

type PendingAction = { readonly employee: EmployeeListItem; readonly kind: 'leave' | 'terminate' };

/**
 * Personal.
 *
 * <p>Esta clase compone y carga. Los cuerpos viven en <c>ui/</c>: la tabla, la ficha por pestañas,
 * el alta y el editor de puesto. Aquí sólo se pide al servidor, se reparte y se encadena.</p>
 *
 * <p>Dos decisiones se ven desde fuera y conviene dejarlas escritas. La primera: <b>los requisitos
 * documentales son de la organización</b>, salen de su catálogo de elegibilidad y la pantalla lo
 * dice con todas sus letras, porque «4 requisitos» sin autor se lee como una regla del sistema que
 * nadie sabe dónde cambiar. La segunda: <b>«Asignar a una posición» lleva a Planeación sin
 * preseleccionar nada</b>, porque esa pantalla no lee ningún parámetro; mandarle uno que ignora
 * sería repetir el defecto que ya se corrigió en el enlace de Clientes a Servicios.</p>
 */
@Component({
  selector: 'app-workforce-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmployeeAssignments,
    EmployeeData,
    EmployeeDocuments,
    EmployeeAdministrativeIncidents,
    EmployeeEvaluations,
    EmployeeForm,
    EmployeeSkills,
    EmployeeTable,
    EntityDocuments,
    GiConfirmDialog,
    GiDetailPanel,
    GiEmptyState,
    GiFilterBar,
    GiTabContent,
  ],
  templateUrl: './workforce-page.html',
  styleUrl: './workforce-page.scss',
})
export class WorkforcePage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(EmployeeListApiService);
  private readonly workforceApi = inject(WorkforceApiService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly systemInfo = inject(SystemInfoService);
  private readonly router = inject(Router);

  /** La organización se hereda de la barra de contexto. Esta pantalla no tiene selector propio. */
  protected readonly organizationId = this.auth.operationalOrganizationId;
  protected readonly canRead = computed(() => this.auth.hasPermission('WORKFORCE.READ'));
  protected readonly canWrite = computed(() => this.auth.hasPermission('WORKFORCE.WRITE'));
  protected readonly canViewSensitive = computed(() => this.auth.hasPermission('PLATFORM.ADMIN'));

  /** El día operativo del servidor. La vigencia no se mide con el reloj del navegador. */
  protected readonly today = this.systemInfo.operationDate;

  protected readonly employees = signal<readonly EmployeeListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly expiringWithinDays = signal(30);
  protected readonly requiredDocuments = signal(0);

  /**
   * Cuántos documentos tiene la persona abierta.
   *
   * <p><b>Nace del listado y lo corrige la pestaña.</b> Antes sólo lo ponía la pestaña, al
   * cargarse; como el expediente vive dentro de un `ng-template` que el panel no instancia hasta
   * que alguien pulsa «Documentos», el número decía <b>0</b> mientras la lista de abajo enseñaba
   * documentos. Había que abrir la pestaña para saber lo que la pestaña servía para no abrir.</p>
   *
   * <p>Peor todavía: al pasar de una persona a otra no se reiniciaba, así que la segunda heredaba
   * el número de la primera. Un número equivocado es peor que un cero, porque no se nota.</p>
   *
   * <p>La pestaña sigue emitiendo el suyo, y por eso el contador se mueve en el acto al agregar o
   * archivar un documento, sin esperar a que la lista se recargue.</p>
   */
  protected readonly documentCount = signal(0);

  /**
   * El tipo de requisito que se está cargando desde su propia fila. Vacío si nadie pidió cargar.
   *
   * <p>Es lo que ata la fila del requisito con el alta de abajo: la fila ya nombra el tipo, así que
   * el alta se abre con él puesto en lugar de pedirlo otra vez.</p>
   */
  protected readonly cargandoRequisito = signal('');

  /**
   * Abre el alta con el tipo del requisito que falta.
   *
   * <p>Antes «Sin cargar» era una etiqueta sin salida: la pantalla decía qué faltaba y obligaba a
   * bajar al expediente y volver a buscar el tipo a mano.</p>
   */
  protected cargarRequisito(documentType: string): void {
    if (!this.canWrite()) {
      return;
    }

    // La pestaña de Documentos es la que tiene el alta debajo, así que hay que estar en ella. Si
    // alguien llega desde otra pestaña, se abre la correcta en lugar de no hacer nada.
    this.activeTab.set('documents');
    this.cargandoRequisito.set(documentType);
  }

  protected readonly search = signal('');
  protected readonly status = signal<EmployeeStatus | ''>('');
  protected readonly jobPosition = signal('');
  protected readonly documentFilter = signal<EmployeeDocumentFilter>('Any');
  protected readonly municipality = signal('');

  protected readonly usedJobPositions = signal<readonly EmployeeJobPositionOption[]>([]);
  protected readonly municipalities = signal<readonly string[]>([]);
  /** Todos los puestos activos del catálogo: los del alta y los del editor de la ficha. */
  protected readonly catalogJobPositions = signal<readonly EmployeeJobPositionOption[]>([]);
  protected readonly requirements = signal<readonly EligibilityRequirement[]>([]);

  /**
   * Las evaluaciones que exige la organización.
   *
   * <p>Van en su propia señal y no mezcladas con las documentales: son dos catálogos de requisitos
   * distintos, cada pestaña lee el suyo, y confundirlos haría que una pestaña listara requisitos
   * que no le toca cubrir.</p>
   */
  protected readonly evaluationRequirements = signal<readonly EligibilityRequirement[]>([]);

  /** Las experiencias que exige la organización, y el catálogo del que salen. */
  protected readonly skillRequirements = signal<readonly EligibilityRequirement[]>([]);
  protected readonly catalogSkills = signal<readonly EmployeeJobPositionOption[]>([]);

  /**
   * Los tipos que ofrece el alta de documento, con los que esta organización exige al principio.
   *
   * <p>Se derivan de los requisitos ya cargados, así que una regla nueva aparece marcada sin tocar
   * esta pantalla.</p>
   */
  protected readonly documentTypeOptions = computed(
    () => employeeDocumentTypeOptions(this.requirements(), this.catalogDocumentCategories()),
  );

  /** Las categorias de documento y de evaluacion del catalogo de la organizacion. */
  protected readonly catalogDocumentCategories = signal<readonly EmployeeJobPositionOption[]>([]);
  protected readonly catalogIncidentTypes = signal<readonly EmployeeJobPositionOption[]>([]);
  protected readonly administrativeIncidents = signal<readonly AdministrativeIncident[]>([]);
  protected readonly catalogEvaluationCategories = signal<readonly EmployeeJobPositionOption[]>([]);

  /** Los niveles de escolaridad, para ver y capturar hasta dónde estudió cada persona. */
  protected readonly catalogEducationLevels = signal<readonly EmployeeJobPositionOption[]>([]);

  protected readonly selected = signal<EmployeeListItem | null>(null);
  protected readonly activeTab = signal('data');
  protected readonly detail = signal<Employee | null>(null);
  protected readonly documents = signal<readonly EmployeeDocument[]>([]);
  protected readonly evaluations = signal<readonly EmployeeEvaluation[]>([]);
  protected readonly skills = signal<readonly EmployeeSkill[]>([]);
  protected readonly assignments = signal<readonly EmployeeAssignment[]>([]);
  protected readonly detailLoading = signal(false);

  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly formProblem = signal('');

  protected readonly editingJobPosition = signal(false);
  protected readonly savingJobPosition = signal(false);
  protected readonly jobPositionProblem = signal('');

  protected readonly confirming = signal<PendingAction | null>(null);

  protected readonly badge = employeeDocumentBadge;

  /**
   * El subtítulo lleva siempre la regla, no sólo el conteo.
   *
   * <p>El umbral se <b>escribe</b> aquí porque en el listado sólo aparecía dentro de una opción de
   * un selector cerrado, y una regla que hay que abrir un desplegable para leer no está en la
   * pantalla. Y se dice de quién son los requisitos, porque «4 requisitos» sin autor se lee como
   * una regla del sistema que nadie sabe dónde cambiar.</p>
   */
  protected readonly subtitle = computed(() => {
    const total = this.total();
    const requisitos = this.requiredDocuments();

    if (!requisitos) {
      return total
        ? `${total} ${total === 1 ? 'persona' : 'personas'}. ` +
            documentRequirementsNote(requisitos, this.expiringWithinDays())
        : documentRequirementsNote(requisitos, this.expiringWithinDays());
    }

    const base = `${total} ${total === 1 ? 'persona' : 'personas'}.`;
    const regla =
      `${requisitos} ${requisitos === 1 ? 'requisito documental definido' : 'requisitos documentales definidos'} ` +
      `por esta organización; se considera «por vencer» lo que caduca en ${this.expiringWithinDays()} ` +
      'días o menos.';

    const conVencidos = this.employees().filter((employee) => employee.expiredDocuments > 0).length;
    const vencidos =
      conVencidos > 0
        ? ` ${conVencidos} ${conVencidos === 1 ? 'tiene' : 'tienen'} algún documento vencido.`
        : '';

    return `${base} ${regla}${vencidos}`;
  });

  protected readonly tableState = computed<GiTableState>(() => {
    if (this.error()) return 'error';
    if (this.loading()) return 'loading';
    if (this.employees().length) return 'ready';
    return this.hasFilters() ? 'empty-filtered' : 'empty';
  });

  protected readonly hasFilters = computed(
    () =>
      !!this.search().trim() ||
      !!this.status() ||
      !!this.jobPosition() ||
      this.documentFilter() !== 'Any' ||
      !!this.municipality(),
  );

  /**
   * Los filtros del panel plegable.
   *
   * <p>Cada grupo se ofrece <b>sólo cuando hay más de una opción real</b>. Un selector con una sola
   * posibilidad ocupa el sitio de uno que sí puede cambiar algo, y el sistema lo rechaza en
   * desarrollo. Por eso puesto y municipio salen de la organización entera y no de la página.</p>
   */
  protected readonly filterGroups = computed<readonly GiFilterGroup[]>(() => {
    const groups: GiFilterGroup[] = [
      {
        id: 'status',
        label: 'Estado de la persona',
        value: this.status(),
        allLabel: 'Todos',
        options: EMPLOYEE_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
      },
      {
        id: 'documents',
        label: 'Vigencia documental',
        value: this.documentFilter() === 'Any' ? '' : this.documentFilter(),
        allLabel: 'Cualquiera',
        options: [
          { value: 'Expired', label: 'Con algún vencido' },
          { value: 'Expiring', label: `Por vencer en ${this.expiringWithinDays()} días` },
          { value: 'Missing', label: 'Con requisitos sin cargar' },
          { value: 'UpToDate', label: 'Al día' },
        ],
      },
    ];

    if (this.usedJobPositions().length > 1) {
      groups.push({
        id: 'job',
        label: 'Puesto',
        value: this.jobPosition(),
        allLabel: 'Todos',
        options: this.usedJobPositions().map((option) => ({
          value: option.idCatalogItem,
          label: option.name,
        })),
      });
    }

    if (this.municipalities().length > 1) {
      groups.push({
        id: 'municipality',
        label: 'Municipio',
        value: this.municipality(),
        allLabel: 'Todos',
        options: this.municipalities().map((name) => ({ value: name, label: name })),
      });
    }

    return groups;
  });

  protected readonly panelTabs = computed<readonly GiTab[]>(() => {
    const employee = this.selected();

    return [
      { id: 'data', label: 'Datos' },
      // El número dice cuántos documentos tiene la persona. Antes decía `requiredDocuments`, que
      // son los tipos que la organización exige: la pestaña marcaba «Documentos 0» con cinco
      // documentos listados debajo, porque esa organización no exige ninguno. Dos cosas distintas
      // compartiendo un rótulo.
      { id: 'documents', label: 'Documentos', count: this.documentCount() },
      // El conteo son las evaluaciones registradas, no las exigidas: es el mismo error que la
      // pestaña de Documentos ya cometió una vez, diciendo «0» con registros listados debajo.
      { id: 'evaluations', label: 'Evaluaciones', count: this.evaluations().filter((item) => item.active).length },
      { id: 'skills', label: 'Experiencia', count: this.skills().filter((item) => item.active).length },
      // Las administrativas, que no son las de la operación diaria. El conteo son las vigentes: una
      // retirada sigue en el expediente pero ya no cuenta para nada.
      {
        id: 'administrative-incidents',
        label: 'Incidencias',
        count: this.administrativeIncidents().filter((item) => item.active).length,
      },
      { id: 'assignments', label: 'Asignaciones', count: employee?.assignmentCount ?? 0 },
    ];
  });

  /** El aviso del pie: un hecho, no una promesa sobre lo que el servidor va a impedir. */
  protected readonly expiredNote = computed(() => {
    const employee = this.selected();

    if (!employee || employee.expiredDocuments === 0) {
      return '';
    }

    return employee.expiredDocuments === 1
      ? 'Tiene un documento vencido de los que exige esta organización.'
      : `Tiene ${employee.expiredDocuments} documentos vencidos de los que exige esta organización.`;
  });

  constructor() {
    /**
     * Recargar cuando cambia la organizacion, y <b>solo</b> por eso.
     *
     * <p>Un efecto se suscribe a todas las señales que se leen mientras corre, incluidas las que
     * lee el metodo al que llama. <c>load()</c> consulta la busqueda y los cuatro filtros, asi que
     * el efecto acababa dependiendo de los cinco: escribir una letra en el buscador llamaba a
     * <c>load()</c> desde <c>onSearch</c> y otra vez desde aqui, dos peticiones por tecla.</p>
     *
     * <p>Es el mismo defecto que dejaba la pantalla de Clientes parpadeando. Aqui no llegaba a
     * ciclo infinito —ninguna de esas cinco señales se escribe al cargar—, pero es la misma
     * causa.</p>
     */
    effect(() => {
      const organizationId = this.organizationId();
      const puedeLeer = this.canRead();

      untracked(() => {
        if (organizationId && puedeLeer) {
          this.load();
          this.loadOptions(organizationId);
        } else {
          this.employees.set([]);
        }
      });
    });
  }

  // ── Listado ──────────────────────────────────────────────────────────────────────────────

  protected onSearch(value: string): void {
    this.search.set(value);
    this.load();
  }

  protected onFilter(change: { groupId: string; value: string }): void {
    switch (change.groupId) {
      case 'status':
        this.status.set(change.value as EmployeeStatus | '');
        break;
      case 'documents':
        this.documentFilter.set((change.value || 'Any') as EmployeeDocumentFilter);
        break;
      case 'job':
        this.jobPosition.set(change.value);
        break;
      default:
        this.municipality.set(change.value);
        break;
    }

    this.load();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set('');
    this.jobPosition.set('');
    this.documentFilter.set('Any');
    this.municipality.set('');
    this.load();
  }

  protected load(): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canRead()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api
      .searchEmployees({
        organizationId,
        search: this.search(),
        status: this.status(),
        idJobPositionCatalogItem: this.jobPosition(),
        documents: this.documentFilter(),
        municipality: this.municipality(),
        pageSize: 25,
      })
      .subscribe({
        next: (result) => {
          this.employees.set(result.page.items);
          this.total.set(result.page.totalCount);
          this.expiringWithinDays.set(result.expiringWithinDays);
          this.requiredDocuments.set(result.requiredDocuments);
          this.loading.set(false);
          this.refreshSelection(result.page.items);
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de personal.');
          this.loading.set(false);
        },
      });
  }

  /** Las opciones de los filtros, los puestos del catálogo y los requisitos, de una vez. */
  private loadOptions(organizationId: string): void {
    forkJoin({
      filters: this.api
        .listFilterOptions(organizationId)
        .pipe(catchError(() => of({ jobPositions: [], municipalities: [] }))),
      items: this.catalogApi.listItems(organizationId).pipe(catchError(() => of([]))),
      requirements: this.catalogApi.listEligibilityRequirements(organizationId).pipe(catchError(() => of([]))),
    }).subscribe((data) => {
      this.usedJobPositions.set(data.filters.jobPositions);
      this.municipalities.set(data.filters.municipalities);

      this.catalogJobPositions.set(
        data.items
          .filter((item) => item.active && item.type === 'JobPosition')
          .map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
      );

      // Sólo los de la organización: los de un cliente, un servicio o una posición se exigen en
      // ese contexto, no en el expediente de la persona.
      const deLaOrganizacion = data.requirements.filter(
        (item) => item.active && item.targetType === 'Organization',
      );

      this.requirements.set(deLaOrganizacion.filter((item) => item.requirementType === 'Document'));
      this.evaluationRequirements.set(
        deLaOrganizacion.filter((item) => item.requirementType === 'Evaluation'),
      );
      this.skillRequirements.set(deLaOrganizacion.filter((item) => item.requirementType === 'Skill'));

      this.catalogSkills.set(
        data.items
          .filter((item) => item.active && item.type === 'Skill')
          .map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
      );

      this.catalogDocumentCategories.set(
        data.items
          .filter((item) => item.active && item.type === 'EmployeeDocumentCategory')
          .map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
      );
      this.catalogIncidentTypes.set(
        data.items
          .filter((item) => item.active && item.type === 'AdministrativeIncidentType')
          .map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
      );
      this.catalogEducationLevels.set(
        data.items
          .filter((item) => item.active && item.type === 'EducationLevel')
          .map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
      );
      this.catalogEvaluationCategories.set(
        data.items
          .filter((item) => item.active && item.type === 'EmployeeEvaluationCategory')
          .map((item) => ({ idCatalogItem: item.idCatalogItem, name: item.name })),
      );
    });
  }

  /** Tras recargar, la ficha abierta sigue al dato nuevo y no al de antes. */
  private refreshSelection(items: readonly EmployeeListItem[]): void {
    const selected = this.selected();

    if (selected) {
      this.selected.set(items.find((item) => item.idEmployee === selected.idEmployee) ?? selected);
    }
  }

  // ── Ficha ────────────────────────────────────────────────────────────────────────────────

  protected open(employee: EmployeeListItem, tab = 'data'): void {
    this.creating.set(false);
    this.editingJobPosition.set(false);
    this.jobPositionProblem.set('');
    this.selected.set(employee);
    this.activeTab.set(tab);
    this.detail.set(null);
    this.documents.set([]);
    this.evaluations.set([]);
    this.skills.set([]);
    this.administrativeIncidents.set([]);
    this.documentCount.set(employee.documentCount);
    this.assignments.set([]);
    this.loadDetail(employee.idEmployee);
  }

  protected closePanel(): void {
    this.selected.set(null);
    this.creating.set(false);
    this.editingJobPosition.set(false);
  }

  private loadDetail(idEmployee: string): void {
    const organizationId = this.organizationId();

    if (!organizationId) {
      return;
    }

    this.detailLoading.set(true);

    forkJoin({
      detail: this.workforceApi
        .getEmployee(organizationId, idEmployee)
        .pipe(catchError(() => of(null))),
      assignments: this.api
        .listAssignments(organizationId, idEmployee)
        .pipe(catchError(() => of([] as readonly EmployeeAssignment[]))),
      // Las experiencias no vienen en el detalle del empleado: son del módulo de catálogos y se
      // piden aparte. Si fallan, la pestaña dice que no hay ninguna, no que no se pudieron leer.
      skills: this.catalogApi
        .listEmployeeSkills(organizationId, idEmployee)
        .pipe(catchError(() => of([] as readonly EmployeeSkill[]))),
      // Igual que las experiencias: si fallan, la pestaña dice que no hay ninguna en vez de dejar
      // la ficha entera sin abrir por una pestaña que quizá nadie mire.
      administrativeIncidents: this.workforceApi
        .listAdministrativeIncidents(organizationId, idEmployee)
        .pipe(catchError(() => of([] as readonly AdministrativeIncident[]))),
    }).subscribe((data) => {
      this.detail.set(data.detail?.employee ?? null);
      this.documents.set(data.detail?.documents ?? []);
      this.evaluations.set(data.detail?.evaluations ?? []);
      this.skills.set(data.skills);
      this.administrativeIncidents.set(data.administrativeIncidents);
      this.assignments.set(data.assignments);
      this.detailLoading.set(false);
    });
  }

  // ── Incidencias administrativas ──────────────────────────────────────────────────────────

  protected createAdministrativeIncident(datos: NewAdministrativeIncident): void {
    this.writeAdministrativeIncident(datos, null);
  }

  protected updateAdministrativeIncident(
    event: { incident: AdministrativeIncident; datos: NewAdministrativeIncident },
  ): void {
    this.writeAdministrativeIncident(event.datos, event.incident.idAdministrativeIncident);
  }

  /**
   * El alta y la edición, que sólo se distinguen en el verbo.
   *
   * <p>Se escribe una vez porque todo lo demás —la validación previa, el estado de guardado, el
   * error y la recarga— es idéntico, y duplicarlo haría que un arreglo se aplicara a uno solo.</p>
   */
  private writeAdministrativeIncident(
    datos: NewAdministrativeIncident,
    idAdministrativeIncident: string | null,
  ): void {
    const organizationId = this.organizationId();
    const employee = this.detail();

    if (!organizationId || !employee || !this.canWrite() || this.saving()) {
      return;
    }

    const request = {
      idOrganization: organizationId,
      idEmployee: employee.idEmployee,
      idIncidentTypeCatalogItem: datos.idIncidentTypeCatalogItem,
      occurredDate: datos.occurredDate,
      details: datos.details,
    };

    this.saving.set(true);

    const call = idAdministrativeIncident
      ? this.workforceApi.updateAdministrativeIncident(
          employee.idEmployee, idAdministrativeIncident, request)
      : this.workforceApi.createAdministrativeIncident(employee.idEmployee, request);

    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.loadDetail(employee.idEmployee);
      },
      error: (problem) => {
        this.saving.set(false);
        this.error.set(
          readServerProblem(problem, 'No se pudo guardar la incidencia administrativa.').message);
      },
    });
  }

  protected retireAdministrativeIncident(idAdministrativeIncident: string): void {
    const organizationId = this.organizationId();
    const employee = this.detail();

    if (!organizationId || !employee || !this.canWrite() || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.workforceApi
      .deactivateAdministrativeIncident(organizationId, employee.idEmployee, idAdministrativeIncident)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.loadDetail(employee.idEmployee);
        },
        error: (problem) => {
          this.saving.set(false);
          this.error.set(
            readServerProblem(problem, 'No se pudo retirar la incidencia administrativa.').message);
        },
      });
  }

  protected createIncidentType(creation: GiCatalogCreation): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canWrite()) {
      return;
    }

    this.catalogApi
      .createItem({
        idOrganization: organizationId,
        type: 'AdministrativeIncidentType',
        name: creation.name,
        description: null,
      })
      .subscribe({
        next: (creado) =>
          this.catalogIncidentTypes.update((valores) => [
            ...valores,
            { idCatalogItem: creado.idCatalogItem, name: creado.name },
          ]),
        error: (problem) =>
          this.error.set(
            readServerProblem(problem, 'No se pudo agregar el tipo de incidencia.').message),
      });
  }

  // ── El documento subido, que tiene que contar como requisito cubierto ─────────────────────

  /**
   * Registra en el expediente el documento que se acaba de subir.
   *
   * <p><b>Por qué hacen falta dos escrituras.</b> La pieza compartida guarda un
   * <c>BusinessDocument</c>: el archivo, con su historial y su revisión. Pero la vigencia
   * documental y la elegibilidad para cubrir un turno se calculan sobre <c>EmployeeDocument</c>,
   * que es otra tabla. Hasta ahora subir un archivo no movía la bandera porque nadie escribía la
   * segunda fila, y no era un problema de refresco: la pantalla escribía donde el indicador no
   * lee.</p>
   *
   * <p><b>El estado es <c>Received</c> y no es un detalle.</b> El servidor sólo acepta como
   * cubierto un documento en <c>Received</c> o <c>Validated</c>; con cualquier otro la persona
   * sigue sin ser elegible y el archivo subido no serviría de nada.</p>
   *
   * <p><b>Se actualiza en lugar de agregar</b> cuando ya hay una fila activa del mismo tipo. Dos
   * filas del mismo requisito harían que la pestaña dijera dos cosas del mismo documento, y el
   * cruce se queda con la primera que encuentra.</p>
   *
   * <p><b>PENDIENTE.</b> La fila no apunta al archivo: falta la columna <c>IdBusinessDocument</c>
   * en <c>EmployeeDocuments</c>, nulable y aditiva, agendada para después de la demo del 17 de
   * septiembre de 2026. Mientras no exista, el archivo se consulta en la lista de abajo, que está
   * en esta misma pestaña. No se usa <c>StorageReference</c> para eso porque esa columna la sirve
   * una ruta heredada del prototipo y guardar ahí un identificador le daría un significado que no
   * tiene.</p>
   */
  protected registerEmployeeDocument(saved: EntityDocumentSaved): void {
    const organizationId = this.organizationId();
    const employee = this.detail();

    if (!organizationId || !employee || !this.canWrite()) {
      return;
    }

    // `saved.documentType` trae el identificador de la categoría del catálogo desde la conversión
    // del 19 de septiembre de 2026, no el nombre de un miembro del enum.
    const existente = this.documents().find(
      (documento) => documento.active && documento.idDocumentCategoryCatalogItem === saved.documentType,
    );

    const request: EmployeeDocumentInput = {
      idOrganization: organizationId,
      idEmployee: employee.idEmployee,
      idDocumentCategoryCatalogItem: saved.documentType,
      // El requisito que se cubre desde la pestaña no se marca sensible: la clasificación se decide
      // al revisar el papel, no al subirlo, y suponerla aquí sería inventar un dato.
      isSensitive: false,
      // El enum heredado deja de clasificar: la categoría de verdad viaja arriba. Se manda «Otro»
      // porque es lo único cierto que se puede decir de una lista que la organización ya amplía.
      documentType: 'Other' as EmployeeDocumentType,
      status: 'Received',
      documentNumber: existente?.documentNumber ?? null,
      receivedDate: this.today(),
      issuedDate: saved.issuedDate,
      expiresDate: saved.expiresDate,
      storageReference: null,
      // El archivo que acaba de subirse. Antes esta fila no apuntaba a ningun archivo y desde el
      // requisito no se podia llegar a el; la columna se agrego para eso.
      idBusinessDocument: saved.idBusinessDocument,
      notes: existente?.notes ?? null,
    };

    const peticion = existente
      ? this.workforceApi.updateDocument(employee.idEmployee, existente.idEmployeeDocument, request)
      : this.workforceApi.createDocument(employee.idEmployee, request);

    peticion.subscribe({
      next: () => {
        // Las dos recargas tienen destinatario distinto: el detalle mueve la bandera de la ficha,
        // la lista mueve la insignia de la tabla.
        this.loadDetail(employee.idEmployee);
        this.load();
      },
      error: () =>
        this.error.set(
          'El archivo se guardó, pero no se pudo registrar como requisito del expediente. '
          + 'Vuelve a guardarlo para que cuente en la vigencia.',
        ),
    });
  }


  // ── Las evaluaciones del expediente ───────────────────────────────────────────────────────

  /**
   * Guarda una evaluación, nueva o corregida.
   *
   * <p><b>Por qué esta pantalla no existía.</b> Las cuatro rutas y los tres métodos del cliente
   * llevaban semanas escritos sin que nadie los llamara, y mientras tanto una organización con una
   * regla de evaluación bloqueante no podía asignar a nadie desde el portal. Era el mismo patrón de
   * los documentos y de las experiencias: el servidor listo y la interfaz sin conectar.</p>
   *
   * <p><b>El resultado no se toca aquí.</b> Se guarda tal como lo capturó quien evaluó, y es el
   * servidor el que decide si cubre el requisito —sólo <c>Approved</c> y
   * <c>ApprovedWithObservations</c> cuentan—. Traducirlo en el camino sería decidir dos veces la
   * misma regla, en dos sitios, con la posibilidad de que dejen de coincidir.</p>
   */
  protected saveEvaluation(valor: EmployeeEvaluationFormValue): void {
    const organizationId = this.organizationId();
    const employee = this.detail();

    if (!organizationId || !employee || !this.canWrite() || this.saving()) {
      return;
    }

    const request: EmployeeEvaluationInput = {
      idOrganization: organizationId,
      idEmployee: employee.idEmployee,
      idEvaluationCategoryCatalogItem: valor.evaluationType,
      evaluationType: 'Other' as EmployeeEvaluationType,
      result: valor.result as EmployeeEvaluationResult,
      evaluatedDate: valor.evaluatedDate,
      expiresDate: valor.expiresDate,
      certificateNumber: valor.certificateNumber,
      // El archivo del certificado no se sube desde aquí: la ruta de descarga del expediente es
      // heredada del prototipo y no hay una de carga. Queda anotado con la columna pendiente.
      storageReference: null,
      notes: valor.notes,
    };

    this.saving.set(true);
    this.error.set('');

    const peticion = valor.idEmployeeEvaluation
      ? this.workforceApi.updateEvaluation(employee.idEmployee, valor.idEmployeeEvaluation, request)
      : this.workforceApi.createEvaluation(employee.idEmployee, request);

    peticion.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(
          valor.idEmployeeEvaluation
            ? 'Evaluación actualizada.'
            : 'Evaluación registrada en el expediente.',
        );
        this.loadDetail(employee.idEmployee);
        this.load();
      },
      error: (problem: unknown) => {
        this.saving.set(false);
        this.error.set(
          problem instanceof HttpErrorResponse && problem.status === 403
            ? 'No tienes permiso para registrar evaluaciones.'
            : 'No se pudo guardar la evaluación.',
        );
      },
    });
  }

  /** Desactiva, nunca borra: una evaluación registrada es historia del expediente. */
  protected deactivateEvaluation(idEmployeeEvaluation: string): void {
    const organizationId = this.organizationId();
    const employee = this.detail();

    if (!organizationId || !employee || !this.canWrite() || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.workforceApi
      .deactivateEvaluation(organizationId, employee.idEmployee, idEmployeeEvaluation)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Evaluación retirada del expediente.');
          this.loadDetail(employee.idEmployee);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('No se pudo retirar la evaluación.');
        },
      });
  }


  // ── Las experiencias del expediente ────────────────────────────────────────────────────────

  /**
   * Acredita una experiencia, o corrige una ya acreditada.
   *
   * <p><b>Esto cierra la trampa</b>: hasta ahora una regla de elegibilidad de tipo experiencia se
   * podía crear y no se podía cumplir, porque ninguna pantalla otorgaba experiencias. Quien caía en
   * ella sólo podía salir desactivando la regla.</p>
   *
   * <p>La experiencia va <b>por identificador de catálogo</b>, como la exige la regla. Al editar no
   * se cambia cuál es: se retira la que estaba y se acredita la otra, porque cambiarla en su sitio
   * convertiría el historial de una experiencia en el de otra.</p>
   */
  protected saveSkill(valor: EmployeeSkillFormValue): void {
    const organizationId = this.organizationId();
    const employee = this.detail();

    if (!organizationId || !employee || !this.canWrite() || this.saving()) {
      return;
    }

    const request: EmployeeSkillInput = {
      idOrganization: organizationId,
      idEmployee: employee.idEmployee,
      idSkillCatalogItem: valor.idSkillCatalogItem,
      acquiredDate: valor.acquiredDate,
      expiresDate: valor.expiresDate,
      notes: valor.notes,
    };

    this.saving.set(true);
    this.error.set('');

    const peticion = valor.idEmployeeSkill
      ? this.catalogApi.updateEmployeeSkill(employee.idEmployee, valor.idEmployeeSkill, request)
      : this.catalogApi.createEmployeeSkill(employee.idEmployee, request);

    peticion.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(
          valor.idEmployeeSkill ? 'Experiencia actualizada.' : 'Experiencia acreditada en el expediente.',
        );
        this.loadDetail(employee.idEmployee);
      },
      error: (problem: unknown) => {
        this.saving.set(false);
        this.error.set(
          problem instanceof HttpErrorResponse && problem.status === 409
            ? 'Esa experiencia ya está acreditada en este expediente.'
            : 'No se pudo guardar la experiencia.',
        );
      },
    });
  }

  /** Desactiva, nunca borra: lo acreditado en su día es historia del expediente. */
  protected deactivateSkill(idEmployeeSkill: string): void {
    const organizationId = this.organizationId();
    const employee = this.detail();

    if (!organizationId || !employee || !this.canWrite() || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.catalogApi
      .deactivateEmployeeSkill(organizationId, employee.idEmployee, idEmployeeSkill)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Experiencia retirada del expediente.');
          this.loadDetail(employee.idEmployee);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('No se pudo retirar la experiencia.');
        },
      });
  }

  /** Alta al vuelo de una experiencia del catálogo, sin salir del expediente. */
  protected createSkillCatalogItem(creation: GiCatalogCreation): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.auth.hasPermission('CATALOGS.WRITE')) {
      this.error.set('No tienes permiso para crear valores de catálogo.');
      return;
    }

    this.catalogApi
      .createItem({ idOrganization: organizationId, type: 'Skill', name: creation.name, description: null })
      .subscribe({
        next: (creado) => {
          this.catalogSkills.update((valores) => [
            ...valores,
            { idCatalogItem: creado.idCatalogItem, name: creado.name },
          ]);
          this.message.set(`«${creado.name}» se agregó al catálogo de experiencias.`);
        },
        error: () => this.error.set('No se pudo crear la experiencia en el catálogo.'),
      });
  }

  // ── El puesto del catálogo, que es la salida de la franja ─────────────────────────────────

  protected startJobPositionEdit(): void {
    this.jobPositionProblem.set('');
    this.editingJobPosition.set(true);
    this.activeTab.set('data');
  }

  /**
   * Guarda el puesto.
   *
   * <p>Viajan el identificador y el nombre: el servidor guarda el primero, que es con el que se
   * compara la elegibilidad, y valida el segundo contra el catálogo de puestos.</p>
   */
  /**
   * Crear un puesto que no estaba en el catálogo, sin salir del alta.
   *
   * <p><b>Lo crea la pantalla y no el formulario</b> porque es una escritura a otro módulo: hay que
   * recargar el catálogo y decir qué pasó. Al volver, el puesto queda elegido, que es lo que el
   * usuario pidió al escribirlo.</p>
   *
   * <p>El 409 de nombre repetido no se pinta como error: significa que alguien más lo creó entre
   * medias, y lo que corresponde es usar el que ya está.</p>
   */
  protected createJobPosition(creation: GiCatalogCreation): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canWrite()) {
      return;
    }

    this.catalogApi
      .createItem({
        idOrganization: organizationId,
        type: 'JobPosition',
        name: creation.name,
        description: null,
      })
      .subscribe({
        next: (creado) => {
          this.catalogJobPositions.update((valores) => [
            ...valores,
            { idCatalogItem: creado.idCatalogItem, name: creado.name },
          ]);
          this.message.set(`«${creado.name}» quedó en el catálogo de puestos y se puede reutilizar.`);
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(
            typeof error.error === 'object' && error.error !== null
              ? String((error.error as Record<string, unknown>)['detail'] ?? 'No se pudo agregar el puesto al catálogo.')
              : 'No se pudo agregar el puesto al catálogo.',
          ),
      });
  }

  protected readonly savingEducation = signal(false);

  /**
   * Guarda hasta dónde estudió la persona.
   *
   * <p>Manda el expediente entero con un campo cambiado, igual que el editor del puesto: la
   * edición del personal es un solo reemplazo de perfil, y mandar sólo el campo tocado lo dejaría
   * todo lo demás en nulo. Vacío se guarda como nulo, que significa «no se sabe» y no bloquea.</p>
   */
  protected saveEducation(idCatalogItem: string | null): void {
    const organizationId = this.organizationId();
    const employee = this.detail();

    if (!organizationId || !employee || !this.canWrite()) {
      return;
    }

    this.savingEducation.set(true);

    this.workforceApi
      .updateEmployee(employee.idEmployee, {
        ...this.perfilDe(employee, organizationId),
        idEducationLevelCatalogItem: idCatalogItem,
      })
      .subscribe({
        next: () => {
          this.savingEducation.set(false);
          const nivel = this.catalogEducationLevels().find(
            (item) => item.idCatalogItem === idCatalogItem,
          );
          this.message.set(
            nivel
              ? `${employee.fullName} queda con escolaridad ${nivel.name}.`
              : `${employee.fullName} queda sin escolaridad registrada.`,
          );
          this.loadDetail(employee.idEmployee);
        },
        error: (problem) => {
          this.savingEducation.set(false);
          this.error.set(
            problem?.error?.detail ?? 'No se pudo guardar la escolaridad.',
          );
        },
      });
  }

  /**
   * El expediente tal como el servidor lo quiere para una edición.
   *
   * <p>Existe porque la ficha edita campo a campo y el servidor reemplaza el perfil completo:
   * cada editor tiene que mandar todo lo demás igual que estaba. Cuando esto se repetía escrito a
   * mano, un campo nuevo se olvidaba en uno de los editores y se guardaba en nulo sin que nadie
   * lo notara.</p>
   */
  private perfilDe(employee: Employee, organizationId: string) {
    return {
      idOrganization: organizationId,
      fullName: employee.fullName,
      jobTitle: employee.jobTitle,
      idJobPositionCatalogItem: employee.idJobPositionCatalogItem,
      idEducationLevelCatalogItem: employee.idEducationLevelCatalogItem,
      hireDate: employee.hireDate,
      birthDate: employee.birthDate,
      birthPlace: employee.birthPlace,
      sex: employee.sex,
      maritalStatus: employee.maritalStatus,
      rfc: employee.rfc,
      curp: employee.curp,
      socialSecurityNumber: employee.socialSecurityNumber,
      voterIdNumber: employee.voterIdNumber,
      driverLicenseNumber: employee.driverLicenseNumber,
      militaryServiceCardNumber: employee.militaryServiceCardNumber,
      email: employee.email,
      mobilePhone: employee.mobilePhone,
      homePhone: employee.homePhone,
      emergencyContactName: employee.emergencyContactName,
      emergencyContactPhone: employee.emergencyContactPhone,
      emergencyContactRelationship: employee.emergencyContactRelationship,
      address: employee.address,
      street: employee.street,
      streetNumber: employee.streetNumber,
      neighborhood: employee.neighborhood,
      municipality: employee.municipality,
      state: employee.state,
      countryCode: employee.countryCode ?? null,
      postalCode: employee.postalCode,
      housingType: employee.housingType,
      residenceSinceDate: employee.residenceSinceDate,
    };
  }

  protected saveJobPosition(idCatalogItem: string): void {
    const organizationId = this.organizationId();
    const employee = this.detail();
    const chosen = this.catalogJobPositions().find((item) => item.idCatalogItem === idCatalogItem);

    if (!organizationId || !employee || !chosen || !this.canWrite()) {
      return;
    }

    this.savingJobPosition.set(true);
    this.jobPositionProblem.set('');

    this.workforceApi
      .updateEmployee(employee.idEmployee, {
        ...this.perfilDe(employee, organizationId),
        jobTitle: chosen.name,
        idJobPositionCatalogItem: chosen.idCatalogItem,
      })
      .subscribe({
        next: () => {
          this.savingJobPosition.set(false);
          this.editingJobPosition.set(false);
          this.message.set(`${employee.fullName} quedó con el puesto ${chosen.name}.`);
          this.load();
          this.loadDetail(employee.idEmployee);
        },
        error: (problem) => {
          this.savingJobPosition.set(false);
          this.jobPositionProblem.set(
            problem?.error?.detail ?? 'No se pudo guardar el puesto. Revisa que siga activo en el catálogo.',
          );
        },
      });
  }

  // ── Acciones de fila ─────────────────────────────────────────────────────────────────────

  protected onRowAction(event: { id: string; employee: EmployeeListItem }): void {
    switch (event.id) {
      case 'assign':
        this.goToPlanning();
        break;
      case 'leave':
        this.confirming.set({ employee: event.employee, kind: 'leave' });
        break;
      case 'terminate':
        this.confirming.set({ employee: event.employee, kind: 'terminate' });
        break;
      case 'reinstate':
        this.reinstate(event.employee);
        break;
    }
  }

  /**
   * Devolver al trabajo a quien estaba en permiso.
   *
   * <p>No pregunta antes. La confirmación existe para lo que cuesta deshacer, y esto es el
   * deshacer: ponerle un diálogo lo haría parecer tan grave como el permiso que se está
   * levantando.</p>
   *
   * <p>El endpoint es el mismo <c>PATCH …/status</c> que registra el permiso, con
   * <c>Active</c> de vuelta. Nunca faltó servidor: faltaba que el menú de la fila lo ofreciera.</p>
   */
  protected reinstate(employee: EmployeeListItem): void {
    const organizationId = this.organizationId();

    if (!organizationId) {
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.workforceApi.changeStatus(employee.idEmployee, organizationId, 'Active').subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(`${employee.fullName} vuelve a estar activa y a proponerse para cubrir turnos.`);
        this.load();

        if (this.selected()?.idEmployee === employee.idEmployee) {
          this.loadDetail(employee.idEmployee);
        }
      },
      // `complete` no vale para apagar el indicador: RxJS no lo llama cuando el observable falla,
      // y la pantalla se quedaria guardando para siempre.
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudo reincorporar a la persona.');
      },
    });
  }

  protected confirmAction(): void {
    const pending = this.confirming();
    const organizationId = this.organizationId();

    if (!pending || !organizationId) {
      return;
    }

    this.confirming.set(null);
    this.saving.set(true);

    const status: EmployeeStatus = pending.kind === 'leave' ? 'OnLeave' : 'Terminated';

    this.workforceApi.changeStatus(pending.employee.idEmployee, organizationId, status).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(
          pending.kind === 'leave'
            ? `${pending.employee.fullName} quedó en permiso. Sus asignaciones y su expediente se conservan.`
            : `${pending.employee.fullName} quedó dada de baja. Su expediente se conserva completo.`,
        );
        this.load();

        if (this.selected()?.idEmployee === pending.employee.idEmployee) {
          this.loadDetail(pending.employee.idEmployee);
        }
      },
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudo cambiar el estado de la persona.');
      },
    });
  }

  // ── Alta ─────────────────────────────────────────────────────────────────────────────────

  protected startCreate(): void {
    this.selected.set(null);
    this.creating.set(true);
    this.formProblem.set('');
  }

  /**
   * El alta.
   *
   * <p>El código lo arma esta pantalla con la marca del momento, y no se le pide al usuario. Vale
   * la pena decir por qué es único por corrida: <b>un código de alguien dado de baja sigue
   * ocupado</b>, porque aquí los registros no se borran.</p>
   */
  protected saveNew(value: EmployeeFormValue): void {
    const organizationId = this.organizationId();

    if (!organizationId || !this.canWrite()) {
      return;
    }

    this.saving.set(true);
    this.formProblem.set('');

    this.workforceApi
      .createEmployee({
        idOrganization: organizationId,
        codeEmployee: `EMP-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        fullName: value.fullName,
        jobTitle: value.jobPositionName || null,
        idJobPositionCatalogItem: value.idJobPositionCatalogItem || null,
        // El alta se queda minima: la escolaridad se captura despues, en la ficha.
        idEducationLevelCatalogItem: null,
        hireDate: value.hireDate,
        birthDate: null,
        birthPlace: null,
        sex: null,
        maritalStatus: null,
        rfc: null,
        curp: value.curp || null,
        socialSecurityNumber: null,
        voterIdNumber: null,
        driverLicenseNumber: null,
        militaryServiceCardNumber: null,
        email: value.email || null,
        mobilePhone: value.mobilePhone || null,
        homePhone: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelationship: null,
        address: null,
        street: null,
        streetNumber: null,
        neighborhood: null,
        municipality: value.municipality || null,
        state: value.state || null,
        countryCode: value.state ? 'MX' : null,
        postalCode: null,
        housingType: null,
        residenceSinceDate: null,
      })
      .subscribe({
        next: (created) => {
          this.finishCreate(
            created.idEmployee,
            value.idJobPositionCatalogItem
              ? `Se dio de alta a ${value.fullName} con el puesto ${value.jobPositionName ?? 'sin catalogar'}.`
              : `Se dio de alta a ${value.fullName}, sin puesto del catálogo. Se le puede asignar una ` +
                  'posición, pero nadie podrá comprobar que corresponde al perfil.',
          );
        },
        error: (problem) => {
          this.saving.set(false);
          this.formProblem.set(
            problem?.error?.detail ??
              'No se pudo dar de alta a la persona. Revisa el nombre, la CURP y el domicilio.',
          );
        },
      });
  }

  /** Cierra el alta, recarga y deja abierta la ficha de quien se acaba de crear. */
  private finishCreate(idEmployee: string, message: string): void {
    const organizationId = this.organizationId();

    if (!organizationId) {
      return;
    }

    this.api.searchEmployees({ organizationId, pageSize: 100 }).subscribe({
      next: (result) => {
        const created = result.page.items.find((item) => item.idEmployee === idEmployee) ?? null;

        this.saving.set(false);
        this.creating.set(false);
        this.message.set(message);
        this.load();

        if (created) {
          this.open(created, created.idJobPositionCatalogItem ? 'documents' : 'data');
        }
      },
      error: () => {
        this.saving.set(false);
        this.creating.set(false);
        this.message.set(message);
        this.load();
      },
    });
  }

  // ── Salidas ──────────────────────────────────────────────────────────────────────────────

  /**
   * La asignación se hace en Planeación, eligiendo la posición.
   *
   * <p><b>Sin parámetro a propósito.</b> Planeación no lee ninguno; mandarle uno que ignora dejaría
   * un enlace que promete filtrar y no filtra, que es el defecto exacto que se corrigió en el paso
   * de Clientes a Servicios.</p>
   */
  protected goToPlanning(): void {
    void this.router.navigate(['/planeacion']);
  }

  protected goToCatalogs(): void {
    void this.router.navigate(['/catalogos']);
  }
}
