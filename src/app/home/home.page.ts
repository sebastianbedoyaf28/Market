import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { Product, ProductService } from '../services/product.service';
import { AuthService } from '../services/auth.service';

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
  
  // Métricas del dashboard
  totalProducts = 0;
  pendingOrders = 3;
  todaySales = 1250.50;
  alertCount = 2;

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
      description: 'Producto "Leche" por debajo del mínimo',
      time: '2 horas',
      color: 'warning'
    }
  ];

  constructor(
    private products: ProductService,
    private auth: AuthService,
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
      // Cargar productos y contar total
      this.products$ = this.products.list();
      this.products$.pipe(
        map(products => products.length)
      ).subscribe(count => {
        this.totalProducts = count;
      });
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      this.loading = false;
    }
  }

  navigateToModule(module: string) {
    // Por ahora mostrar toast, después implementaremos las rutas
    this.showToast(`Navegando a ${module}`, 'primary');
    
    // Aquí implementarías la navegación a cada módulo
    switch (module) {
      case 'inventory':
        // this.router.navigateByUrl('/inventory');
        break;
      case 'orders':
        // this.router.navigateByUrl('/orders');
        break;
      case 'sales':
        // this.router.navigateByUrl('/sales');
        break;
      case 'reports':
        // this.router.navigateByUrl('/reports');
        break;
      case 'users':
        // this.router.navigateByUrl('/users');
        break;
      case 'alerts':
        // this.router.navigateByUrl('/alerts');
        break;
    }
  }

  async logout() {
    this.loading = true;
    const { error } = await this.auth.signOut();
    this.loading = false;
    
    if (error) {
      await this.showToast('Error al cerrar sesión', 'danger');
      return;
    }
    
    await this.showToast('Sesión cerrada', 'success');
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
