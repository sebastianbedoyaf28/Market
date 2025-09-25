import { Injectable } from '@angular/core';
import { from, map } from 'rxjs';
import { supabase } from '../core/supabase-client';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  price: number;
  stock: number;
  minStock: number;
  image_url?: string | null;
  expiryDate?: string | null;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductService {

  // === Versión RxJS (ideal para usar con | async en plantillas) ===
  list() {
    return from(
      supabase()
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
    ).pipe(
      map(res => {
        if (res.error) throw res.error;
        return res.data as Product[];
      })
    );
  }

  create(p: Omit<Product, 'id' | 'created_at'>) {
    return from(
      supabase()
        .from('products')
        .insert(p)
        .select()
        .single()
    );
  }

  update(id: string, patch: Partial<Product>) {
    return from(
      supabase()
        .from('products')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
    );
  }

  remove(id: string) {
    return from(
      supabase()
        .from('products')
        .delete()
        .eq('id', id)
    );
  }

  // === Versión async/await (útil si prefieres await en componentes/servicios) ===
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase()
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Product[];
  }
}
