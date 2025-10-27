import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { supabase } from '../../../core/supabase-client';
import { Sale, SaleFilters, SalesSummary, ExportOptions } from '../models/sales.models';

/**
 * Servicio de ventas
 * RF006 - Importación de Ventas Externas
 * RF007 - Historial de Ventas y Reportes
 */
@Injectable({ providedIn: 'root' })
export class SalesService {
  
  /**
   * Lista todas las ventas con filtros opcionales
   * RF007 - Filtros por fecha, estado
   */
  list(filters?: SaleFilters): Observable<Sale[]> {
    return from(this.listAsync(filters));
  }

  private async listAsync(filters?: SaleFilters): Promise<Sale[]> {
    let query = supabase()
      .from('sales')
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        sale_date,
        customer_name,
        invoice_number,
        import_source,
        status,
        user_id,
        created_at,
        updated_at,
        inventory_products!inner (id, name, sku)
      `)
      .order('sale_date', { ascending: false });

    // Aplicar filtros
    if (filters?.dateFrom) {
      query = query.gte('sale_date', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('sale_date', filters.dateTo);
    }
    if (filters?.status && filters.status !== 'all') {
      // La tabla actual no tiene campo status, lo agregaremos más adelante
      // query = query.eq('status', filters.status);
    }
    if (filters?.customerName) {
      query = query.ilike('customer_name', `%${filters.customerName}%`);
    }
    if (filters?.invoiceNumber) {
      query = query.ilike('invoice_number', `%${filters.invoiceNumber}%`);
    }
    if (filters?.importSource && filters.importSource !== 'all') {
      query = query.eq('import_source', filters.importSource);
    }

    const { data, error } = await query;

    if (error) {
      // Error fetching sales
      throw error;
    }

    return (data || []).map(this.mapSaleRow);
  }

  /**
   * Obtiene una venta por ID
   */
  getById(id: string): Observable<Sale | null> {
    return from(this.getByIdAsync(id));
  }

  private async getByIdAsync(id: string): Promise<Sale | null> {
    const { data, error } = await supabase()
      .from('sales')
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        sale_date,
        customer_name,
        invoice_number,
        import_source,
        status,
        user_id,
        created_at,
        updated_at,
        inventory_products!inner (id, name, sku)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      // Error fetching sale
      throw error;
    }

    return data ? this.mapSaleRow(data) : null;
  }

  /**
   * Crea una nueva venta manualmente
   */
  create(sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Observable<Sale> {
    return from(this.createAsync(sale));
  }

  private async createAsync(sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale> {
    // Validaciones RF006/RF007
    if (sale.quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0');
    }
    if (sale.unitPrice < 0) {
      throw new Error('El precio unitario no puede ser negativo');
    }
    if (sale.totalPrice < 0) {
      throw new Error('El precio total no puede ser negativo');
    }

    // Validar fecha
    const saleDate = new Date(sale.saleDate);
    if (isNaN(saleDate.getTime())) {
      throw new Error('Fecha de venta inválida');
    }

    const { data: { user } } = await supabase().auth.getUser();

    const { data, error } = await supabase()
      .from('sales')
      .insert({
        product_id: sale.productId,
        quantity: sale.quantity,
        unit_price: sale.unitPrice,
        total_price: sale.totalPrice,
        sale_date: sale.saleDate,
        customer_name: sale.customerName || null,
        invoice_number: sale.invoiceNumber || null,
        import_source: sale.importSource || 'manual',
        status: sale.status || 'pending',
        user_id: user?.id || null,
      })
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        sale_date,
        customer_name,
        invoice_number,
        import_source,
        status,
        user_id,
        created_at,
        updated_at,
        inventory_products!inner (id, name, sku)
      `)
      .single();

    if (error) {
      // Error creating sale
      throw error;
    }

    return this.mapSaleRow(data);
  }

  /**
   * Actualiza una venta existente
   */
  update(id: string, patch: Partial<Sale>): Observable<Sale> {
    return from(this.updateAsync(id, patch));
  }

  private async updateAsync(id: string, patch: Partial<Sale>): Promise<Sale> {
    // Validaciones
    if (patch.quantity !== undefined && patch.quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0');
    }
    if (patch.unitPrice !== undefined && patch.unitPrice < 0) {
      throw new Error('El precio unitario no puede ser negativo');
    }
    if (patch.totalPrice !== undefined && patch.totalPrice < 0) {
      throw new Error('El precio total no puede ser negativo');
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (patch.quantity !== undefined) updateData.quantity = patch.quantity;
    if (patch.unitPrice !== undefined) updateData.unit_price = patch.unitPrice;
    if (patch.totalPrice !== undefined) updateData.total_price = patch.totalPrice;
    if (patch.saleDate !== undefined) updateData.sale_date = patch.saleDate;
    if (patch.customerName !== undefined) updateData.customer_name = patch.customerName;
    if (patch.invoiceNumber !== undefined) updateData.invoice_number = patch.invoiceNumber;
    if (patch.importSource !== undefined) updateData.import_source = patch.importSource;
    if (patch.status !== undefined) updateData.status = patch.status;

    const { data, error } = await supabase()
      .from('sales')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        sale_date,
        customer_name,
        invoice_number,
        import_source,
        status,
        user_id,
        created_at,
        updated_at,
        inventory_products!inner (id, name, sku)
      `)
      .single();

    if (error) {
      // Error updating sale
      throw error;
    }

    return this.mapSaleRow(data);
  }

  /**
   * Elimina una venta
   */
  delete(id: string): Observable<void> {
    return from(this.deleteAsync(id));
  }

  private async deleteAsync(id: string): Promise<void> {
    const { error } = await supabase()
      .from('sales')
      .delete()
      .eq('id', id);

    if (error) {
      // Error deleting sale
      throw error;
    }
  }

  /**
   * Obtiene un resumen de ventas con estadísticas
   * RF007 - Análisis de ventas
   */
  getSummary(filters?: SaleFilters): Observable<SalesSummary> {
    return from(this.getSummaryAsync(filters));
  }

  private async getSummaryAsync(filters?: SaleFilters): Promise<SalesSummary> {
    const sales = await this.listAsync(filters);

    const summary: SalesSummary = {
      totalSales: sales.length,
      totalAmount: sales.reduce((sum, sale) => sum + Number(sale.totalPrice), 0),
      totalQuantity: sales.reduce((sum, sale) => sum + sale.quantity, 0),
      byStatus: {
        pending: sales.filter(s => s.status === 'pending').length,
        reconciled: sales.filter(s => s.status === 'reconciled').length,
        cancelled: sales.filter(s => s.status === 'cancelled').length,
      },
      bySource: {
        manual: sales.filter(s => s.importSource === 'manual').length,
        csv_excel_import: sales.filter(s => s.importSource === 'csv_excel_import').length,
        pos_system: sales.filter(s => s.importSource === 'pos_system').length,
      },
    };

    return summary;
  }

  /**
   * Exporta ventas a CSV
   * RF007 - Exportación con filtros aplicados
   */
  async exportToCSV(filters?: SaleFilters): Promise<Blob> {
    const sales = await this.listAsync(filters);

    const headers = [
      'Fecha',
      'Producto',
      'SKU',
      'Cantidad',
      'Precio Unitario',
      'Total',
      'Cliente',
      'Factura',
      'Origen',
      'Estado',
    ];

    const rows = sales.map(sale => [
      sale.saleDate,
      sale.productName || '',
      sale.productSku || '',
      sale.quantity.toString(),
      sale.unitPrice.toFixed(2),
      sale.totalPrice.toFixed(2),
      sale.customerName || '',
      sale.invoiceNumber || '',
      this.getImportSourceLabel(sale.importSource),
      this.getStatusLabel(sale.status),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Exporta ventas a PDF
   * RF007 - Exportación con filtros aplicados
   */
  async exportToPDF(filters?: SaleFilters): Promise<Blob> {
    const { jsPDF } = await import('jspdf');
    const sales = await this.listAsync(filters);
    const summary = await this.getSummaryAsync(filters);

    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(20);
    doc.text('REPORTE DE VENTAS', 14, 20);
    
    // Información del reporte
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total de ventas: ${summary.totalSales}`, 14, 36);
    doc.text(`Monto total: $${summary.totalAmount.toFixed(2)}`, 14, 42);
    doc.text(`Cantidad total: ${summary.totalQuantity}`, 14, 48);
    
    // Encabezados de la tabla
    let yPos = 60;
    const pageHeight = doc.internal.pageSize.height;
    
    if (sales.length > 0) {
      doc.setFontSize(12);
      doc.text('DETALLE DE VENTAS', 14, yPos);
      yPos += 10;
      
      sales.forEach((sale, index) => {
        // Verificar si necesitamos una nueva página
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(9);
        doc.text(`${index + 1}. ${sale.saleDate}`, 14, yPos);
        yPos += 6;
        
        doc.text(`Producto: ${sale.productName || 'N/A'}`, 16, yPos);
        yPos += 6;
        
        doc.text(`Cantidad: ${sale.quantity} | Total: $${sale.totalPrice.toFixed(2)}`, 16, yPos);
        yPos += 8;
      });
    }
    
    return doc.output('blob');
  }

  /**
   * Mapea una fila de la BD al modelo Sale
   */
  private mapSaleRow(row: any): Sale {
    return {
      id: row.id,
      productId: row.product_id,
      productName: row.inventory_products?.name,
      productSku: row.inventory_products?.sku,
      quantity: row.quantity,
      unitPrice: Number(row.unit_price),
      totalPrice: Number(row.total_price),
      saleDate: row.sale_date,
      customerName: row.customer_name,
      invoiceNumber: row.invoice_number,
      importSource: row.import_source,
      status: row.status || 'pending',
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Obtiene la etiqueta de origen de importación
   */
  private getImportSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      manual: 'Manual',
      csv_excel_import: 'CSV/Excel',
      pos_system: 'Sistema POS',
    };
    return labels[source] || source;
  }

  /**
   * Obtiene la etiqueta de estado
   */
  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      reconciled: 'Conciliada',
      cancelled: 'Anulada',
    };
    return labels[status] || status;
  }
}

