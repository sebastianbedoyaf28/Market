import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase-client';

interface Cart {
  id: string;
  user_id: string;
  status: 'open' | 'ordered';
  created_at: string;
}

interface CartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  qty: number;
}

interface ProductRow {
  id: string;
  price: number;
  name?: string | null;
  created_at?: string;
}

export interface DashboardActivity {
  icon: string;
  title: string;
  description: string;
  time: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'medium';
}

@Injectable({ providedIn: 'root' })
export class CartService {
  async countPendingOrders(): Promise<number> {
    // Contar carritos abiertos (pedidos de clientes)
    const { count: cartCount, error: cartError } = await supabase()
      .from('carts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');
    if (cartError) throw cartError;

    // Contar pedidos de proveedores enviados (pendientes de recepción)
    const { count: purchaseOrderCount, error: poError } = await supabase()
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'SENT');
    if (poError) throw poError;

    return (cartCount || 0) + (purchaseOrderCount || 0);
  }

  async sumTodaySales(): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const { data: carts, error: cartsErr } = await supabase()
      .from('carts')
      .select('id, created_at, status')
      .eq('status', 'ordered')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (cartsErr) throw cartsErr;
    const cartIds = (carts || []).map(c => c.id);
    if (cartIds.length === 0) return 0;

    const { data: items, error: itemsErr } = await supabase()
      .from('cart_items')
      .select('id, cart_id, product_id, qty')
      .in('cart_id', cartIds);

    if (itemsErr) throw itemsErr;
    const productIds = Array.from(new Set((items || []).map(i => i.product_id)));
    if (productIds.length === 0) return 0;

    const { data: products, error: prodErr } = await supabase()
      .from('products')
      .select('id, price')
      .in('id', productIds);

    if (prodErr) throw prodErr;
    const priceById = new Map<string, number>((products || []).map(p => [p.id, Number(p.price) || 0]));

    return (items || []).reduce((sum, item) => {
      const price = priceById.get(item.product_id) ?? 0;
      return sum + price * (item.qty || 0);
    }, 0);
  }

  async recentActivities(limit = 10): Promise<DashboardActivity[]> {
    // Últimos productos creados
    const { data: recentProducts } = await supabase()
      .from('products')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Últimos carritos (pedidos) creados u ordenados
    const { data: recentCarts } = await supabase()
      .from('carts')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Últimos pedidos de proveedores
    const { data: recentPurchaseOrders } = await supabase()
      .from('purchase_orders')
      .select('id, status, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    const activities: DashboardActivity[] = [];

    for (const p of recentProducts || []) {
      activities.push({
        icon: 'add-circle-outline',
        title: 'Nuevo producto',
        description: `${p.name || 'Producto'} agregado`,
        time: this.relativeTime(p.created_at),
        color: 'success'
      });
    }

    for (const c of recentCarts || []) {
      const isOrdered = c.status === 'ordered';
      activities.push({
        icon: isOrdered ? 'receipt-outline' : 'cart-outline',
        title: isOrdered ? 'Pedido confirmado' : 'Carrito creado',
        description: isOrdered ? `Pedido ${c.id.slice(0, 6)} confirmado` : `Carrito ${c.id.slice(0, 6)} creado`,
        time: this.relativeTime(c.created_at),
        color: isOrdered ? 'primary' : 'medium'
      });
    }

    for (const po of recentPurchaseOrders || []) {
      let icon = 'cube-outline';
      let title = 'Pedido a proveedor';
      let description = `Pedido ${po.id.slice(0, 6)}`;
      let color: 'primary' | 'success' | 'warning' | 'danger' | 'medium' = 'primary';

      switch (po.status) {
        case 'DRAFT':
          icon = 'document-outline';
          title = 'Borrador de pedido';
          color = 'medium';
          break;
        case 'SENT':
          icon = 'send-outline';
          title = 'Pedido enviado';
          color = 'warning';
          break;
        case 'RECEIVED':
          icon = 'checkmark-circle-outline';
          title = 'Pedido recibido';
          color = 'success';
          break;
        case 'CANCELLED':
          icon = 'close-circle-outline';
          title = 'Pedido cancelado';
          color = 'danger';
          break;
      }

      activities.push({
        icon,
        title,
        description,
        time: this.relativeTime(po.updated_at || po.created_at),
        color
      });
    }

    // Ordenar y cortar al límite
    activities.sort((a, b) => (a.time > b.time ? -1 : 1));
    return activities.slice(0, limit);
  }

  private relativeTime(dateIso?: string): string {
    if (!dateIso) return '';
    const diff = Date.now() - new Date(dateIso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs} h`;
    const days = Math.floor(hrs / 24);
    return `${days} d`;
  }
}


