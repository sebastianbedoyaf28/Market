import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { Product, ProductService } from '../services/product.service';
import { CartService } from '../services/cart.service';
import { AuthService } from '../services/auth.service';
import { InventoryService } from '../modules/inventory/services/inventory.service';
import { supabase } from '../core/supabase-client';

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
export class HomePage implements OnInit {
  products$!: Observable<Product[]>;
  loading = false;

  totalProducts = 0;
  pendingOrders = 0;
  todaySales = 0;
  alertCount = 0;

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
      id: 'sales',
      title: 'Punto de Venta',
      subtitle: 'Registro de ventas',
      icon: 'card-outline',
      cssClass: 'sales',
      route: '',
      permissions: ['sales:import'],
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
      id: 'sales-import',
      title: 'Importar ventas',
      subtitle: 'CSV/Excel desde sistemas externos',
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














