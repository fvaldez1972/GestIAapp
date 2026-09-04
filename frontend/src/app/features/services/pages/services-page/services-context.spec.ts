import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTemplate } from '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ServicesPage } from './services-page';

describe('Services context selectors', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders asynchronously loaded organization and deep-linked client as the selected options', async () => {
    const source = readFileSync(resolve('src/app/features/services/pages/services-page/services-page.html'), 'utf8');
    const parsed = parseTemplate(source, 'services-page.html');
    const workspace: any = parsed.nodes[0];
    const context = workspace.children.find((node: any) =>
      node.attributes?.some((attribute: any) => attribute.name === 'class' && attribute.value === 'context-bar'));
    const template = source.slice(context.sourceSpan.start.offset, context.sourceSpan.end.offset);
    const params = convertToParamMap({ clientId: 'client-a' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(params), snapshot: { queryParamMap: params } } },
        { provide: AuthService, useValue: {
          session: () => ({ permissions: ['CLIENTS.READ'] }),
          hasPermission: (permission: string) => permission === 'CLIENTS.READ',
          resolveOperationalOrganizationId: (organizations: any[]) => organizations[0]?.idOrganization ?? '',
          isSupportModeActive: () => false,
        } },
      ],
    });
    TestBed.overrideComponent(ServicesPage, {
      set: { template, templateUrl: undefined, styles: [], styleUrl: undefined, imports: [FormsModule] },
    });
    const fixture = TestBed.createComponent(ServicesPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/v1/organizations').flush([
      { idOrganization: 'org-a', legalName: 'Organization A', active: true },
    ]);
    fixture.detectChanges();
    // The linked client intentionally arrives after a different search-result page.
    http.expectOne(request => request.url === '/api/v1/clients').flush({
      items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0,
    });
    fixture.detectChanges();
    http.expectOne('/api/v1/clients/client-a?organizationId=org-a').flush({
      idClient: 'client-a', idOrganization: 'org-a', legalName: 'Client A', codeClient: 'A', active: true,
    });
    http.match(request => request.url.startsWith('/api/v1/clients/client-a/'))
      .forEach(request => request.flush([]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const organization: HTMLSelectElement = fixture.nativeElement.querySelector('select[aria-label="Organización"]');
    const client: HTMLSelectElement = fixture.nativeElement.querySelector('select[aria-label="Cliente"]');
    expect(organization.value).toBe('org-a');
    expect(organization.selectedOptions[0].textContent).toContain('Organization A');
    expect(client.value).toBe('client-a');
    expect(client.selectedOptions[0].textContent).toContain('Client A');
    http.verify();
  });
});
