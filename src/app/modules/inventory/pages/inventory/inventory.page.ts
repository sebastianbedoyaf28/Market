import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, startWith, switchMap, takeUntil } from 'rxjs/operators';
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
    const blob = await this.inventoryService.exportInventoryToCsv(this.filtersForm.value);
    this.downloadBlob(blob, `inventario-${Date.now()}.csv`);
  }

  async onExportPdf(): Promise<void> {
    const blob = await this.inventoryService.exportInventoryToPdf(this.filtersForm.value);
    this.downloadBlob(blob, `inventario-${Date.now()}.pdf`);
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

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}






