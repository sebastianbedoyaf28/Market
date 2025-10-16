import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { supabase } from '../../../core/supabase-client';
import { POSCart, POSCartItem, POSProduct, POSTransaction, POSCompletedSale } from '../models/pos.models';
import { SalesService } from '../../sales/services/sales.service';

/**
 * Servicio de Punto de Ventas
 * Gestiona el carrito y crea ventas que se integran con el módulo de ventas
 */
@Injectable({ providedIn: 'root' })
export class POSService {
  private cartSubject = new BehaviorSubject<POSCart>(this.getEmptyCart());
  public cart$ = this.cartSubject.asObservable();

  constructor(private salesService: SalesService) {
    // Cargar carrito del localStorage si existe
    this.loadCartFromStorage();
  }

  /**
   * Obtiene productos disponibles del inventario
   */
  async searchProducts(query: string = ''): Promise<POSProduct[]> {
    let supaQuery = supabase()
      .from('inventory_products')
      .select('id, name, sku, sale_price, total_stock')
      .gt('sale_price', 0); // Solo productos con precio de venta

    // Filtrar por stock disponible (mayor que 0)
    supaQuery = supaQuery.gt('total_stock', 0);

    if (query.trim()) {
      supaQuery = supaQuery.or(`name.ilike.%${query}%,sku.ilike.%${query}%`);
    }

    const { data, error } = await supaQuery.order('name').limit(50);

    if (error) {
      console.error('Error searching products:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      price: Number(row.sale_price) || 0,
      stock: row.total_stock || 100, // Stock por defecto si es null
    }));
  }

  /**
   * Obtiene todos los productos disponibles por categoría
   */
  async getProductsByCategory(category?: string): Promise<POSProduct[]> {
    let query = supabase()
      .from('inventory_products')
      .select('id, name, sku, sale_price, total_stock, category')
      .gt('sale_price', 0); // Solo productos con precio de venta

    // Filtrar por stock disponible (mayor que 0)
    query = query.gt('total_stock', 0);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error('Error getting products:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      price: Number(row.sale_price) || 0,
      stock: row.total_stock || 100, // Stock por defecto si es null
      category: row.category,
    }));
  }

  /**
   * Agrega un producto al carrito
   */
  addToCart(product: POSProduct, quantity: number = 1): void {
    const currentCart = this.cartSubject.value;
    const existingItemIndex = currentCart.items.findIndex(
      item => item.productId === product.id
    );

    if (existingItemIndex >= 0) {
      // Actualizar cantidad del item existente
      const existingItem = currentCart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > product.stock) {
        throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
      }

      currentCart.items[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        subtotal: newQuantity * existingItem.unitPrice,
      };
    } else {
      // Agregar nuevo item
      if (quantity > product.stock) {
        throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
      }

      currentCart.items.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity,
        unitPrice: product.price,
        subtotal: quantity * product.price,
        stock: product.stock,
      });
    }

    this.updateCart(currentCart);
  }

  /**
   * Actualiza la cantidad de un item en el carrito
   */
  updateItemQuantity(productId: string, quantity: number): void {
    const currentCart = this.cartSubject.value;
    const itemIndex = currentCart.items.findIndex(
      item => item.productId === productId
    );

    if (itemIndex < 0) return;

    const item = currentCart.items[itemIndex];

    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (quantity > item.stock) {
      throw new Error(`Stock insuficiente. Disponible: ${item.stock}`);
    }

    currentCart.items[itemIndex] = {
      ...item,
      quantity,
      subtotal: quantity * item.unitPrice,
    };

    this.updateCart(currentCart);
  }

  /**
   * Remueve un producto del carrito
   */
  removeFromCart(productId: string): void {
    const currentCart = this.cartSubject.value;
    currentCart.items = currentCart.items.filter(
      item => item.productId !== productId
    );
    this.updateCart(currentCart);
  }

  /**
   * Limpia el carrito
   */
  clearCart(): void {
    this.cartSubject.next(this.getEmptyCart());
    this.saveCartToStorage();
  }

  /**
   * Obtiene el carrito actual
   */
  getCurrentCart(): POSCart {
    return this.cartSubject.value;
  }

  /**
   * Completa la venta y crea los registros en la tabla sales
   * Se integra con el módulo de ventas existente
   */
  async completeSale(transaction: POSTransaction): Promise<POSCompletedSale> {
    const cart = transaction.cart;

    if (cart.items.length === 0) {
      throw new Error('El carrito está vacío');
    }

    // Generar número de factura único
    const invoiceNumber = transaction.invoiceNumber || this.generateInvoiceNumber();
    const saleDate = transaction.saleDate || new Date().toISOString().split('T')[0];

    const { data: { user } } = await supabase().auth.getUser();

    // Crear una venta por cada item en el carrito
    // Esto se integra con el módulo de ventas
    const salesPromises = cart.items.map(async (item) => {
      const saleData = {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.subtotal,
        saleDate,
        customerName: transaction.customer?.name,
        invoiceNumber,
        importSource: 'pos_system' as const,
        status: 'reconciled' as const,
        userId: user?.id,
      };

      // Usar el servicio de ventas para crear cada venta
      return this.salesService.create(saleData).toPromise();
    });

    const salesResults = await Promise.all(salesPromises);
    const salesIds = salesResults.map(sale => sale!.id);

    // Actualizar inventario (decrementar stock)
    await this.updateInventoryStock(cart.items);

    const completedSale: POSCompletedSale = {
      id: invoiceNumber,
      invoiceNumber,
      total: cart.total,
      itemsCount: cart.itemsCount,
      customer: transaction.customer,
      saleDate,
      salesIds,
    };

    // Limpiar carrito después de la venta exitosa
    this.clearCart();

    return completedSale;
  }

  /**
   * Actualiza el stock del inventario después de una venta
   */
  private async updateInventoryStock(items: POSCartItem[]): Promise<void> {
    for (const item of items) {
      try {
        // Decrementar el stock del producto
        const { data: product } = await supabase()
          .from('inventory_products')
          .select('total_stock')
          .eq('id', item.productId)
          .single();

        if (product) {
          const newStock = Math.max(0, (product.total_stock || 0) - item.quantity);
          
          await supabase()
            .from('inventory_products')
            .update({ 
              total_stock: newStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.productId);
        }
      } catch (error) {
        console.error(`Error updating stock for product ${item.productId}:`, error);
        // Continuar con los demás productos aunque uno falle
      }
    }
  }

  /**
   * Calcula los totales del carrito
   */
  private updateCart(cart: POSCart): void {
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    cart.tax = cart.subtotal * 0; // Sin impuestos por ahora, se puede configurar
    cart.discount = 0; // Sin descuento por ahora, se puede configurar
    cart.total = cart.subtotal + cart.tax - cart.discount;
    cart.itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    this.cartSubject.next(cart);
    this.saveCartToStorage();
  }

  /**
   * Genera un número de factura único
   */
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}${day}-${random}`;
  }

  /**
   * Crea un carrito vacío
   */
  private getEmptyCart(): POSCart {
    return {
      items: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      itemsCount: 0,
    };
  }

  /**
   * Guarda el carrito en localStorage
   */
  private saveCartToStorage(): void {
    try {
      localStorage.setItem('pos_cart', JSON.stringify(this.cartSubject.value));
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  }

  /**
   * Carga el carrito desde localStorage
   */
  private loadCartFromStorage(): void {
    try {
      const saved = localStorage.getItem('pos_cart');
      if (saved) {
        const cart = JSON.parse(saved);
        this.cartSubject.next(cart);
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
    }
  }
}

