import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertController, ToastController, IonicModule } from '@ionic/angular';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { startWith, switchMap, takeUntil, tap } from 'rxjs/operators';
import { InventoryProduct, StockStatus } from '../../models/inventory.models';
import { InventoryService } from '../../services/inventory.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
})
export class ProductDetailPage implements OnInit, OnDestroy {
  product$!: Observable<InventoryProduct | undefined>;
  movementForm: FormGroup;
  readonly statusLabels: Record<StockStatus, string> = {
    SUFFICIENT: 'Stock suficiente',
    LOW: 'Stock bajo',
    OUT: 'Agotado',
    EXPIRING: 'Proximo a vencer',
  };

  private productId!: string;
  private readonly destroy$ = new Subject<void>();
  private readonly refresh$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly inventoryService: InventoryService,
    private readonly toast: ToastController,
    private readonly alert: AlertController,
  ) {
    this.movementForm = this.fb.group({
      type: ['IN', Validators.required],
      reason: ['purchase', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      lotId: [''],
      note: [''],
      newLotNumber: [''],
      newLotExpiry: [''],
      newLotProvider: [''],
    });
  }

  ngOnInit(): void {
    this.product$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id) {
          this.router.navigate(['/inventory']);
          return of(undefined);
        }
        this.productId = id;
        return this.refresh$.pipe(
          startWith(void 0),
          switchMap(() => this.inventoryService.getById(id)),
        );
      }),
      tap(product => {
        if (!product) {
          void this.presentToast('No se encontro el producto.', 'danger');
          this.router.navigate(['/inventory']);
          return;
        }

        if (product.lots.length) {
          this.movementForm.patchValue({ lotId: product.lots[0].id }, { emitEvent: false });
        }
      }),
    );

    this.movementForm.controls['type'].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(type => {
        if (type === 'IN') {
          this.movementForm.controls['newLotNumber'].enable({ emitEvent: false });
          this.movementForm.controls['newLotExpiry'].enable({ emitEvent: false });
          this.movementForm.controls['newLotProvider'].enable({ emitEvent: false });
        } else {
          this.movementForm.controls['newLotNumber'].disable({ emitEvent: false });
          this.movementForm.controls['newLotExpiry'].disable({ emitEvent: false });
          this.movementForm.controls['newLotProvider'].disable({ emitEvent: false });
          this.movementForm.patchValue({ newLotNumber: '', newLotExpiry: '', newLotProvider: '' }, { emitEvent: false });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  lotLabel(lotNumber: string, provider?: string | null): string {
    return provider ? `${lotNumber} - ${provider}` : lotNumber;
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

  async recordMovement(product: InventoryProduct): Promise<void> {
    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      await this.presentToast('Completa los datos del movimiento.', 'warning');
      return;
    }

    const { type, reason, quantity, lotId, note, newLotNumber, newLotExpiry, newLotProvider } = this.movementForm.value;

    try {
      await firstValueFrom(
        this.inventoryService.recordMovement({
          productId: product.id,
          type,
          reason,
          quantity,
          lotId: lotId || undefined,
          note: note?.trim() || undefined,
          newLot:
            type === 'IN' && newLotNumber
              ? {
                  lotNumber: newLotNumber,
                  expiryDate: newLotExpiry || undefined,
                  provider: newLotProvider || undefined,
                }
              : undefined,
        }),
      );

      this.movementForm.patchValue({
        quantity: 1,
        note: '',
        newLotNumber: '',
        newLotExpiry: '',
        newLotProvider: '',
      });

      await this.presentToast('Movimiento registrado.', 'success');
      this.refresh$.next();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No fue posible registrar el movimiento.';
      await this.presentToast(message, 'danger');
    }
  }

  async deleteProduct(): Promise<void> {
    const alert = await this.alert.create({
      header: 'Confirmar eliminacion',
      message: 'Esta accion eliminara el producto y su historial. Continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await firstValueFrom(this.inventoryService.deleteProduct(this.productId));
              await this.presentToast('Producto eliminado.', 'success');
              this.router.navigate(['/inventory']);
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'No fue posible eliminar el producto.';
              await this.presentToast(message, 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  goToEdition(): void {
    this.router.navigate(['/inventory/product', this.productId, 'edit']);
  }

  cancel(): void {
    this.router.navigate(['/inventory']);
  }

  trackByLot(_: number, lot: { id: string }): string {
    return lot.id;
  }

  trackByMovement(_: number, movement: { id: string }): string {
    return movement.id;
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toast.create({
      message,
      duration: 2500,
      position: 'top',
      color,
    });
    await toast.present();
  }
}




