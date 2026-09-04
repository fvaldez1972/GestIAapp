import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from './auth.service';

describe('support session expiration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
    localStorage.clear();
  });
  it('clears the active support session at its expiration time', () => {
    const service = TestBed.inject(AuthService);
    service.loadCurrentSupportSession().subscribe();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/support-sessions/current').flush({
      idSupportSession: 'session', idOrganization: 'organization', organizationName: 'Test',
      reason: 'Test support', startsAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000).toISOString(),
      endedAt: null, startedBy: 'Admin', active: true,
    });
    expect(service.isSupportModeActive()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(service.isSupportModeActive()).toBe(false);
    expect(service.supportSession()).toBeNull();
    expect(localStorage.getItem('gestia.auth.supportSession')).toBeNull();
  });
});
