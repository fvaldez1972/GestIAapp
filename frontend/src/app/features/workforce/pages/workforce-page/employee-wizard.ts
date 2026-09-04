import { AbstractControl } from '@angular/forms';

export const employeeStepFields: readonly (readonly string[])[] = [
  ['codeEmployee', 'hireDate', 'fullName', 'rfc', 'curp', 'socialSecurityNumber', 'birthDate', 'birthPlace'],
  ['email', 'mobilePhone', 'homePhone', 'emergencyContactName', 'emergencyContactPhone'],
  ['address', 'state', 'municipality', 'postalCode', 'housingType', 'residenceSinceDate'],
  ['jobTitle', 'sex', 'maritalStatus', 'voterIdNumber', 'driverLicenseNumber', 'militaryServiceCardNumber'],
  [],
];

export function validateEmployeeStep(form: AbstractControl, step: number): boolean {
  const fields = employeeStepFields[step - 1];
  if (!fields) {
    return false;
  }

  for (const field of fields) {
    form.get(field)?.markAsTouched();
  }
  return fields.every(field => form.get(field)?.valid === true);
}
