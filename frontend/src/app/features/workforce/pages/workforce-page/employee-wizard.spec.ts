import { FormControl, FormGroup, Validators } from '@angular/forms';
import { employeeStepFields, validateEmployeeStep } from './employee-wizard';

describe('employee wizard validation', () => {
  const form = () => new FormGroup(Object.fromEntries(employeeStepFields.flat().map(field => [field, new FormControl('')])));

  it('blocks invalid identity and marks fields touched', () => {
    const group = form();
    group.get('fullName')!.setValidators(Validators.required);
    group.get('fullName')!.updateValueAndValidity();
    expect(validateEmployeeStep(group, 1)).toBe(false);
    expect(group.get('fullName')!.touched).toBe(true);
    expect(group.get('email')!.touched).toBe(false);
  });

  it('validates only the current step', () => {
    const group = form();
    group.get('email')!.setValidators(Validators.email);
    group.get('email')!.setValue('invalid');
    expect(validateEmployeeStep(group, 1)).toBe(true);
    expect(validateEmployeeStep(group, 2)).toBe(false);
    expect(validateEmployeeStep(group, 5)).toBe(true);
    expect(validateEmployeeStep(group, 7)).toBe(false);
  });
});
