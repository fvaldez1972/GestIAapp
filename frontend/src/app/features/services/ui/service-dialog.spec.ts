import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServiceDialog } from './service-dialog';

describe('ServiceDialog keyboard focus', () => {
  let dialog: HTMLElement;
  let trigger: HTMLButtonElement;
  let directive: ServiceDialog;

  beforeEach(() => {
    trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    dialog = document.createElement('section');
    dialog.innerHTML = '<button id="close">Close</button><fieldset disabled><input /></fieldset><button id="next">Next</button>';
    document.body.append(dialog);
    TestBed.configureTestingModule({ providers: [{ provide: ElementRef, useValue: new ElementRef(dialog) }] });
    directive = TestBed.runInInjectionContext(() => new ServiceDialog());
    directive.ngAfterViewInit();
  });

  afterEach(() => {
    directive.ngOnDestroy();
    dialog.remove();
    trigger.remove();
    TestBed.resetTestingModule();
  });

  it('wraps focus, skips disabled controls, and restores the trigger', () => {
    expect(document.activeElement?.id).toBe('close');
    directive.onKeydown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement?.id).toBe('next');
    directive.onKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(document.activeElement?.id).toBe('close');
    directive.ngOnDestroy();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps focus in the dialog when advancing a wizard removes the focused button', async () => {
    dialog.querySelector<HTMLButtonElement>('#next')!.focus();
    dialog.querySelector('#next')!.remove();
    await Promise.resolve();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
