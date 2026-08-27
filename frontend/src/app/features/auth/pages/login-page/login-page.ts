import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly form = new FormGroup({
    email: new FormControl('admin@gestia.local', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('GestIA.Local.2026!', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  protected readonly canSubmit = computed(() => this.form.valid && !this.loading());

  submit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/'),
        error: () => this.error.set('No pudimos iniciar sesión con esos datos.'),
      });
  }
}
