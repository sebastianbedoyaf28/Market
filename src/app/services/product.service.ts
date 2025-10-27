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

  // === Búsqueda y filtros avanzados ===
  async searchProducts(filters: ProductSearchFilters): Promise<Product[]> {
    try {
      // Si no hay filtros, devolver todos los productos
      if (!filters.searchTerm && !filters.category && !filters.productStatus && 
          filters.minPrice === undefined && filters.maxPrice === undefined) {
        return await this.getProducts();
      }

      let query = supabase()
        .from('products')
        .select('*');

      // Búsqueda por texto (nombre, SKU, categoría)
      if (filters.searchTerm) {
        query = query.or(`name.ilike.%${filters.searchTerm}%,sku.ilike.%${filters.searchTerm}%,category.ilike.%${filters.searchTerm}%`);
      }

      // Filtro por categoría
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      // Filtro por rango de precios
      if (filters.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }

      // Filtro por stock mínimo
      if (filters.minStock !== undefined) {
        query = query.gte('stock', filters.minStock);
      }

      // Filtro por estado del producto
      if (filters.productStatus) {
        switch (filters.productStatus) {
          case 'stock_bajo':
            query = query.filter('stock', 'lte', 'min_stock');
            break;
          case 'agotado':
            query = query.eq('stock', 0);
            break;
          case 'proximo_vencer':
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            query = query.lte('expiry_date', futureDate.toISOString().split('T')[0])
                         .gt('stock', 0);
            break;
          case 'normal':
            query = query.filter('stock', 'gt', 'min_stock');
            break;
        }
      }

      // Filtro por proveedor (si existe la relación)
      if (filters.supplierId) {
        query = query.eq('supplier_id', filters.supplierId);
      }

      // Filtro por productos activos (solo si existe el campo)
      // if (filters.activeOnly !== false) {
      //   query = query.eq('is_active', true);
      // }

      // Ordenamiento
      const orderBy = filters.sortBy || 'name';
      const ascending = filters.sortDirection !== 'desc';
      query = query.order(orderBy, { ascending });

      // Límite de resultados
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        // Error en búsqueda
        throw error;
      }
      
      return data as Product[];
    } catch (error) {
      // Error en searchProducts
      // Si hay error, devolver productos sin filtros
      return await this.getProducts();
    }
  }

  // Obtener productos con stock bajo
  async getLowStockProducts(): Promise<Product[]> {
    const { data, error } = await supabase()
      .from('products')
      .select('*')
      .lte('stock', 'min_stock')
      .eq('is_active', true);

    if (error) throw error;
    return data as Product[];
  }

  // Obtener productos próximos a caducar
  async getExpiringProducts(days = 30): Promise<Product[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase()
      .from('products')
      .select('*')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', futureDate.toISOString().split('T')[0])
      .gt('stock', 0)
      .eq('is_active', true);

    if (error) throw error;
    return data as Product[];
  }

  // Obtener categorías únicas
  async getCategories(): Promise<string[]> {
    try {
      const { data, error } = await supabase()
        .from('products')
        .select('category')
        .not('category', 'is', null);

      if (error) {
        // Error obteniendo categorías
        // Devolver categorías por defecto si hay error
        return [
          'Alimentos',
          'Bebidas',
          'Lácteos',
          'Carnes',
          'Frutas y Verduras',
          'Panadería',
          'Limpieza',
          'Higiene',
          'Otros'
        ];
      }
      
      const categories = [...new Set(data?.map(item => item.category).filter(Boolean))];
      return categories.sort();
    } catch (error) {
      // Error en getCategories
      return [
        'Alimentos',
        'Bebidas',
        'Lácteos',
        'Carnes',
        'Frutas y Verduras',
        'Panadería',
        'Limpieza',
        'Higiene',
        'Otros'
      ];
    }
  }

  // Obtener rango de precios
  async getPriceRange(): Promise<{ min: number; max: number }> {
    try {
      const { data, error } = await supabase()
        .from('products')
        .select('price');

      if (error) {
        // Error obteniendo rango de precios
        return { min: 0, max: 1000 };
      }

      const prices = data?.map(item => item.price).filter(price => price > 0) || [];
      
      if (prices.length === 0) {
        return { min: 0, max: 1000 };
      }
      
      return {
        min: Math.min(...prices),
        max: Math.max(...prices)
      };
    } catch (error) {
      // Error en getPriceRange
      return { min: 0, max: 1000 };
    }
  }
}

// === Interfaces para filtros ===
export interface ProductSearchFilters {
  searchTerm?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  productStatus?: 'stock_bajo' | 'agotado' | 'proximo_vencer' | 'normal';
  supplierId?: string;
  activeOnly?: boolean;
  sortBy?: 'name' | 'price' | 'stock' | 'category' | 'created_at';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

export interface ProductStatusCount {
  total: number;
  stock_bajo: number;
  agotado: number;
  proximo_vencer: number;
  normal: number;
}
