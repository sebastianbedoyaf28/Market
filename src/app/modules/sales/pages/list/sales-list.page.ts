import { Component, OnInit } from '@angular/core';
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonChip,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonGrid,
  IonRow,
  IonCol,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonModal,
  IonSpinner,
  IonInput,
  LoadingController,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  filterOutline,
  downloadOutline,
  eyeOutline,
  trashOutline,
  addOutline,
  calendarOutline,
  closeCircleOutline,
} from 'ionicons/icons';
import { Sale, SaleFilters, SalesSummary } from '../../models/sales.models';
import { SalesService } from '../../services/sales.service';

/**
 * Página de lista de ventas con filtros
 * RF007 - Historial de Ventas y Reportes
 */
@Component({
  selector: 'app-sales-list',
  templateUrl: './sales-list.page.html',
  styleUrls: ['./sales-list.page.scss'],
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonSearchbar,
    IonChip,
    IonBadge,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonGrid,
    IonRow,
    IonCol,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonModal,
    IonSpinner,
    IonInput,
  ],
})
export class SalesListPage implements OnInit {
  sales: Sale[] = [];
  filteredSales: Sale[] = [];
  summary: SalesSummary | null = null;
  isLoading = false;
  showFilterModal = false;

  // Filtros
  filters: SaleFilters = {
    status: 'all',
    importSource: 'all',
  };

  searchTerm = '';

  constructor(
    private salesService: SalesService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    addIcons({
      filterOutline,
      downloadOutline,
      eyeOutline,
      trashOutline,
      addOutline,
      calendarOutline,
      closeCircleOutline,
    });
  }

  ngOnInit() {
    this.loadSales();
  }

  async loadSales(event?: any) {
    if (!event) {
      this.isLoading = true;
    }

    try {
      this.salesService.list(this.filters).subscribe({
        next: (sales) => {
          this.sales = sales;
          this.applySearch();
          this.loadSummary();
          this.isLoading = false;
          if (event) event.target.complete();
        },
        error: (error) => {
          console.error('Error loading sales:', error);
          this.showToast('Error al cargar ventas', 'danger');
          this.isLoading = false;
          if (event) event.target.complete();
        },
      });
    } catch (error) {
      console.error('Error:', error);
      this.isLoading = false;
      if (event) event.target.complete();
    }
  }

  loadSummary() {
    this.salesService.getSummary(this.filters).subscribe({
      next: (summary) => {
        this.summary = summary;
      },
      error: (error) => {
        console.error('Error loading summary:', error);
      },
    });
  }

  applySearch() {
    if (!this.searchTerm.trim()) {
      this.filteredSales = [...this.sales];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredSales = this.sales.filter(
      (sale) =>
        sale.productName?.toLowerCase().includes(term) ||
        sale.productSku?.toLowerCase().includes(term) ||
        sale.customerName?.toLowerCase().includes(term) ||
        sale.invoiceNumber?.toLowerCase().includes(term)
    );
  }

  onSearchChange(event: any) {
    this.searchTerm = event.target.value || '';
    this.applySearch();
  }

  openFilterModal() {
    this.showFilterModal = true;
  }

  closeFilterModal() {
    this.showFilterModal = false;
  }

  applyFilters() {
    this.closeFilterModal();
    this.loadSales();
  }

  clearFilters() {
    this.filters = {
      status: 'all',
      importSource: 'all',
    };
    this.searchTerm = '';
    this.loadSales();
  }

  viewDetail(sale: Sale) {
    this.router.navigate(['/sales/detail', sale.id]);
  }

  async deleteSale(sale: Sale) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar eliminación',
      message: `¿Está seguro de eliminar la venta de ${sale.productName}?`,
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

            this.salesService.delete(sale.id).subscribe({
              next: async () => {
                await loading.dismiss();
                await this.showToast('Venta eliminada correctamente', 'success');
                this.loadSales();
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

  async exportCSV() {
    const loading = await this.loadingCtrl.create({
      message: 'Exportando a CSV...',
    });
    await loading.present();

    try {
      const blob = await this.salesService.exportToCSV(this.filters);
      this.downloadFile(blob, `ventas_${this.getDateString()}.csv`);
      await loading.dismiss();
      await this.showToast('Exportado correctamente', 'success');
    } catch (error) {
      await loading.dismiss();
      console.error('Error exporting CSV:', error);
      await this.showToast('Error al exportar', 'danger');
    }
  }

  async exportPDF() {
    const loading = await this.loadingCtrl.create({
      message: 'Exportando a PDF...',
    });
    await loading.present();

    try {
      const blob = await this.salesService.exportToPDF(this.filters);
      this.downloadFile(blob, `ventas_${this.getDateString()}.pdf`);
      await loading.dismiss();
      await this.showToast('Exportado correctamente', 'success');
    } catch (error) {
      await loading.dismiss();
      console.error('Error exporting PDF:', error);
      await this.showToast('Error al exportar', 'danger');
    }
  }

  private downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'warning',
      reconciled: 'success',
      cancelled: 'danger',
    };
    return colors[status] || 'medium';
  }

  getImportSourceIcon(source: string): string {
    const icons: Record<string, string> = {
      manual: 'person-outline',
      csv_excel_import: 'document-text-outline',
      pos_system: 'desktop-outline',
    };
    return icons[source] || 'help-outline';
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
      month: 'short',
      day: 'numeric',
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

