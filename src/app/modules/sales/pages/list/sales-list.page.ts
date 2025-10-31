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
  IonGrid,
  IonRow,
  IonCol,
  IonSelect,
  IonSelectOption,
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
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
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
    IonGrid,
    IonRow,
    IonCol,
    IonSelect,
    IonSelectOption,
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
          // Error loading sales
          this.showToast('Error al cargar ventas', 'danger');
          this.isLoading = false;
          if (event) event.target.complete();
        },
      });
    } catch (error) {
      // Error
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
        // Error loading summary
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
                // Error deleting sale
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
      const filename = `ventas_${this.getDateString()}.csv`;
      await this.downloadFile(blob, filename);
      await loading.dismiss();
    } catch (error: any) {
      await loading.dismiss();
      const errorMsg = error?.message || error?.toString() || 'Error desconocido';
      await this.showToast(`Error al exportar: ${errorMsg}`, 'danger');
    }
  }

  async exportPDF() {
    const loading = await this.loadingCtrl.create({
      message: 'Exportando a PDF...',
    });
    await loading.present();

    try {
      const blob = await this.salesService.exportToPDF(this.filters);
      await this.downloadFile(blob, `ventas_${this.getDateString()}.pdf`);
      await loading.dismiss();
    } catch (error) {
      await loading.dismiss();
      // Error exporting PDF
      await this.showToast('Error al exportar', 'danger');
    }
  }

  private async downloadFile(blob: Blob, filename: string) {
    const platform = Capacitor.getPlatform();
    
    // Si estamos en Android o iOS, guardar en múltiples ubicaciones y compartir
    if (platform === 'android' || platform === 'ios') {
      try {
        // Convertir blob a base64
        let base64: string;
        
        if (blob.type.includes('text/') || blob.type.includes('csv')) {
          // Para CSV, convertir texto a base64 UTF-8
          const text = await blob.text();
          base64 = btoa(unescape(encodeURIComponent(text)));
        } else {
          // Para PDF y otros binarios
          base64 = await this.blobToBase64(blob);
        }
        
        // 1. Guardar en Cache primero (para compartir)
        const cacheResult = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });
        
        const fileUri = cacheResult.uri;
        
        // 2. Guardar en Documents (para acceso directo del usuario)
        let documentsUri: string | null = null;
        try {
          const documentsResult = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Documents,
          });
          documentsUri = documentsResult.uri;
        } catch (docError) {
          // Si falla Documents, no es crítico
        }
        
        // 3. Intentar guardar en ExternalStorage si está disponible (Android)
        let externalUri: string | null = null;
        if (platform === 'android') {
          try {
            // En Android, intentar guardar en Downloads usando ExternalStorage
            const externalResult = await Filesystem.writeFile({
              path: `Download/${filename}`, // Guardar en carpeta Download
              data: base64,
              directory: Directory.ExternalStorage,
            });
            externalUri = externalResult.uri;
          } catch (externalError) {
            // ExternalStorage puede requerir permisos adicionales, no es crítico
          }
        }
        
        // 4. Mostrar diálogo de compartir
        try {
          const fileType = filename.endsWith('.csv') ? 'CSV' : 'PDF';
          await Share.share({
            title: 'Compartir archivo',
            text: `Archivo: ${filename}`,
            url: fileUri,
            dialogTitle: `Compartir archivo ${fileType}`,
          });
          
          // Informar al usuario dónde está guardado
          let locationMsg = 'Archivo listo para compartir';
          if (externalUri) {
            locationMsg += ' y guardado en Descargas';
          } else if (documentsUri) {
            locationMsg += ' y guardado en Documentos de la app';
          }
          await this.showToast(locationMsg, 'success');
        } catch (shareError) {
          // Si Share falla, informar dónde está guardado
          let locationMsg = `Archivo guardado: ${filename}`;
          if (externalUri) {
            locationMsg = 'Archivo guardado en Descargas';
          } else if (documentsUri) {
            locationMsg = 'Archivo guardado en Documentos de la app';
          } else {
            locationMsg = 'Archivo guardado en caché';
          }
          await this.showToast(locationMsg, 'success');
        }
        
      } catch (error: any) {
        // Si todo falla, intentar método alternativo
        try {
          await this.showToast('Guardando archivo...', 'warning');
          
          const base64 = blob.type.includes('text/') || blob.type.includes('csv')
            ? btoa(unescape(encodeURIComponent(await blob.text())))
            : await this.blobToBase64(blob);
          
          // Guardar en cache como último recurso
          await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Cache,
          });
          
          await this.showToast('Archivo guardado en caché de la app', 'success');
        } catch (fallbackError: any) {
          const errorMsg = error?.message || fallbackError?.message || 'No se pudo guardar el archivo';
          await this.showToast(`Error: ${errorMsg}`, 'danger');
          throw error;
        }
      }
    } else {
      // Si estamos en web, usar el método tradicional
      try {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        await this.showToast('Archivo descargado correctamente', 'success');
      } catch (fallbackError: any) {
        await this.showToast('Error al descargar archivo', 'danger');
        throw fallbackError;
      }
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64 = reader.result as string;
          // Remover el prefijo data:mimeType;base64,
          const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
          console.log('Base64 convertido exitosamente, longitud:', base64Data.length);
          resolve(base64Data);
        } catch (error) {
          console.error('Error al procesar base64:', error);
          reject(error);
        }
      };
      reader.onerror = (error) => {
        console.error('Error en FileReader:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
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

