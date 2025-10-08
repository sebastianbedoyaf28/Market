import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent, 
  IonButton, 
  IonIcon, 
  IonItem, 
  IonLabel, 
  IonSelect, 
  IonSelectOption, 
  IonGrid, 
  IonRow, 
  IonCol, 
  IonDatetime, 
  IonCheckbox,
  IonList,
  IonSpinner,
  IonChip,
  IonBadge,
  LoadingController,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  downloadOutline, 
  documentTextOutline, 
  receiptOutline,
  calendarOutline,
  personOutline,
  timeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  fileTrayFullOutline
} from 'ionicons/icons';
import { ExportService, ExportOptions, ExportHistory } from '../../services/export.service';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonGrid,
    IonRow,
    IonCol,
    IonDatetime,
    IonCheckbox,
    IonList,
    IonSpinner,
    IonChip,
    IonBadge
  ]
})
export class ReportsPage implements OnInit {

  // Opciones de exportación
  exportOptions: ExportOptions = {
    type: 'inventory',
    format: 'csv',
    includeMetadata: true
  };

  // Estado de la UI
  isExporting = false;
  exportHistory: ExportHistory[] = [];
  isLoadingHistory = false;

  // Opciones para los selects
  reportTypes = [
    { value: 'inventory', label: 'Inventario', description: 'Productos y movimientos de stock' },
    { value: 'sales', label: 'Ventas', description: 'Registro de ventas realizadas' },
    { value: 'orders', label: 'Pedidos', description: 'Órdenes de compra y recepción' }
  ];

  formats = [
    { value: 'csv', label: 'CSV', description: 'Archivo de valores separados por comas' },
    { value: 'pdf', label: 'PDF', description: 'Documento portable con formato' }
  ];

  constructor(
    private exportService: ExportService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    addIcons({
      downloadOutline,
      documentTextOutline,
      receiptOutline,
      calendarOutline,
      personOutline,
      timeOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      fileTrayFullOutline
    });
  }

  ngOnInit() {
    this.loadExportHistory();
  }

  /**
   * Carga el historial de exportaciones
   */
  async loadExportHistory() {
    this.isLoadingHistory = true;
    try {
      this.exportHistory = await this.exportService.getExportHistory();
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      this.isLoadingHistory = false;
    }
  }

  /**
   * Ejecuta la exportación
   */
  async executeExport() {
    // Validar opciones
    if (!this.exportOptions.type || !this.exportOptions.format) {
      await this.showToast('Por favor seleccione el tipo de reporte y formato', 'warning');
      return;
    }

    // Confirmar exportación
    const shouldExport = await this.confirmExport();
    if (!shouldExport) return;

    const loading = await this.loadingController.create({
      message: 'Generando reporte...',
      spinner: 'crescent'
    });
    await loading.present();

    this.isExporting = true;

    try {
      const result = await this.exportService.exportData(this.exportOptions);
      
      if (result.success) {
        await this.showToast(
          `Reporte ${result.fileName} descargado exitosamente`, 
          'success'
        );
        // Recargar historial
        await this.loadExportHistory();
      } else {
        await this.showToast(
          `Error en la exportación: ${result.error}`, 
          'danger'
        );
      }
    } catch (error) {
      await this.showToast(`Error inesperado: ${error}`, 'danger');
    } finally {
      this.isExporting = false;
      await loading.dismiss();
    }
  }

  /**
   * Confirma la exportación con el usuario
   */
  private async confirmExport(): Promise<boolean> {
    const reportTypeLabel = this.reportTypes.find(t => t.value === this.exportOptions.type)?.label;
    const formatLabel = this.formats.find(f => f.value === this.exportOptions.format)?.label;
    
    let message = `¿Desea exportar el reporte de ${reportTypeLabel} en formato ${formatLabel}?`;
    
    if (this.exportOptions.dateFrom && this.exportOptions.dateTo) {
      message += `\n\nRango de fechas: ${this.exportOptions.dateFrom} a ${this.exportOptions.dateTo}`;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar Exportación',
      message,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Exportar',
          role: 'confirm'
        }
      ]
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  /**
   * Maneja el cambio de fecha desde
   */
  onDateFromChange(event: any) {
    this.exportOptions.dateFrom = event.detail.value?.split('T')[0];
  }

  /**
   * Maneja el cambio de fecha hasta
   */
  onDateToChange(event: any) {
    this.exportOptions.dateTo = event.detail.value?.split('T')[0];
  }

  /**
   * Limpia las fechas seleccionadas
   */
  clearDates() {
    this.exportOptions.dateFrom = undefined;
    this.exportOptions.dateTo = undefined;
  }

  /**
   * Obtiene el ícono para el tipo de reporte
   */
  getReportTypeIcon(type: string): string {
    switch (type) {
      case 'inventory': return 'file-tray-full-outline';
      case 'sales': return 'receipt-outline';
      case 'orders': return 'document-text-outline';
      default: return 'document-text-outline';
    }
  }

  /**
   * Obtiene el color para el formato
   */
  getFormatColor(format: string): string {
    switch (format) {
      case 'csv': return 'success';
      case 'pdf': return 'danger';
      default: return 'medium';
    }
  }

  /**
   * Obtiene el color para el tipo de reporte
   */
  getReportTypeColor(type: string): string {
    switch (type) {
      case 'inventory': return 'primary';
      case 'sales': return 'success';
      case 'orders': return 'warning';
      default: return 'medium';
    }
  }

  /**
   * Formatea la fecha para mostrar
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtiene la fecha mínima para el selector
   */
  getMinDate(): string {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return oneYearAgo.toISOString();
  }

  /**
   * Obtiene la fecha máxima para el selector
   */
  getMaxDate(): string {
    return new Date().toISOString();
  }

  /**
   * Obtiene una vista previa de las opciones seleccionadas
   */
  getOptionsPreview(): string {
    const reportType = this.reportTypes.find(t => t.value === this.exportOptions.type);
    const format = this.formats.find(f => f.value === this.exportOptions.format);
    
    let preview = `${reportType?.label} en formato ${format?.label}`;
    
    if (this.exportOptions.dateFrom && this.exportOptions.dateTo) {
      preview += ` del ${this.exportOptions.dateFrom} al ${this.exportOptions.dateTo}`;
    }
    
    if (this.exportOptions.includeMetadata) {
      preview += ' (con metadata)';
    }
    
    return preview;
  }

  /**
   * Obtiene la etiqueta del tipo de reporte
   */
  getReportTypeLabel(type: string): string {
    const reportType = this.reportTypes.find(t => t.value === type);
    return reportType?.label || type;
  }

  /**
   * Muestra un mensaje toast
   */
  private async showToast(message: string, color: 'success' | 'danger' | 'warning' | 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 4000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}