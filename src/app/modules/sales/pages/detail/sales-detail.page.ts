import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonChip,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner,
  LoadingController,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  trashOutline,
  createOutline,
  calendarOutline,
  personOutline,
  documentTextOutline,
  cubeOutline,
  cashOutline,
} from 'ionicons/icons';
import { Sale } from '../../models/sales.models';
import { SalesService } from '../../services/sales.service';

/**
 * Página de detalle de venta
 * RF007 - Detalle de venta con ítems, cantidades y totales
 */
@Component({
  selector: 'app-sales-detail',
  templateUrl: './sales-detail.page.html',
  styleUrls: ['./sales-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonChip,
    IonBadge,
    IonGrid,
    IonRow,
    IonCol,
    IonSpinner,
  ],
})
export class SalesDetailPage implements OnInit {
  sale: Sale | null = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private salesService: SalesService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    addIcons({
      trashOutline,
      createOutline,
      calendarOutline,
      personOutline,
      documentTextOutline,
      cubeOutline,
      cashOutline,
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadSale(id);
    } else {
      this.router.navigate(['/sales']);
    }
  }

  loadSale(id: string) {
    this.isLoading = true;
    this.salesService.getById(id).subscribe({
      next: (sale) => {
        this.sale = sale;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading sale:', error);
        this.showToast('Error al cargar la venta', 'danger');
        this.isLoading = false;
        this.router.navigate(['/sales']);
      },
    });
  }

  async deleteSale() {
    if (!this.sale) return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar eliminación',
      message: `¿Está seguro de eliminar esta venta?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Eliminando...',
            });
            await loading.present();

            this.salesService.delete(this.sale!.id).subscribe({
              next: async () => {
                await loading.dismiss();
                await this.showToast('Venta eliminada correctamente', 'success');
                this.router.navigate(['/sales']);
              },
              error: async (error) => {
                await loading.dismiss();
                console.error('Error deleting sale:', error);
                await this.showToast('Error al eliminar la venta', 'danger');
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'warning',
      reconciled: 'success',
      cancelled: 'danger',
    };
    return colors[status] || 'medium';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      reconciled: 'Conciliada',
      cancelled: 'Anulada',
    };
    return labels[status] || status;
  }

  getImportSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      manual: 'Manual',
      csv_excel_import: 'CSV/Excel',
      pos_system: 'Sistema POS',
    };
    return labels[source] || source;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatDateTime(datetime: string | undefined): string {
    if (!datetime) return 'N/A';
    return new Date(datetime).toLocaleString('es-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

