import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  output,
} from '@angular/core';

@Directive({ selector: '[serviceDialog]' })
export class ServiceDialog implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previousFocus = document.activeElement as HTMLElement | null;
  private observer?: MutationObserver;
  readonly dismiss = output<void>();

  ngAfterViewInit(): void {
    this.element.nativeElement.tabIndex = -1;
    this.focusable()[0]?.focus();
    // Wizard steps can remove the focused control while the dialog stays open.
    this.observer = new MutationObserver(() => {
      if (!this.element.nativeElement.contains(document.activeElement)) {
        (this.focusable()[0] ?? this.element.nativeElement).focus();
      }
    });
    this.observer.observe(this.element.nativeElement, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.previousFocus?.focus();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss.emit();
    }
    if (event.key !== 'Tab') return;
    const elements = this.focusable();
    const first = elements[0],
      last = elements.at(-1);
    if (!first) {
      event.preventDefault();
      this.element.nativeElement.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === this.element.nativeElement)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusable(): HTMLElement[] {
    return Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex="0"]',
      ),
    ).filter((element) => !element.matches(':disabled') && !element.closest('[hidden]'));
  }
}
