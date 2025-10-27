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
    try {
      const sb = supabase();

      // Configurar autenticación
      const { data: { session } } = await sb.auth.getSession();

      sb.auth.onAuthStateChange((event, session) => {
        const email = session?.user?.email ?? '(sin sesión)';
        document.title = `Market - ${email}`;

        const note = document.getElementById('user-email');
        if (note) note.textContent = session?.user?.email ?? 'Invitado';
      });
    } catch (error) {
      console.error('Error inicializando aplicación:', error);
      // La aplicación continuará funcionando aunque Supabase tenga problemas
    }
  }
}
