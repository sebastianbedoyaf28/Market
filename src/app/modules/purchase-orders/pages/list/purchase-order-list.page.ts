import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { PurchaseOrdersService } from '../../services/purchase-orders.service';
import { PurchaseOrder } from '../../models/purchase-orders.models';

@Component({
  standalone: true,
  selector: 'app-purchase-order-list',
  imports: [CommonModule, IonicModule],
  templateUrl: './purchase-order-list.page.html',
  styleUrls: ['./purchase-order-list.page.scss'],
})
export class PurchaseOrderListPage implements OnInit {
  loading = false;
  orders: PurchaseOrder[] = [];

  constructor(private svc: PurchaseOrdersService, private router: Router, private toast: ToastController) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    try {
      this.orders = await this.svc.list();
    } catch (e) {
      await this.showToast('Error cargando pedidos', 'danger');
    } finally {
      this.loading = false;
    }
  }

  newOrder() {
    this.router.navigate(['orders', 'new']);
  }

  open(order: PurchaseOrder) {
    this.router.navigate(['orders', order.id]);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' | 'warning') {
    const t = await this.toast.create({ message, duration: 2000, position: 'top', color });
    await t.present();
  }
}


