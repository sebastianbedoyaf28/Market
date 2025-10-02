import { Injectable } from '@angular/core';
import { InventoryService } from '../../inventory/services/inventory.service';

export interface AlertItem {
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON';
  productId: string;
  name: string;
  sku: string;
  details: string;
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
  constructor(private inventory: InventoryService) {}

  async list(): Promise<AlertItem[]> {
    const items = await this.inventory.list().toPromise();
    const alerts: AlertItem[] = [];
    const now = Date.now();
    const in30d = now + 30 * 24 * 60 * 60 * 1000;

    for (const p of items || []) {
      if (p.totalStock <= 0) {
        alerts.push({ type: 'OUT_OF_STOCK', productId: p.id, name: p.name, sku: p.sku, details: 'Producto agotado' });
        continue;
      }
      if (p.status === 'LOW') {
        alerts.push({ type: 'LOW_STOCK', productId: p.id, name: p.name, sku: p.sku, details: `Stock bajo: ${p.totalStock}` });
      }
      if (p.nextExpiryDate) {
        const t = new Date(p.nextExpiryDate).getTime();
        if (t <= in30d && t >= now) {
          const days = Math.ceil((t - now) / (1000 * 60 * 60 * 24));
          alerts.push({ type: 'EXPIRING_SOON', productId: p.id, name: p.name, sku: p.sku, details: `Vence en ${days} días` });
        }
      }
    }
    return alerts;
  }
}


