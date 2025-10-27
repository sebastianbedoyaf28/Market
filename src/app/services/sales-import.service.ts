import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { InventoryService } from '../modules/inventory/services/inventory.service';
import { supabase } from '../core/supabase-client';

export interface SaleRecord {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  saleDate: string;
  customerName?: string;
  invoiceNumber?: string;
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  errorRecords: number;
  errors: string[];
  warnings: string[];
}

export interface ImportPreview {
  headers: string[];
  sampleData: any[];
  totalRows: number;
  mappingOptions: {
    sku?: string;
    productName?: string;
    quantity?: string;
    unitPrice?: string;
    totalPrice?: string;
    saleDate?: string;
    customerName?: string;
    invoiceNumber?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SalesImportService {

  constructor(private inventoryService: InventoryService) {}

  /**
   * Lee un archivo CSV o Excel y devuelve una vista previa
   */
  async parseFile(file: File): Promise<ImportPreview> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      let data: any[] = [];
      
      if (fileExtension === 'csv') {
        data = await this.parseCSV(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        data = await this.parseExcel(file);
      } else {
        throw new Error('Formato de archivo no soportado. Use CSV o Excel (.xlsx/.xls)');
      }

      if (data.length === 0) {
        throw new Error('El archivo está vacío o no contiene datos válidos');
      }

      const headers = Object.keys(data[0]);
      const sampleData = data.slice(0, 5); // Primeras 5 filas para preview
      
      return {
        headers,
        sampleData,
        totalRows: data.length,
        mappingOptions: this.suggestMappings(headers)
      };
    } catch (error) {
      throw new Error(`Error al leer el archivo: ${error}`);
    }
  }

  /**
   * Procesa un archivo CSV
   */
  private parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`Error en CSV: ${results.errors[0].message}`));
          } else {
            resolve(results.data);
          }
        },
        error: (error) => reject(error)
      });
    });
  }

  /**
   * Procesa un archivo Excel
   */
  private parseExcel(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo Excel'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Sugiere mapeos automáticos basados en nombres de columnas
   */
  private suggestMappings(headers: string[]): ImportPreview['mappingOptions'] {
    const mappings: ImportPreview['mappingOptions'] = {};
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase();
      
      if (lowerHeader.includes('sku') || lowerHeader.includes('codigo') || lowerHeader.includes('code')) {
        mappings.sku = header;
      } else if (lowerHeader.includes('producto') || lowerHeader.includes('product') || lowerHeader.includes('nombre')) {
        mappings.productName = header;
      } else if (lowerHeader.includes('cantidad') || lowerHeader.includes('quantity') || lowerHeader.includes('qty')) {
        mappings.quantity = header;
      } else if (lowerHeader.includes('precio') && (lowerHeader.includes('unitario') || lowerHeader.includes('unit'))) {
        mappings.unitPrice = header;
      } else if (lowerHeader.includes('total') || lowerHeader.includes('subtotal')) {
        mappings.totalPrice = header;
      } else if (lowerHeader.includes('fecha') || lowerHeader.includes('date')) {
        mappings.saleDate = header;
      } else if (lowerHeader.includes('cliente') || lowerHeader.includes('customer')) {
        mappings.customerName = header;
      } else if (lowerHeader.includes('factura') || lowerHeader.includes('invoice')) {
        mappings.invoiceNumber = header;
      }
    });
    
    return mappings;
  }

  /**
   * Procesa los datos importados y los convierte a registros de venta
   */
  async processSalesData(
    file: File, 
    mappings: ImportPreview['mappingOptions']
  ): Promise<Observable<ImportResult>> {
    try {
      const preview = await this.parseFile(file);
      const rawData = preview.sampleData; // En producción, esto sería todos los datos

      // Recargar todos los datos del archivo
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let allData: any[] = [];
      
      if (fileExtension === 'csv') {
        allData = await this.parseCSV(file);
      } else {
        allData = await this.parseExcel(file);
      }

      const result: ImportResult = {
        success: true,
        totalRecords: allData.length,
        processedRecords: 0,
        errorRecords: 0,
        errors: [],
        warnings: []
      };

      const salesRecords: SaleRecord[] = [];

      // Convertir datos raw a registros de venta
      for (const row of allData) {
        try {
          const saleRecord = this.mapRowToSaleRecord(row, mappings);
          const validation = this.validateSaleRecord(saleRecord);
          
          if (validation.isValid) {
            salesRecords.push(saleRecord);
            result.processedRecords++;
          } else {
            result.errorRecords++;
            result.errors.push(...validation.errors);
          }
        } catch (error) {
          result.errorRecords++;
          result.errors.push(`Error procesando fila: ${error}`);
        }
      }

      if (salesRecords.length > 0) {
        // Procesar las ventas y actualizar inventario
        await this.processSalesAndUpdateInventory(salesRecords, result);
      }

      result.success = result.errorRecords < result.totalRecords;
      
      return of(result);
    } catch (error) {
      return of({
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        errorRecords: 0,
        errors: [`Error general: ${error}`],
        warnings: []
      });
    }
  }

  /**
   * Mapea una fila de datos a un registro de venta
   */
  private mapRowToSaleRecord(row: any, mappings: ImportPreview['mappingOptions']): SaleRecord {
    return {
      sku: row[mappings.sku || ''] || '',
      productName: row[mappings.productName || ''] || '',
      quantity: parseFloat(row[mappings.quantity || '']) || 0,
      unitPrice: parseFloat(row[mappings.unitPrice || '']) || 0,
      totalPrice: parseFloat(row[mappings.totalPrice || '']) || 0,
      saleDate: this.parseDate(row[mappings.saleDate || '']),
      customerName: row[mappings.customerName || ''] || '',
      invoiceNumber: row[mappings.invoiceNumber || ''] || ''
    };
  }

  /**
   * Valida un registro de venta
   */
  private validateSaleRecord(record: SaleRecord): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!record.sku && !record.productName) {
      errors.push('SKU o nombre del producto es requerido');
    }
    if (record.quantity <= 0) {
      errors.push('La cantidad debe ser mayor a 0');
    }
    if (record.unitPrice < 0) {
      errors.push('El precio unitario no puede ser negativo');
    }
    if (!record.saleDate) {
      errors.push('Fecha de venta es requerida');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Procesa las ventas y actualiza el inventario
   */
  private async processSalesAndUpdateInventory(
    salesRecords: SaleRecord[], 
    result: ImportResult
  ): Promise<void> {
    for (const sale of salesRecords) {
      try {
        // Buscar el producto por SKU o nombre
        const product = await this.findProductBySKUOrName(sale.sku, sale.productName);
        
        if (!product) {
          result.warnings.push(`Producto no encontrado: ${sale.sku || sale.productName}`);
          continue;
        }

        // Verificar stock disponible
        const currentStock = await this.inventoryService.calculateCurrentStock(product.id);
        
        if (currentStock < sale.quantity) {
          result.warnings.push(
            `Stock insuficiente para ${product.name}. Disponible: ${currentStock}, Requerido: ${sale.quantity}`
          );
          // Continuar pero registrar la venta parcial si hay algo de stock
          const saleQuantity = Math.min(currentStock, sale.quantity);
          if (saleQuantity > 0) {
            await this.registerSale(product.id, saleQuantity, sale);
          }
        } else {
          // Registrar la venta completa
          await this.registerSale(product.id, sale.quantity, sale);
        }

      } catch (error) {
        result.errors.push(`Error procesando venta de ${sale.productName}: ${error}`);
        result.errorRecords++;
        result.processedRecords--;
      }
    }
  }

  /**
   * Busca un producto por SKU o nombre
   */
  private async findProductBySKUOrName(sku: string, productName: string): Promise<any> {
    let query = supabase().from('products').select('*');
    
    if (sku) {
      query = query.eq('sku', sku);
    } else if (productName) {
      query = query.ilike('name', `%${productName}%`);
    }
    
    const { data, error } = await query.single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }
    
    return data;
  }

  /**
   * Registra una venta en el sistema
   */
  private async registerSale(productId: string, quantity: number, saleData: SaleRecord): Promise<void> {
    // Registrar el movimiento de inventario (salida)
    await this.inventoryService.registerExit(
      productId,
      quantity,
      'venta',
      `Venta importada - Factura: ${saleData.invoiceNumber || 'N/A'}, Cliente: ${saleData.customerName || 'N/A'}`
    );

    // Registrar la venta en la tabla de ventas (si existe)
    try {
      await supabase()
        .from('sales')
        .insert({
          product_id: productId,
          quantity,
          unit_price: saleData.unitPrice,
          total_price: saleData.totalPrice,
          sale_date: saleData.saleDate,
          customer_name: saleData.customerName,
          invoice_number: saleData.invoiceNumber,
          import_source: 'csv_excel_import',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      // Si la tabla de ventas no existe, solo registramos el movimiento de inventario
      // Tabla de ventas no encontrada, solo se registró el movimiento de inventario
    }
  }

  /**
   * Parsea una fecha de diferentes formatos
   */
  private parseDate(dateString: string): string {
    if (!dateString) return new Date().toISOString().split('T')[0];
    
    // Intentar diferentes formatos de fecha
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    ];

    const dateStr = dateString.toString().trim();
    
    // Formato ISO (YYYY-MM-DD)
    if (formats[0].test(dateStr)) {
      return dateStr;
    }
    
    // Formato DD/MM/YYYY
    if (formats[1].test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Formato DD-MM-YYYY
    if (formats[2].test(dateStr)) {
      const [day, month, year] = dateStr.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Intentar parsearlo como fecha estándar
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      // Fallback a fecha actual
    }
    
    return new Date().toISOString().split('T')[0];
  }
}