import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastController, IonicModule } from '@ionic/angular';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { CreateInventoryProductDto, InventoryLotInput, InventoryProduct, UpdateInventoryProductDto } from '../../models/inventory.models';
import { InventoryService } from '../../services/inventory.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  templateUrl: './product-form.page.html',
  styleUrls: ['./product-form.page.scss'],
})
export class ProductFormPage implements OnInit, OnDestroy {
  form: FormGroup;
  mode: 'create' | 'edit' = 'create';
  product$!: Observable<InventoryProduct | undefined>;
  private productId: string | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly inventoryService: InventoryService,
    private readonly toast: ToastController,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      sku: ['', [Validators.required, Validators.minLength(3)]],
      category: ['', Validators.required],
      provider: ['', Validators.required],
      costPrice: [0, [Validators.required, Validators.min(0)]],
      salePrice: [0, [Validators.required, Validators.min(0)]],
      imageUrl: [''],
      lots: this.fb.array([this.createLotGroup()]),
    });
  }

  ngOnInit(): void {
    this.product$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id || id === 'new') {
          this.mode = 'create';
          return of(undefined);
        }
        this.mode = 'edit';
        this.productId = id;
        return this.inventoryService.getById(id);
      }),
      tap(product => {
        if (this.mode === 'edit') {
          if (!product) {
            void this.presentToast('El producto no existe.', 'danger');
            this.router.navigate(['/inventory']);
            return;
          }

          this.form.patchValue({
            name: product.name,
            sku: product.sku,
            category: product.category,
            provider: product.provider,
            costPrice: product.costPrice,
            salePrice: product.salePrice,
            imageUrl: product.imageUrl ?? '',
          });

          this.form.setControl(
            'lots',
            this.fb.array(
              product.lots.map(lot => this.createLotGroup({
                id: lot.id,
                lotNumber: lot.lotNumber,
                quantity: lot.quantity,
                expiryDate: lot.expiryDate ?? '',
                provider: lot.provider ?? '',
              })),
            ),
          );
        }
      }),
    );

    this.form.controls['costPrice'].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(cost => {
        const saleControl = this.form.controls['salePrice'];
        if (saleControl.value < cost) {
          saleControl.setValue(cost, { emitEvent: false });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get lots(): FormArray {
    return this.form.get('lots') as FormArray;
  }

  addLot(): void {
    this.lots.push(this.createLotGroup());
  }

  removeLot(index: number): void {
    if (this.lots.length === 1) {
      void this.presentToast('Debe existir al menos un lote.', 'warning');
      return;
    }
    this.lots.removeAt(index);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.presentToast('Revisa los campos obligatorios.', 'warning');
      return;
    }

    const payload = this.buildPayload();

    try {
      if (this.mode === 'create') {
        await firstValueFrom(this.inventoryService.createProduct(payload as CreateInventoryProductDto));
        await this.presentToast('Producto creado.', 'success');
        this.router.navigate(['/inventory']);
      } else if (this.productId) {
        await firstValueFrom(this.inventoryService.updateProduct(this.productId, payload as UpdateInventoryProductDto));
        await this.presentToast('Producto actualizado.', 'success');
        this.router.navigate(['/inventory/product', this.productId]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar el producto.';
      await this.presentToast(message, 'danger');
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  private createLotGroup(data?: { id?: string | null; lotNumber?: string; quantity?: number; expiryDate?: string; provider?: string }): FormGroup {
    return this.fb.group({
      id: [data?.id ?? null],
      lotNumber: [data?.lotNumber ?? '', Validators.required],
      quantity: [data?.quantity ?? 0, [Validators.required, Validators.min(0)]],
      expiryDate: [data?.expiryDate ?? ''],
      provider: [data?.provider ?? ''],
    });
  }

  private buildPayload(): CreateInventoryProductDto | UpdateInventoryProductDto {
    const formValue = this.form.value;
    const lots: InventoryLotInput[] = formValue.lots.map((lot: any) => ({
      id: lot.id || undefined,
      lotNumber: lot.lotNumber,
      quantity: Number(lot.quantity),
      expiryDate: lot.expiryDate || undefined,
      provider: lot.provider || undefined,
    }));

    return {
      name: formValue.name.trim(),
      sku: formValue.sku.trim().toUpperCase(),
      category: formValue.category.trim(),
      provider: formValue.provider.trim(),
      costPrice: Number(formValue.costPrice),
      salePrice: Number(formValue.salePrice),
      imageUrl: formValue.imageUrl?.trim() || undefined,
      lots,
    };
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



