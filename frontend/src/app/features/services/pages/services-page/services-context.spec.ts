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
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { ServicesPage } from './services-page';

describe('Services context selectors', () => {
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Antes esta prueba comprobaba dos cosas: que la organización cargada por HTTP y el cliente
   * traído por enlace aparecieran como opciones elegidas. La primera se fue con el selector de
   * organización, que ya no existe: la organización la fija la barra de contexto. Queda la
   * segunda, que es la que cuidaba un caso real —el cliente enlazado llega después de una página
   * de resultados distinta— y se le añade la comprobación de que la organización usada en las
   * peticiones es la de la barra.
   */
  it('renders the deep-linked client as the selected option, scoped by the context bar', async () => {
    const source = readFileSync(resolve('src/app/features/services/pages/services-page/services-page.html'), 'utf8');
    const parsed = parseTemplate(source, 'services-page.html');
    const workspace: any = parsed.nodes[0];
    const context = workspace.children.find((node: any) =>
      node.attributes?.some((attribute: any) => attribute.name === 'class' && attribute.value === 'client-context'));
    const template = source.slice(context.sourceSpan.start.offset, context.sourceSpan.end.offset);
    const params = convertToParamMap({ clientId: 'client-a' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(params), snapshot: { queryParamMap: params } } },
        // La pantalla lee el día operativo del servidor; el doble lo fija para que la prueba no
        // dependa del reloj de quien la corre.
        { provide: SystemInfoService, useValue: {
          operationDate: () => '2026-09-04',
          timeZoneId: () => 'America/Mexico_City',
          info: () => null,
          refresh: () => undefined,
        } },
        { provide: AuthService, useValue: {
          session: () => ({ permissions: ['CLIENTS.READ'] }),
          hasPermission: (permission: string) => permission === 'CLIENTS.READ',
          operationalOrganizationId: () => 'org-a',
          activeOrganization: () => ({ idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Organization A' }),
          availableOrganizations: () => [{ idOrganization: 'org-a', codeOrganization: 'A', legalName: 'Organization A' }],
        } },
      ],
    });
    TestBed.overrideComponent(ServicesPage, {
      set: { template, templateUrl: undefined, styles: [], styleUrl: undefined, imports: [FormsModule] },
    });
    const fixture = TestBed.createComponent(ServicesPage);
    const http = TestBed.inject(HttpTestingController);
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
    // Ya no hay selector de organización en la pantalla: eso es lo que se busca.
    expect(fixture.nativeElement.querySelector('select[aria-label="Organización"]')).toBeNull();
    const client: HTMLSelectElement = fixture.nativeElement.querySelector('select[aria-label="Cliente"]');
    expect(client.value).toBe('client-a');
    expect(client.selectedOptions[0].textContent).toContain('Client A');
    http.verify();
  });
});
