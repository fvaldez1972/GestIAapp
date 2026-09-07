import { FormControl, FormGroup } from '@angular/forms';
import { dateRangeValidator, shiftIntervalValidator } from './service-validators';

describe('service date and shift constraints', () => {
  it('accepts open-ended and same-day terms, rejects reversed dates', () => {
    const form = new FormGroup(
      { start: new FormControl('2026-09-03'), end: new FormControl('') },
      { validators: dateRangeValidator('start', 'end') },
    );
    expect(form.valid).toBe(true);
    form.controls.end.setValue('2026-09-03');
    expect(form.valid).toBe(true);
    form.controls.end.setValue('2026-09-02');
    expect(form.hasError('dateRange')).toBe(true);
  });

  it.each([
    ['08:00', '16:00', false, true],
    ['22:00', '06:00', true, true],
    ['22:00', '06:00', false, false],
    ['08:00', '16:00', true, false],
    ['08:00', '08:00', false, false],
    ['08:00', '08:00', true, true],
  ])('validates %s to %s, overnight=%s', (start, end, overnight, valid) => {
    const form = new FormGroup(
      {
        startTime: new FormControl(start),
        endTime: new FormControl(end),
        isOvernight: new FormControl(overnight),
      },
      { validators: shiftIntervalValidator },
    );
    expect(form.valid).toBe(valid);
  });
});
