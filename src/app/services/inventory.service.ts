import { Injectable } from '@angular/core';
import { from } from 'rxjs';
import { supabase } from '../core/supabase-client';

export interface InventoryMovement {
  id: string;
  productId: string;
  type: 'entrada' | 'salida';
  quantity: number;
  reason: 'compra' | 'venta' | 'ajuste' | 'merma' | 'inicial';
  lotNumber?: string;
  expiryDate?: string;
  notes?: string;
  userId: string;
  createdAt: string;
}

export interface ProductLot {
  id: string;
  productId: string;
  lotNumber: string;
  quantity: number;
  remainingQuantity: number;
  expiryDate?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {

  // Registrar movimiento de inventario
  async recordMovement(movement: Omit<InventoryMovement, 'id' | 'createdAt'>) {
    return from(
      supabase()
        .from('inventory_movements')
        .insert(movement)
        .select()
        .single()
    );
  }

  // Obtener movimientos de un producto
  async getProductMovements(productId: string) {
    return from(
      supabase()
        .from('inventory_movements')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
    );
  }

  // Obtener historial de movimientos
  async getMovementHistory(limit = 100) {
    return from(
      supabase()
        .from('inventory_movements')
        .select(`
          *,
          products!inner(name, sku)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
    );
  }

  // Calcular stock actual de un producto
  async calculateCurrentStock(productId: string): Promise<number> {
    const { data: movements, error } = await supabase()
      .from('inventory_movements')
      .select('type, quantity')
      .eq('product_id', productId);

    if (error) throw error;

    let stock = 0;
    movements?.forEach(movement => {
      if (movement.type === 'entrada') {
        stock += movement.quantity;
      } else if (movement.type === 'salida') {
        stock -= movement.quantity;
      }
    });

    return Math.max(0, stock);
  }

  // Obtener productos con stock bajo
  async getLowStockProducts() {
    return from(
      supabase()
        .from('products')
        .select('*')
        .filter('stock', 'lte', 'min_stock')
    );
  }

  // Obtener productos próximos a caducar
  async getExpiringProducts(days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return from(
      supabase()
        .from('products')
        .select('*')
        .not('expiry_date', 'is', null)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .gt('stock', 0)
    );
  }

  // Ajuste de inventario
  async adjustInventory(productId: string, quantity: number, reason: string, notes?: string) {
    const currentStock = await this.calculateCurrentStock(productId);
    const adjustment = quantity - currentStock;
    
    if (adjustment === 0) return;

    const movement: Omit<InventoryMovement, 'id' | 'createdAt'> = {
      productId,
      type: adjustment > 0 ? 'entrada' : 'salida',
      quantity: Math.abs(adjustment),
      reason: 'ajuste',
      notes: `${reason}. ${notes || ''}`,
      userId: 'current-user-id' // Obtener del servicio de auth
    };

    return this.recordMovement(movement);
  }

  // Registrar entrada de mercancía
  async registerEntry(
    productId: string, 
    quantity: number, 
    lotNumber?: string, 
    expiryDate?: string,
    notes?: string
  ) {
    const movement: Omit<InventoryMovement, 'id' | 'createdAt'> = {
      productId,
      type: 'entrada',
      quantity,
      reason: 'compra',
      lotNumber,
      expiryDate,
      notes,
      userId: 'current-user-id'
    };

    return this.recordMovement(movement);
  }

  // Registrar salida de mercancía
  async registerExit(
    productId: string, 
    quantity: number, 
    reason: 'venta' | 'merma' = 'venta',
    notes?: string
  ) {
    const movement: Omit<InventoryMovement, 'id' | 'createdAt'> = {
      productId,
      type: 'salida',
      quantity,
      reason,
      notes,
      userId: 'current-user-id'
    };

    return this.recordMovement(movement);
  }

  // Obtener reporte de inventario
  async getInventoryReport() {
    return from(
      supabase()
        .from('products')
        .select(`
          *,
          inventory_movements!inner(type, quantity, created_at)
        `)
        .order('created_at', { ascending: false })
    );
  }
}
