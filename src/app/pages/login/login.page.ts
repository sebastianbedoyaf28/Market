import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = false;
  error: string | null = null;
  info: string | null = null;
  showPass = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastController
  ) {}

  ngOnInit() {
    const hash = window.location.hash;
    if (hash.includes('otp_expired') || hash.includes('invalid')) {
      this.error = 'El enlace de acceso ya no es válido. Solicita uno nuevo.';
      history.replaceState(null, '', window.location.pathname);
    }
  }

  private lockKey(email: string) { return `login-lock:${email}`; }
  private attemptsKey(email: string) { return `login-attempts:${email}`; }

  private isLocked(email: string): string | null {
    const until = localStorage.getItem(this.lockKey(email));
    if (!until) return null;
    const ms = parseInt(until, 10);
    return Date.now() < ms ? new Date(ms).toLocaleTimeString() : null;
  }
  private registerFailure(email: string, maxFails = 5, lockMinutes = 5) {
    const k = this.attemptsKey(email);
    const attempts = parseInt(localStorage.getItem(k) || '0', 10) + 1;
    localStorage.setItem(k, String(attempts));
    if (attempts >= maxFails) {
      localStorage.setItem(this.lockKey(email), String(Date.now() + lockMinutes * 60 * 1000));
      localStorage.removeItem(k);
    }
  }
  private clearFailures(email: string) {
    localStorage.removeItem(this.attemptsKey(email));
    localStorage.removeItem(this.lockKey(email));
  }

  async emailPasswordSignIn() {
    if (this.form.invalid) { this.tocarTodo(); return; }
    this.loading = true; this.error = null; this.info = null;

    const email = (this.form.value.email || '').trim();
    const password = this.form.value.password as string;

    const lockedUntil = this.isLocked(email);
    if (lockedUntil) {
      this.loading = false;
      this.error = `Demasiados intentos. Intenta de nuevo después de ${lockedUntil}.`;
      return;
    }

    const { error } = await this.auth.signInEmail(email, password);
    this.loading = false;

    if (error) {
      this.registerFailure(email);
      this.error = (error.message === 'Invalid login credentials')
        ? 'Credenciales inválidas.'
        : error.message;
      return;
    }

    this.clearFailures(email);
    await this.toastOk('¡Bienvenido!');
    this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  async emailPasswordSignUp() {
    if (this.form.invalid) { this.tocarTodo(); return; }
    this.loading = true; this.error = null; this.info = null;

    const email = (this.form.value.email || '').trim();
    const password = this.form.value.password as string;

    const { error } = await this.auth.signUpEmail(email, password);
    this.loading = false;

    if (error) { this.error = error.message; return; }
    this.info = 'Cuenta creada. Revisa tu correo si se requiere confirmación.';
  }

  async magicLink() {
    const email = (this.form.value.email || '').trim();
    if (!email || this.form.get('email')?.invalid) {
      this.error = 'Ingresa un email válido antes de solicitar el enlace.';
      return;
    }
    this.loading = true; this.error = null; this.info = null;
    const { error } = await this.auth.signInMagic(email);
    this.loading = false;
    if (error) { this.error = error.message; return; }
    this.info = 'Te enviamos un enlace. Ábrelo en este mismo navegador.';
    await this.toastOk('Enlace enviado a tu correo');
  }

  async resetPass() {
    const email = (this.form.value.email || '').trim();
    if (!email || this.form.get('email')?.invalid) {
      this.error = 'Ingresa un email válido para enviar el reset.';
      return;
    }
    this.loading = true; this.error = null; this.info = null;
    const { error } = await this.auth.resetPassword(email);
    this.loading = false;
    if (error) { this.error = error.message; return; }
    this.info = 'Te enviamos un email para restablecer la contraseña.';
    await this.toastOk('Email de restablecimiento enviado');
  }

  tocarTodo() {
    this.form.markAllAsTouched();
  }

  private async toastOk(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 1400, position: 'top' });
    await t.present();
  }
}
