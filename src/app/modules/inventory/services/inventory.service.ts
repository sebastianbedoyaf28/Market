import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { supabase } from '../../../core/supabase-client';
import {
  CreateInventoryProductDto,
  InventoryFilters,
  InventoryLot,
  InventoryLotInput,
  InventoryProduct,
  RecordMovementDto,
  StockMovement,
  StockStatus,
  UpdateInventoryProductDto,
} from '../models/inventory.models';

interface InventoryLotRow {
  id: string;
  product_id: string;
  lot_number: string;
  quantity: number;
  expiry_date: string | null;
  provider: string | null;
  created_at: string;
}

interface InventoryMovementRow {
  id: string;
  product_id: string;
  lot_id: string | null;
  type: 'IN' | 'OUT';
  reason: 'purchase' | 'sale' | 'adjustment' | 'waste';
  quantity: number;
  note: string | null;
  created_at: string;
}

interface InventoryProductRow {
  id: string;
  name: string;
  sku: string;
  category: string;
  provider: string;
  cost_price: number;
  sale_price: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  inventory_lots: InventoryLotRow[] | null;
  inventory_movements: InventoryMovementRow[] | null;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly lowStockThreshold = 10;

  list(filters?: InventoryFilters): Observable<InventoryProduct[]> {
    return from(this.loadInventory(filters));
  }

  getById(id: string): Observable<InventoryProduct | undefined> {
    return from(this.loadProductById(id));
  }

  getCategories(): Observable<string[]> {
    return from(this.fetchDistinctValues('category'));
  }

  getProviders(): Observable<string[]> {
    return from(this.fetchDistinctValues('provider'));
  }

  createProduct(payload: CreateInventoryProductDto): Observable<InventoryProduct> {
    return from(this.createProductAsync(payload));
  }

  updateProduct(id: string, patch: UpdateInventoryProductDto): Observable<InventoryProduct> {
    return from(this.updateProductAsync(id, patch));
  }

  deleteProduct(id: string): Observable<void> {
    return from(this.deleteProductAsync(id));
  }

  recordMovement(payload: RecordMovementDto): Observable<InventoryProduct> {
    return from(this.recordMovementAsync(payload));
  }

  async exportInventoryToCsv(filters?: InventoryFilters): Promise<Blob> {
    const inventory = await this.loadInventory(filters);

    const headers = [
      'SKU',
      'Nombre',
      'Categoria',
      'Proveedor',
      'Stock total',
      'Estado',
      'Proximo vencimiento',
      'Precio costo',
      'Precio venta',
    ];

    const rows = inventory.map(product => [
      product.sku,
      product.name,
      product.category,
      product.provider,
      product.totalStock.toString(),
      this.translateStatus(product.status),
      product.nextExpiryDate ? new Date(product.nextExpiryDate).toLocaleDateString() : '',
      product.costPrice.toFixed(2),
      product.salePrice.toFixed(2),
    ]);

    const csvContent = [headers, ...rows]
      .map(line => line.map(field => `"${(field ?? '').toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  async exportInventoryToPdf(filters?: InventoryFilters): Promise<Blob> {
    const inventory = await this.loadInventory(filters);
    const lines = inventory.map(product =>
      `${product.sku} ${product.name} Stock:${product.totalStock} Estado:${this.translateStatus(product.status)}`,
    );
    const content = this.buildSimplePdf(`Inventario (${new Date().toLocaleString()})`, lines);
    return new Blob([content], { type: 'application/pdf' });
  }

  private async loadInventory(filters?: InventoryFilters): Promise<InventoryProduct[]> {
    const client = supabase();
    let query = client
      .from('inventory_products')
      .select(
        `
        id,
        name,
        sku,
        category,
        provider,
        cost_price,
        sale_price,
        image_url,
        created_at,
        updated_at,
        inventory_lots (*),
        inventory_movements (*)
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.provider) {
      query = query.eq('provider', filters.provider);
    }

    if (filters?.search) {
      const term = `%${filters.search}%`;
      query = query.or(`name.ilike.${term},sku.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const products = (data ?? []).map(row => this.mapProductRow(row as unknown as InventoryProductRow));
    return this.applyFilters(products, filters);
  }

  private async loadProductById(id: string): Promise<InventoryProduct | undefined> {
    const { data, error } = await supabase()
      .from('inventory_products')
      .select(
        `
        id,
        name,
        sku,
        category,
        provider,
        cost_price,
        sale_price,
        image_url,
        created_at,
        updated_at,
        inventory_lots (*),
        inventory_movements (*)
      `,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? this.mapProductRow(data as unknown as InventoryProductRow) : undefined;
  }

  private async fetchDistinctValues(column: 'category' | 'provider'): Promise<string[]> {
    const { data, error } = await supabase()
      .from('inventory_products')
      .select(column)
      .not(column, 'is', null)
      .order(column, { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as Array<Record<'category' | 'provider', string | null>>;

    return rows
      .map(row => (row[column] ?? '').trim())
      .filter(value => value.length > 0)
      .filter((value, index, array) => array.indexOf(value) === index);
  }
  private async createProductAsync(payload: CreateInventoryProductDto): Promise<InventoryProduct> {
    const validationError = this.validateProductPayload(payload);
    if (validationError) {
      throw new Error(validationError);
    }

    const normalizedSku = payload.sku.trim().toUpperCase();
    const { data: existingSku, error: skuError } = await supabase()
      .from('inventory_products')
      .select('id')
      .eq('sku', normalizedSku)
      .maybeSingle();

    if (skuError && skuError.code !== 'PGRST116') {
      throw skuError;
    }

    if (existingSku) {
      throw new Error('El SKU ya existe, debe ser unico.');
    }

    const now = new Date().toISOString();
    const { data: productRow, error: insertError } = await supabase()
      .from('inventory_products')
      .insert({
        name: payload.name.trim(),
        sku: normalizedSku,
        category: payload.category.trim(),
        provider: payload.provider.trim(),
        cost_price: payload.costPrice,
        sale_price: payload.salePrice,
        image_url: payload.imageUrl?.trim() || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (payload.lots.length) {
      const lotsToInsert = payload.lots.map(lot => ({
        product_id: productRow.id,
        lot_number: lot.lotNumber.trim(),
        quantity: lot.quantity,
        expiry_date: lot.expiryDate ?? null,
        provider: lot.provider?.trim() || null,
      }));

      const { error: lotsError } = await supabase().from('inventory_lots').insert(lotsToInsert);
      if (lotsError) {
        throw lotsError;
      }
    }

    const product = await this.loadProductById(productRow.id);
    if (!product) {
      throw new Error('No fue posible cargar el producto creado.');
    }
    return product;
  }

  private async updateProductAsync(id: string, patch: UpdateInventoryProductDto): Promise<InventoryProduct> {
    const existing = await this.loadProductById(id);
    if (!existing) {
      throw new Error('Producto no encontrado.');
    }

    const merged: CreateInventoryProductDto = {
      name: patch.name ?? existing.name,
      sku: (patch.sku ?? existing.sku).toUpperCase(),
      category: patch.category ?? existing.category,
      provider: patch.provider ?? existing.provider,
      costPrice: patch.costPrice ?? existing.costPrice,
      salePrice: patch.salePrice ?? existing.salePrice,
      imageUrl: patch.imageUrl ?? existing.imageUrl ?? undefined,
      lots: patch.lots ?? existing.lots.map(lot => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        quantity: lot.quantity,
        expiryDate: lot.expiryDate ?? undefined,
        provider: lot.provider ?? undefined,
      })),
    };

    const validationError = this.validateProductPayload(merged);
    if (validationError) {
      throw new Error(validationError);
    }

    if (merged.sku !== existing.sku) {
      const { data: skuInUse, error: skuError } = await supabase()
        .from('inventory_products')
        .select('id')
        .eq('sku', merged.sku)
        .neq('id', id)
        .maybeSingle();

      if (skuError && skuError.code !== 'PGRST116') {
        throw skuError;
      }

      if (skuInUse) {
        throw new Error('El SKU ya existe, debe ser unico.');
      }
    }

    const { error: updateError } = await supabase()
      .from('inventory_products')
      .update({
        name: merged.name.trim(),
        sku: merged.sku.trim(),
        category: merged.category.trim(),
        provider: merged.provider.trim(),
        cost_price: merged.costPrice,
        sale_price: merged.salePrice,
        image_url: merged.imageUrl?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    await this.syncLots(id, merged.lots);

    const product = await this.loadProductById(id);
    if (!product) {
      throw new Error('No fue posible cargar el producto actualizado.');
    }
    return product;
  }

  private async deleteProductAsync(id: string): Promise<void> {
    const { error } = await supabase().from('inventory_products').delete().eq('id', id);
    if (error) {
      throw error;
    }
  }

  private async recordMovementAsync(payload: RecordMovementDto): Promise<InventoryProduct> {
    if (payload.quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0.');
    }

    const product = await this.loadProductById(payload.productId);
    if (!product) {
      throw new Error('Producto no encontrado.');
    }

    const client = supabase();
    const nowIso = new Date().toISOString();
    let movementLotId: string | null = payload.lotId ?? null;

    if (payload.type === 'IN') {
      if (payload.newLot) {
        const lotError = this.validateNewLot(payload.newLot);
        if (lotError) {
          throw new Error(lotError);
        }
        const { data: newLot, error: insertLotError } = await client
          .from('inventory_lots')
          .insert({
            product_id: product.id,
            lot_number: payload.newLot.lotNumber.trim(),
            quantity: payload.quantity,
            expiry_date: payload.newLot.expiryDate ?? null,
            provider: payload.newLot.provider?.trim() || null,
            created_at: nowIso,
          })
          .select()
          .single();

        if (insertLotError) {
          throw insertLotError;
        }

        movementLotId = newLot.id;
      } else if (payload.lotId) {
        const targetLot = product.lots.find(lot => lot.id === payload.lotId);
        if (!targetLot) {
          throw new Error('Lote no encontrado para el producto.');
        }

        const { error: updateLotError } = await client
          .from('inventory_lots')
          .update({ quantity: targetLot.quantity + payload.quantity, created_at: targetLot.createdAt })
          .eq('id', payload.lotId);

        if (updateLotError) {
          throw updateLotError;
        }
      } else {
        const genericLotNumber = `ING-${Date.now()}`;
        const { data: genericLot, error: insertGenericError } = await client
          .from('inventory_lots')
          .insert({
            product_id: product.id,
            lot_number: genericLotNumber,
            quantity: payload.quantity,
            expiry_date: null,
            provider: null,
            created_at: nowIso,
          })
          .select()
          .single();

        if (insertGenericError) {
          throw insertGenericError;
        }
        movementLotId = genericLot.id;
      }
    } else {
      // type === 'OUT'
      if (payload.quantity > product.totalStock) {
        throw new Error('La cantidad supera el stock disponible.');
      }

      if (payload.lotId) {
        const lot = product.lots.find(item => item.id === payload.lotId);
        if (!lot) {
          throw new Error('El lote seleccionado no pertenece al producto.');
        }
        if (lot.quantity < payload.quantity) {
          throw new Error('El stock del lote es insuficiente para la salida.');
        }
        const remaining = lot.quantity - payload.quantity;
        if (remaining === 0) {
          const { error: deleteLotError } = await client.from('inventory_lots').delete().eq('id', lot.id);
          if (deleteLotError) {
            throw deleteLotError;
          }
          movementLotId = null;
        } else {
          const { error: updateLotError } = await client
            .from('inventory_lots')
            .update({ quantity: remaining })
            .eq('id', lot.id);
          if (updateLotError) {
            throw updateLotError;
          }
        }
      } else {
        let remaining = payload.quantity;
        const lotsByExpiry = [...product.lots].sort((a, b) => {
          const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
          const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
          return dateA - dateB;
        });

        for (const lot of lotsByExpiry) {
          if (remaining <= 0) {
            break;
          }
          const deduction = Math.min(lot.quantity, remaining);
          const newQuantity = lot.quantity - deduction;
          remaining -= deduction;

          if (newQuantity === 0) {
            const { error: deleteLotError } = await client.from('inventory_lots').delete().eq('id', lot.id);
            if (deleteLotError) {
              throw deleteLotError;
            }
          } else {
            const { error: updateLotError } = await client
              .from('inventory_lots')
              .update({ quantity: newQuantity })
              .eq('id', lot.id);
            if (updateLotError) {
              throw updateLotError;
            }
          }
        }

        if (remaining > 0) {
          throw new Error('Stock insuficiente para registrar la salida.');
        }
      }
    }

    const { error: movementError } = await client.from('inventory_movements').insert({
      product_id: product.id,
      lot_id: movementLotId,
      type: payload.type,
      reason: payload.reason,
      quantity: payload.quantity,
      note: payload.note?.trim() || null,
      created_at: nowIso,
    });

    if (movementError) {
      throw movementError;
    }

    const { error: touchError } = await client
      .from('inventory_products')
      .update({ updated_at: nowIso })
      .eq('id', product.id);

    if (touchError) {
      throw touchError;
    }

    const updated = await this.loadProductById(product.id);
    if (!updated) {
      throw new Error('No fue posible obtener el producto actualizado.');
    }
    return updated;
  }

  private async syncLots(productId: string, lots: InventoryLotInput[]): Promise<void> {
    const client = supabase();

    const existingLots = await client
      .from('inventory_lots')
      .select('id')
      .eq('product_id', productId);

    if (existingLots.error) {
      throw existingLots.error;
    }

    const existingIds = new Set((existingLots.data ?? []).map(item => item.id as string));
    const incomingIds = new Set(lots.filter(lot => lot.id).map(lot => lot.id as string));

    const idsToDelete = [...existingIds].filter(id => !incomingIds.has(id));
    if (idsToDelete.length) {
      const { error } = await client.from('inventory_lots').delete().in('id', idsToDelete);
      if (error) {
        throw error;
      }
    }

    const lotsToUpdate = lots.filter(lot => lot.id);
    if (lotsToUpdate.length) {
      const updatePromises = lotsToUpdate.map(lot =>
        client
          .from('inventory_lots')
          .update({
            lot_number: lot.lotNumber.trim(),
            quantity: lot.quantity,
            expiry_date: lot.expiryDate ?? null,
            provider: lot.provider?.trim() || null,
          })
          .eq('id', lot.id!),
      );

      const updateResults = await Promise.all(updatePromises);
      const updateError = updateResults.find(result => result.error)?.error;
      if (updateError) {
        throw updateError;
      }
    }

    const lotsToInsert = lots.filter(lot => !lot.id);
    if (lotsToInsert.length) {
      const formatted = lotsToInsert.map(lot => ({
        product_id: productId,
        lot_number: lot.lotNumber.trim(),
        quantity: lot.quantity,
        expiry_date: lot.expiryDate ?? null,
        provider: lot.provider?.trim() || null,
      }));

      const { error } = await client.from('inventory_lots').insert(formatted);
      if (error) {
        throw error;
      }
    }
  }

  private applyFilters(products: InventoryProduct[], filters?: InventoryFilters): InventoryProduct[] {
    if (!filters) {
      return products;
    }

    const { status, expiryFrom, expiryTo } = filters;

    const filtered = products.filter(product => {
      const matchesStatus = status ? product.status === status : true;

      let matchesExpiry = true;
      if ((expiryFrom || expiryTo) && product.nextExpiryDate) {
        const expiry = new Date(product.nextExpiryDate).getTime();
        const from = expiryFrom ? new Date(expiryFrom).getTime() : null;
        const to = expiryTo ? new Date(expiryTo).getTime() : null;
        matchesExpiry = (!from || expiry >= from) && (!to || expiry <= to);
      } else if ((expiryFrom || expiryTo) && !product.nextExpiryDate) {
        matchesExpiry = false;
      }

      return matchesStatus && matchesExpiry;
    });

    return filtered;
  }

  private mapProductRow(row: InventoryProductRow): InventoryProduct {
    const lots = (row.inventory_lots ?? []).map<InventoryLot>(lot => ({
      id: lot.id,
      lotNumber: lot.lot_number,
      quantity: lot.quantity,
      expiryDate: lot.expiry_date,
      provider: lot.provider,
      createdAt: lot.created_at,
    }));

    const movements = (row.inventory_movements ?? []).map<StockMovement>(movement => ({
      id: movement.id,
      productId: movement.product_id,
      lotId: movement.lot_id,
      type: movement.type,
      reason: movement.reason,
      quantity: movement.quantity,
      note: movement.note,
      createdAt: movement.created_at,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalStock = this.computeTotalStock(lots);
    const nextExpiryDate = this.computeNextExpiry(lots);

    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      provider: row.provider,
      costPrice: row.cost_price,
      salePrice: row.sale_price,
      imageUrl: row.image_url,
      lots,
      movements,
      totalStock,
      status: this.computeStatus(totalStock, nextExpiryDate),
      nextExpiryDate,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private validateProductPayload(payload: CreateInventoryProductDto): string | null {
    if (!payload.name.trim()) {
      return 'El nombre es obligatorio.';
    }

    if (!payload.sku.trim()) {
      return 'El SKU es obligatorio.';
    }

    if (!payload.category.trim()) {
      return 'La Categoria es obligatoria.';
    }

    if (!payload.provider.trim()) {
      return 'El proveedor es obligatorio.';
    }

    if (payload.costPrice < 0) {
      return 'El precio de costo no puede ser negativo.';
    }

    if (payload.salePrice < payload.costPrice) {
      return 'El precio de venta debe ser mayor o igual al costo.';
    }

    return this.validateLots(payload.lots);
  }

  private validateLots(lots: InventoryLotInput[]): string | null {
    if (!lots.length) {
      return 'Debe registrar al menos un lote para el producto.';
    }

    const now = new Date();
    for (const lot of lots) {
      if (!lot.lotNumber.trim()) {
        return 'Todos los lotes deben tener numero.';
      }
      if (lot.quantity < 0) {
        return 'La cantidad de stock del lote no puede ser negativa.';
      }
      if (lot.expiryDate) {
        const expiry = new Date(lot.expiryDate);
        if (Number.isNaN(expiry.getTime()) || expiry <= now) {
          return 'La fecha de vencimiento debe ser posterior a hoy.';
        }
      }
    }

    return null;
  }

  private validateNewLot(lot: NonNullable<RecordMovementDto['newLot']>): string | null {
    if (!lot.lotNumber.trim()) {
      return 'Debe indicar el numero de lote.';
    }

    if (lot.expiryDate) {
      const expiry = new Date(lot.expiryDate);
      if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
        return 'La fecha de vencimiento del nuevo lote debe ser futura.';
      }
    }

    return null;
  }

  private computeTotalStock(lots: InventoryLot[]): number {
    return lots.reduce((acc, lot) => acc + lot.quantity, 0);
  }

  private computeNextExpiry(lots: InventoryLot[]): string | null {
    const validDates = lots
      .map(lot => (lot.expiryDate ? new Date(lot.expiryDate) : null))
      .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()));

    if (!validDates.length) {
      return null;
    }

    validDates.sort((a, b) => a.getTime() - b.getTime());
    return validDates[0].toISOString();
  }

  private computeStatus(totalStock: number, nextExpiry: string | null | undefined): StockStatus {
    if (totalStock <= 0) {
      return 'OUT';
    }

    if (nextExpiry) {
      const diff = new Date(nextExpiry).getTime() - Date.now();
      const days = diff / (1000 * 60 * 60 * 24);
      if (days <= 7) {
        return 'EXPIRING';
      }
    }

    if (totalStock < this.lowStockThreshold) {
      return 'LOW';
    }

    return 'SUFFICIENT';
  }

  private translateStatus(status: StockStatus): string {
    switch (status) {
      case 'LOW':
        return 'Stock bajo';
      case 'OUT':
        return 'Agotado';
      case 'EXPIRING':
        return 'Proximo a vencer';
      default:
        return 'Stock suficiente';
    }
  }

  private buildSimplePdf(title: string, lines: string[]): Uint8Array {
    const header = '%PDF-1.3\n';
    const objects: string[] = [];

    const textStream = [
      'BT',
      '/F1 12 Tf',
      '72 750 Td',
      `(${this.escapePdfText(title)}) Tj`,
    ];

    for (const line of lines) {
      textStream.push('0 -14 Td', `(${this.escapePdfText(line)}) Tj`);
    }

    textStream.push('ET');

    const content = textStream.join('\n');
    const length = content.length;

    const fontObject = '2 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
    const contentObject = `3 0 obj\n<< /Length ${length} >>\nstream\n${content}\nendstream\nendobj\n`;
    const pageObject = '4 0 obj\n<< /Type /Page /Parent 5 0 R /Resources << /Font << /F1 2 0 R >> >> /MediaBox [0 0 612 792] /Contents 3 0 R >>\nendobj\n';
    const pagesObject = '5 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n';
    const catalogObject = '1 0 obj\n<< /Type /Catalog /Pages 5 0 R >>\nendobj\n';

    objects.push(catalogObject, fontObject, contentObject, pageObject, pagesObject);

    const xref: number[] = [];
    let position = header.length;
    const body = objects
      .map(obj => {
        const current = position;
        position += obj.length;
        xref.push(current);
        return obj;
      })
      .join('');

    const xrefStart = position;
    const xrefTable =
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
      xref.map(offset => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('');
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const pdfString = header + body + xrefTable + trailer;
    return new TextEncoder().encode(pdfString);
  }

  private escapePdfText(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}




