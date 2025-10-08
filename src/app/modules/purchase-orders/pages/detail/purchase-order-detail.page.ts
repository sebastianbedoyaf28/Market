import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { PurchaseOrdersService } from '../../services/purchase-orders.service';
import { PurchaseOrder } from '../../models/purchase-orders.models';

@Component({
  standalone: true,
  selector: 'app-purchase-order-detail',
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './purchase-order-detail.page.html',
  styleUrls: ['./purchase-order-detail.page.scss'],
})
export class PurchaseOrderDetailPage implements OnInit {
  order: PurchaseOrder | null = null;
  loading = false;
  itemsToReceive: Array<{ productId: string; quantityReceived: number }> = [];

  constructor(private route: ActivatedRoute, private svc: PurchaseOrdersService, private toast: ToastController, private alert: AlertController) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loading = true;
    try {
      this.order = await this.svc.getById(id);
      this.itemsToReceive = this.order?.items.map(it => ({ productId: it.productId, quantityReceived: it.quantityReceived || 0 })) || [];
    } catch {
      await this.showToast('Error cargando pedido', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async markSent() {
    if (!this.order) return;
    await this.svc.changeStatus(this.order.id, 'SENT');
    await this.reload();
  }

  async markCancelled() {
    if (!this.order) return;
    await this.svc.changeStatus(this.order.id, 'CANCELLED');
    await this.reload();
  }

  async receive() {
    if (!this.order) return;
    try {
      this.loading = true;
      // Detectar faltantes antes de registrar
      const faltantes = this.order.items.filter((it, i) => {
        const recibido = this.itemsToReceive[i]?.quantityReceived ?? 0;
        return recibido < it.quantityOrdered;
      });

      if (faltantes.length > 0) {
        const productos = faltantes.map(f => `${f.name || f.productId}: solicitado ${f.quantityOrdered}, recibido ${this.itemsToReceive.find(x => x.productId === f.productId)?.quantityReceived ?? 0}`).join('\n');
        await this.alert.create({
          header: 'Atención: Faltantes',
          message: `Se recibieron menos unidades de lo solicitado para:\n${productos}`,
          buttons: ['OK']
        }).then(a => a.present());
      }

      await this.svc.receive(this.order.id, this.itemsToReceive);
      await this.showToast('Recepción registrada', 'success');
      await this.reload();
    } catch (e: any) {
      await this.showToast(e?.message || 'Error al recibir', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async exportPdf() {
    if (!this.order) return;
    const blob = await this.svc.exportPdf(this.order.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedido-${this.order.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async reload() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.order = await this.svc.getById(id);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' | 'warning') {
    const t = await this.toast.create({ message, duration: 2000, position: 'top', color });
    await t.present();
  }
}


