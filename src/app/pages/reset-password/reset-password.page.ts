import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { supabase } from '../../core/supabase-client';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
})
export class ResetPasswordPage {
  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  loading = false;
  error: string | null = null;
  info: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toast: ToastController
  ) {}

  async ngOnInit() {
    // When arriving from recovery link, Supabase sets a session allowing updateUser
    const { data } = await supabase().auth.getSession();
    if (!data.session) {
      this.error = 'El enlace de restablecimiento no es válido o expiró.';
    }
  }

  async submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const password = this.form.value.password as string;
    const confirm = this.form.value.confirm as string;
    if (password !== confirm) { this.error = 'Las contraseñas no coinciden.'; return; }

    this.loading = true; this.error = null; this.info = null;
    try {
      const { data, error: sesErr } = await supabase().auth.getSession();
      if (sesErr || !data.session) {
        this.error = 'El enlace de restablecimiento no es válido o expiró.';
        return;
      }

      // Timeout seguro para la llamada (15s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${environment.supabaseUrl}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.session.access_token}`,
          'apikey': environment.supabaseAnonKey
        },
        body: JSON.stringify({ new_password: password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        this.error = errorText || `No se pudo actualizar la contraseña. (${res.status})`;
        return;
      }

      await this.toastOk('Contraseña actualizada');
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        this.error = 'Tiempo de espera agotado. Intenta de nuevo.';
      } else {
        this.error = err?.message || 'Ocurrió un error inesperado.';
      }
    } finally {
      this.loading = false;
    }
  }

  private async toastOk(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 1400, position: 'top' });
    await t.present();
  }
}
