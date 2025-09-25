import { NgModule } from '@angular/core';

import { InventoryRoutingModule } from './inventory-routing.module';
import { InventoryPage } from './pages/inventory/inventory.page';
import { ProductDetailPage } from './pages/product-detail/product-detail.page';
import { ProductFormPage } from './pages/product-form/product-form.page';

@NgModule({
  imports: [
    InventoryRoutingModule,
    InventoryPage,
    ProductDetailPage,
    ProductFormPage,
  ],
})
export class InventoryModule {}
