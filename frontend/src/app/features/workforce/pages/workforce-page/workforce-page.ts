import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import {
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
import { EntityDocuments } from '../../../documents/components/entity-documents/entity-documents';
import { EligibilityRequirement } from '../../../catalogs/data-access/catalog.models';
import { EmployeeListApiService } from '../../data-access/employee-list-api.service';
import {
  EmployeeAssignment,
  EmployeeDocumentFilter,
  EmployeeJobPositionOption,
  EmployeeListItem,
  EMPLOYEE_STATUS_OPTIONS,
  documentRequirementsNote,
  employeeDocumentBadge,
} from '../../data-access/employee-list.models';
import { WorkforceApiService } from '../../data-access/workforce-api.service';
import { Employee, EmployeeDocument, EmployeeStatus } from '../../data-access/workforce.models';
import { EmployeeAssignments } from '../../ui/employee-assignments';
import { EmployeeData } from '../../ui/employee-data';
import { EmployeeDocuments } from '../../ui/employee-documents';
import { EmployeeForm, EmployeeFormValue } from '../../ui/employee-form';
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
    EmployeeForm,
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

  protected readonly selected = signal<EmployeeListItem | null>(null);
  protected readonly activeTab = signal('data');
  protected readonly detail = signal<Employee | null>(null);
  protected readonly documents = signal<readonly EmployeeDocument[]>([]);
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
      { id: 'documents', label: 'Documentos', count: this.requiredDocuments() },
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
    effect(() => {
      const organizationId = this.organizationId();

      if (organizationId && this.canRead()) {
        this.load();
        this.loadOptions(organizationId);
      } else {
        this.employees.set([]);
      }
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
      this.requirements.set(
        data.requirements.filter(
          (item) => item.active && item.requirementType === 'Document' && item.targetType === 'Organization',
        ),
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
    }).subscribe((data) => {
      this.detail.set(data.detail?.employee ?? null);
      this.documents.set(data.detail?.documents ?? []);
      this.assignments.set(data.assignments);
      this.detailLoading.set(false);
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
        idOrganization: organizationId,
        fullName: employee.fullName,
        jobTitle: chosen.name,
        idJobPositionCatalogItem: chosen.idCatalogItem,
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
        address: employee.address,
        municipality: employee.municipality,
        state: employee.state,
        countryCode: employee.countryCode ?? null,
        postalCode: employee.postalCode,
        housingType: employee.housingType,
        residenceSinceDate: employee.residenceSinceDate,
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
    }
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
        address: null,
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
              ? `Se dio de alta a ${value.fullName} con el puesto ${value.jobPositionName}.`
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
