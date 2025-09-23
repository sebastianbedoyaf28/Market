import { Component, OnInit } from '@angular/core';
import { supabase } from './core/supabase-client';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor() {}

  async ngOnInit() {
    const sb = supabase();

    // Log inicial de sesión
    const { data: { session } } = await sb.auth.getSession();
    console.log('[Auth] sesión actual:', session);

    // Log en cada intento/cambio de auth
    sb.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] evento:', event, 'sesión:', session);
      // Opcional: muestra el correo logueado en el título/encabezado
      const email = session?.user?.email ?? '(sin sesión)';
      document.title = `Market - ${email}`;

      // (Opcional) también podrías actualizar algún elemento del UI aquí.
      const note = document.getElementById('user-email');
      if (note) note.textContent = session?.user?.email ?? 'Invitado';
    });

    // Prueba rápida de conexión a DB
    const { data, error } = await sb.from('products').select('*').limit(1);
    if (error) {
      console.error('[DB] error probando conexión:', error);
    } else {
      console.log('[DB] conexión OK. Ejemplo products[0]:', data?.[0]);
    }
  }
}
