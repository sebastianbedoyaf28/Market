import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { supabase } from '../../../core/supabase-client';
import { Role, RoleInput } from '../models/role.model';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[] | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly table = 'roles';

  list(): Observable<Role[]> {
    return from(this.fetchAll());
  }

  getById(id: string): Observable<Role | null> {
    return from(this.fetchById(id));
  }

  create(payload: RoleInput): Observable<Role> {
    return from(this.createAsync(payload));
  }

  update(id: string, payload: RoleInput): Observable<Role> {
    return from(this.updateAsync(id, payload));
  }

  delete(id: string): Observable<void> {
    return from(this.deleteAsync(id));
  }

  private mapRow(row: RoleRow): Role {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      permissions: row.permissions ?? [],
      createdAt: row.created_at,
    };
  }

  private async fetchAll(): Promise<Role[]> {
    const { data, error } = await supabase()
      .from(this.table)
      .select('id, code, name, description, permissions, created_at')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`No se pudo cargar la lista de roles: ${error.message}`);
    }

    const rows = (data ?? []) as RoleRow[];
    return rows.map(row => this.mapRow(row));
  }

  private async fetchById(id: string): Promise<Role | null> {
    const { data, error } = await supabase()
      .from(this.table)
      .select('id, code, name, description, permissions, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo obtener el rol: ${error.message}`);
    }

    const row = (data as RoleRow | null) ?? null;
    return row ? this.mapRow(row) : null;
  }

  private async createAsync(payload: RoleInput): Promise<Role> {
    const { data, error } = await supabase()
      .from(this.table)
      .insert({
        code: payload.code,
        name: payload.name,
        description: payload.description,
        permissions: payload.permissions,
      })
      .select('id, code, name, description, permissions, created_at')
      .single();

    if (error) {
      throw new Error(this.translateError(error.message, 'crear el rol'));
    }

    return this.mapRow(data as RoleRow);
  }

  private async updateAsync(id: string, payload: RoleInput): Promise<Role> {
    const { data, error } = await supabase()
      .from(this.table)
      .update({
        code: payload.code,
        name: payload.name,
        description: payload.description,
        permissions: payload.permissions,
      })
      .eq('id', id)
      .select('id, code, name, description, permissions, created_at')
      .single();

    if (error) {
      throw new Error(this.translateError(error.message, 'actualizar el rol'));
    }

    return this.mapRow(data as RoleRow);
  }

  private async deleteAsync(id: string): Promise<void> {
    const { error } = await supabase().from(this.table).delete().eq('id', id);
    if (error) {
      throw new Error(this.translateError(error.message, 'eliminar el rol'));
    }
  }

  private translateError(message: string, action: string): string {
    if (/duplicate key value/.test(message) && /roles_code_key/.test(message)) {
      return 'El codigo del rol ya esta en uso.';
    }

    if (/duplicate key value/.test(message) && /roles_name_key/.test(message)) {
      return 'El nombre del rol ya esta en uso.';
    }

    return `No se pudo ${action}: ${message}`;
  }
}
