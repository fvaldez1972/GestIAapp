import { Component, input } from '@angular/core';
import { NavigationIcon } from '../../../core/layout/navigation';

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name()) {
        @case ('home') { <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /> }
        @case ('request') { <path d="M9 5h10M9 9h10M9 13h7M5 5h.01M5 9h.01M5 13h.01" /><path d="M4 18h14l2 3H4a2 2 0 0 1 0-4h16" /> }
        @case ('customer') { <circle cx="9" cy="8" r="3" /><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M16 4h5v5M18 7h3" /> }
        @case ('people') { <circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M2 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M15 14h2a4 4 0 0 1 4 4v2" /> }
        @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /> }
        @case ('attendance') { <circle cx="9" cy="8" r="3" /><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 4.5 2.8M16 19l2 2 4-5" /> }
        @case ('incident') { <path d="M12 3 2.5 20h19zM12 9v5M12 18h.01" /> }
        @case ('coverage') { <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6zM8 12l2.5 2.5L16 9" /> }
        @case ('report') { <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> }
        @case ('audit') { <path d="M5 4h14v16H5z" /><path d="M9 8h6M9 12h6M9 16h3" /><path d="m15 16 1.5 1.5L20 14" /> }
        @case ('security') { <path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6z" /><path d="M9 12h6M12 9v6" /> }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 1.25rem; height: 1.25rem; }
    svg { width: 100%; height: 100%; }
  `,
})
export class AppIcon {
  readonly name = input.required<NavigationIcon>();
}
