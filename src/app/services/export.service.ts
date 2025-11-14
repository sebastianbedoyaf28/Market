import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { supabase } from '../core/supabase-client';
import { AuthService } from '../core/services/auth.service';
import { InventoryService } from '../modules/inventory/services/inventory.service';

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
  async exportData(options: ExportOptions): Promise<{ success: boolean; fileName?: string; message?: string; error?: string }> {
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
      const downloadMessage = options.format === 'csv'
        ? await this.exportToCSV(data, fileName, metadata, options.includeMetadata)
        : await this.exportToPDF(data, fileName, metadata, options.type);

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

      return { success: true, fileName: `${fileName}.${options.format}`, message: downloadMessage };
    } catch (error: any) {
      let msg = error?.message || error?.toString() || 'Error desconocido';
      if (typeof error === 'object') {
        if (error.error_description) msg = error.error_description;
        if (error.message) msg = error.message;
      }
      // Error en exportación
      return { success: false, error: msg };
    }
  }

  /**
   * Obtiene datos de inventario
   * Ahora se basa en inventory_movements + relación correcta a inventory_products
   */
private async getInventoryData(_dateFrom?: string, _dateTo?: string): Promise<any[]> {
  // 1) Traer productos de inventario con sus lotes
  const { data, error } = await supabase()
    .from('inventory_products')
    .select(`
      id,
      name,
      sku,
      category,
      provider,
      cost_price,
      sale_price,
      created_at,
      inventory_lots (
        quantity,
        expiry_date
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const products = data || [];
  if (products.length === 0) {
    return [];
  }

  // 2) Construir las filas del reporte
  return products.map((p: any) => {
    const lots = Array.isArray(p.inventory_lots)
      ? p.inventory_lots
      : (p.inventory_lots ? [p.inventory_lots] : []);

    // Stock total
    const totalStock = lots.reduce(
      (sum: number, lot: any) => sum + (lot.quantity ?? 0),
      0
    );

    // Próximo vencimiento
    const validDates = lots
      .map((lot: any) => lot.expiry_date ? new Date(lot.expiry_date) : null)
      .filter((d: Date | null) => d && !Number.isNaN(d.getTime())) as Date[];

    let nextExpiry = '';
    if (validDates.length > 0) {
      validDates.sort((a, b) => a.getTime() - b.getTime());
      nextExpiry = validDates[0].toLocaleDateString('es-ES');
    }

    return {
      'SKU': p.sku || 'N/A',
      'Nombre del Producto': p.name,
      'Categoría': p.category || 'N/A',
      'Proveedor': p.provider || 'N/A',
      'Stock total': totalStock,
      'Próximo vencimiento': nextExpiry,
      'Precio costo': p.cost_price ?? 0,
      'Precio venta': p.sale_price ?? 0,
      'Fecha creación producto': new Date(p.created_at).toLocaleDateString('es-ES')
    };
  });
}


  /**
   * Obtiene datos de ventas
   */
 private async getSalesData(dateFrom?: string, dateTo?: string): Promise<any[]> {
  // 1) Traer las ventas
  let salesQuery = supabase()
    .from('sales')
    .select('*')
    .order('sale_date', { ascending: false });

  if (dateFrom) {
    salesQuery = salesQuery.gte('sale_date', dateFrom);
  }
  if (dateTo) {
    salesQuery = salesQuery.lte('sale_date', dateTo);
  }

  const { data: sales, error: salesError } = await salesQuery;
  if (salesError) throw salesError;

  const salesData = sales || [];
  if (salesData.length === 0) {
    return [];
  }

  // 2) Obtener los product_id distintos
  const productIds = Array.from(
    new Set(
      salesData
        .map((s: any) => s.product_id)
        .filter((id: string | null) => !!id)
    )
  );

  // 3) Traer los productos relacionados (solo columnas reales: id, name, price)
  const productsMap = new Map<string, { id: string; name?: string; price?: number }>();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase()
      .from('products')
      .select('id, name, price')
      .in('id', productIds);

    if (productsError) throw productsError;

    (products || []).forEach((p: any) => {
      productsMap.set(p.id, { id: p.id, name: p.name, price: p.price });
    });
  }

  // 4) Armar las filas del reporte
  return salesData.map((sale: any) => {
    const product = sale.product_id ? productsMap.get(sale.product_id) : undefined;

    // Usamos un "pseudo SKU" basado en el id
    const pseudoSku = product?.id ? product.id.substring(0, 8) : 'N/A';

    return {
      'Fecha de Venta': new Date(sale.sale_date).toLocaleDateString('es-ES'),
      'SKU': pseudoSku,
      'Producto': product?.name || 'Producto eliminado',
      'Cantidad': sale.quantity,
      'Precio Unitario': sale.unit_price != null
        ? `$${sale.unit_price.toFixed(2)}`
        : (product?.price != null ? `$${product.price.toFixed(2)}` : 'N/A'),
      'Total': sale.total_price != null ? `$${sale.total_price.toFixed(2)}` : 'N/A',
      'Cliente': sale.customer_name || 'N/A',
      'Factura': sale.invoice_number || 'N/A',
      'Origen': this.translateImportSource(sale.import_source),
      'Fecha Registro': new Date(sale.created_at).toLocaleDateString('es-ES')
    };
  });
}


  /**
   * Obtiene datos de pedidos
   */
  private async getOrdersData(_dateFrom?: string, _dateTo?: string): Promise<any[]> {
  const { data, error } = await supabase()
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

  if (error) throw error;

  const orders = data || [];

  return orders
    .map(order => {
      const items = Array.isArray(order.purchase_order_items)
        ? order.purchase_order_items
        : (order.purchase_order_items ? [order.purchase_order_items] : []);

      return items.map((item: any) => ({
        'Número de Pedido': order.id.substring(0, 8),
        'Proveedor': order.suppliers?.name || 'N/A',
        'Estado': this.translateOrderStatus(order.status),
        'Producto': item.inventory_products?.name || 'N/A',
        'Cantidad Pedida': item.quantity_ordered,
        'Cantidad Recibida': item.quantity_received,
        'Costo Unitario': item.unit_cost != null ? `$${item.unit_cost.toFixed(2)}` : 'N/A',
        'Total': item.unit_cost != null
          ? `$${(item.quantity_ordered * item.unit_cost).toFixed(2)}`
          : 'N/A',
        'Fecha Esperada': new Date(order.expected_date).toLocaleDateString('es-ES'),
        'Fecha Creación': new Date(order.created_at).toLocaleDateString('es-ES')
      }));
    })
    .flat();
}

  /**
   * Exporta datos a CSV
   */
  private async exportToCSV(data: any[], fileName: string, metadata: ExportMetadata, includeMetadata = true): Promise<string> {
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

    // Crear blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Guardar archivo usando el método apropiado para la plataforma
    return await this.saveFile(blob, `${fileName}.csv`);
  }

  /**
   * Exporta datos a PDF
   */
  private async exportToPDF(data: any[], fileName: string, metadata: ExportMetadata, reportType: string): Promise<string> {
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

    // Guardar PDF usando el método apropiado para la plataforma
    const blob = doc.output('blob');
    return await this.saveFile(blob, `${fileName}.pdf`);
  }

  /**
   * Guarda el historial de exportación
   */
  private async saveExportHistory(exportData: Omit<ExportHistory, 'id'>): Promise<void> {
    const { error } = await supabase()
      .from('export_history')
      .insert(exportData);

    if (error) {
      // Error guardando historial de exportación
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
      // Error obteniendo historial
      return [];
    }

    return data || [];
  }

  /**
   * Traduce razones de movimiento de inventario
   * (valores reales en BD: purchase | sale | adjustment | waste | initial)
   */
  private translateReason(reason: string): string {
    const translations: { [key: string]: string } = {
      'purchase': 'Compra',
      'sale': 'Venta',
      'adjustment': 'Ajuste',
      'waste': 'Merma',
      'initial': 'Stock inicial'
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

  /**
   * Guarda un archivo usando el método apropiado según la plataforma
   * En Android/iOS usa Filesystem de Capacitor; en web genera una descarga temporal
   */
  private async saveFile(blob: Blob, filename: string): Promise<string> {
    const platform = Capacitor.getPlatform();

    if (platform === 'android' || platform === 'ios') {
      try {
        let base64: string;

        if (blob.type.includes('text/') || blob.type.includes('csv')) {
          const text = await blob.text();
          base64 = btoa(unescape(encodeURIComponent(text)));
        } else {
          base64 = await this.blobToBase64(blob);
        }

        const cacheResult = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });

        const fileUri = cacheResult.uri;

        let documentsUri: string | null = null;
        try {
          const documentsResult = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Documents,
          });
          documentsUri = documentsResult.uri;
        } catch {
          // Ignorar error al guardar en documentos
        }

        let externalUri: string | null = null;
        if (platform === 'android') {
          try {
            const externalResult = await Filesystem.writeFile({
              path: `Download/${filename}`,
              data: base64,
              directory: Directory.ExternalStorage,
            });
            externalUri = externalResult.uri;
          } catch {
            // ExternalStorage puede requerir permisos adicionales
          }
        }

        try {
          const fileType = filename.endsWith('.csv') ? 'CSV' : 'PDF';
          await Share.share({
            title: 'Compartir archivo',
            text: `Archivo: ${filename}`,
            url: fileUri,
            dialogTitle: `Compartir archivo ${fileType}`,
          });

          let locationMsg = `Archivo ${filename} listo para compartir`;
          if (externalUri) {
            locationMsg += ' y guardado en Descargas';
          } else if (documentsUri) {
            locationMsg += ' y guardado en Documentos de la app';
          }
          return locationMsg;
        } catch {
          if (externalUri) {
            return `Archivo ${filename} guardado en Descargas`;
          }
          if (documentsUri) {
            return `Archivo ${filename} guardado en Documentos de la app`;
          }
          return `Archivo ${filename} guardado en caché`;
        }
      } catch (error: any) {
        try {
          const base64 = blob.type.includes('text/') || blob.type.includes('csv')
            ? btoa(unescape(encodeURIComponent(await blob.text())))
            : await this.blobToBase64(blob);

          await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Cache,
          });

          return `Archivo ${filename} guardado en caché de la app`;
        } catch (fallbackError: any) {
          const errorMsg = error?.message || fallbackError?.message || 'No se pudo guardar el archivo';
          throw new Error(errorMsg);
        }
      }
    } else {
      try {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return `Archivo ${filename} descargado correctamente`;
      } catch {
        throw new Error('Error al descargar archivo');
      }
    }
  }

  /**
   * Convierte un Blob a base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remover el prefijo data:mimeType;base64,
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
