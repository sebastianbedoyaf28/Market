import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { supabase } from '../core/supabase-client';
import { AuthService } from './auth.service';
import { InventoryService } from './inventory.service';

export interface ExportOptions {
  type: 'inventory' | 'sales' | 'orders';
  format: 'csv' | 'pdf';
  dateFrom?: string;
  dateTo?: string;
  includeMetadata?: boolean;
}

export interface ExportMetadata {
  exportedBy: string;
  exportedAt: string;
  reportType: string;
  format: string;
  dateRange?: {
    from: string;
    to: string;
  };
  totalRecords: number;
}

export interface ExportHistory {
  id: string;
  userId: string;
  userName: string;
  reportType: string;
  format: string;
  dateFrom?: string;
  dateTo?: string;
  totalRecords: number;
  fileName: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor(
    private auth: AuthService,
    private inventoryService: InventoryService
  ) {}

  /**
   * Exporta datos según las opciones especificadas
   */
  async exportData(options: ExportOptions): Promise<{ success: boolean; fileName?: string; error?: string }> {
    try {
      const user = this.auth.user;
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener datos según el tipo
      let data: any[] = [];
      let fileName = '';
      
      switch (options.type) {
        case 'inventory':
          data = await this.getInventoryData(options.dateFrom, options.dateTo);
          fileName = `inventario_${this.getDateString()}`;
          break;
        case 'sales':
          data = await this.getSalesData(options.dateFrom, options.dateTo);
          fileName = `ventas_${this.getDateString()}`;
          break;
        case 'orders':
          data = await this.getOrdersData(options.dateFrom, options.dateTo);
          fileName = `pedidos_${this.getDateString()}`;
          break;
        default:
          throw new Error('Tipo de exportación no válido');
      }

      if (data.length === 0) {
        throw new Error('No hay datos para exportar en el rango seleccionado');
      }

      // Crear metadata
      const metadata: ExportMetadata = {
        exportedBy: user.email || 'Usuario',
        exportedAt: new Date().toISOString(),
        reportType: options.type,
        format: options.format,
        dateRange: options.dateFrom && options.dateTo ? {
          from: options.dateFrom,
          to: options.dateTo
        } : undefined,
        totalRecords: data.length
      };

      // Exportar según el formato
      if (options.format === 'csv') {
        await this.exportToCSV(data, fileName, metadata, options.includeMetadata);
      } else {
        await this.exportToPDF(data, fileName, metadata, options.type);
      }

      // Registrar en historial
      await this.saveExportHistory({
        userId: user.id,
        userName: user.email || 'Usuario',
        reportType: options.type,
        format: options.format,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        totalRecords: data.length,
        fileName: `${fileName}.${options.format}`,
        createdAt: new Date().toISOString()
      });

      return { success: true, fileName: `${fileName}.${options.format}` };
    } catch (error) {
      console.error('Error en exportación:', error);
      return { success: false, error: `${error}` };
    }
  }

  /**
   * Obtiene datos de inventario
   */
  private async getInventoryData(dateFrom?: string, dateTo?: string): Promise<any[]> {
    let query = supabase()
      .from('products')
      .select(`
        *,
        inventory_movements!inner(
          type,
          quantity,
          reason,
          created_at,
          notes
        )
      `)
      .order('created_at', { ascending: false });

    if (dateFrom) {
      query = query.gte('inventory_movements.created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('inventory_movements.created_at', dateTo);
    }

    const { data, error } = await query;
    
    if (error) throw error;

    // Procesar datos para el reporte
    return (data || []).map(product => {
      const movements = Array.isArray(product.inventory_movements) 
        ? product.inventory_movements 
        : [product.inventory_movements];
      
      return movements.map((movement: any) => ({
        'SKU': product.sku || 'N/A',
        'Nombre del Producto': product.name,
        'Precio': product.price,
        'Tipo de Movimiento': movement.type === 'entrada' ? 'Entrada' : 'Salida',
        'Cantidad': movement.quantity,
        'Razón': this.translateReason(movement.reason),
        'Fecha': new Date(movement.created_at).toLocaleDateString('es-ES'),
        'Notas': movement.notes || ''
      }));
    }).flat();
  }

  /**
   * Obtiene datos de ventas
   */
  private async getSalesData(dateFrom?: string, dateTo?: string): Promise<any[]> {
    let query = supabase()
      .from('sales')
      .select(`
        *,
        products!inner(name, sku)
      `)
      .order('sale_date', { ascending: false });

    if (dateFrom) {
      query = query.gte('sale_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('sale_date', dateTo);
    }

    const { data, error } = await query;
    
    if (error) throw error;

    return (data || []).map(sale => ({
      'Fecha de Venta': new Date(sale.sale_date).toLocaleDateString('es-ES'),
      'SKU': sale.products?.sku || 'N/A',
      'Producto': sale.products?.name || 'Producto eliminado',
      'Cantidad': sale.quantity,
      'Precio Unitario': `$${sale.unit_price?.toFixed(2)}`,
      'Total': `$${sale.total_price?.toFixed(2)}`,
      'Cliente': sale.customer_name || 'N/A',
      'Factura': sale.invoice_number || 'N/A',
      'Origen': this.translateImportSource(sale.import_source),
      'Fecha Registro': new Date(sale.created_at).toLocaleDateString('es-ES')
    }));
  }

  /**
   * Obtiene datos de pedidos
   */
  private async getOrdersData(dateFrom?: string, dateTo?: string): Promise<any[]> {
    let query = supabase()
      .from('purchase_orders')
      .select(`
        *,
        suppliers!inner(name),
        purchase_order_items!inner(
          quantity_ordered,
          quantity_received,
          unit_cost,
          inventory_products!inner(name)
        )
      `)
      .order('created_at', { ascending: false });

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;
    
    if (error) throw error;

    return (data || []).map(order => {
      const items = Array.isArray(order.purchase_order_items) 
        ? order.purchase_order_items 
        : [order.purchase_order_items];
      
      return items.map((item: any) => ({
        'Número de Pedido': order.id.substring(0, 8),
        'Proveedor': order.suppliers?.name || 'N/A',
        'Estado': this.translateOrderStatus(order.status),
        'Producto': item.inventory_products?.name || 'N/A',
        'Cantidad Pedida': item.quantity_ordered,
        'Cantidad Recibida': item.quantity_received,
        'Costo Unitario': item.unit_cost ? `$${item.unit_cost.toFixed(2)}` : 'N/A',
        'Total': item.unit_cost ? `$${(item.quantity_ordered * item.unit_cost).toFixed(2)}` : 'N/A',
        'Fecha Esperada': new Date(order.expected_date).toLocaleDateString('es-ES'),
        'Fecha Creación': new Date(order.created_at).toLocaleDateString('es-ES')
      }));
    }).flat();
  }

  /**
   * Exporta datos a CSV
   */
  private async exportToCSV(data: any[], fileName: string, metadata: ExportMetadata, includeMetadata = true): Promise<void> {
    let csvContent = '';

    // Agregar metadata si se solicita
    if (includeMetadata) {
      csvContent += `# REPORTE DE ${metadata.reportType.toUpperCase()}\n`;
      csvContent += `# Exportado por: ${metadata.exportedBy}\n`;
      csvContent += `# Fecha de exportación: ${new Date(metadata.exportedAt).toLocaleString('es-ES')}\n`;
      csvContent += `# Total de registros: ${metadata.totalRecords}\n`;
      if (metadata.dateRange) {
        csvContent += `# Rango de fechas: ${metadata.dateRange.from} a ${metadata.dateRange.to}\n`;
      }
      csvContent += '\n';
    }

    // Obtener headers
    const headers = Object.keys(data[0]);
    csvContent += headers.map(header => `"${header}"`).join(',') + '\n';

    // Agregar datos
    data.forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        // Escapar comillas y envolver en comillas si contiene comas
        value = value.toString().replace(/"/g, '""');
        return `"${value}"`;
      });
      csvContent += values.join(',') + '\n';
    });

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${fileName}.csv`);
  }

  /**
   * Exporta datos a PDF
   */
  private async exportToPDF(data: any[], fileName: string, metadata: ExportMetadata, reportType: string): Promise<void> {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    // Configurar fuente
    doc.setFont('helvetica');
    
    // Header del documento
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text(`REPORTE DE ${reportType.toUpperCase()}`, 20, 20);
    
    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    let yPosition = 35;
    
    doc.text(`Exportado por: ${metadata.exportedBy}`, 20, yPosition);
    yPosition += 5;
    doc.text(`Fecha de exportación: ${new Date(metadata.exportedAt).toLocaleString('es-ES')}`, 20, yPosition);
    yPosition += 5;
    doc.text(`Total de registros: ${metadata.totalRecords}`, 20, yPosition);
    yPosition += 5;
    
    if (metadata.dateRange) {
      doc.text(`Rango de fechas: ${metadata.dateRange.from} a ${metadata.dateRange.to}`, 20, yPosition);
      yPosition += 5;
    }
    
    yPosition += 10;

    // Obtener headers y preparar datos para la tabla
    const headers = Object.keys(data[0]);
    const tableData = data.map(row => headers.map(header => row[header] || ''));

    // Configurar tabla
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: yPosition,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: [44, 62, 80],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [52, 73, 94],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [236, 240, 241]
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto' }
      },
      margin: { top: 30, right: 20, bottom: 20, left: 20 },
      didDrawPage: (data) => {
        // Footer con número de página
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(127, 140, 141);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          doc.internal.pageSize.width - 30,
          doc.internal.pageSize.height - 10
        );
      }
    });

    // Guardar PDF
    doc.save(`${fileName}.pdf`);
  }

  /**
   * Guarda el historial de exportación
   */
  private async saveExportHistory(exportData: Omit<ExportHistory, 'id'>): Promise<void> {
    const { error } = await supabase()
      .from('export_history')
      .insert(exportData);

    if (error) {
      console.warn('Error guardando historial de exportación:', error);
      // No lanzar error, ya que la exportación fue exitosa
    }
  }

  /**
   * Obtiene el historial de exportaciones
   */
  async getExportHistory(limit = 50): Promise<ExportHistory[]> {
    const { data, error } = await supabase()
      .from('export_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Traduce razones de movimiento de inventario
   */
  private translateReason(reason: string): string {
    const translations: { [key: string]: string } = {
      'compra': 'Compra',
      'venta': 'Venta',
      'ajuste': 'Ajuste',
      'merma': 'Merma',
      'inicial': 'Stock Inicial'
    };
    return translations[reason] || reason;
  }

  /**
   * Traduce fuentes de importación
   */
  private translateImportSource(source: string): string {
    const translations: { [key: string]: string } = {
      'manual': 'Manual',
      'csv_excel_import': 'Importación CSV/Excel',
      'pos_system': 'Sistema POS'
    };
    return translations[source] || source;
  }

  /**
   * Traduce estados de pedidos
   */
  private translateOrderStatus(status: string): string {
    const translations: { [key: string]: string } = {
      'DRAFT': 'Borrador',
      'SENT': 'Enviado',
      'RECEIVED': 'Recibido',
      'CANCELLED': 'Cancelado'
    };
    return translations[status] || status;
  }

  /**
   * Genera string de fecha para nombres de archivo
   */
  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0].replace(/-/g, '');
  }
}