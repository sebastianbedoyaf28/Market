/**
 * Modelos de datos para el módulo de Punto de Ventas (POS)
 * Se integra con el módulo de ventas existente
 */

export interface POSProduct {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  category?: string;
}

export interface POSCartItem {
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  stock: number; // Stock disponible
}

export interface POSCart {
  items: POSCartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  itemsCount: number;
}

export interface POSCustomer {
  name: string;
  email?: string;
  phone?: string;
}

export interface POSTransaction {
  cart: POSCart;
  customer?: POSCustomer;
  invoiceNumber?: string;
  paymentMethod: 'cash' | 'card' | 'transfer';
  notes?: string;
  saleDate: string;
}

export interface POSCompletedSale {
  id: string;
  invoiceNumber: string;
  total: number;
  itemsCount: number;
  customer?: POSCustomer;
  saleDate: string;
  salesIds: string[]; // IDs de las ventas individuales creadas
}

