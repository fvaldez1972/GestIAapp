import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { SupportSession } from '../../../core/auth/auth.models';
import { ClientApiService } from '../../clients/data-access/client-api.service';
import { MonitorPage } from './monitor-page';

describe('Monitor organization boundary', () => {
  it('loads governance without fetching operational data outside support', () => {
    const supportSession = signal<SupportSession | null>(null);
    const api = {
      listOrganizationGovernance: vi.fn(() => of([])),
      getOperationsSummary: vi.fn(() => of({})),
      getOperationsByService: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({ providers: [
      { provide: ClientApiService, useValue: api },
      { provide: AuthService, useValue: { supportSession, isSupportModeActive: () => !!supportSession() } },
    ] });
    TestBed.runInInjectionContext(() => new MonitorPage());
    TestBed.tick();
    expect(api.listOrganizationGovernance).toHaveBeenCalledOnce();
    expect(api.getOperationsSummary).not.toHaveBeenCalled();
    supportSession.set({ idSupportSession: 'session', idOrganization: 'org-only', organizationName: 'Org', reason: 'QA support', startsAt: '', expiresAt: '', endedAt: null, startedBy: 'Admin', active: true });
    TestBed.tick();
    expect(api.getOperationsSummary).toHaveBeenCalledWith('org-only', undefined, undefined, expect.any(String), expect.any(String));
    expect(api.getOperationsByService).toHaveBeenCalledWith('org-only', undefined, undefined, expect.any(String), expect.any(String));
    supportSession.set(null);
    TestBed.tick();
    expect(api.getOperationsSummary).toHaveBeenCalledTimes(1);
  });
});
