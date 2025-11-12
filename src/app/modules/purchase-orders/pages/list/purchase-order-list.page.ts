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
  pagedOrders: PurchaseOrder[] = [];
  readonly pageSize = 10;
  currentPage = 1;
  totalPages = 0;
  totalItems = 0;

  constructor(private svc: PurchaseOrdersService, private router: Router, private toast: ToastController) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    try {
      this.orders = await this.svc.list();
      this.updatePagedOrders(true);
    } catch (e) {
      await this.showToast('Error cargando pedidos', 'danger');
      this.updatePagedOrders();
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

  get rangeStart(): number {
    if (!this.totalItems || !this.currentPage) {
      return 0;
    }
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    if (!this.totalItems || !this.currentPage) {
      return 0;
    }
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
      this.updatePagedOrders();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
      this.updatePagedOrders();
    }
  }

  private updatePagedOrders(resetPage = false) {
    this.totalItems = this.orders.length;
    this.totalPages = this.totalItems ? Math.ceil(this.totalItems / this.pageSize) : 0;

    if (!this.totalPages) {
      this.currentPage = 0;
      this.pagedOrders = [];
      return;
    }

    if (resetPage || this.currentPage < 1) {
      this.currentPage = 1;
    } else if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedOrders = this.orders.slice(start, start + this.pageSize);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' | 'warning') {
    const t = await this.toast.create({ message, duration: 2000, position: 'top', color });
    await t.present();
  }
}


