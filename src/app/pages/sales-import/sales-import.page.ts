import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
  IonProgressBar, 
  IonAlert,
  IonSpinner,
  IonChip,
  IonBadge,
  IonList,
  IonItemDivider,
  AlertController,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  cloudUploadOutline, 
  documentAttachOutline, 
  checkmarkCircleOutline, 
  warningOutline, 
  closeCircleOutline,
  downloadOutline,
  eyeOutline
} from 'ionicons/icons';
import { SalesImportService, ImportPreview, ImportResult } from '../../services/sales-import.service';

@Component({
  selector: 'app-sales-import',
  templateUrl: './sales-import.page.html',
  styleUrls: ['./sales-import.page.scss'],
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
    IonProgressBar,
    IonAlert,
    IonSpinner,
    IonChip,
    IonBadge,
    IonList,
    IonItemDivider
  ]
})
export class SalesImportPage implements OnInit {
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  selectedFile: File | null = null;
  preview: ImportPreview | null = null;
  isLoading = false;
  currentStep = 1; // 1: Selección, 2: Mapeo, 3: Procesamiento, 4: Resultado
  importResult: ImportResult | null = null;

  // Opciones de mapeo
  mappingOptions: {
    sku?: string;
    productName?: string;
    quantity?: string;
    unitPrice?: string;
    totalPrice?: string;
    saleDate?: string;
    customerName?: string;
    invoiceNumber?: string;
  } = {
    sku: '',
    productName: '',
    quantity: '',
    unitPrice: '',
    totalPrice: '',
    saleDate: '',
    customerName: '',
    invoiceNumber: ''
  };

  constructor(
    private salesImportService: SalesImportService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    addIcons({
      cloudUploadOutline,
      documentAttachOutline,
      checkmarkCircleOutline,
      warningOutline,
      closeCircleOutline,
      downloadOutline,
      eyeOutline
    });
  }

  ngOnInit() {}

  /**
   * Abre el selector de archivos
   */
  selectFile() {
    this.fileInput.nativeElement.click();
  }

  /**
   * Maneja la selección de archivo
   */
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      await this.showError('Tipo de archivo no válido. Por favor seleccione un archivo CSV o Excel.');
      return;
    }

    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      await this.showError('El archivo es demasiado grande. Máximo 10MB permitido.');
      return;
    }

    this.selectedFile = file;
    await this.parseSelectedFile();
  }

  /**
   * Parsea el archivo seleccionado y genera la vista previa
   */
  async parseSelectedFile() {
    if (!this.selectedFile) return;

    const loading = await this.loadingController.create({
      message: 'Analizando archivo...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      this.preview = await this.salesImportService.parseFile(this.selectedFile);
      this.mappingOptions = { 
        sku: this.preview.mappingOptions.sku || '',
        productName: this.preview.mappingOptions.productName || '',
        quantity: this.preview.mappingOptions.quantity || '',
        unitPrice: this.preview.mappingOptions.unitPrice || '',
        totalPrice: this.preview.mappingOptions.totalPrice || '',
        saleDate: this.preview.mappingOptions.saleDate || '',
        customerName: this.preview.mappingOptions.customerName || '',
        invoiceNumber: this.preview.mappingOptions.invoiceNumber || ''
      };
      this.currentStep = 2;
    } catch (error) {
      await this.showError(`Error al leer el archivo: ${error}`);
      this.resetImport();
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Procesa la importación
   */
  async processImport() {
    if (!this.selectedFile || !this.preview) return;

    // Validar mapeos obligatorios
    if (!this.mappingOptions.sku && !this.mappingOptions.productName) {
      await this.showError('Debe mapear al menos SKU o Nombre del Producto');
      return;
    }
    if (!this.mappingOptions.quantity) {
      await this.showError('Debe mapear la Cantidad');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Procesando ventas...',
      spinner: 'crescent'
    });
    await loading.present();

    this.currentStep = 3;

    try {
      const result$ = await this.salesImportService.processSalesData(
        this.selectedFile,
        this.mappingOptions
      );

      result$.subscribe({
        next: (result) => {
          this.importResult = result;
          this.currentStep = 4;
          loading.dismiss();
          this.showImportSummary();
        },
        error: (error) => {
          loading.dismiss();
          this.showError(`Error durante la importación: ${error}`);
          this.currentStep = 2;
        }
      });
    } catch (error) {
      await loading.dismiss();
      await this.showError(`Error durante la importación: ${error}`);
      this.currentStep = 2;
    }
  }

  /**
   * Muestra el resumen de la importación
   */
  async showImportSummary() {
    if (!this.importResult) return;

    const message = `
      <strong>Importación ${this.importResult.success ? 'Completada' : 'Finalizada con Errores'}</strong><br><br>
      📊 Total de registros: ${this.importResult.totalRecords}<br>
      ✅ Procesados: ${this.importResult.processedRecords}<br>
      ❌ Con errores: ${this.importResult.errorRecords}<br>
      ⚠️ Advertencias: ${this.importResult.warnings.length}
    `;

    const alert = await this.alertController.create({
      header: 'Resumen de Importación',
      message,
      buttons: ['OK']
    });

    await alert.present();
  }

  /**
   * Descarga un archivo de ejemplo
   */
  downloadSampleFile() {
    const sampleData = [
      {
        'SKU': 'PROD001',
        'Nombre del Producto': 'Producto Ejemplo 1',
        'Cantidad': '5',
        'Precio Unitario': '10.50',
        'Precio Total': '52.50',
        'Fecha de Venta': '2024-10-07',
        'Cliente': 'Juan Pérez',
        'Número de Factura': 'FAC-001'
      },
      {
        'SKU': 'PROD002',
        'Nombre del Producto': 'Producto Ejemplo 2',
        'Cantidad': '3',
        'Precio Unitario': '25.00',
        'Precio Total': '75.00',
        'Fecha de Venta': '2024-10-07',
        'Cliente': 'María García',
        'Número de Factura': 'FAC-002'
      }
    ];

    const csv = this.convertToCSV(sampleData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ejemplo_ventas.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Convierte datos a formato CSV
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ].join('\n');

    return csvContent;
  }

  /**
   * Reinicia el proceso de importación
   */
  resetImport() {
    this.selectedFile = null;
    this.preview = null;
    this.importResult = null;
    this.currentStep = 1;
    this.mappingOptions = {
      sku: '',
      productName: '',
      quantity: '',
      unitPrice: '',
      totalPrice: '',
      saleDate: '',
      customerName: '',
      invoiceNumber: ''
    };
    
    // Limpiar el input de archivo
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  /**
   * Muestra un mensaje de error
   */
  private async showError(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 5000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
  }

  /**
   * Obtiene las opciones disponibles para mapear
   */
  getAvailableHeaders(): string[] {
    return this.preview?.headers || [];
  }

  /**
   * Obtiene el progreso actual
   */
  getProgress(): number {
    return (this.currentStep - 1) / 3;
  }

  /**
   * Obtiene el texto del paso actual
   */
  getCurrentStepText(): string {
    switch (this.currentStep) {
      case 1: return 'Seleccionar Archivo';
      case 2: return 'Mapear Columnas';
      case 3: return 'Procesando...';
      case 4: return 'Completado';
      default: return '';
    }
  }
}