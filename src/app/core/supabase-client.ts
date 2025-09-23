import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

let _client: SupabaseClient;

export const supabase = (): SupabaseClient => {
  if (!_client) {
    _client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // (sin multiTab)
      },
    });
  }
  return _client;
};
