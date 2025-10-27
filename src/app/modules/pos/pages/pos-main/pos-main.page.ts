import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonSearchbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonSpinner,
  LoadingController,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  removeOutline,
  trashOutline,
  cartOutline,
  checkmarkCircleOutline,
  searchOutline,
  personOutline,
  closeCircleOutline,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { POSService } from '../../services/pos.service';
import { POSProduct, POSCart, POSCartItem, POSCustomer, POSTransaction } from '../../models/pos.models';

/**
 * Página principal del Punto de Ventas
 * Permite buscar productos, agregarlos al carrito y completar ventas
 * Se integra con el módulo de ventas existente
 */
@Component({
  selector: 'app-pos-main',
  templateUrl: './pos-main.page.html',
  styleUrls: ['./pos-main.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonSearchbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonBadge,
    IonGrid,
    IonRow,
    IonCol,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonModal,
    IonSpinner,
  ],
})
export class POSMainPage implements OnInit, OnDestroy {
  products: POSProduct[] = [];
  filteredProducts: POSProduct[] = [];
  cart: POSCart | null = null;
  isLoading = false;
  searchTerm = '';
  showCheckoutModal = false;

  // Información del cliente (opcional)
  customer: POSCustomer = {
    name: '',
  };

  paymentMethod: 'cash' | 'card' | 'transfer' = 'cash';
  notes = '';

  private cartSubscription?: Subscription;

  constructor(
    private posService: POSService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    addIcons({
      addOutline,
      removeOutline,
      trashOutline,
      cartOutline,
      checkmarkCircleOutline,
      searchOutline,
      personOutline,
      closeCircleOutline,
    });
  }

  ngOnInit() {
    this.loadProducts();
    
    // Subscribirse a cambios del carrito
    this.cartSubscription = this.posService.cart$.subscribe(cart => {
      this.cart = cart;
    });
  }

  ngOnDestroy() {
    this.cartSubscription?.unsubscribe();
  }

  async loadProducts() {
    this.isLoading = true;
    try {
      this.products = await this.posService.searchProducts();
      this.filteredProducts = [...this.products];
    } catch (error) {
      // Error loading products
      await this.showToast('Error al cargar productos', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async searchProducts(event: any) {
    const query = event.target.value || '';
    this.searchTerm = query;

    if (!query.trim()) {
      this.filteredProducts = [...this.products];
      return;
    }

    try {
      const results = await this.posService.searchProducts(query);
      this.filteredProducts = results;
    } catch (error) {
      // Error searching products
    }
  }

  addToCart(product: POSProduct) {
    try {
      this.posService.addToCart(product, 1);
      this.showToast(`${product.name} agregado al carrito`, 'success');
    } catch (error: any) {
      this.showToast(error.message || 'Error al agregar producto', 'danger');
    }
  }

  updateQuantity(item: POSCartItem, increment: number) {
    try {
      const newQuantity = item.quantity + increment;
      this.posService.updateItemQuantity(item.productId, newQuantity);
    } catch (error: any) {
      this.showToast(error.message || 'Error al actualizar cantidad', 'danger');
    }
  }

  removeItem(item: POSCartItem) {
    this.posService.removeFromCart(item.productId);
    this.showToast('Producto eliminado del carrito', 'success');
  }

  async clearCart() {
    const alert = await this.alertCtrl.create({
      header: 'Limpiar Carrito',
      message: '¿Está seguro de vaciar el carrito?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Limpiar',
          role: 'destructive',
          handler: () => {
            this.posService.clearCart();
            this.showToast('Carrito limpiado', 'success');
          },
        },
      ],
    });

    await alert.present();
  }

  openCheckout() {
    if (!this.cart || this.cart.items.length === 0) {
      this.showToast('El carrito está vacío', 'warning');
      return;
    }
    this.showCheckoutModal = true;
  }

  closeCheckout() {
    this.showCheckoutModal = false;
    // Limpiar datos del cliente
    this.customer = { name: '' };
    this.notes = '';
  }

  async completeSale() {
    if (!this.cart || this.cart.items.length === 0) {
      await this.showToast('El carrito está vacío', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Procesando venta...',
    });
    await loading.present();

    try {
      const transaction: POSTransaction = {
        cart: this.cart,
        customer: this.customer.name.trim() ? this.customer : undefined,
        paymentMethod: this.paymentMethod,
        notes: this.notes.trim() || undefined,
        saleDate: new Date().toISOString().split('T')[0],
      };

      const completedSale = await this.posService.completeSale(transaction);

      await loading.dismiss();
      this.closeCheckout();

      // Mostrar resumen de venta
      await this.showSaleSummary(completedSale);

      // Recargar productos para actualizar stock
      await this.loadProducts();
    } catch (error: any) {
      await loading.dismiss();
      // Error completing sale
      await this.showToast(error.message || 'Error al procesar la venta', 'danger');
    }
  }

  private async showSaleSummary(sale: any) {
    const alert = await this.alertCtrl.create({
      header: '✅ Venta Completada',
      message: `
        <strong>Factura:</strong> ${sale.invoiceNumber}<br>
        <strong>Total:</strong> ${this.formatCurrency(sale.total)}<br>
        <strong>Items:</strong> ${sale.itemsCount}<br>
        ${sale.customer ? `<strong>Cliente:</strong> ${sale.customer.name}<br>` : ''}
        <br>
        La venta se ha registrado correctamente.
      `,
      buttons: [
        {
          text: 'Ver en Historial',
          handler: () => {
            this.router.navigate(['/sales']);
          },
        },
        {
          text: 'Nueva Venta',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  getCartItemsCount(): number {
    return this.cart?.itemsCount || 0;
  }

  getCartTotal(): number {
    return this.cart?.total || 0;
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
      color,
    });
    await toast.present();
  }
}

