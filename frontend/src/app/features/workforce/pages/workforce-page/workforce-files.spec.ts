import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth/auth.service';
import { Employee } from '../../data-access/workforce.models';
import { WorkforcePage } from './workforce-page';

describe('Workforce contextual file upload', () => {
  let page: WorkforcePage;
  let http: HttpTestingController;
  let permissions: string[];
  const fileEvent = () => ({ target: { files: [new File(['document'], 'identity.pdf')], value: 'identity.pdf' } }) as unknown as Event;

  beforeEach(() => {
    permissions = ['DOCUMENTS.SENSITIVE.READ', 'DOCUMENTS.SENSITIVE.WRITE', 'DOCUMENTS.WRITE', 'WORKFORCE.WRITE'];
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { hasPermission: (value: string) => permissions.includes(value) } },
    ] });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.runInInjectionContext(() => new WorkforcePage());
    page['selectedOrganizationId'].set('org-1');
    page['selectedEmployee'].set({ idEmployee: 'employee-1' } as Employee);
  });

  afterEach(() => http.verify());

  it('uploads an employee document into the selected organization', () => {
    page['uploadEmployeeFile'](fileEvent(), 'documents');
    const request = http.expectOne('/api/v1/documents/upload?organizationId=org-1');
    expect(request.request.method).toBe('POST');
    request.flush({ storageReference: 'business-documents/org-1/identity.pdf' });
    expect(page['documentForm'].controls.storageReference.value).toBe('business-documents/org-1/identity.pdf');
    expect(page['uploadingFile']()).toBe(false);
  });

  it('does not attach a late upload to another employee', () => {
    page['uploadEmployeeFile'](fileEvent(), 'evaluations');
    const request = http.expectOne('/api/v1/documents/upload?organizationId=org-1');
    page['selectedEmployee'].set({ idEmployee: 'employee-2' } as Employee);
    request.flush({ storageReference: 'business-documents/org-1/identity.pdf' });
    expect(page['evaluationForm'].controls.storageReference.value).toBe('');
  });

  it('does not upload without sensitive write permission', () => {
    permissions = ['WORKFORCE.WRITE', 'DOCUMENTS.WRITE', 'DOCUMENTS.SENSITIVE.READ'];
    page['uploadEmployeeFile'](fileEvent(), 'documents');
    http.expectNone(request => request.url.includes('/upload'));
  });

  it('releases the uploading state after an API error', () => {
    page['uploadEmployeeFile'](fileEvent(), 'documents');
    http.expectOne('/api/v1/documents/upload?organizationId=org-1')
      .flush({ message: 'Rejected' }, { status: 400, statusText: 'Bad Request' });
    expect(page['uploadingFile']()).toBe(false);
    expect(page['documentForm'].controls.storageReference.value).toBe('');
  });
});
