import { Injectable } from '@angular/core';
import { supabase } from '../../../core/supabase-client';

export interface SupplierRow {
  id: string;
  name: string;
  email?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  async list(): Promise<SupplierRow[]> {
    const { data, error } = await supabase()
      .from('suppliers')
      .select('id, name, email')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as SupplierRow[];
  }

  async create(input: { name: string; email?: string | null }): Promise<SupplierRow> {
    if (!input.name || !input.name.trim()) {
      throw new Error('El nombre es obligatorio');
    }
    const { data, error } = await supabase()
      .from('suppliers')
      .insert({ name: input.name.trim(), email: input.email?.trim() || null })
      .select('id, name, email')
      .single();
    if (error) throw error;
    return data as SupplierRow;
  }
}


