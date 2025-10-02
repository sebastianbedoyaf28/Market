import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { PurchaseOrdersService } from '../../services/purchase-orders.service';
import { SuppliersService, SupplierRow } from '../../services/suppliers.service';
import { InventoryService } from '../../../inventory/services/inventory.service';

@Component({
  standalone: true,
  selector: 'app-purchase-order-form',
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './purchase-order-form.page.html',
  styleUrls: ['./purchase-order-form.page.scss'],
})
export class PurchaseOrderFormPage {
  supplierId = '';
  expectedDate = '';
  items: Array<{ productId: string; quantityOrdered: number; unitCost?: number }>= [];
  saving = false;
  suppliers: SupplierRow[] = [];
  products: Array<{ id: string; name: string; sku: string; salePrice: number }> = [];

  constructor(private svc: PurchaseOrdersService, private router: Router, private toast: ToastController, private suppliersSvc: SuppliersService, private alert: AlertController, private inventorySvc: InventoryService) {}

  async ionViewWillEnter() {
    try {
      this.suppliers = await this.suppliersSvc.list();
      const inv = await this.inventorySvc.list().toPromise();
      this.products = (inv || []).map(p => ({ id: p.id, name: p.name, sku: p.sku, salePrice: p.salePrice }));
    } catch {}
  }

  addItem() {
    this.items.push({ productId: '', quantityOrdered: 1 });
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
  }

  async save() {
    try {
      this.saving = true;
      const order = await this.svc.create({ supplierId: this.supplierId, expectedDate: this.expectedDate, items: this.items });
      await this.showToast('Pedido creado', 'success');
      this.router.navigate(['orders', order.id]);
    } catch (e: any) {
      await this.showToast(e?.message || 'Error al crear pedido', 'danger');
    } finally {
      this.saving = false;
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' | 'warning') {
    const t = await this.toast.create({ message, duration: 2000, position: 'top', color });
    await t.present();
  }

  async openNewSupplierAlert() {
    const a = await this.alert.create({
      header: 'Nuevo proveedor',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre', attributes: { maxlength: 80 } },
        { name: 'email', type: 'email', placeholder: 'Email (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Crear',
          handler: async (data) => {
            try {
              const created = await this.suppliersSvc.create({ name: data?.name, email: data?.email });
              this.suppliers = await this.suppliersSvc.list();
              this.supplierId = created.id;
              await this.showToast('Proveedor creado', 'success');
            } catch (e: any) {
              await this.showToast(e?.message || 'Error creando proveedor', 'danger');
            }
          }
        }
      ]
    });
    await a.present();
  }
}


