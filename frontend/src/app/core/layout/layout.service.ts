import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

const STORAGE_KEY = '__GESTIA_LAYOUT__';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;

  readonly isCondensed = signal(this.readCondensedPreference());
  readonly mobileMenuOpen = signal(false);

  constructor() {
    effect(() => {
      const condensed = this.isCondensed();
      this.document.documentElement.dataset['sidenavSize'] = condensed ? 'condensed' : 'default';
      this.view?.sessionStorage.setItem(STORAGE_KEY, condensed ? 'condensed' : 'default');
    });
  }

  toggleNavigation(): void {
    if ((this.view?.innerWidth ?? 1024) <= 900) {
      this.mobileMenuOpen.update((open) => !open);
      this.syncMobileDocumentState();
      return;
    }

    this.isCondensed.update((condensed) => !condensed);
  }

  closeMobileNavigation(): void {
    if (!this.mobileMenuOpen()) {
      return;
    }

    this.mobileMenuOpen.set(false);
    this.syncMobileDocumentState();
  }

  private readCondensedPreference(): boolean {
    try {
      return this.view?.sessionStorage.getItem(STORAGE_KEY) === 'condensed';
    } catch {
      return false;
    }
  }

  private syncMobileDocumentState(): void {
    this.document.documentElement.classList.toggle('sidenav-enable', this.mobileMenuOpen());
    this.document.body.classList.toggle('navigation-open', this.mobileMenuOpen());
  }
}
