// src/app/pages/login/login.page.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  loading = false;
  error: string | null = null;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  async emailPasswordSignIn() {
    if (this.form.invalid) return;
    this.loading = true; this.error = null;
    const { email, password } = this.form.value as any;
    const { error } = await this.auth.signInEmail(email, password);
    this.loading = false;
    if (error) { this.error = error.message; return; }
    this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  async emailPasswordSignUp() {
    if (this.form.invalid) return;
    this.loading = true; this.error = null;
    const { email, password } = this.form.value as any;
    const { error } = await this.auth.signUpEmail(email, password);
    this.loading = false;
    if (error) { this.error = error.message; return; }
    alert('Cuenta creada. Revisa tu correo si se requiere confirmación.');
  }

  async magicLink() {
    const email = prompt('Correo para recibir enlace mágico:');
    if (!email) return;
    const { error } = await this.auth.signInMagic(email);
    if (error) { this.error = error.message; return; }
    alert('Revisa tu correo para continuar.');
  }

  ngOnInit() {
  const hash = window.location.hash; // p. ej. #error=access_denied&error_code=otp_expired...
  if (hash.includes('otp_expired') || hash.includes('invalid')) {
    this.error = 'El enlace de acceso ya no es válido. Solicita uno nuevo.';
    // Limpia el hash para que no quede el error pegado al refrescar:
    history.replaceState(null, '', window.location.pathname);
  }
}


}
