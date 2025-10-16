/**
 * Modelos de datos para el módulo de ventas
 * RF006 - Importación de Ventas Externas
 * RF007 - Historial de Ventas y Reportes
 */

export interface Sale {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  saleDate: string; // Format: YYYY-MM-DD
  customerName?: string;
  invoiceNumber?: string;
  importSource: 'manual' | 'csv_excel_import' | 'pos_system';
  status: 'pending' | 'reconciled' | 'cancelled';
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface SaleFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: 'pending' | 'reconciled' | 'cancelled' | 'all';
  customerName?: string;
  invoiceNumber?: string;
  productName?: string;
  importSource?: 'manual' | 'csv_excel_import' | 'pos_system' | 'all';
}

export interface SalesSummary {
  totalSales: number;
  totalAmount: number;
  totalQuantity: number;
  byStatus: {
    pending: number;
    reconciled: number;
    cancelled: number;
  };
  bySource: {
    manual: number;
    csv_excel_import: number;
    pos_system: number;
  };
}

export interface ExportOptions {
  format: 'csv' | 'pdf';
  filters?: SaleFilters;
}

