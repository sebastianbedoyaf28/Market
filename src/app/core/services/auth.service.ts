import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase-client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session$ = new BehaviorSubject<Session | null>(null);
  session$ = this._session$.asObservable();

  constructor() {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => this._session$.next(data.session ?? null));
    sb.auth.onAuthStateChange((_event, session) => this._session$.next(session));
  }

  get user(): User | null {
    return this._session$.value?.user ?? null;
  }

  signUpEmail(email: string, password: string) {
    return supabase().auth.signUp({ email, password });
  }

  signInEmail(email: string, password: string) {
    return supabase().auth.signInWithPassword({ email, password });
  }

  signInMagic(email: string) {
    return supabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/login' },
    });
  }

  resetPassword(email: string) {
    return supabase().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
  }

  signOut() {
    return supabase().auth.signOut();
  }
}
