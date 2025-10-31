import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { InventoryService } from '../../services/inventory.service';
import { InventoryProduct, StockStatus } from '../../models/inventory.models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
})
export class InventoryPage implements OnInit, OnDestroy {
  filtersForm: FormGroup;
  inventory$!: Observable<InventoryProduct[]>;
  categories$ = this.inventoryService.getCategories();
  providers$ = this.inventoryService.getProviders();
  readonly statuses: Array<{ value: StockStatus; label: string }> = [
    { value: 'SUFFICIENT', label: 'Stock suficiente' },
    { value: 'LOW', label: 'Stock bajo' },
    { value: 'OUT', label: 'Agotado' },
    { value: 'EXPIRING', label: 'Proximo a vencer' },
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly inventoryService: InventoryService,
    public readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
  ) {
    this.filtersForm = this.fb.group({
      search: [''],
      category: [''],
      provider: [''],
      status: [''],
      expiryFrom: [''],
      expiryTo: [''],
    });
  }

  ngOnInit(): void {
    this.inventory$ = this.filtersForm.valueChanges.pipe(
      startWith(this.filtersForm.value),
      debounceTime(200),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      switchMap(filters => this.inventoryService.list({
        search: filters.search?.trim() || undefined,
        category: filters.category || undefined,
        provider: filters.provider || undefined,
        status: filters.status || undefined,
        expiryFrom: filters.expiryFrom || undefined,
        expiryTo: filters.expiryTo || undefined,
      })),
    );

    this.filtersForm.controls['expiryFrom'].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (value && this.filtersForm.value.expiryTo && value > this.filtersForm.value.expiryTo) {
          this.filtersForm.patchValue({ expiryTo: value }, { emitEvent: false });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByProduct(_: number, product: InventoryProduct): string {
    return product.id;
  }

  onCreateProduct(): void {
    this.router.navigate(['/inventory/product/new']);
  }

  onOpenProduct(product: InventoryProduct): void {
    this.router.navigate(['/inventory/product', product.id]);
  }

  async onExportCsv(): Promise<void> {
    const loading = await this.loadingCtrl.create({
      message: 'Exportando a CSV...',
    });
    await loading.present();

    try {
      const blob = await this.inventoryService.exportInventoryToCsv(this.filtersForm.value);
      const filename = `inventario_${this.getDateString()}.csv`;
      await this.downloadFile(blob, filename);
      await loading.dismiss();
    } catch (error: any) {
      await loading.dismiss();
      const errorMsg = error?.message || error?.toString() || 'Error desconocido';
      await this.showToast(`Error al exportar: ${errorMsg}`, 'danger');
    }
  }

  async onExportPdf(): Promise<void> {
    const loading = await this.loadingCtrl.create({
      message: 'Exportando a PDF...',
    });
    await loading.present();

    try {
      const blob = await this.inventoryService.exportInventoryToPdf(this.filtersForm.value);
      const filename = `inventario_${this.getDateString()}.pdf`;
      await this.downloadFile(blob, filename);
      await loading.dismiss();
    } catch (error: any) {
      await loading.dismiss();
      const errorMsg = error?.message || error?.toString() || 'Error desconocido';
      await this.showToast(`Error al exportar: ${errorMsg}`, 'danger');
    }
  }

  onClearFilters(): void {
    this.filtersForm.reset({
      search: '',
      category: '',
      provider: '',
      status: '',
      expiryFrom: '',
      expiryTo: '',
    });
  }

  statusColor(status: StockStatus): string {
    switch (status) {
      case 'LOW':
        return 'warning';
      case 'OUT':
        return 'danger';
      case 'EXPIRING':
        return 'tertiary';
      default:
        return 'success';
    }
  }

  statusLabel(status: StockStatus): string {
    return this.statuses.find(item => item.value === status)?.label ?? '';
  }

  private async downloadFile(blob: Blob, filename: string) {
    const platform = Capacitor.getPlatform();
    
    // Si estamos en Android o iOS, intentar guardar y compartir
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
        
        // Guardar archivo temporalmente
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache, // Usar Cache en lugar de Documents
        });
        
        // Obtener la URI del archivo guardado
        const fileUri = writeResult.uri;
        
        // Intentar compartir el archivo usando Share API
        try {
          const fileType = filename.endsWith('.csv') ? 'CSV' : 'PDF';
          await Share.share({
            title: 'Compartir archivo',
            text: `Archivo: ${filename}`,
            url: fileUri,
            dialogTitle: `Compartir archivo ${fileType}`,
          });
          
          await this.showToast('Archivo listo para compartir', 'success');
        } catch (shareError) {
          // Si Share falla, al menos el archivo está guardado
          await this.showToast(`Archivo guardado en caché: ${filename}`, 'success');
        }
        
        // También intentar mover a Documents después de un momento
        try {
          // Leer el archivo desde cache
          const fileData = await Filesystem.readFile({
            path: filename,
            directory: Directory.Cache,
          });
          
          // Escribir en Documents
          await Filesystem.writeFile({
            path: filename,
            data: fileData.data,
            directory: Directory.Documents,
          });
          
          // Eliminar de cache
          await Filesystem.deleteFile({
            path: filename,
            directory: Directory.Cache,
          });
        } catch (moveError) {
          // Si falla mover, no importa, el archivo está en cache
        }
        
      } catch (error: any) {
        // Si Filesystem falla, intentar compartir directamente desde el blob
        try {
          // Para compartir, necesitamos el archivo guardado
          // Si llegamos aquí, intentar método alternativo
          await this.showToast('Intentando método alternativo...', 'warning');
          
          // Convertir blob a data URL y compartir
          const base64 = await this.blobToBase64(blob);
          const dataUrl = `data:${blob.type};base64,${base64}`;
          
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
          resolve(base64Data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  }

  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
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






