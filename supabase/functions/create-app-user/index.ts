import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";
import type { User } from "https://esm.sh/@supabase/supabase-js@2.33.1";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("PROJECT_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

interface CreateAppUserPayload {
  email?: string;
  password?: string;
  fullName?: string;
  roleId?: string;
  phone?: string | null;
  isActive?: boolean;
}

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, 405);
  }

  let payload: CreateAppUserPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ message: "Invalid JSON body" }, 400);
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  const password = (payload.password ?? "").trim();
  const fullName = (payload.fullName ?? "").trim();
  const roleId = payload.roleId?.trim();
  const phone = payload.phone?.trim() ?? null;
  const isActive = payload.isActive ?? true;

  if (!email || !password || !fullName || !roleId) {
    return jsonResponse(
      { message: "Missing required fields: email, password, fullName and roleId are mandatory." },
      400,
    );
  }

  const { data: role, error: roleError } = await adminClient
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .maybeSingle();

  if (roleError || !role) {
    return jsonResponse({
      message: "The provided role does not exist.",
      details: roleError?.message ?? null,
    }, 400);
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    return jsonResponse({ message: authError?.message ?? "Unable to create auth user." }, 400);
  }

  const authUser: User = authData.user;

  const { data: insertedUser, error: insertError } = await adminClient
    .from("app_users")
    .insert({
      auth_user_id: authUser.id,
      full_name: fullName,
      email,
      role_id: roleId,
      phone,
      is_active: isActive,
    })
    .select(
      "id, auth_user_id, full_name, email, role_id, phone, is_active, created_at, updated_at, role:roles(id, code, name, description, permissions, created_at)",
    )
    .single();

  if (insertError || !insertedUser) {
    await adminClient.auth.admin.deleteUser(authUser.id);
    return jsonResponse({ message: insertError?.message ?? "Unable to save app user." }, 400);
  }

  return jsonResponse({ user: insertedUser });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
