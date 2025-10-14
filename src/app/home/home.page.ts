import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { Product, ProductService } from '../services/product.service';
import { CartService } from '../services/cart.service';
import { AuthService } from '../services/auth.service';
import { InventoryService } from '../modules/inventory/services/inventory.service';
import { supabase } from '../core/supabase-client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RecentActivity {
  icon: string;
  title: string;
  description: string;
  time: string;
  color: string;
}

interface ModuleCard {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  cssClass: string;
  route: string;
  permissions: string | string[];
}

interface ModuleWithAccess extends ModuleCard {
  allowed: boolean;
}


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  products$!: Observable<Product[]>;
  loading = false;

  totalProducts = 0;
  pendingOrders = 0;
  todaySales = 0;
  alertCount = 0;

  // Canales de subscripción en tiempo real
  private realtimeChannels: RealtimeChannel[] = [];

  readonly moduleCards: ModuleCard[] = [
    {
      id: 'inventory',
      title: 'Gestion de Inventarios',
      subtitle: 'Control de productos y stock',
      icon: 'cube-outline',
      cssClass: 'inventory',
      route: '/inventory',
      permissions: ['inventory:read'],
    },
    {
      id: 'orders',
      title: 'Gestion de Pedidos',
      subtitle: 'Seguimiento y recepcion',
      icon: 'receipt-outline',
      cssClass: 'orders',
      route: '/orders',
      permissions: ['orders:read'],
    },
    {
      id: 'pos',
      title: 'Punto de Venta',
      subtitle: 'Registro de ventas en tiempo real',
      icon: 'card-outline',
      cssClass: 'sales',
      route: '/pos',
      permissions: ['sales:write'],
    },
    {
      id: 'alerts',
      title: 'Alertas',
      subtitle: 'Monitoreo en tiempo real',
      icon: 'notifications-outline',
      cssClass: 'alerts',
      route: '/alerts',
      permissions: ['alerts:read'],
    },
    {
      id: 'reports',
      title: 'Reportes',
      subtitle: 'Analisis y exportacion',
      icon: 'bar-chart-outline',
      cssClass: 'reports',
      route: '/reports',
      permissions: ['reports:read'],
    },
    {
      id: 'reports-export',
      title: 'Exportar reportes',
      subtitle: 'CSV/PDF de inventario, ventas y pedidos',
      icon: 'download-outline',
      cssClass: 'export',
      route: '/reports',
      permissions: ['reports:write'],
    },
    {
      id: 'sales-history',
      title: 'Historial de Ventas',
      subtitle: 'Consulta y análisis de ventas (RF007)',
      icon: 'receipt-outline',
      cssClass: 'sales',
      route: '/sales',
      permissions: ['sales:read'],
    },
    {
      id: 'sales-import',
      title: 'Importar ventas',
      subtitle: 'CSV/Excel desde sistemas externos (RF006)',
      icon: 'cloud-upload-outline',
      cssClass: 'import',
      route: '/sales-import',
      permissions: ['sales:import'],
    },
    {
      id: 'users',
      title: 'Usuarios',
      subtitle: 'Gestion de usuarios del sistema',
      icon: 'people-outline',
      cssClass: 'users',
      route: '/users',
      permissions: ['users:read'],
    },
    {
      id: 'roles',
      title: 'Roles',
      subtitle: 'Permisos y perfiles de acceso',
      icon: 'shield-checkmark-outline',
      cssClass: 'roles',
      route: '/roles',
      permissions: ['roles:read'],
    },
  ];

  readonly modules$: Observable<ModuleWithAccess[]>;

  recentActivities: RecentActivity[] = [
    {
      icon: 'add-circle-outline',
      title: 'Nuevo producto agregado',
      description: 'Producto "Arroz Premium" agregado al inventario',
      time: '5 min',
      color: 'success',
    },
    {
      icon: 'receipt-outline',
      title: 'Pedido recibido',
      description: 'Pedido #1234 marcado como recibido',
      time: '15 min',
      color: 'primary',
    },
    {
      icon: 'card-outline',
      title: 'Venta registrada',
      description: 'Venta por $45.50 procesada',
      time: '1 hora',
      color: 'success',
    },
    {
      icon: 'warning-outline',
      title: 'Stock bajo',
      description: 'Producto "Leche" por debajo del mÃ­nimo',
      time: '2 horas',
      color: 'warning',
    },
  ];

  constructor(
    private products: ProductService,
    public auth: AuthService,
    private carts: CartService,
    private inventory: InventoryService,
    private router: Router,
    private toast: ToastController,
    private menu: MenuController,
  ) {
    // TODO: Rehabilitar las verificaciones de permisos cuando sea necesario.
    this.modules$ = of(this.moduleCards.map(card => ({ ...card, allowed: true })));
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.setupRealtimeSubscriptions();
  }

  ngOnDestroy(): void {
    // Limpiar todas las subscripciones de realtime
    this.realtimeChannels.forEach(channel => {
      supabase().removeChannel(channel);
    });
    this.realtimeChannels = [];
  }

  private setupRealtimeSubscriptions(): void {
    console.log('[Realtime] Configurando subscripciones...');
    const sb = supabase();

    // Subscripción a cambios en productos
    const productsChannel = sb
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('[Realtime] Cambio en products:', payload);
          this.updateRecentActivities();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal products:', status);
      });

    // Subscripción a cambios en carritos (pedidos)
    const cartsChannel = sb
      .channel('carts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carts' },
        (payload) => {
          console.log('[Realtime] Cambio en carts:', payload);
          this.updateRecentActivities();
          this.updateMetrics();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal carts:', status);
      });

    // Subscripción a cambios en items de carritos
    const cartItemsChannel = sb
      .channel('cart-items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cart_items' },
        (payload) => {
          console.log('[Realtime] Cambio en cart_items:', payload);
          this.updateRecentActivities();
          this.updateMetrics();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal cart_items:', status);
      });

    // Subscripción a cambios en productos de inventario
    const inventoryChannel = sb
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_products' },
        (payload) => {
          console.log('[Realtime] Cambio en inventory_products:', payload);
          this.updateRecentActivities();
          this.updateMetrics();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal inventory_products:', status);
      });

    // Subscripción a cambios en órdenes de compra (GESTIÓN DE PEDIDOS)
    const purchaseOrdersChannel = sb
      .channel('purchase-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        (payload) => {
          console.log('[Realtime] ✨ Cambio en purchase_orders (GESTIÓN DE PEDIDOS):', payload);
          this.updateRecentActivities();
          this.updateMetrics();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal purchase_orders:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Canal de gestión de pedidos ACTIVO');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] ❌ ERROR: Canal de gestión de pedidos falló. Verifica que Realtime esté habilitado en Supabase.');
        }
      });

    // Subscripción a cambios en items de órdenes de compra
    const purchaseOrderItemsChannel = sb
      .channel('purchase-order-items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_order_items' },
        (payload) => {
          console.log('[Realtime] ✨ Cambio en purchase_order_items:', payload);
          this.updateRecentActivities();
          this.updateMetrics();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal purchase_order_items:', status);
      });

    // Subscripción a cambios en ventas
    const salesChannel = sb
      .channel('sales-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        (payload) => {
          console.log('[Realtime] Cambio en sales:', payload);
          this.updateRecentActivities();
          this.updateMetrics();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Canal sales:', status);
      });

    this.realtimeChannels = [
      productsChannel,
      cartsChannel,
      cartItemsChannel,
      inventoryChannel,
      purchaseOrdersChannel,
      purchaseOrderItemsChannel,
      salesChannel
    ];

    console.log('[Realtime] ✅ Configuración completa - 7 canales iniciados');
    console.log('[Realtime] 📝 Para que funcione, ejecuta el script SQL en Supabase (ver DIAGNOSTICO_REALTIME.md)');
  }

  private async updateRecentActivities(): Promise<void> {
    try {
      const allActivities: RecentActivity[] = [];
      
      // 1. Actividades de productos
      try {
        const { data: products } = await supabase()
          .from('products')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        
        (products || []).forEach((row: any) => {
          allActivities.push({
            icon: 'add-circle-outline',
            title: 'Nuevo producto',
            description: `${row.name || 'Producto'} agregado`,
            time: this.relativeTime(row.created_at),
            color: 'success',
          });
        });
      } catch (error) {
        console.error('Error cargando productos recientes:', error);
      }

      // 2. Actividades de inventario
      try {
        const { data: inventory } = await supabase()
          .from('inventory_products')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        
        (inventory || []).forEach((row: any) => {
          allActivities.push({
            icon: 'archive-outline',
            title: 'Inventario',
            description: `${row.name || 'Producto'} registrado`,
            time: this.relativeTime(row.created_at),
            color: 'success',
          });
        });
      } catch (error) {
        console.error('Error cargando inventario reciente:', error);
      }

      // 3. Actividades de carritos (pedidos)
      try {
        const { data: carts } = await supabase()
          .from('carts')
          .select('id, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        
        (carts || []).forEach((row: any) => {
          const isOrdered = row.status === 'ordered';
          allActivities.push({
            icon: isOrdered ? 'receipt-outline' : 'cart-outline',
            title: isOrdered ? 'Pedido confirmado' : 'Carrito creado',
            description: `Pedido ${row.id.slice(0, 8)}... ${isOrdered ? 'confirmado' : 'creado'}`,
            time: this.relativeTime(row.created_at),
            color: isOrdered ? 'primary' : 'medium',
          });
        });
      } catch (error) {
        console.error('Error cargando carritos recientes:', error);
      }

      // 4. Actividades de items de carritos
      try {
        const { data: cartItems } = await supabase()
          .from('cart_items')
          .select(`
            id, 
            qty, 
            created_at,
            product_id,
            products (name)
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        
        (cartItems || []).forEach((row: any) => {
          const productName = row.products?.name || 'Producto';
          allActivities.push({
            icon: 'cart-outline',
            title: 'Item agregado al carrito',
            description: `${row.qty}x ${productName}`,
            time: this.relativeTime(row.created_at),
            color: 'primary',
          });
        });
      } catch (error) {
        console.error('Error cargando items de carrito:', error);
      }

      // 5. Actividades de órdenes de compra
      try {
        const { data: orders } = await supabase()
          .from('purchase_orders')
          .select(`
            id, 
            status, 
            expected_date, 
            created_at,
            suppliers (name)
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        
        (orders || []).forEach((row: any) => {
          const supplierName = row.suppliers?.name || 'Proveedor';
          let statusText = '';
          let statusColor: 'primary' | 'success' | 'warning' | 'danger' | 'medium' = 'medium';
          
          switch (row.status) {
            case 'DRAFT':
              statusText = 'borrador';
              statusColor = 'medium';
              break;
            case 'SENT':
              statusText = 'enviada';
              statusColor = 'primary';
              break;
            case 'RECEIVED':
              statusText = 'recibida';
              statusColor = 'success';
              break;
            case 'CANCELLED':
              statusText = 'cancelada';
              statusColor = 'danger';
              break;
            default:
              statusText = row.status.toLowerCase();
          }
          
          allActivities.push({
            icon: 'document-text-outline',
            title: `Orden de compra ${statusText}`,
            description: `${supplierName} - ${row.id.slice(0, 8)}...`,
            time: this.relativeTime(row.created_at),
            color: statusColor,
          });
        });
      } catch (error) {
        console.error('Error cargando órdenes de compra:', error);
      }

      // 6. Actividades de items de órdenes de compra
      try {
        const { data: orderItems } = await supabase()
          .from('purchase_order_items')
          .select(`
            id, 
            quantity_ordered, 
            quantity_received,
            created_at,
            inventory_products (name)
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        
        (orderItems || []).forEach((row: any) => {
          const productName = row.inventory_products?.name || 'Producto';
          const received = row.quantity_received > 0;
          
          allActivities.push({
            icon: received ? 'checkmark-circle-outline' : 'cube-outline',
            title: received ? 'Pedido recibido' : 'Item ordenado',
            description: received 
              ? `${row.quantity_received}/${row.quantity_ordered} ${productName} recibido`
              : `${row.quantity_ordered}x ${productName} ordenado`,
            time: this.relativeTime(row.created_at),
            color: received ? 'success' : 'primary',
          });
        });
      } catch (error) {
        console.error('Error cargando items de órdenes:', error);
      }

      // 7. Actividades de ventas
      try {
        const { data: sales } = await supabase()
          .from('sales')
          .select(`
            id, 
            quantity, 
            total_price,
            sale_date,
            products (name)
          `)
          .order('sale_date', { ascending: false })
          .limit(5);
        
        (sales || []).forEach((row: any) => {
          const productName = row.products?.name || 'Producto';
          allActivities.push({
            icon: 'cash-outline',
            title: 'Venta registrada',
            description: `${row.quantity}x ${productName} - $${Number(row.total_price).toFixed(2)}`,
            time: this.relativeTime(row.sale_date),
            color: 'success',
          });
        });
      } catch (error) {
        console.error('Error cargando ventas recientes:', error);
      }

      // Ordenar todas las actividades por tiempo (más recientes primero)
      allActivities.sort((a, b) => {
        // Convertir tiempo relativo a timestamp para ordenar correctamente
        const getTimestamp = (timeStr: string): number => {
          if (timeStr === 'ahora') return Date.now();
          const match = timeStr.match(/(\d+)\s*(min|h|d)/);
          if (!match) return 0;
          const value = parseInt(match[1]);
          const unit = match[2];
          const now = Date.now();
          if (unit === 'min') return now - value * 60000;
          if (unit === 'h') return now - value * 3600000;
          if (unit === 'd') return now - value * 86400000;
          return 0;
        };
        return getTimestamp(b.time) - getTimestamp(a.time);
      });

      // Tomar solo las 10 más recientes
      this.recentActivities = allActivities.slice(0, 10);
    } catch (error) {
      console.error('Error actualizando actividades recientes:', error);
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      // Actualizar inventario
      const inventoryItems = await firstValueFrom(this.inventory.list());
      this.totalProducts = inventoryItems.length;

      // Actualizar alertas
      try {
        const now = Date.now();
        const in30d = now + 30 * 24 * 60 * 60 * 1000;
        const lowOrOut = inventoryItems.filter(p => p.status === 'LOW' || p.status === 'OUT').length;
        const expiringSoon = inventoryItems.filter(p => {
          if (!p.nextExpiryDate) {
            return false;
          }
          const t = new Date(p.nextExpiryDate).getTime();
          return t <= in30d && t >= now && (p.totalStock ?? 0) > 0;
        }).length;
        this.alertCount = lowOrOut + expiringSoon;
      } catch {
        this.alertCount = 0;
      }

      // Actualizar pedidos pendientes
      this.pendingOrders = await this.carts.countPendingOrders().catch(() => 0);
      
      // Actualizar ventas del día
      this.todaySales = await this.carts.sumTodaySales().catch(() => 0);
    } catch (error) {
      console.error('Error actualizando métricas:', error);
    }
  }

  async loadDashboardData() {
    this.loading = true;
    try {
      const inventoryItems = await firstValueFrom(this.inventory.list());
      this.totalProducts = inventoryItems.length;

      try {
        const now = Date.now();
        const in30d = now + 30 * 24 * 60 * 60 * 1000;
        const lowOrOut = inventoryItems.filter(p => p.status === 'LOW' || p.status === 'OUT').length;
        const expiringSoon = inventoryItems.filter(p => {
          if (!p.nextExpiryDate) {
            return false;
          }
          const t = new Date(p.nextExpiryDate).getTime();
          return t <= in30d && t >= now && (p.totalStock ?? 0) > 0;
        }).length;
        this.alertCount = lowOrOut + expiringSoon;
      } catch {
        this.alertCount = 0;
      }

      this.pendingOrders = await this.carts.countPendingOrders().catch(() => 0);
      this.todaySales = await this.carts.sumTodaySales().catch(() => 0);

      const orderActivities = await this.carts.recentActivities(10).catch(() => []);
      let recentInv: RecentActivity[] = [];
      try {
        const { data } = await supabase()
          .from('inventory_products')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(10);
        recentInv = (data || []).map((row: any) => ({
          icon: 'archive-outline',
          title: 'Inventario',
          description: `${row.name || 'Producto'} registrado`,
          time: this.relativeTime(row.created_at),
          color: 'success',
        }));
      } catch {
        recentInv = [];
      }
      this.recentActivities = [...orderActivities, ...recentInv].slice(0, 10);
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      this.loading = false;
    }
  }

  navigateToModule(module: ModuleWithAccess) {
    if (!module.allowed) {
      void this.showToast('No tienes permisos para acceder a este modulo.', 'warning');
      return;
    }

    switch (module.id) {
      case 'inventory':
        this.router.navigateByUrl('/inventory');
        return;
      case 'orders':
        this.router.navigateByUrl('/orders');
        return;
      case 'sales-history':
        this.router.navigateByUrl('/sales');
        return;
      case 'sales-import':
        this.router.navigateByUrl('/sales-import');
        return;
      case 'alerts':
        this.router.navigateByUrl('/alerts');
        return;
      case 'reports':
      case 'reports-export':
        this.router.navigateByUrl('/reports');
        return;
      case 'users':
        this.router.navigateByUrl('/users');
        return;
      case 'roles':
        this.router.navigateByUrl('/roles');
        return;
      case 'pos':
        this.router.navigateByUrl('/pos');
        return;
      case 'sales':
        void this.showToast('Modulo de punto de venta en construccion.', 'primary');
        return;
      default:
        void this.showToast(`Modulo ${module.title} en construccion.`, 'primary');
        return;
    }
  }
  async logout() {
    this.loading = true;
    const { error } = await this.auth.signOut();
    this.loading = false;

    if (error) {
      await this.showToast('Error al cerrar sesiÃ³n', 'danger');
      return;
    }

    await this.showToast('SesiÃ³n cerrada', 'success');
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private relativeTime(dateIso?: string): string {
    if (!dateIso) {
      return '';
    }
    const diff = Date.now() - new Date(dateIso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) {
      return 'ahora';
    }
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} h`;
    }
    const days = Math.floor(hours / 24);
    return `${days} d`;
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' | 'warning') {
    const toast = await this.toast.create({
      message,
      duration: 2000,
      position: 'top',
      color,
    });
    await toast.present();
  }
}














