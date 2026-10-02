import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function dateRangeValidator(start: string, end: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const from = control.get(start)?.value as string;
    const to = control.get(end)?.value as string;
    return from && to && to < from ? { dateRange: true } : null;
  };
}

export const shiftIntervalValidator: ValidatorFn = (control) => {
  const { startTime, endTime, isOvernight } = control.getRawValue();
  if (!startTime || !endTime) return null;
  return (!isOvernight && endTime <= startTime) || (isOvernight && endTime > startTime)
    ? { shiftInterval: true }
    : null;
};
