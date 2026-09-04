import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { OrganizationAccess } from '../../../core/auth/auth.models';
import { ClientApiService } from '../../clients/data-access/client-api.service';
import { MonitorPage } from './monitor-page';

describe('Monitor organization boundary', () => {
  it('carga el gobierno sin pedir datos operativos hasta que se entra a una organización', () => {
    const activeOrganization = signal<OrganizationAccess | null>(null);
    const api = {
      listOrganizationGovernance: vi.fn(() => of([])),
      getOperationsSummary: vi.fn(() => of({})),
      getOperationsByService: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ClientApiService, useValue: api },
        {
          provide: AuthService,
          useValue: {
            activeOrganization,
            activeOrganizationId: () => activeOrganization()?.idOrganization ?? '',
            setActiveOrganization: (id: string) =>
              activeOrganization.set({ idOrganization: id, codeOrganization: '', legalName: id }),
          },
        },
      ],
    });

    TestBed.runInInjectionContext(() => new MonitorPage());
    TestBed.tick();

    expect(api.listOrganizationGovernance).toHaveBeenCalledOnce();
    expect(api.getOperationsSummary).not.toHaveBeenCalled();

    activeOrganization.set({ idOrganization: 'org-only', codeOrganization: 'O', legalName: 'Org' });
    TestBed.tick();

    expect(api.getOperationsSummary).toHaveBeenCalledWith('org-only', undefined, undefined, expect.any(String), expect.any(String));
    expect(api.getOperationsByService).toHaveBeenCalledWith('org-only', undefined, undefined, expect.any(String), expect.any(String));

    activeOrganization.set(null);
    TestBed.tick();

    expect(api.getOperationsSummary).toHaveBeenCalledTimes(1);
  });
});
