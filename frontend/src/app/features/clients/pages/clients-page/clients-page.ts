import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ClientApiService } from '../../data-access/client-api.service';
import {
  Client,
  ClientInput,
  CreateClient,
  Organization,
  PagedResult,
} from '../../data-access/client.models';

@Component({
  selector: 'app-clients-page',
  imports: [ReactiveFormsModule],
  templateUrl: './clients-page.html',
  styleUrl: './clients-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly organizations = signal<readonly Organization[]>([]);
  protected readonly selectedOrganizationId = signal('');
  protected readonly result = signal<PagedResult<Client>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editorOpen = signal(false);
  protected readonly organizationEditorOpen = signal(false);
  protected readonly editingClient = signal<Client | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly search = signal('');

  protected readonly organizationForm = this.formBuilder.nonNullable.group({
    codeOrganization: ['', [Validators.required, Validators.maxLength(30)]],
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    rfc: ['', [Validators.maxLength(13)]],
  });

  protected readonly clientForm = this.formBuilder.nonNullable.group({
    codeClient: ['', [Validators.required, Validators.maxLength(30)]],
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    tradeName: ['', [Validators.maxLength(200)]],
    rfc: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(13)]],
    nationality: ['Mexicana', [Validators.maxLength(80)]],
    taxActivity: ['', [Validators.maxLength(300)]],
    taxAddress: ['', [Validators.maxLength(500)]],
    employerRegistrationNumber: ['', [Validators.maxLength(30)]],
  });

  ngOnInit(): void {
    this.loadOrganizations();
  }

  protected loadOrganizations(preferredId?: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .listOrganizations()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (organizations) => {
          this.organizations.set(organizations);
          const organizationId =
            preferredId ?? this.selectedOrganizationId() ?? organizations[0]?.idOrganization ?? '';
          this.selectedOrganizationId.set(organizationId);
          if (organizationId) {
            this.loadClients(1);
          }
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected selectOrganization(organizationId: string): void {
    this.selectedOrganizationId.set(organizationId);
    this.message.set('');
    this.loadClients(1);
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
  }

  protected loadClients(page = this.result().page): void {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId) {
      this.result.set({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 });
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.api
      .listClients(organizationId, this.search(), page, this.result().pageSize)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateOrganization(): void {
    this.organizationForm.reset({ codeOrganization: '', legalName: '', rfc: '' });
    this.organizationEditorOpen.set(true);
  }

  protected saveOrganization(): void {
    if (this.organizationForm.invalid) {
      this.organizationForm.markAllAsTouched();
      return;
    }

    const form = this.organizationForm.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.api
      .createOrganization({
        codeOrganization: form.codeOrganization,
        legalName: form.legalName,
        rfc: this.optional(form.rfc),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (organization) => {
          this.organizationEditorOpen.set(false);
          this.message.set('Organización creada correctamente.');
          this.loadOrganizations(organization.idOrganization);
        },
        error: (error: HttpErrorResponse) => this.setError(error),
      });
  }

  protected openCreateClient(): void {
    this.editingClient.set(null);
    this.clientForm.reset({
      codeClient: '',
      legalName: '',
      tradeName: '',
      rfc: '',
      nationality: 'Mexicana',
      taxActivity: '',
      taxAddress: '',
      employerRegistrationNumber: '',
    });
    this.editorOpen.set(true);
  }

  protected openEditClient(client: Client): void {
    this.editingClient.set(client);
    this.clientForm.reset({
      codeClient: client.codeClient,
      legalName: client.legalName,
      tradeName: client.tradeName ?? '',
      rfc: client.rfc,
      nationality: client.nationality ?? '',
      taxActivity: client.taxActivity ?? '',
      taxAddress: client.taxAddress ?? '',
      employerRegistrationNumber: client.employerRegistrationNumber ?? '',
    });
    this.editorOpen.set(true);
  }

  protected saveClient(): void {
    if (this.clientForm.invalid || !this.selectedOrganizationId()) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const form = this.clientForm.getRawValue();
    const input: ClientInput = {
      idOrganization: this.selectedOrganizationId(),
      legalName: form.legalName,
      tradeName: this.optional(form.tradeName),
      rfc: form.rfc,
      nationality: this.optional(form.nationality),
      taxActivity: this.optional(form.taxActivity),
      taxAddress: this.optional(form.taxAddress),
      publicRegistryDate: null,
      commercialRegistryFolio: null,
      employerRegistrationNumber: this.optional(form.employerRegistrationNumber),
      incorporationDate: null,
      incorporationDeedNumber: null,
      legalRepresentativeInstrumentNumber: null,
    };
    const editing = this.editingClient();
    const request = editing
      ? this.api.updateClient(editing.idClient, input)
      : this.api.createClient({ ...input, codeClient: form.codeClient } satisfies CreateClient);

    this.saving.set(true);
    this.error.set('');
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.editorOpen.set(false);
        this.message.set(
          editing ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.',
        );
        this.loadClients(editing ? this.result().page : 1);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected deactivate(client: Client): void {
    if (!window.confirm(`¿Deseas desactivar a ${client.legalName}?`)) {
      return;
    }

    this.api.deactivateClient(this.selectedOrganizationId(), client.idClient).subscribe({
      next: () => {
        this.message.set('Cliente desactivado correctamente.');
        this.loadClients(1);
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  protected closeEditors(): void {
    this.editorOpen.set(false);
    this.organizationEditorOpen.set(false);
  }

  private optional(value: string): string | null {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private setError(error: HttpErrorResponse): void {
    const detail =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)['detail']
        : null;
    this.error.set(typeof detail === 'string' ? detail : 'No fue posible completar la operación.');
  }
}
