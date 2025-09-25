import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
})
export class ForgotPasswordPage {
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = false;
  error: string | null = null;
  info: string | null = null;
  sent = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastController
  ) {}

  async submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true; this.error = null; this.info = null;
    const email = (this.form.value.email || '').trim();
    const { error } = await this.auth.resetPassword(email);
    this.loading = false;
    if (error) { this.error = error.message; return; }
    this.sent.set(true);
    this.info = 'Si el correo existe, enviamos las instrucciones.';
    await this.toastOk('Revisa tu correo');
  }

  backToLogin() {
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async toastOk(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 1400, position: 'top' });
    await t.present();
  }
}
