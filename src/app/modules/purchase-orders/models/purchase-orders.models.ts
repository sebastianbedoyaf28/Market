export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';

export interface Supplier {
  id: string;
  name: string;
  email?: string | null;
}

export interface PurchaseOrderItem {
  productId: string;
  sku?: string;
  name?: string;
  quantityOrdered: number; // > 0
  quantityReceived?: number; // 0..=quantityOrdered
  unitCost?: number; // Costo unitario del producto
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName?: string;
  supplierEmail?: string | null;
  expectedDate: string; // ISO futura
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}


