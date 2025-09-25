import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts';

// Read secrets (support both our names and legacy SUPABASE_* just in case)
const SUPABASE_URL = Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing PROJECT_URL/SERVICE_ROLE_KEY. Set with: supabase secrets set SERVICE_ROLE_KEY="..." PROJECT_URL="https://<ref>.supabase.co"');
}

const PASSWORD_HISTORY_LIMIT = 5;
const MAX_TOKEN_AGE_MINUTES = 15;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Enhanced CORS handling
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
  } as const;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: {
        ...corsHeaders,
        'Content-Length': '0'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }
  const accessToken = authHeader.slice('Bearer '.length);

  const body = await req.json().catch(() => ({}));
  const newPassword: unknown = body?.new_password;
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return new Response('Contraseña inválida', { status: 400, headers: corsHeaders });
  }

  // Decode token to verify age
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1] ?? '')) as { iat?: number; sub?: string };
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.iat || (nowSec - payload.iat) > (MAX_TOKEN_AGE_MINUTES * 60)) {
      return new Response('Enlace expirado', { status: 401, headers: corsHeaders });
    }
    const userId = payload.sub;
    if (!userId) {
      return new Response('Token inválido', { status: 401, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Hash new password and compare with last N
    const newHash = await sha256Hex(newPassword);
    const { data: history, error: histErr } = await admin
      .from('user_password_history')
      .select('password_hash')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(PASSWORD_HISTORY_LIMIT);
    if (histErr) {
      return new Response(`Error leyendo historial: ${histErr.message}`, { status: 500, headers: corsHeaders });
    }
    if (history?.some(h => h.password_hash === newHash)) {
      return new Response('No puedes reutilizar contraseñas anteriores.', { status: 409, headers: corsHeaders });
    }

    // Update password using Admin API
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updErr) {
      return new Response(`No se pudo actualizar: ${updErr.message}`, { status: 400, headers: corsHeaders });
    }

    // Store new hash (best-effort)
    const { error: insErr } = await admin
      .from('user_password_history')
      .insert({ user_id: userId, password_hash: newHash });
    if (insErr) {
      console.error('Failed to insert password history:', insErr.message);
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response('Token inválido', { status: 401, headers: corsHeaders });
  }
});
