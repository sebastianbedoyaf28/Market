import { Injectable } from '@angular/core';
import { supabase } from '../../../core/supabase-client';
import { InventoryService } from '../../inventory/services/inventory.service';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Supplier } from '../models/purchase-orders.models';

@Injectable({ providedIn: 'root' })
export class PurchaseOrdersService {
  constructor(private inventory: InventoryService) {}

  // Tablas esperadas: purchase_orders, purchase_order_items, suppliers
  async list(): Promise<PurchaseOrder[]> {
    const { data, error } = await supabase()
      .from('purchase_orders')
      .select('id, supplier_id, expected_date, status, created_at, updated_at, suppliers:supplier_id(id, name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const orders = (data || []).map((row: any) => this.mapOrderRow(row));
    return orders;
  }

  async getById(id: string): Promise<PurchaseOrder | null> {
    const { data, error } = await supabase()
      .from('purchase_orders')
      .select('id, supplier_id, expected_date, status, created_at, updated_at, suppliers:supplier_id(id, name, email)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const order = this.mapOrderRow(data);

    const { data: items, error: itemsErr } = await supabase()
      .from('purchase_order_items')
      .select('product_id, quantity_ordered, quantity_received, unit_cost')
      .eq('order_id', id);
    if (itemsErr) throw itemsErr;
    order.items = (items || []).map((it: any) => ({
      productId: it.product_id,
      quantityOrdered: it.quantity_ordered,
      quantityReceived: it.quantity_received,
      unitCost: it.unit_cost ?? undefined,
    }));
    return order;
  }

  async create(payload: { supplierId: string; expectedDate: string; items: PurchaseOrderItem[] }): Promise<PurchaseOrder> {
    if (!payload.supplierId) throw new Error('Proveedor requerido');
    if (!payload.expectedDate || new Date(payload.expectedDate) <= new Date()) throw new Error('Fecha de entrega futura requerida');
    if (!payload.items.length || payload.items.some(i => i.quantityOrdered <= 0)) throw new Error('Todas las cantidades deben ser > 0');

    const now = new Date().toISOString();
    const { data: order, error } = await supabase()
      .from('purchase_orders')
      .insert({ supplier_id: payload.supplierId, expected_date: payload.expectedDate, status: 'DRAFT', created_at: now, updated_at: now })
      .select()
      .single();
    if (error) throw error;

    const itemsRows = payload.items.map(it => ({
      order_id: order.id,
      product_id: it.productId,
      quantity_ordered: it.quantityOrdered,
      quantity_received: 0,
      unit_cost: it.unitCost ?? null,
    }));
    const { error: itemsErr } = await supabase().from('purchase_order_items').insert(itemsRows);
    if (itemsErr) throw itemsErr;

    return (await this.getById(order.id))!;
  }

  async changeStatus(id: string, status: PurchaseOrderStatus): Promise<void> {
    const valid: PurchaseOrderStatus[] = ['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'];
    if (!valid.includes(status)) throw new Error('Estado no válido');
    const { error } = await supabase().from('purchase_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  async receive(id: string, receivedItems: Array<{ productId: string; quantityReceived: number }>): Promise<PurchaseOrder> {
    const order = await this.getById(id);
    if (!order) throw new Error('Pedido no encontrado');

    // Validaciones RF009
    const byId = new Map(order.items.map(i => [i.productId, i]));
    for (const r of receivedItems) {
      if (r.quantityReceived < 0) throw new Error('Cantidad recibida debe ser ≥ 0');
      const orig = byId.get(r.productId);
      if (!orig) throw new Error('Producto del pedido no encontrado');
      if (r.quantityReceived > orig.quantityOrdered) throw new Error('Recibido no puede superar lo solicitado');
    }

    // Actualizar cantidades recibidas
    for (const r of receivedItems) {
      await supabase()
        .from('purchase_order_items')
        .update({ quantity_received: r.quantityReceived })
        .eq('order_id', id)
        .eq('product_id', r.productId);
    }

    // Incrementar stock en inventario por diferencia recibida
    for (const r of receivedItems) {
      const orig = byId.get(r.productId)!;
      const delta = r.quantityReceived; // ya validado 0..=ordered
      if (delta > 0) {
        await this.inventory.recordMovement({
          productId: r.productId,
          type: 'IN',
          reason: 'purchase',
          quantity: delta,
          note: `Recepción de pedido ${id}`,
        }).toPromise();
      }
    }

    // Estado a RECIBIDO si todo llegó, de lo contrario queda SENT
    const allReceived = order.items.every(it => {
      const r = receivedItems.find(x => x.productId === it.productId)?.quantityReceived ?? 0;
      return r >= it.quantityOrdered;
    });
    await this.changeStatus(id, allReceived ? 'RECEIVED' : 'SENT');
    return (await this.getById(id))!;
  }

  // TODO RF008: exportación PDF y envío por correo (stub)
  async exportPdf(_id: string): Promise<Blob> {
    return new Blob([`Pedido PDF`], { type: 'application/pdf' });
  }

  async sendByEmail(_id: string): Promise<void> {
    // Integrar servicio de correo (Supabase Functions / SMTP) en el futuro
  }

  private mapOrderRow(row: any): PurchaseOrder {
    return {
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.suppliers?.name ?? undefined,
      supplierEmail: row.suppliers?.email ?? undefined,
      expectedDate: row.expected_date,
      status: row.status,
      items: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}


