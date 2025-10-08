import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Observable, map, firstValueFrom } from 'rxjs';
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
  
  // MÃ©tricas del dashboard
  totalProducts = 0;
  pendingOrders = 0;
  todaySales = 0;
  alertCount = 0;

  // Actividad reciente (mock data por ahora)
  recentActivities: RecentActivity[] = [
    {
      icon: 'add-circle-outline',
      title: 'Nuevo producto agregado',
      description: 'Producto "Arroz Premium" agregado al inventario',
      time: '5 min',
      color: 'success'
    },
    {
      icon: 'receipt-outline',
      title: 'Pedido recibido',
      description: 'Pedido #1234 marcado como recibido',
      time: '15 min',
      color: 'primary'
    },
    {
      icon: 'card-outline',
      title: 'Venta registrada',
      description: 'Venta por $45.50 procesada',
      time: '1 hora',
      color: 'success'
    },
    {
      icon: 'warning-outline',
      title: 'Stock bajo',
      description: 'Producto "Leche" por debajo del mÃ­nimo',
      time: '2 horas',
      color: 'warning'
    }
  ];

  constructor(
    private products: ProductService,
    public auth: AuthService,
    private carts: CartService,
    private inventory: InventoryService,
    private router: Router,
    private toast: ToastController,
    private menu: MenuController
  ) {}

  ngOnInit() { 
    this.loadDashboardData();
  }

  async loadDashboardData() {
    this.loading = true;
    try {
      // INVENTARIO: contar productos reales desde inventory_products
      const inventoryItems = await firstValueFrom(this.inventory.list());
      this.totalProducts = inventoryItems.length;

      // Calcular alertas: stock bajo + próximos a vencer (con base en inventario)
      try {
        const now = Date.now();
        const in30d = now + 30 * 24 * 60 * 60 * 1000;
        const lowOrOut = inventoryItems.filter(p => p.status === 'LOW' || p.status === 'OUT').length;
        const expiringSoon = inventoryItems.filter(p => {
          if (!p.nextExpiryDate) return false;
          const t = new Date(p.nextExpiryDate).getTime();
          return t <= in30d && t >= now && (p.totalStock ?? 0) > 0;
        }).length;
        this.alertCount = lowOrOut + expiringSoon;
      } catch {
        this.alertCount = 0;
      }

      // Pedidos pendientes
      this.pendingOrders = await this.carts.countPendingOrders().catch(() => 0);
      // Ventas hoy
      this.todaySales = await this.carts.sumTodaySales().catch(() => 0);

      // Actividad reciente real (mezcla de pedidos y altas de inventario)
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
      } catch {}
      this.recentActivities = [...orderActivities, ...recentInv].slice(0, 10);
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      this.loading = false;
    }
  }

  private relativeTime(dateIso?: string): string {
    if (!dateIso) return '';
    const diff = Date.now() - new Date(dateIso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs} h`;
    const days = Math.floor(hrs / 24);
    return `${days} d`;
  }

  navigateToModule(module: string) {
    if (module === 'inventory') {
      this.router.navigateByUrl('/inventory');
      return;
    }
    if (module === 'orders') {
      this.router.navigateByUrl('/orders');
      return;
    }
    if (module === 'sales-import') {
      this.router.navigateByUrl('/sales-import');
      return;
    }
    if (module === 'alerts') {
      this.router.navigateByUrl('/alerts');
      return;
    }

    this.showToast('Navegando a ' + module, 'primary');
  }

  async logout() {
    this.loading = true;
    const { error } = await this.auth.signOut();
    this.loading = false;

    if (error) {
      await this.showToast('Error al cerrar sesion', 'danger');
      return;
    }

    await this.showToast('Sesion cerrada', 'success');
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' | 'warning') {
    const toast = await this.toast.create({
      message,
      duration: 2000,
      position: 'top',
      color
    });
    await toast.present();
  }
}






