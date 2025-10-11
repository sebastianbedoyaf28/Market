import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { supabase } from '../../../core/supabase-client';
import { AppUser, UpsertUserPayload } from '../models/user.model';
import { Role } from '../../roles/models/role.model';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[] | null;
  created_at: string;
}

interface AppUserRow {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role_id: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role: RoleRow | RoleRow[] | null;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly table = 'app_users';

  list(): Observable<AppUser[]> {
    return from(this.fetchAll());
  }

  getById(id: string): Observable<AppUser | null> {
    return from(this.fetchById(id));
  }

  getByEmail(email: string): Observable<AppUser | null> {
    return from(this.fetchByEmail(email));
  }

  create(payload: UpsertUserPayload): Observable<AppUser> {
    return from(this.createAsync(payload));
  }

  update(id: string, payload: UpsertUserPayload): Observable<AppUser> {
    return from(this.updateAsync(id, payload));
  }

  delete(id: string): Observable<void> {
    return from(this.deleteAsync(id));
  }

  private async fetchAll(): Promise<AppUser[]> {
    const { data, error } = await supabase()
      .from(this.table)
      .select(
        'id, auth_user_id, full_name, email, role_id, phone, is_active, created_at, updated_at, role:roles(id, code, name, description, permissions, created_at)',
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`No se pudo obtener la lista de usuarios: ${error.message}`);
    }

    const rows = (data ?? []) as AppUserRow[];
    return rows.map(row => this.mapRow(row));
  }

  private async fetchById(id: string): Promise<AppUser | null> {
    const { data, error } = await supabase()
      .from(this.table)
      .select(
        'id, auth_user_id, full_name, email, role_id, phone, is_active, created_at, updated_at, role:roles(id, code, name, description, permissions, created_at)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo obtener el usuario: ${error.message}`);
    }

    const row = (data as AppUserRow | null) ?? null;
    return row ? this.mapRow(row) : null;
  }

  private async fetchByEmail(email: string): Promise<AppUser | null> {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await supabase()
      .from(this.table)
      .select(
        'id, auth_user_id, full_name, email, role_id, phone, is_active, created_at, updated_at, role:roles(id, code, name, description, permissions, created_at)',
      )
      .eq('email', normalized)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo obtener el usuario por correo: ${error.message}`);
    }

    const row = (data as AppUserRow | null) ?? null;
    return row ? this.mapRow(row) : null;
  }

  private async createAsync(payload: UpsertUserPayload): Promise<AppUser> {
    const { data, error } = await supabase()
      .from(this.table)
      .insert({
        full_name: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        role_id: payload.roleId,
        phone: payload.phone?.trim() ?? null,
        is_active: payload.isActive ?? true,
      })
      .select(
        'id, auth_user_id, full_name, email, role_id, phone, is_active, created_at, updated_at, role:roles(id, code, name, description, permissions, created_at)',
      )
      .single();

    if (error) {
      throw new Error(this.translateError(error.message, 'crear el usuario'));
    }

    return this.mapRow(data as unknown as AppUserRow);
  }

  private async updateAsync(id: string, payload: UpsertUserPayload): Promise<AppUser> {
    const { data, error } = await supabase()
      .from(this.table)
      .update({
        full_name: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        role_id: payload.roleId,
        phone: payload.phone?.trim() ?? null,
        is_active: payload.isActive ?? true,
      })
      .eq('id', id)
      .select(
        'id, auth_user_id, full_name, email, role_id, phone, is_active, created_at, updated_at, role:roles(id, code, name, description, permissions, created_at)',
      )
      .single();

    if (error) {
      throw new Error(this.translateError(error.message, 'actualizar el usuario'));
    }

    return this.mapRow(data as unknown as AppUserRow);
  }

  private async deleteAsync(id: string): Promise<void> {
    const { error } = await supabase().from(this.table).delete().eq('id', id);
    if (error) {
      throw new Error(this.translateError(error.message, 'eliminar el usuario'));
    }
  }

  private mapRow(row: AppUserRow): AppUser {
    const roleData = Array.isArray(row.role) ? row.role[0] ?? null : row.role;
    const role = roleData ? this.mapRole(roleData) : undefined;
    return {
      id: row.id,
      authUserId: row.auth_user_id ?? undefined,
      fullName: row.full_name,
      email: row.email,
      roleId: row.role_id,
      roleName: role?.name,
      permissions: role?.permissions ?? [],
      phone: row.phone,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRole(row: RoleRow): Role {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      permissions: row.permissions ?? [],
      createdAt: row.created_at,
    };
  }

  private translateError(message: string, action: string): string {
    if (/duplicate key value/.test(message) && /app_users_email_key/.test(message)) {
      return 'El correo ya esta registrado.';
    }

    if (/app_users_email_format/.test(message)) {
      return 'El correo no tiene un formato valido.';
    }

    return `No se pudo ${action}: ${message}`;
  }
}

